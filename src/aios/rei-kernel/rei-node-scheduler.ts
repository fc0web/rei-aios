/**
 * Rei Kernel — Node Scheduler（ノードスケジューラ）
 * 
 * D-FUMT 公理対応:
 *   A1: Center-Periphery — スケジューラ（中心）がノード群（周囲）を管理
 *   A2: Extension-Reduction — ノード数の動的拡張・縮約
 *   A3: Sigma-Accumulation — σ蓄積速度による優先度決定
 *   A4: Genesis — 新規ノードの自動生成
 *
 * 既存 TaskScheduler との違い:
 *   TaskScheduler = 時間/イベント駆動の「いつ実行するか」
 *   NodeScheduler = σ/κ駆動の「どのノードを優先するか」
 *
 * 6属性との対応:
 *   場(field)   → ノードが所属する計算空間
 *   流れ(flow)  → 拡散方向と速度
 *   記憶(memory) → σ蓄積履歴
 *   層(layer)   → ノードの階層位置
 *   関係(relation) → ノード間の依存関係
 *   意志(will)  → 目標とする収束条件
 */

import { EventEmitter } from 'events';

// ─── 型定義 ────────────────────────────────────────────

/** 計算ノードの状態 */
export type NodeState =
  | 'pending'      // 生成済み・未開始
  | 'expanding'    // 拡散中（A2 Extension）
  | 'converging'   // 収束中
  | 'converged'    // 収束完了
  | 'stagnant'     // 停滞（σ変化なし）
  | 'reduced'      // 縮約済み（A2 Reduction）
  | 'error';

/** 6属性を持つ計算ノード */
export interface ComputeNode {
  /** ノード一意ID */
  id: string;
  /** 表示名 */
  name: string;
  /** 状態 */
  state: NodeState;

  // ─── 6属性 ───
  /** 場: 所属する計算空間ID */
  fieldId: string;
  /** 流れ: 現在の拡散方向数 */
  flowDirections: number;
  /** 記憶: σ蓄積履歴 */
  sigmaHistory: SigmaSnapshot[];
  /** 層: 階層位置（0=表層, 1=中層, 2=深層...） */
  layerId: number;
  /** 関係: 依存ノードID群 */
  dependencies: string[];
  /** 意志: 収束条件 */
  convergenceGoal: string;

  // ─── スケジューリング指標 ───
  /** 現在のσ値（0〜1） */
  sigma: number;
  /** σ変化速度（直近の差分/時間） */
  sigmaVelocity: number;
  /** κ（曲率）: 操作の影響度（0〜1） */
  kappa: number;
  /** 計算された優先度スコア */
  priority: number;
  /** 最終更新時刻 */
  lastUpdatedAt: number;
  /** 生成時刻 */
  createdAt: number;
  /** 実行関数 */
  execute: () => Promise<NodeExecutionResult>;
}

/** σスナップショット */
export interface SigmaSnapshot {
  timestamp: number;
  sigma: number;
  delta: number;
}

/** ノード実行結果 */
export interface NodeExecutionResult {
  nodeId: string;
  success: boolean;
  sigma: number;
  output?: any;
  /** 子ノード生成要求（A4 Genesis） */
  spawnRequests?: SpawnRequest[];
  error?: string;
}

/** 子ノード生成要求 */
export interface SpawnRequest {
  name: string;
  fieldId: string;
  layerId: number;
  convergenceGoal: string;
  kappa: number;
  execute: () => Promise<NodeExecutionResult>;
}

/** スケジューラ設定 */
export interface NodeSchedulerConfig {
  /** 最大同時実行ノード数 */
  maxConcurrent: number;
  /** σ停滞判定の閾値（ms） */
  stagnationThresholdMs: number;
  /** σ停滞判定のδ閾値（この値以下なら停滞） */
  stagnationDeltaThreshold: number;
  /** スケジューリング間隔（ms） */
  tickIntervalMs: number;
  /** 優先度計算の重み */
  weights: {
    sigmaVelocity: number;  // σ変化速度の重み
    kappa: number;          // κ（影響度）の重み
    age: number;            // 待機時間の重み
    layerDepth: number;     // 深い層ほど優先（深層計算は重要）
  };
  log?: (msg: string) => void;
}

