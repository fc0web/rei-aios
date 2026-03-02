/**
 * Rei Kernel Bridge — 既存コンポーネントとの接続
 * ──────────────────────────────────────────────
 * Step 2-B: TaskScheduler ↔ NodeScheduler
 * Step 2-C: Watchdog → FaultRecovery
 * Step 2-D: LayerManager → BoundaryCheck
 *
 * このモジュールは既存のAIOSコンポーネントを変更せずに、
 * ReiKernelとの橋渡しを行う「アダプター」として機能する。
 *
 * D-FUMT設計原則:
 *   中心 = ReiKernel（公理的計算エンジン）
 *   周辺 = 既存コンポーネント群（Watchdog, TaskScheduler, LayerManager）
 *   接続 = KernelBridge（中心と周辺の仲介者）
 */

import { EventEmitter } from 'events';
import { ReiKernel } from './index';
import { NodeExecutionResult } from './rei-node-scheduler';
import { Watchdog, ErrorRecord } from '../self-repair/watchdog';
import { TaskScheduler, ScheduledTask } from '../scheduler/task-scheduler';

// ─── 型定義 ──────────────────────────────────────────

export interface KernelBridgeConfig {
  /** ReiKernelインスタンス */
  kernel: ReiKernel;
  /** Watchdogインスタンス（任意） */
  watchdog?: Watchdog;
  /** TaskSchedulerインスタンス（任意） */
  taskScheduler?: TaskScheduler;
  /** ログ関数 */
  log?: (msg: string) => void;
}

export interface BridgeStatus {
  watchdogConnected: boolean;
  taskSchedulerConnected: boolean;
  layerManagerConnected: boolean;
  bridgedTaskCount: number;
  bridgedErrorCount: number;
}

// ─── KernelBridge クラス ─────────────────────────────

/**
 * KernelBridge — 既存コンポーネントとReiKernelをつなぐ
 *
 * 使用例:
 * ```typescript
 * const kernel = new ReiKernel({ log: console.log });
 * kernel.initialize();
 *
 * const bridge = new KernelBridge({
 *   kernel,
 *   watchdog: existingWatchdog,
 *   taskScheduler: existingTaskScheduler,
 * });
 * bridge.connectAll();
 * ```
 */
export class KernelBridge extends EventEmitter {
  private kernel: ReiKernel;
  private watchdog?: Watchdog;
  private taskScheduler?: TaskScheduler;
  private log: (msg: string) => void;

  private bridgedTaskCount = 0;
  private bridgedErrorCount = 0;

  // 接続状態追跡
  private watchdogConnected = false;
  private taskSchedulerConnected = false;
  private layerManagerConnected = false;

  // タスクID → ノードID のマッピング
  private taskToNodeMap: Map<string, string> = new Map();

  constructor(config: KernelBridgeConfig) {
    super();
    this.kernel = config.kernel;
    this.watchdog = config.watchdog;
    this.taskScheduler = config.taskScheduler;
    this.log = config.log || ((msg) => console.log(`[KernelBridge] ${msg}`));
  }

  // ═══════════════════════════════════════════════
  //  一括接続
  // ═══════════════════════════════════════════════

  /**
   * 利用可能なすべてのコンポーネントを接続する
   */
  connectAll(): void {
    if (this.watchdog) {
      this.connectWatchdog(this.watchdog);
    }
    if (this.taskScheduler) {
      this.connectTaskScheduler(this.taskScheduler);
    }
    this.log('All available components connected.');
    this.emit('bridge:connected', this.getStatus());
  }

  // ═══════════════════════════════════════════════
  //  Step 2-C: Watchdog → FaultRecovery 接続
  // ═══════════════════════════════════════════════

