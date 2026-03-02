/**
 * Rei Kernel — Fault Recovery（障害回復）
 * 公理ベースの自動修復エンジン
 *
 * D-FUMT 公理対応:
 *   A2: Extension-Reduction — 障害ノードの自動縮約と代替ノードの拡張
 *   A3: Sigma-Accumulation — σ停滞をトリガーとした障害検知
 *
 * 既存 Watchdog との違い:
 *   Watchdog     = エラー分類 + メモリ監視 + Circuit Breaker（受動的）
 *   FaultRecovery = σ停滞検知 + 自動縮約 + 代替生成 + 回復戦略（能動的）
 *
 * 回復戦略（公理から導出）:
 *   1. Retry      — 一時的障害 → 再試行（既存Watchdogのリトライ拡張）
 *   2. Reduce     — 持続的障害 → A2 Reduction（ノード縮約）
 *   3. Reroute    — 代替ノード → A2 Extension（別経路で拡張）
 *   4. Escalate   — 回復不能 → 上位層に報告
 *   5. Hibernate  — リソース不足 → 一時休眠
 */

import { EventEmitter } from 'events';

// ─── 型定義 ────────────────────────────────────────────

/** 障害種別 */
export type FaultType =
  | 'sigma-stagnation'    // σ停滞（A3 蓄積が進まない）
  | 'execution-error'     // 実行エラー
  | 'timeout'             // タイムアウト
  | 'dependency-failure'  // 依存ノードの障害
  | 'resource-exhaustion' // リソース枯渇
  | 'boundary-violation'  // 層間境界違反
  | 'ipc-failure'         // 通信障害
  | 'infinite-expansion'  // 無限拡散（拡散方向が際限なく増える）
  | 'contradiction';      // 矛盾検出（公理的整合性の破れ）

/** 回復戦略 */
export type RecoveryStrategy =
  | 'retry'       // 再試行
  | 'reduce'      // 縮約（A2 Reduction）
  | 'reroute'     // 代替経路（A2 Extension）
  | 'escalate'    // 上位層に報告
  | 'hibernate';  // 一時休眠

/** 障害レコード */
export interface FaultRecord {
  id: string;
  nodeId: string;
  nodeName: string;
  faultType: FaultType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  context?: any;
  detectedAt: number;
  /** 選択された回復戦略 */
  strategy: RecoveryStrategy;
  /** 回復試行回数 */
  recoveryAttempts: number;
  /** 回復成功したか */
  resolved: boolean;
  resolvedAt?: number;
}

/** 回復アクションの結果 */
export interface RecoveryResult {
  faultId: string;
  strategy: RecoveryStrategy;
  success: boolean;
  message: string;
  /** 代替ノードID（reroute時） */
  replacementNodeId?: string;
}

/** Fault Recovery 設定 */
export interface FaultRecoveryConfig {
  /** σ停滞の判定閾値（ms） */
  stagnationThresholdMs: number;
  /** σ変化量の停滞閾値 */
  stagnationDeltaMin: number;
  /** 最大リトライ回数 */
  maxRetries: number;
  /** リトライベース間隔（ms、指数バックオフ） */
  retryBaseMs: number;
  /** 拡散方向数の上限（これを超えたら infinite-expansion） */
  maxFlowDirections: number;
  /** 障害履歴の最大保持数 */
  maxHistorySize: number;
  /** 自動縮約を有効にするか */
  enableAutoReduction: boolean;
  log?: (msg: string) => void;
}

const DEFAULT_CONFIG: FaultRecoveryConfig = {
  stagnationThresholdMs: 30000,
  stagnationDeltaMin: 0.005,
  maxRetries: 3,
  retryBaseMs: 2000,
  maxFlowDirections: 512,
  maxHistorySize: 500,
  enableAutoReduction: true,
};

/** 障害種別 → 回復戦略の決定テーブル */
const STRATEGY_TABLE: Record<FaultType, { primary: RecoveryStrategy; fallback: RecoveryStrategy }> = {
  'sigma-stagnation':    { primary: 'retry',     fallback: 'reduce' },
  'execution-error':     { primary: 'retry',     fallback: 'reroute' },
  'timeout':             { primary: 'retry',     fallback: 'reroute' },
  'dependency-failure':  { primary: 'reroute',   fallback: 'escalate' },
  'resource-exhaustion': { primary: 'hibernate',  fallback: 'reduce' },
  'boundary-violation':  { primary: 'reduce',    fallback: 'escalate' },
  'ipc-failure':         { primary: 'retry',     fallback: 'reroute' },
  'infinite-expansion':  { primary: 'reduce',    fallback: 'hibernate' },
  'contradiction':       { primary: 'escalate',  fallback: 'reduce' },
};

