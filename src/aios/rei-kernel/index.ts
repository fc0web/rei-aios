/**
 * Rei Kernel — 統合エントリポイント
 *
 * Reiの「公理的カーネル」: 5つの中核コンポーネントを統合し、
 * 従来のOSカーネルに相当する機能を公理ベースで提供する。
 *
 * ┌─────────────────────────────────────────┐
 * │              Rei Kernel                 │
 * │                                         │
 * │  ┌─────────────┐  ┌─────────────────┐  │
 * │  │  Scheduler   │  │      IPC        │  │
 * │  │  (σ/κ優先度) │←→│ (インドラの網)  │  │
 * │  └──────┬───────┘  └────────┬────────┘  │
 * │         │                   │           │
 * │  ┌──────┴───────────────────┴────────┐  │
 * │  │        Fault Recovery             │  │
 * │  │   (公理ベース自動修復)            │  │
 * │  └──────┬───────────────────┬────────┘  │
 * │         │                   │           │
 * │  ┌──────┴───────┐  ┌───────┴────────┐  │
 * │  │  Boundary    │  │   Resource     │  │
 * │  │  Check       │  │   Collector    │  │
 * │  │ (層間境界)   │  │  (GC/捨)      │  │
 * │  └──────────────┘  └────────────────┘  │
 * └─────────────────────────────────────────┘
 *
 * 対応する従来のOSカーネル機能:
 *   Scheduler        → プロセススケジューラ
 *   IPC              → プロセス間通信
 *   Fault Recovery   → シグナルハンドリング / ウォッチドッグ
 *   Boundary Check   → メモリ保護 / ページテーブル
 *   Resource Collector → ガベージコレクション
 */

// ─── コンポーネントの再エクスポート ─────────────────────

export {
  NodeScheduler,
  ComputeNode,
  NodeState,
  NodeExecutionResult,
  SpawnRequest,
  NodeSchedulerConfig,
} from './rei-node-scheduler';

export {
  NodeIPC,
  NodeMessage,
  MessageType,
  DeliveryTarget,
  MessageHandler,
  MergeRequest,
  IPCStats,
} from './node-ipc';

export {
  FaultRecovery,
  FaultType,
  FaultRecord,
  RecoveryStrategy,
  RecoveryResult,
  FaultRecoveryConfig,
} from './fault-recovery';

export {
  BoundaryCheck,
  LayerTransfer,
  LayerDefinition,
  BoundaryPolicy,
  BoundaryCheckResult,
  TransferDataType,
} from './boundary-check';

export {
  ResourceCollector,
  CollectionReport,
  SigmaCompactionResult,
  CollectorDataSources,
  ResourceCollectorConfig,
} from './resource-collector';

export {
  KernelBridge,
  KernelBridgeConfig,
  BridgeStatus,
} from './kernel-bridge';

// ─── 統合カーネルクラス ────────────────────────────────

import { EventEmitter } from 'events';
import { NodeScheduler, NodeSchedulerConfig } from './rei-node-scheduler';
import { NodeIPC } from './node-ipc';
import { FaultRecovery, FaultRecoveryConfig } from './fault-recovery';
import { BoundaryCheck, BoundaryPolicy, LayerDefinition } from './boundary-check';
import { ResourceCollector, ResourceCollectorConfig, CollectorDataSources } from './resource-collector';

export interface ReiKernelConfig {
  scheduler?: Partial<NodeSchedulerConfig>;
  faultRecovery?: Partial<FaultRecoveryConfig>;
  boundaryPolicy?: Partial<BoundaryPolicy>;
  resourceCollector?: Partial<ResourceCollectorConfig>;
  customLayers?: LayerDefinition[];
  log?: (msg: string) => void;
}

/**
 * ReiKernel — 5コンポーネントを統合した公理的カーネル
 *
 * 使用例:
 * ```typescript
 * const kernel = new ReiKernel({ log: console.log });
 * kernel.initialize();
 *
 * // ノード登録
 * const nodeId = kernel.scheduler.registerNode({
 *   name: 'データ分析',
 *   fieldId: 'field-1',
 *   layerId: 1,
 *   convergenceGoal: '分析完了',
 *   kappa: 0.7,
 *   execute: async () => ({ nodeId: '', success: true, sigma: 0.5 }),
 * });
 *
 * // カーネル起動
 * kernel.start();
 * ```
 */
export class ReiKernel extends EventEmitter {
  public readonly scheduler: NodeScheduler;
  public readonly ipc: NodeIPC;
  public readonly faultRecovery: FaultRecovery;
  public readonly boundaryCheck: BoundaryCheck;
  public readonly gc: ResourceCollector;
  private log: (msg: string) => void;
  private initialized = false;

  constructor(config?: ReiKernelConfig) {
    super();
    this.log = config?.log || ((msg) => console.log(`[ReiKernel] ${msg}`));

    // コンポーネント初期化
    this.scheduler = new NodeScheduler({
      ...config?.scheduler,
      log: (msg) => this.log(`  [Scheduler] ${msg}`),
    });

    this.ipc = new NodeIPC(
      (msg) => this.log(`  [IPC] ${msg}`),
    );

    this.faultRecovery = new FaultRecovery({
      ...config?.faultRecovery,
      log: (msg) => this.log(`  [FaultRecovery] ${msg}`),
    });

    this.boundaryCheck = new BoundaryCheck(
      config?.customLayers,
      config?.boundaryPolicy,
      (msg) => this.log(`  [Boundary] ${msg}`),
    );

    this.gc = new ResourceCollector({
      ...config?.resourceCollector,
      log: (msg) => this.log(`  [GC] ${msg}`),
    });
  }