  /**
   * Watchdog がエラーを検出した時、FaultRecovery に報告する。
   *
   * Watchdog（受動的監視）→ FaultRecovery（能動的回復）
   *   - Watchdog がエラーを検出 → FaultRecovery に報告
   *   - FaultRecovery が回復戦略を決定・実行
   */
  connectWatchdog(watchdog: Watchdog): void {
    this.watchdog = watchdog;

    // Watchdog の error-recorded イベントを FaultRecovery に橋渡し
    watchdog.on('error-recorded', (record: ErrorRecord) => {
      this.bridgedErrorCount++;

      // エラークラスから FaultType へのマッピング
      const faultType = this.mapErrorClassToFaultType(record.class);

      // FaultRecovery に報告
      const nodeId = record.context || 'system';
      const nodeName = record.context || 'AIOS System';

      this.kernel.faultRecovery.reportFault(
        nodeId,
        nodeName,
        faultType,
        record.message,
      );

      this.log(`Watchdog -> FaultRecovery: [${record.class}] ${record.message.slice(0, 80)}`);
    });

    // Watchdog の critical-error イベントで即座にカーネルに通知
    watchdog.on('critical-error', (record: ErrorRecord) => {
      this.kernel.emit('kernel:critical-error', {
        source: 'watchdog',
        errorClass: record.class,
        message: record.message,
        timestamp: record.timestamp,
      });
      this.log(`CRITICAL: ${record.class} error bridged to kernel`);
    });

    // Watchdog の memory-critical イベント
    watchdog.on('memory-critical', (data: { memMB: number }) => {
      // GC に強制回収を要求
      this.kernel.gc.collect().then((report) => {
        this.log(`Memory critical (${data.memMB}MB) -> GC triggered: ${report.totalCollected} items collected`);
      }).catch((err) => {
        this.log(`Memory critical GC failed: ${err}`);
      });
    });

    this.watchdogConnected = true;
    this.log('Watchdog <-> FaultRecovery connected.');
  }

  // ═══════════════════════════════════════════════
  //  Step 2-B: TaskScheduler ↔ NodeScheduler 接続
  // ═══════════════════════════════════════════════

  /**
   * TaskScheduler のタスクを NodeScheduler にも登録する。
   *
   * TaskScheduler → 「いつ実行するか」（cron, interval, event）
   * NodeScheduler → 「どのノードを優先するか」（σ速度, κ影響度）
   *
   * 両者は共存し、TaskScheduler が「いつ」を決め、
   * NodeScheduler が「どの順序で」を決める。
   */
  connectTaskScheduler(taskScheduler: TaskScheduler): void {
    this.taskScheduler = taskScheduler;

    // TaskScheduler がタスク実行時に、NodeScheduler にも登録
    taskScheduler.on('task:start', (data: { taskId: string; taskName: string }) => {
      this.bridgedTaskCount++;

      // タスクを ComputeNode としても登録
      const nodeId = this.kernel.scheduler.registerNode({
        name: `task:${data.taskName}`,
        fieldId: 'field-scheduler',
        layerId: 2,
        convergenceGoal: `Task "${data.taskName}" complete`,
        kappa: 0.5,
        execute: async (): Promise<NodeExecutionResult> => {
          return { nodeId, success: true, sigma: 0.5 };
        },
      });

      this.taskToNodeMap.set(data.taskId, nodeId);
      this.log(`TaskScheduler -> NodeScheduler: registered "${data.taskName}" as node ${nodeId.slice(0, 8)}`);
    });

    // タスク完了時にノードの σ を更新
    taskScheduler.on('task:complete', (data: { taskId: string; success: boolean }) => {
      const nodeId = this.taskToNodeMap.get(data.taskId);
      if (nodeId) {
        const sigma = data.success ? 1.0 : 0.1;
        this.kernel.scheduler.updateSigma(nodeId, sigma);

        if (!data.success) {
          this.kernel.faultRecovery.reportFault(
            nodeId,
            `task:${data.taskId}`,
            'execution-error',
            `Scheduled task "${data.taskId}" failed`,
          );
        }

        this.log(`Task ${data.taskId} -> sigma=${sigma} (${data.success ? 'success' : 'failed'})`);
      }
    });

    // タスク削除時にノードも削除
    taskScheduler.on('task:removed', (data: { taskId: string }) => {
      const nodeId = this.taskToNodeMap.get(data.taskId);
      if (nodeId) {
        this.kernel.scheduler.removeNode(nodeId);
        this.taskToNodeMap.delete(data.taskId);
      }
    });

    this.taskSchedulerConnected = true;
    this.log('TaskScheduler <-> NodeScheduler connected.');
  }

  // ═══════════════════════════════════════════════
  //  Step 2-D: LayerManager → BoundaryCheck 接続
  // ═══════════════════════════════════════════════