/** 障害種別 → 重大度の判定 */
const SEVERITY_MAP: Record<FaultType, FaultRecord['severity']> = {
  'sigma-stagnation':    'medium',
  'execution-error':     'medium',
  'timeout':             'low',
  'dependency-failure':  'high',
  'resource-exhaustion': 'high',
  'boundary-violation':  'high',
  'ipc-failure':         'medium',
  'infinite-expansion':  'critical',
  'contradiction':       'critical',
};

// ─── FaultRecovery クラス ──────────────────────────────

export class FaultRecovery extends EventEmitter {
  private config: FaultRecoveryConfig;
  private log: (msg: string) => void;
  private faults: FaultRecord[] = [];
  private faultCounter = 0;
  private activeFaults = new Map<string, FaultRecord>(); // nodeId → latest fault
  private retryCounters = new Map<string, number>(); // nodeId → retry count

  // 外部注入用のコールバック
  private onReduceNode?: (nodeId: string) => Promise<void>;
  private onRerouteNode?: (nodeId: string) => Promise<string | null>; // returns replacement nodeId
  private onHibernateNode?: (nodeId: string) => Promise<void>;
  private onEscalate?: (fault: FaultRecord) => Promise<void>;

  constructor(config?: Partial<FaultRecoveryConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.log = config?.log || ((msg) => console.log(`[FaultRecovery] ${msg}`));
  }

  // ─── 外部コールバック登録 ────────────────────────────

  setHandlers(handlers: {
    onReduce?: (nodeId: string) => Promise<void>;
    onReroute?: (nodeId: string) => Promise<string | null>;
    onHibernate?: (nodeId: string) => Promise<void>;
    onEscalate?: (fault: FaultRecord) => Promise<void>;
  }): void {
    this.onReduceNode = handlers.onReduce;
    this.onRerouteNode = handlers.onReroute;
    this.onHibernateNode = handlers.onHibernate;
    this.onEscalate = handlers.onEscalate;
  }

  // ─── 障害検出 ────────────────────────────────────────

  /**
   * σ停滞を検出する。
   * NodeScheduler から定期的に呼ばれることを想定。
   */
  detectSigmaStagnation(nodeId: string, nodeName: string, sigmaHistory: Array<{
    timestamp: number;
    sigma: number;
    delta: number;
  }>): FaultRecord | null {
    if (sigmaHistory.length < 2) return null;

    const now = Date.now();
    const latest = sigmaHistory[sigmaHistory.length - 1];
    const elapsed = now - latest.timestamp;

    // 時間閾値未満ならまだ判定しない
    if (elapsed < this.config.stagnationThresholdMs) return null;

    // 直近3件のδ平均を確認
    const recentDeltas = sigmaHistory.slice(-3).map(s => Math.abs(s.delta));
    const avgDelta = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length;

    if (avgDelta > this.config.stagnationDeltaMin) return null;

    // 停滞確定
    return this.reportFault(nodeId, nodeName, 'sigma-stagnation',
      `σ停滞検出: 直近Δ平均=${avgDelta.toFixed(4)}, 経過=${Math.round(elapsed / 1000)}秒`
    );
  }

  /**
   * 無限拡散を検出する。
   */
  detectInfiniteExpansion(nodeId: string, nodeName: string, flowDirections: number): FaultRecord | null {
    if (flowDirections <= this.config.maxFlowDirections) return null;

    return this.reportFault(nodeId, nodeName, 'infinite-expansion',
      `拡散方向数が上限超過: ${flowDirections} > ${this.config.maxFlowDirections}`
    );
  }

  /**
   * 汎用障害報告
   */
  reportFault(nodeId: string, nodeName: string, faultType: FaultType, message: string, context?: any): FaultRecord {
    const severity = SEVERITY_MAP[faultType];
    const strategy = this.selectStrategy(nodeId, faultType);

    const fault: FaultRecord = {
      id: `fault-${++this.faultCounter}`,
      nodeId,
      nodeName,
      faultType,
      severity,
      message,
      context,
      detectedAt: Date.now(),
      strategy,
      recoveryAttempts: 0,
      resolved: false,
    };

    this.faults.push(fault);
    if (this.faults.length > this.config.maxHistorySize) {
      this.faults = this.faults.slice(-this.config.maxHistorySize);
    }

    this.activeFaults.set(nodeId, fault);

    this.emit('fault:detected', fault);
    this.log(`⚠ Fault detected: [${severity}] ${faultType} on ${nodeName} — ${message}`);

    return fault;
  }