  /**
   * カーネルを初期化する。
   * コンポーネント間の接続を確立し、コールバックを設定する。
   */
  initialize(): void {
    if (this.initialized) return;

    // ─── FaultRecovery ↔ Scheduler 接続 ───
    this.faultRecovery.setHandlers({
      onReduce: async (nodeId) => {
        this.scheduler.removeNode(nodeId);
        this.ipc.unregisterEndpoint(nodeId);
      },
      onReroute: async (nodeId) => {
        // 元ノードと同じ設定で新ノードを生成（A4 Genesis）
        const nodes = this.scheduler.getAllNodes();
        const original = nodes.find(n => n.id === nodeId);
        if (!original) return null;

        const newId = this.scheduler.registerNode({
          name: `${original.name} (rerouted)`,
          fieldId: original.fieldId,
          layerId: original.layerId,
          convergenceGoal: 'rerouted recovery',
          kappa: original.kappa,
          execute: async () => ({ nodeId: '', success: true, sigma: 0 }),
        });

        this.ipc.registerEndpoint(newId, original.fieldId, original.layerId);
        return newId;
      },
      onEscalate: async (fault) => {
        this.emit('kernel:escalation', fault);
      },
    });

    // ─── Scheduler イベント → IPC/FaultRecovery 連携 ───
    this.scheduler.on('node:registered', ({ nodeId }: { nodeId: string }) => {
      const nodes = this.scheduler.getAllNodes();
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        this.ipc.registerEndpoint(nodeId, node.fieldId, node.layerId);
      }
    });

    this.scheduler.on('node:removed', ({ nodeId }: { nodeId: string }) => {
      this.ipc.unregisterEndpoint(nodeId);
    });

    this.scheduler.on('node:stagnant', ({ nodeId, name }: { nodeId: string; name: string }) => {
      const nodes = this.scheduler.getAllNodes();
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        this.faultRecovery.detectSigmaStagnation(
          nodeId, name,
          [] // NodeScheduler から sigmaHistory を取得する必要がある
        );
      }
    });

    this.scheduler.on('node:error', ({ nodeId, error }: { nodeId: string; error: string }) => {
      const nodes = this.scheduler.getAllNodes();
      const node = nodes.find(n => n.id === nodeId);
      this.faultRecovery.reportFault(
        nodeId,
        node?.name || 'unknown',
        'execution-error',
        error,
      );
    });

    // ─── GC データソース登録 ───
    const gcSources: CollectorDataSources = {
      getNodes: () => {
        return this.scheduler.getAllNodes().map(n => ({
          id: n.id,
          state: n.state,
          sigma: n.sigma,
          sigmaHistory: [], // 簡略化（実際にはSchedulerからフル履歴を取得）
          lastUpdatedAt: Date.now(), // 簡略化
          fieldId: n.fieldId,
          layerId: n.layerId,
        }));
      },
      removeNode: (nodeId) => this.scheduler.removeNode(nodeId),
      updateSigmaHistory: (_nodeId, _compacted) => {
        // Scheduler側のσ履歴更新
      },
      getIPCInboxes: () => {
        const inboxes = new Map<string, Array<{ id: string; timestamp: number }>>();
        for (const node of this.scheduler.getAllNodes()) {
          const messages = this.ipc.getInbox(node.id);
          inboxes.set(node.id, messages.map(m => ({ id: m.id, timestamp: m.timestamp })));
        }
        return inboxes;
      },
    };
    this.gc.registerSources(gcSources);

    this.initialized = true;
    this.log('Kernel initialized. All components connected.');
    this.emit('kernel:initialized');
  }

  /**
   * カーネルを起動する
   */
  start(): void {
    if (!this.initialized) this.initialize();

    this.scheduler.start();
    this.gc.startAutoCollect();

    this.log('Kernel started.');
    this.emit('kernel:started');
  }

  /**
   * カーネルを停止する
   */
  stop(): void {
    this.scheduler.stop();
    this.gc.stopAutoCollect();

    this.log('Kernel stopped.');
    this.emit('kernel:stopped');
  }

  /**
   * カーネル全体の状態を取得する
   */
  getStatus(): {
    initialized: boolean;
    scheduler: ReturnType<NodeScheduler['getStats']>;
    ipc: ReturnType<NodeIPC['getStats']>;
    faultRecovery: ReturnType<FaultRecovery['getStats']>;
    boundaryCheck: ReturnType<BoundaryCheck['getStats']>;
    gc: ReturnType<ResourceCollector['getStats']>;
  } {
    return {
      initialized: this.initialized,
      scheduler: this.scheduler.getStats(),
      ipc: this.ipc.getStats(),
      faultRecovery: this.faultRecovery.getStats(),
      boundaryCheck: this.boundaryCheck.getStats(),
      gc: this.gc.getStats(),
    };
  }

  /**
   * カーネルを破棄する
   */
  destroy(): void {
    this.stop();
    this.scheduler.destroy();
    this.ipc.destroy();
    this.faultRecovery.destroy();
    this.boundaryCheck.destroy();
    this.gc.destroy();
    this.removeAllListeners();
    this.log('Kernel destroyed.');
  }
}