const DEFAULT_CONFIG: NodeSchedulerConfig = {
  maxConcurrent: 4,
  stagnationThresholdMs: 30000,   // 30秒
  stagnationDeltaThreshold: 0.01,
  tickIntervalMs: 1000,
  weights: {
    sigmaVelocity: 0.35,
    kappa: 0.30,
    age: 0.15,
    layerDepth: 0.20,
  },
};

// ─── NodeScheduler クラス ──────────────────────────────

export class NodeScheduler extends EventEmitter {
  private nodes = new Map<string, ComputeNode>();
  private running = new Set<string>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private config: NodeSchedulerConfig;
  private log: (msg: string) => void;
  private nodeCounter = 0;
  private started = false;

  constructor(config?: Partial<NodeSchedulerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.log = config?.log || ((msg) => console.log(`[NodeScheduler] ${msg}`));
  }

  // ─── ノード登録 ──────────────────────────────────────

  /**
   * 計算ノードを登録する。
   * A1: 中心（スケジューラ）に周囲（ノード）が加わる。
   */
  registerNode(params: {
    name: string;
    fieldId: string;
    layerId: number;
    convergenceGoal: string;
    kappa: number;
    dependencies?: string[];
    execute: () => Promise<NodeExecutionResult>;
  }): string {
    const id = `node-${++this.nodeCounter}-${Date.now()}`;
    const now = Date.now();

    const node: ComputeNode = {
      id,
      name: params.name,
      state: 'pending',
      fieldId: params.fieldId,
      flowDirections: 8, // 初期は8方向
      sigmaHistory: [{ timestamp: now, sigma: 0, delta: 0 }],
      layerId: params.layerId,
      dependencies: params.dependencies || [],
      convergenceGoal: params.convergenceGoal,
      sigma: 0,
      sigmaVelocity: 0,
      kappa: params.kappa,
      priority: 0,
      lastUpdatedAt: now,
      createdAt: now,
      execute: params.execute,
    };

    this.nodes.set(id, node);
    this.recalcPriority(node);
    this.emit('node:registered', { nodeId: id, name: params.name });
    this.log(`Node registered: ${id} (${params.name}) κ=${params.kappa}`);
    return id;
  }

