/**
 * Rei AIOS — Layer Manager
 * Theme J: 合わせ鏡マルチレイヤー環境 中枢制御
 *
 * Layer 1〜5 の全体を管理する中枢クラス。
 * 各Layerの生成・削除・状態管理・エージェント配置を担う。
 *
 * D-FUMT F-0根幹公理との接続:
 *   Layer 1（R）が動く → Layer 2（R'）が生成される
 *   → Layer 3（R''）が生成される → 無限に続く
 *
 * 既存実装との統合:
 *   - AgentPool (multi-agent/pool.ts): 各LayerのエージェントPool
 *   - MirrorUI (mirror-ui/): 合わせ鏡の視覚化
 *   - Phase4 TaskScheduler: タスクの自律スケジューリング
 *   - LayerHibernator: メモリ節約のためのスリープ制御
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { WSL2Manager, VirtualDesktop } from '../wsl2/wsl2-manager';
import { LayerBridgeHub, LayerMessage } from '../wsl2/layer-bridge';
import { LayerHibernator, HibernationState } from './layer-hibernator';

// ─── 型定義 ────────────────────────────────────────────

export type LayerStatus =
  | 'inactive'     // 未作成
  | 'initializing' // 起動中
  | 'active'       // フル稼働（操作中）
  | 'running'      // タスク実行中（バックグラウンド）
  | 'sleeping'     // スリープ（メモリ節約）
  | 'error';       // エラー

export type AgentRole =
  | 'commander'    // Layer 1: ユーザー対話・指揮
  | 'researcher'   // Layer 2: 情報収集・調査
  | 'analyst'      // Layer 3: D-FUMT分析
  | 'executor'     // Layer 4: Rei-Automator実行
  | 'integrator';  // Layer 5: 結果統合・圧縮

export interface LayerAgent {
  id: string;
  role: AgentRole;
  name: string;
  /** 割り当てられたLLMプロバイダID */
  providerId?: string;
  /** 現在のタスク */
  currentTask?: string;
  /** タスク完了数 */
  completedTasks: number;
}

export interface LayerInfo {
  /** Layer番号（1〜5）*/
  id: number;
  /** 状態 */
  status: LayerStatus;
  /** 担当エージェント */
  agent: LayerAgent;
  /** 仮想デスクトップ情報（Layer 2〜5のみ）*/
  desktop?: VirtualDesktop;
  /** 冬眠状態 */
  hibernation: HibernationState;
  /** 起動時刻 */
  startedAt?: Date;
  /** 最終アクティブ時刻 */
  lastActiveAt?: Date;
  /** 完了タスク数 */
  taskCount: number;
  /** 生成ファイル数 */
  fileCount: number;
}

export interface LayerManagerConfig {
  dataDir: string;
  /** 最大同時活性Layer数（RAM節約）*/
  maxActiveLayers: number;
  /** 初期展開Layer数 */
  initialLayers: number;
  /** WSL2を使用するか */
  useWSL2: boolean;
  /** スリープまでの非活動時間（ms）*/
  sleepAfterInactiveMs: number;
  log?: (msg: string) => void;
}

const DEFAULT_CONFIG: LayerManagerConfig = {
  dataDir: './data',
  maxActiveLayers: 3,
  initialLayers: 2,
  useWSL2: true,
  sleepAfterInactiveMs: 5 * 60 * 1000, // 5分
};

// ─── AgentRole ↔ Layer番号のデフォルトマッピング ─────

const DEFAULT_ROLES: Record<number, AgentRole> = {
  1: 'commander',
  2: 'researcher',
  3: 'analyst',
  4: 'executor',
  5: 'integrator',
};

const ROLE_NAMES: Record<AgentRole, string> = {
  commander:  '司令官（ユーザー対話）',
  researcher: '研究者（情報収集）',
  analyst:    '分析者（D-FUMT分析）',
  executor:   '実行者（Rei-Automator）',
  integrator: '統合者（結果圧縮）',
};

// ─── LayerManager クラス ──────────────────────────────

export class LayerManager extends EventEmitter {
  private config: LayerManagerConfig;
  private log: (msg: string) => void;
  private layers = new Map<number, LayerInfo>();
  private wsl2: WSL2Manager;
  private bridge: LayerBridgeHub;
  private hibernator: LayerHibernator;
  private inactivityTimers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(config: Partial<LayerManagerConfig> & { dataDir: string }) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.log = config.log || ((msg) => console.log(`[LayerManager] ${msg}`));

    this.wsl2 = new WSL2Manager({
      dataDir: config.dataDir,
      log: (msg) => this.log(`  [WSL2] ${msg}`),
    });

    this.bridge = new LayerBridgeHub(
      config.dataDir,
      (msg) => this.log(`  [Bridge] ${msg}`)
    );

    this.hibernator = new LayerHibernator(
      config.dataDir,
      (msg) => this.log(`  [Hibernator] ${msg}`)
    );