  /**
   * LayerManager の層間メッセージを BoundaryCheck で検査する。
   *
   * 注: LayerManager は WSL2/VirtualDesktop に依存するため、
   *     EventEmitter ベースの疎結合接続を提供する。
   */
  connectLayerManagerEvents(layerEmitter: EventEmitter): void {
    // 層間メッセージ送信時に BoundaryCheck を実行
    layerEmitter.on('layer:message', (msg: {
      fromLayer: number;
      toLayer: number;
      dataType: string;
      payload: any;
      kappa?: number;
      sigma?: number;
    }) => {
      const transfer = {
        id: `bridge-${Date.now()}`,
        fromLayerId: msg.fromLayer,
        toLayerId: msg.toLayer,
        fromNodeId: 'layer-manager',
        dataType: msg.dataType as any,
        payload: msg.payload,
        kappa: msg.kappa ?? 0.5,
        sigma: msg.sigma ?? 0.5,
        reason: 'layer-message',
        timestamp: Date.now(),
      };
      const result = this.kernel.boundaryCheck.check(transfer);

      if (!result.allowed) {
        const failedChecks = result.checks.filter((c) => !c.passed).map((c) => c.message);
        this.log(
          `BoundaryCheck blocked: Layer ${msg.fromLayer} -> ${msg.toLayer} ` +
          `(${failedChecks.join(', ')})`
        );
        layerEmitter.emit('layer:message-blocked', {
          fromLayer: msg.fromLayer,
          toLayer: msg.toLayer,
          dataType: msg.dataType,
          payload: msg.payload,
          denyReason: result.denyReason,
        });
      } else {
        const warnings = result.checks.filter((c) => !c.passed);
        if (warnings.length > 0) {
          this.log(
            `BoundaryCheck warnings: ${warnings.map((w) => w.message).join(', ')}`
          );
        }
        layerEmitter.emit('layer:message-approved', msg);
      }
    });

    // エージェント配置時の層互換性チェック
    layerEmitter.on('layer:assign-agent', (assignment: {
      agentId: string;
      targetLayer: number;
      dataType: string;
    }) => {
      const transfer = {
        id: `assign-${Date.now()}`,
        fromLayerId: 0,
        toLayerId: assignment.targetLayer,
        fromNodeId: 'agent-assignment',
        dataType: assignment.dataType as any,
        payload: { agentId: assignment.agentId },
        kappa: 0.5,
        sigma: 0,
        reason: 'agent-assignment',
        timestamp: Date.now(),
      };
      const result = this.kernel.boundaryCheck.check(transfer);

      if (!result.allowed) {
        this.log(
          `Agent assignment blocked: agent ${assignment.agentId} -> Layer ${assignment.targetLayer}`
        );
      }
    });

    this.layerManagerConnected = true;
    this.log('LayerManager <-> BoundaryCheck connected (event-based).');
  }

  // ═══════════════════════════════════════════════
  //  ユーティリティ
  // ═══════════════════════════════════════════════

  /**
   * Watchdog の ErrorClass を FaultRecovery の FaultType にマッピング
   */
  private mapErrorClassToFaultType(
    errorClass: string
  ): 'execution-error' | 'sigma-stagnation' | 'infinite-expansion' | 'boundary-violation' | 'resource-exhaustion' {
    switch (errorClass) {
      case 'oom':
        return 'resource-exhaustion';
      case 'timeout':
        return 'sigma-stagnation';
      case 'network':
      case 'server-error':
        return 'execution-error';
      case 'auth':
      case 'rate-limit':
        return 'boundary-violation';
      default:
        return 'execution-error';
    }
  }

  /**
   * ブリッジの状態を取得
   */
  getStatus(): BridgeStatus {
    return {
      watchdogConnected: this.watchdogConnected,
      taskSchedulerConnected: this.taskSchedulerConnected,
      layerManagerConnected: this.layerManagerConnected,
      bridgedTaskCount: this.bridgedTaskCount,
      bridgedErrorCount: this.bridgedErrorCount,
    };
  }

  /**
   * ブリッジを破棄
   */
  destroy(): void {
    this.taskToNodeMap.clear();
    this.removeAllListeners();
    this.log('Bridge destroyed.');
  }
}