  // ─── 回復戦略選択 ────────────────────────────────────

  /**
   * 障害種別とリトライ履歴から最適な回復戦略を選択する
   */
  private selectStrategy(nodeId: string, faultType: FaultType): RecoveryStrategy {
    const retries = this.retryCounters.get(nodeId) || 0;
    const table = STRATEGY_TABLE[faultType];

    // リトライ上限を超えている場合はフォールバック戦略
    if (retries >= this.config.maxRetries) {
      this.log(`  Retry limit reached for ${nodeId} — switching to ${table.fallback}`);
      return table.fallback;
    }

    return table.primary;
  }

  // ─── 回復実行 ────────────────────────────────────────

  /**
   * 障害に対して回復アクションを実行する
   */
  async recover(faultId: string): Promise<RecoveryResult> {
    const fault = this.faults.find(f => f.id === faultId);
    if (!fault) {
      return { faultId, strategy: 'escalate', success: false, message: 'Fault not found' };
    }

    fault.recoveryAttempts++;
    this.log(`Recovery attempt ${fault.recoveryAttempts} for ${fault.nodeName}: strategy=${fault.strategy}`);

    let result: RecoveryResult;

    switch (fault.strategy) {
      case 'retry':
        result = await this.executeRetry(fault);
        break;
      case 'reduce':
        result = await this.executeReduce(fault);
        break;
      case 'reroute':
        result = await this.executeReroute(fault);
        break;
      case 'hibernate':
        result = await this.executeHibernate(fault);
        break;
      case 'escalate':
        result = await this.executeEscalate(fault);
        break;
      default:
        result = { faultId, strategy: fault.strategy, success: false, message: 'Unknown strategy' };
    }

    if (result.success) {
      fault.resolved = true;
      fault.resolvedAt = Date.now();
      this.activeFaults.delete(fault.nodeId);
      this.retryCounters.delete(fault.nodeId);
      this.emit('fault:resolved', { faultId, strategy: result.strategy });
      this.log(`✅ Fault resolved: ${faultId} via ${result.strategy}`);
    } else {
      // 戦略をフォールバックに切り替え
      const table = STRATEGY_TABLE[fault.faultType];
      if (fault.strategy === table.primary) {
        fault.strategy = table.fallback;
        this.log(`  Switching to fallback strategy: ${fault.strategy}`);
      }
      this.emit('fault:recovery-failed', { faultId, strategy: result.strategy, message: result.message });
    }

    return result;
  }