  /**
   * ノードを削除する（A2 Reduction）。
   */
  removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.state = 'reduced';
    this.running.delete(nodeId);
    this.nodes.delete(nodeId);
    this.emit('node:removed', { nodeId, reason: 'manual' });
    this.log(`Node removed: ${nodeId} (${node.name})`);
    return true;
  }

  // ─── スケジューラ起動・停止 ──────────────────────────

  start(): void {
    if (this.started) return;
    this.started = true;

    this.tickTimer = setInterval(() => this.tick(), this.config.tickIntervalMs);
    this.log(`Scheduler started. Nodes: ${this.nodes.size}, MaxConcurrent: ${this.config.maxConcurrent}`);
    this.emit('scheduler:started');
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.log('Scheduler stopped.');
    this.emit('scheduler:stopped');
  }

  // ─── スケジューリングティック ────────────────────────

  /**
   * 毎ティック:
   * 1. 全ノードの優先度を再計算
   * 2. 停滞ノードを検出
   * 3. 依存関係を確認
   * 4. 空きスロットに最高優先ノードを割り当て
   */
  private async tick(): Promise<void> {
    // 1. 優先度再計算
    for (const node of this.nodes.values()) {
      this.recalcPriority(node);
    }

    // 2. 停滞検出
    this.detectStagnation();

    // 3. 実行可能ノードを優先度順に取得
    const runnableNodes = this.getRunnableNodes();

    // 4. 空きスロットに割り当て
    const availableSlots = this.config.maxConcurrent - this.running.size;
    const toRun = runnableNodes.slice(0, availableSlots);

    for (const node of toRun) {
      this.executeNode(node);
    }

    this.emit('scheduler:tick', {
      totalNodes: this.nodes.size,
      runningNodes: this.running.size,
      runnableNodes: runnableNodes.length,
      dispatched: toRun.length,
    });
  }

  // ─── 優先度計算 ──────────────────────────────────────

  /**
   * 優先度 = σ変化速度 × w1 + κ × w2 + 待機時間 × w3 + 層深度 × w4
   *
   * σ変化速度が高い = 順調に進んでいる → 優先的にリソースを与えてさらに加速
   * κが高い = 影響度が大きい → 優先
   * 待機時間が長い = 飢餓防止
   * 層深度が深い = 根本的な計算 → 優先
   */
  private recalcPriority(node: ComputeNode): void {
    const { weights } = this.config;
    const now = Date.now();

    // σ変化速度の正規化（0〜1）
    const vNorm = Math.min(1, Math.max(0, node.sigmaVelocity * 10));

    // 待機時間の正規化（最大60秒を1.0とする）
    const ageMs = now - node.lastUpdatedAt;
    const ageNorm = Math.min(1, ageMs / 60000);

    // 層深度の正規化（0〜1、深いほど高い）
    const layerNorm = Math.min(1, node.layerId / 5);

    node.priority =
      vNorm * weights.sigmaVelocity +
      node.kappa * weights.kappa +
      ageNorm * weights.age +
      layerNorm * weights.layerDepth;
  }

  // ─── 停滞検出 ────────────────────────────────────────

  /**
   * σ蓄積が一定時間変化しないノードを「停滞」と判定。
   * → A2 Reduction の候補としてマークする。
   */
  private detectStagnation(): void {
    const now = Date.now();
    for (const node of this.nodes.values()) {
      if (node.state !== 'expanding') continue;

      const elapsed = now - node.lastUpdatedAt;
      if (elapsed < this.config.stagnationThresholdMs) continue;

      // 直近のσ変化量を確認
      const recentHistory = node.sigmaHistory.slice(-3);
      const avgDelta = recentHistory.length > 0
        ? recentHistory.reduce((sum, s) => sum + Math.abs(s.delta), 0) / recentHistory.length
        : 0;

      if (avgDelta <= this.config.stagnationDeltaThreshold) {
        node.state = 'stagnant';
        this.emit('node:stagnant', {
          nodeId: node.id,
          name: node.name,
          elapsed,
          avgDelta,
        });
        this.log(`⚠ Node stagnant: ${node.id} (${node.name}) — σΔ=${avgDelta.toFixed(4)} for ${elapsed}ms`);
      }
    }
  }

  // ─── 実行可能ノード取得 ──────────────────────────────

  /**
   * 実行可能 = pending/expanding かつ依存関係が満たされている
   * 優先度降順でソート
   */
  private getRunnableNodes(): ComputeNode[] {
    const runnable: ComputeNode[] = [];

    for (const node of this.nodes.values()) {
      // 既に実行中なら除外
      if (this.running.has(node.id)) continue;

      // 状態チェック
      if (node.state !== 'pending' && node.state !== 'expanding') continue;

      // 依存関係チェック
      if (!this.areDependenciesMet(node)) continue;

      runnable.push(node);
    }

    // 優先度降順
    return runnable.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 全依存ノードが converged 状態であるか確認
   */
  private areDependenciesMet(node: ComputeNode): boolean {
    for (const depId of node.dependencies) {
      const dep = this.nodes.get(depId);
      if (!dep || dep.state !== 'converged') return false;
    }
    return true;
  }

  // ─── ノード実行 ──────────────────────────────────────

  private async executeNode(node: ComputeNode): Promise<void> {
    this.running.add(node.id);
    node.state = 'expanding';
    node.flowDirections = Math.min(node.flowDirections * 2, 256); // 拡散方向を倍増
    this.emit('node:executing', { nodeId: node.id, name: node.name });

    try {
      const result = await node.execute();
      const now = Date.now();
      const prevSigma = node.sigma;

      // σ更新
      node.sigma = result.sigma;
      const delta = result.sigma - prevSigma;
      node.sigmaVelocity = delta / Math.max(1, (now - node.lastUpdatedAt) / 1000);
      node.sigmaHistory.push({ timestamp: now, sigma: result.sigma, delta });

      // 履歴の制限（最大100件）
      if (node.sigmaHistory.length > 100) {
        node.sigmaHistory = node.sigmaHistory.slice(-100);
      }

      node.lastUpdatedAt = now;

      if (result.success && result.sigma >= 1.0) {
        // 収束完了
        node.state = 'converged';
        node.flowDirections = 1; // 収束 = 方向が1つに
        this.emit('node:converged', { nodeId: node.id, name: node.name, sigma: node.sigma });
        this.log(`✅ Node converged: ${node.id} (${node.name}) σ=${node.sigma.toFixed(3)}`);
      } else if (!result.success) {
        node.state = 'error';
        this.emit('node:error', { nodeId: node.id, error: result.error });
        this.log(`❌ Node error: ${node.id} — ${result.error}`);
      }
      // else: state は expanding のまま次のティックへ

      // A4 Genesis: 子ノード生成
      if (result.spawnRequests) {
        for (const req of result.spawnRequests) {
          const childId = this.registerNode({
            ...req,
            dependencies: [node.id], // 親ノードに依存しない（並行実行）
          });
          this.log(`  ↳ Spawned child: ${childId} (${req.name})`);
        }
      }

    } catch (err: any) {
      node.state = 'error';
      this.emit('node:error', { nodeId: node.id, error: err.message });
      this.log(`❌ Node execution failed: ${node.id} — ${err.message}`);
    } finally {
      this.running.delete(node.id);
    }
  }

  // ─── 外部API ────────────────────────────────────────

  /**
   * 外部からσを更新する（手動進捗報告）
   */
  updateSigma(nodeId: string, sigma: number, note?: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const now = Date.now();
    const delta = sigma - node.sigma;
    node.sigma = sigma;
    node.sigmaVelocity = delta / Math.max(1, (now - node.lastUpdatedAt) / 1000);
    node.sigmaHistory.push({ timestamp: now, sigma, delta });
    node.lastUpdatedAt = now;

    if (sigma >= 1.0) {
      node.state = 'converged';
    }

    this.emit('node:sigma-updated', { nodeId, sigma, delta, note });
  }

  /**
   * 停滞ノードを強制縮約する（A2 Reduction）
   */
  reduceStagnantNodes(): string[] {
    const reduced: string[] = [];
    for (const node of this.nodes.values()) {
      if (node.state === 'stagnant') {
        this.removeNode(node.id);
        reduced.push(node.id);
        this.emit('node:auto-reduced', { nodeId: node.id, name: node.name });
        this.log(`🔻 Auto-reduced stagnant node: ${node.id} (${node.name})`);
      }
    }
    return reduced;
  }

  /**
   * 全ノード状態を取得
   */
  getAllNodes(): Array<{
    id: string;
    name: string;
    state: NodeState;
    fieldId: string;
    layerId: number;
    sigma: number;
    sigmaVelocity: number;
    kappa: number;
    priority: number;
    flowDirections: number;
    dependencies: string[];
  }> {
    return Array.from(this.nodes.values()).map(n => ({
      id: n.id,
      name: n.name,
      state: n.state,
      fieldId: n.fieldId,
      layerId: n.layerId,
      sigma: n.sigma,
      sigmaVelocity: n.sigmaVelocity,
      kappa: n.kappa,
      priority: n.priority,
      flowDirections: n.flowDirections,
      dependencies: n.dependencies,
    }));
  }

  /**
   * 場ごとのノード一覧
   */
  getNodesByField(fieldId: string): ComputeNode[] {
    return Array.from(this.nodes.values()).filter(n => n.fieldId === fieldId);
  }

  /**
   * 層ごとのノード一覧
   */
  getNodesByLayer(layerId: number): ComputeNode[] {
    return Array.from(this.nodes.values()).filter(n => n.layerId === layerId);
  }

  /**
   * 統計情報
   */
  getStats(): {
    totalNodes: number;
    byState: Record<NodeState, number>;
    byField: Record<string, number>;
    byLayer: Record<number, number>;
    runningCount: number;
    avgSigma: number;
    avgPriority: number;
  } {
    const byState: Record<string, number> = {};
    const byField: Record<string, number> = {};
    const byLayer: Record<number, number> = {};
    let sigmaSum = 0;
    let prioritySum = 0;

    for (const node of this.nodes.values()) {
      byState[node.state] = (byState[node.state] || 0) + 1;
      byField[node.fieldId] = (byField[node.fieldId] || 0) + 1;
      byLayer[node.layerId] = (byLayer[node.layerId] || 0) + 1;
      sigmaSum += node.sigma;
      prioritySum += node.priority;
    }

    const total = this.nodes.size || 1;
    return {
      totalNodes: this.nodes.size,
      byState: byState as Record<NodeState, number>,
      byField,
      byLayer,
      runningCount: this.running.size,
      avgSigma: sigmaSum / total,
      avgPriority: prioritySum / total,
    };
  }

  destroy(): void {
    this.stop();
    this.nodes.clear();
    this.running.clear();
    this.removeAllListeners();
  }
}