    // ブリッジメッセージを LayerManager イベントに転送
    this.bridge.on('message', (msg: LayerMessage) => {
      this.emit('layer:message', msg);
      this.touchLayer(msg.fromLayer);
    });
  }

  // ─── 初期化 ──────────────────────────────────────

  async initialize(): Promise<void> {
    this.log('Initializing LayerManager...');

    // Layer 1 は常にアクティブ（Windowsメイン環境）
    this.createLayerInfo(1);
    this.setLayerStatus(1, 'active');

    // ブリッジのLayer1チャネルを開く（Windowsではソケット非対応のため省略）
    try {
      await this.bridge.openChannel(1);
    } catch (e: any) {
      this.log(`[LayerBridge] Channel open skipped (${e.message})`);
    }

    // 初期Layer数分を展開
    for (let id = 2; id <= this.config.initialLayers; id++) {
      try {
        await this.activateLayer(id);
      } catch (e: any) {
        this.log(`[LayerBridge] Layer ${id} activation skipped (${e.message})`);
      }
    }

    this.log(`LayerManager initialized. Active layers: 1〜${this.config.initialLayers}`);
    this.emit('initialized', { layers: this.config.initialLayers });
  }

  // ─── Layer 活性化 ────────────────────────────────

  /**
   * Layer N を起動・活性化する。
   * Layer 2以上は WSL2 仮想デスクトップを展開する。
   */
  async activateLayer(layerId: number): Promise<LayerInfo> {
    if (layerId < 1 || layerId > 5) {
      throw new Error(`Invalid layerId: ${layerId}`);
    }

    // 既にアクティブなら返す
    const existing = this.layers.get(layerId);
    if (existing && (existing.status === 'active' || existing.status === 'running')) {
      return existing;
    }

    // スリープ中なら起こす
    if (existing?.status === 'sleeping') {
      return this.wakeLayer(layerId);
    }

    this.log(`Activating Layer ${layerId}...`);
    this.emit('layer:activating', { layerId });

    const info = this.createLayerInfo(layerId);
    this.setLayerStatus(layerId, 'initializing');

    // ブリッジチャネルを開く
    try { await this.bridge.openChannel(layerId); } catch (e: any) { this.log(`[LayerBridge] Layer ${layerId} channel skipped`); }

    // Layer 2以上: WSL2仮想デスクトップを起動
    if (layerId >= 2 && this.config.useWSL2) {
      try {
        const status = await this.wsl2.getStatus();
        if (status === 'running' || status === 'stopped') {
          if (!this.wsl2.isSetupComplete()) {
            this.log(`Layer ${layerId}: WSL2 initial setup starting...`);
            this.emit('layer:setup-progress', { layerId, message: 'WSL2環境を準備中...' });
            await this.wsl2.setupEnvironment();
          }
          const desktop = await this.wsl2.startDesktop(layerId);
          info.desktop = desktop;
        } else {
          this.log(`Layer ${layerId}: WSL2 not available (${status}), running without virtual desktop`);
          this.emit('layer:warning', { layerId, message: `WSL2が利用できません (${status})` });
        }
      } catch (err: any) {
        this.log(`Layer ${layerId}: Desktop start failed: ${err.message}`);
        // デスクトップなしでも継続（エージェントとして機能する）
      }
    }

    info.startedAt = new Date();
    info.lastActiveAt = new Date();
    this.setLayerStatus(layerId, 'active');

    this.log(`Layer ${layerId} activated (${info.agent.role}: ${info.agent.name})`);
    this.emit('layer:activated', info);

    // 非活動タイマーを設定
    this.resetInactivityTimer(layerId);

    return info;
  }

  // ─── Layer スリープ / ウェイク ─────────────────────

  async sleepLayer(layerId: number): Promise<void> {
    const layer = this.layers.get(layerId);
    if (!layer || layer.status === 'sleeping' || layerId === 1) return; // Layer1はスリープしない

    this.log(`Sleeping Layer ${layerId}...`);

    // 冬眠状態を保存
    await this.hibernator.hibernate(layerId, {
      agent: layer.agent,
      taskCount: layer.taskCount,
      fileCount: layer.fileCount,
    });

    // 仮想デスクトップを一時停止（プロセスは残す）
    if (layer.desktop) {
      await this.wsl2.stopDesktop(layerId);
    }

    this.setLayerStatus(layerId, 'sleeping');
    this.bridge.closeChannel(layerId);
    this.emit('layer:sleeping', { layerId });
    this.log(`Layer ${layerId} sleeping ✅`);
  }

  async wakeLayer(layerId: number): Promise<LayerInfo> {
    const layer = this.layers.get(layerId);
    if (!layer) throw new Error(`Layer ${layerId} not found`);
    if (layer.status !== 'sleeping') return layer;

    this.log(`Waking Layer ${layerId}...`);
    this.emit('layer:waking', { layerId });

    // 状態を復元
    const saved = await this.hibernator.restore(layerId);
    if (saved) {
      layer.agent = { ...layer.agent, ...(saved.agent as typeof layer.agent) };
      layer.taskCount = saved.taskCount || layer.taskCount;
    }

    // チャネルを再開
    try { await this.bridge.openChannel(layerId); } catch (e: any) { this.log(`[LayerBridge] Layer ${layerId} channel skipped`); }

    // 仮想デスクトップを再起動
    if (layerId >= 2 && this.config.useWSL2) {
      try {
        layer.desktop = await this.wsl2.startDesktop(layerId);
      } catch { /* ignore */ }
    }

    layer.lastActiveAt = new Date();
    this.setLayerStatus(layerId, 'active');
    this.resetInactivityTimer(layerId);

    this.emit('layer:woken', layer);
    this.log(`Layer ${layerId} woken ✅`);
    return layer;
  }

  // ─── Layer 停止 ────────────────────────────────────

  async deactivateLayer(layerId: number): Promise<void> {
    if (layerId === 1) throw new Error('Layer 1 cannot be deactivated');

    const layer = this.layers.get(layerId);
    if (!layer) return;

    this.log(`Deactivating Layer ${layerId}...`);

    if (layer.desktop) {
      await this.wsl2.stopDesktop(layerId);
    }

    this.bridge.closeChannel(layerId);
    this.clearInactivityTimer(layerId);
    this.layers.delete(layerId);
    this.emit('layer:deactivated', { layerId });
    this.log(`Layer ${layerId} deactivated`);
  }

  // ─── タスク割り当て ────────────────────────────────

  /**
   * タスクを特定Layerに割り当て、エージェントに実行させる
   */
  assignTask(layerId: number, goal: string, context?: string): string {
    const taskId = `task-L${layerId}-${Date.now()}`;
    const layer = this.layers.get(layerId);

    if (!layer) {
      throw new Error(`Layer ${layerId} not active`);
    }

    layer.agent.currentTask = goal;
    this.setLayerStatus(layerId, 'running');
    this.touchLayer(layerId);

    this.bridge.assignTask(layerId, { taskId, goal, context });
    this.emit('task:assigned', { layerId, taskId, goal });
    this.log(`Task assigned to Layer ${layerId}: "${goal}" [${taskId}]`);

    return taskId;
  }

  /**
   * タスク完了を記録する
   */
  recordTaskComplete(layerId: number, taskId: string, success: boolean): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    layer.taskCount++;
    layer.agent.completedTasks++;
    layer.agent.currentTask = undefined;
    this.setLayerStatus(layerId, 'active');
    this.touchLayer(layerId);

    this.emit('task:complete', { layerId, taskId, success, taskCount: layer.taskCount });
    this.log(`Layer ${layerId} task complete: ${taskId} (${success ? '✅' : '❌'})`);
  }

  // ─── 全Layer状態取得 ──────────────────────────────

  getAllLayerInfo(): LayerInfo[] {
    return Array.from(this.layers.values()).sort((a, b) => a.id - b.id);
  }

  getLayer(layerId: number): LayerInfo | undefined {
    return this.layers.get(layerId);
  }

  getBridge(): LayerBridgeHub {
    return this.bridge;
  }

  getWSL2Manager(): WSL2Manager {
    return this.wsl2;
  }

  // ─── 内部ユーティリティ ────────────────────────────

  private createLayerInfo(layerId: number): LayerInfo {
    const role = DEFAULT_ROLES[layerId] || 'researcher';
    const info: LayerInfo = {
      id: layerId,
      status: 'inactive',
      agent: {
        id: `agent-layer-${layerId}`,
        role,
        name: ROLE_NAMES[role],
        completedTasks: 0,
      },
      hibernation: { state: 'awake' },
      taskCount: 0,
      fileCount: 0,
    };
    this.layers.set(layerId, info);
    return info;
  }

  private setLayerStatus(layerId: number, status: LayerStatus): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;
    layer.status = status;
    this.emit('layer:status-changed', { layerId, status });
  }

  /** Layer の最終活動時刻を更新し、非活動タイマーをリセット */
  private touchLayer(layerId: number): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.lastActiveAt = new Date();
    }
    if (layerId !== 1) {
      this.resetInactivityTimer(layerId);
    }
  }

  private resetInactivityTimer(layerId: number): void {
    this.clearInactivityTimer(layerId);
    const timer = setTimeout(() => {
      const layer = this.layers.get(layerId);
      if (layer && layer.status === 'active') {
        this.log(`Layer ${layerId} inactive for ${this.config.sleepAfterInactiveMs}ms → sleeping`);
        this.sleepLayer(layerId).catch(() => {});
      }
    }, this.config.sleepAfterInactiveMs);
    this.inactivityTimers.set(layerId, timer);
  }

  private clearInactivityTimer(layerId: number): void {
    const timer = this.inactivityTimers.get(layerId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.inactivityTimers.delete(layerId);
    }
  }

  // ─── クリーンアップ ──────────────────────────────

  async destroy(): Promise<void> {
    this.log('Destroying LayerManager...');
    for (const [id] of this.layers) {
      if (id > 1) {
        await this.deactivateLayer(id).catch(() => {});
      }
    }
    this.bridge.destroy();
    this.wsl2.destroy();
    this.removeAllListeners();
  }
}