  /**
   * 全アクティブ障害に対して自動回復を試みる
   */
  async autoRecover(): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = [];
    for (const fault of this.activeFaults.values()) {
      if (fault.resolved) continue;
      const result = await this.recover(fault.id);
      results.push(result);
    }
    return results;
  }

  // ─── 回復アクション実装 ──────────────────────────────

  private async executeRetry(fault: FaultRecord): Promise<RecoveryResult> {
    const retries = (this.retryCounters.get(fault.nodeId) || 0) + 1;
    this.retryCounters.set(fault.nodeId, retries);

    if (retries > this.config.maxRetries) {
      return {
        faultId: fault.id,
        strategy: 'retry',
        success: false,
        message: `Retry limit exceeded (${retries}/${this.config.maxRetries})`,
      };
    }

    // 指数バックオフで待機
    const delay = this.config.retryBaseMs * Math.pow(2, retries - 1);
    this.log(`  Retry ${retries}: waiting ${delay}ms...`);
    await new Promise(r => setTimeout(r, delay));

    // リトライ自体は成功を返す（実際の再実行はNodeSchedulerが行う）
    this.emit('recovery:retry', { nodeId: fault.nodeId, attempt: retries });
    return {
      faultId: fault.id,
      strategy: 'retry',
      success: true,
      message: `Retry scheduled (attempt ${retries})`,
    };
  }

  private async executeReduce(fault: FaultRecord): Promise<RecoveryResult> {
    if (!this.config.enableAutoReduction) {
      return {
        faultId: fault.id,
        strategy: 'reduce',
        success: false,
        message: 'Auto-reduction is disabled',
      };
    }

    if (this.onReduceNode) {
      try {
        await this.onReduceNode(fault.nodeId);
        this.emit('recovery:reduced', { nodeId: fault.nodeId });
        return {
          faultId: fault.id,
          strategy: 'reduce',
          success: true,
          message: `Node ${fault.nodeId} reduced (A2 Reduction)`,
        };
      } catch (err: any) {
        return {
          faultId: fault.id,
          strategy: 'reduce',
          success: false,
          message: `Reduction failed: ${err.message}`,
        };
      }
    }

    return {
      faultId: fault.id,
      strategy: 'reduce',
      success: false,
      message: 'No reduce handler registered',
    };
  }

  private async executeReroute(fault: FaultRecord): Promise<RecoveryResult> {
    if (this.onRerouteNode) {
      try {
        const replacementId = await this.onRerouteNode(fault.nodeId);
        if (replacementId) {
          this.emit('recovery:rerouted', { nodeId: fault.nodeId, replacementId });
          return {
            faultId: fault.id,
            strategy: 'reroute',
            success: true,
            message: `Rerouted to ${replacementId} (A2 Extension)`,
            replacementNodeId: replacementId,
          };
        }
      } catch (err: any) {
        return {
          faultId: fault.id,
          strategy: 'reroute',
          success: false,
          message: `Reroute failed: ${err.message}`,
        };
      }
    }

    return {
      faultId: fault.id,
      strategy: 'reroute',
      success: false,
      message: 'No reroute handler or no replacement available',
    };
  }

  private async executeHibernate(fault: FaultRecord): Promise<RecoveryResult> {
    if (this.onHibernateNode) {
      try {
        await this.onHibernateNode(fault.nodeId);
        this.emit('recovery:hibernated', { nodeId: fault.nodeId });
        return {
          faultId: fault.id,
          strategy: 'hibernate',
          success: true,
          message: `Node ${fault.nodeId} hibernated`,
        };
      } catch (err: any) {
        return {
          faultId: fault.id,
          strategy: 'hibernate',
          success: false,
          message: `Hibernation failed: ${err.message}`,
        };
      }
    }

    return {
      faultId: fault.id,
      strategy: 'hibernate',
      success: false,
      message: 'No hibernate handler registered',
    };
  }

  private async executeEscalate(fault: FaultRecord): Promise<RecoveryResult> {
    if (this.onEscalate) {
      try {
        await this.onEscalate(fault);
        this.emit('recovery:escalated', fault);
        return {
          faultId: fault.id,
          strategy: 'escalate',
          success: true,
          message: `Escalated to upper layer: ${fault.faultType}`,
        };
      } catch (err: any) {
        return {
          faultId: fault.id,
          strategy: 'escalate',
          success: false,
          message: `Escalation failed: ${err.message}`,
        };
      }
    }

    // エスカレーションハンドラがなくてもログに記録
    this.log(`🔴 ESCALATION: ${fault.faultType} on ${fault.nodeName} — ${fault.message}`);
    return {
      faultId: fault.id,
      strategy: 'escalate',
      success: true,
      message: 'Escalation logged (no handler)',
    };
  }

  // ─── 照会API ────────────────────────────────────────

  getActiveFaults(): FaultRecord[] {
    return Array.from(this.activeFaults.values());
  }

  getFaultHistory(limit = 50): FaultRecord[] {
    return this.faults.slice(-limit);
  }

  getFaultsByNode(nodeId: string): FaultRecord[] {
    return this.faults.filter(f => f.nodeId === nodeId);
  }

  getStats(): {
    totalFaults: number;
    activeFaults: number;
    resolvedFaults: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    avgResolutionTimeMs: number;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const resolutionTimes: number[] = [];

    for (const fault of this.faults) {
      byType[fault.faultType] = (byType[fault.faultType] || 0) + 1;
      bySeverity[fault.severity] = (bySeverity[fault.severity] || 0) + 1;
      if (fault.resolved && fault.resolvedAt) {
        resolutionTimes.push(fault.resolvedAt - fault.detectedAt);
      }
    }

    return {
      totalFaults: this.faults.length,
      activeFaults: this.activeFaults.size,
      resolvedFaults: this.faults.filter(f => f.resolved).length,
      byType,
      bySeverity,
      avgResolutionTimeMs: resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : 0,
    };
  }

  destroy(): void {
    this.faults = [];
    this.activeFaults.clear();
    this.retryCounters.clear();
    this.removeAllListeners();
  }
}
