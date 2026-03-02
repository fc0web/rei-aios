/**
 * Rei Kernel — Resource Collector（資源回収 / ガベージコレクション）
 * 「捨」（ウペッカー）— 執着せず手放す智慧
 *
 * D-FUMT 公理対応:
 *   A2: Extension-Reduction — 不要リソースの縮約
 *   A3: Sigma-Accumulation — σ蓄積履歴の圧縮・間引き
 *
 * 回収対象:
 *   1. 収束済みノード（converged state, 一定時間経過）
 *   2. エラーノード（error state, 回復不能）
 *   3. 古いσ履歴（compaction/間引き）
 *   4. IPC受信キューの古いメッセージ
 *   5. 障害履歴の古いレコード
 *   6. 未参照の場（全ノードが消えた場）
 *
 * 設計思想:
 *   「何を保持し、何を忘れるか」の判断基準を公理的に定義。
 *   - 高σ値で収束した成功記録 → 長期保持
 *   - 低σ値で停滞した失敗記録 → 短期保持
 *   - σ変化の大きい転換点 → 保持
 *   - σ変化の小さい平坦期 → 間引き
 */

import { EventEmitter } from 'events';

// ─── 型定義 ────────────────────────────────────────────

/** 回収対象のカテゴリ */
export type CollectableType =
  | 'converged-node'    // 収束済みノード
  | 'error-node'        // エラーノード
  | 'stagnant-node'     // 停滞ノード
  | 'sigma-history'     // σ履歴エントリ
  | 'ipc-message'       // IPC受信メッセージ
  | 'fault-record'      // 障害レコード
  | 'empty-field';      // 空の場

/** 回収レポート */
export interface CollectionReport {
  /** 回収実行ID */
  id: string;
  /** 回収開始時刻 */
  startedAt: number;
  /** 回収完了時刻 */
  completedAt: number;
  /** カテゴリ別の回収数 */
  collected: Record<CollectableType, number>;
  /** 合計回収数 */
  totalCollected: number;
  /** 推定解放メモリ（概算） */
  estimatedFreedBytes: number;
  /** 保持されたアイテム数 */
  retained: number;
}

/** σ履歴の圧縮結果 */
export interface SigmaCompactionResult {
  nodeId: string;
  originalCount: number;
  compactedCount: number;
  /** 保持された転換点のインデックス */
  keptIndices: number[];
}

/** Resource Collector 設定 */
export interface ResourceCollectorConfig {
  /** 収束後にノードを保持する時間（ms） */
  convergedRetentionMs: number;
  /** エラーノードを保持する時間（ms） */
  errorRetentionMs: number;
  /** 停滞ノードを保持する時間（ms） */
  stagnantRetentionMs: number;
  /** σ履歴の最大保持数（ノードあたり） */
  maxSigmaHistoryPerNode: number;
  /** σ履歴の間引き閾値（Δがこの値以下の連続エントリを間引く） */
  sigmaCompactionDeltaThreshold: number;
  /** IPCメッセージの保持時間（ms） */
  ipcMessageRetentionMs: number;
  /** 障害レコードの保持時間（ms） */
  faultRecordRetentionMs: number;
  /** 自動GC間隔（ms、0=無効） */
  autoCollectIntervalMs: number;
  /** 回収実行時にイベントを発行するか */
  emitEvents: boolean;
  log?: (msg: string) => void;
}

const DEFAULT_CONFIG: ResourceCollectorConfig = {
  convergedRetentionMs: 5 * 60 * 1000,     // 5分
  errorRetentionMs: 10 * 60 * 1000,         // 10分（エラー分析用に長め）
  stagnantRetentionMs: 2 * 60 * 1000,       // 2分
  maxSigmaHistoryPerNode: 50,
  sigmaCompactionDeltaThreshold: 0.001,
  ipcMessageRetentionMs: 3 * 60 * 1000,     // 3分
  faultRecordRetentionMs: 60 * 60 * 1000,   // 1時間
  autoCollectIntervalMs: 60 * 1000,          // 1分ごと
  emitEvents: true,
};

// ─── 外部データソースインターフェース ─────────────────

/**
 * Resource Collector は外部のデータソース（NodeScheduler, NodeIPC, FaultRecovery等）
 * に直接依存せず、コールバック経由でアクセスする。
 */
export interface CollectorDataSources {
  /** 全ノードの状態を取得 */
  getNodes: () => Array<{
    id: string;
    state: string;
    sigma: number;
    sigmaHistory: Array<{ timestamp: number; sigma: number; delta: number }>;
    lastUpdatedAt: number;
    fieldId: string;
    layerId: number;
  }>;
  /** ノードを削除する */
  removeNode: (nodeId: string) => boolean;
  /** ノードのσ履歴を更新する */
  updateSigmaHistory: (nodeId: string, compacted: Array<{ timestamp: number; sigma: number; delta: number }>) => void;
  /** IPCの受信キューを取得 */
  getIPCInboxes?: () => Map<string, Array<{ id: string; timestamp: number }>>;
  /** IPCの受信キューをトリミング */
  trimIPCInbox?: (nodeId: string, keepIds: string[]) => void;
  /** 障害レコードを取得 */
  getFaultRecords?: () => Array<{ id: string; detectedAt: number; resolved: boolean }>;
  /** 古い障害レコードを削除 */
  purgeFaultRecords?: (olderThanMs: number) => number;
}

// ─── ResourceCollector クラス ──────────────────────────

export class ResourceCollector extends EventEmitter {
  private config: ResourceCollectorConfig;
  private log: (msg: string) => void;
  private sources?: CollectorDataSources;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private collectionCounter = 0;
  private reports: CollectionReport[] = [];
  private maxReports = 100;

  constructor(config?: Partial<ResourceCollectorConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.log = config?.log || ((msg) => console.log(`[ResourceCollector] ${msg}`));
  }

  /**
   * データソースを登録する
   */
  registerSources(sources: CollectorDataSources): void {
    this.sources = sources;
    this.log('Data sources registered.');
  }

  // ─── GC 開始・停止 ──────────────────────────────────

  startAutoCollect(): void {
    if (this.autoTimer || this.config.autoCollectIntervalMs <= 0) return;

    this.autoTimer = setInterval(() => {
      this.collect().catch(err => {
        this.log(`Auto-collect error: ${err.message}`);
      });
    }, this.config.autoCollectIntervalMs);

    this.log(`Auto-collect started (interval: ${this.config.autoCollectIntervalMs}ms)`);
  }

  stopAutoCollect(): void {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
      this.log('Auto-collect stopped.');
    }
  }

  // ─── メイン回収処理 ──────────────────────────────────

  /**
   * 全カテゴリの回収を実行する。
   * 仏教的に言えば「捨」（ウペッカー）— 必要なものだけを残す。
   */
  async collect(): Promise<CollectionReport> {
    if (!this.sources) {
      throw new Error('Data sources not registered. Call registerSources() first.');
    }

    const startedAt = Date.now();
    const collected: Record<CollectableType, number> = {
      'converged-node': 0,
      'error-node': 0,
      'stagnant-node': 0,
      'sigma-history': 0,
      'ipc-message': 0,
      'fault-record': 0,
      'empty-field': 0,
    };
    let retained = 0;
    let estimatedFreed = 0;

    const nodes = this.sources.getNodes();

    // ─── 1. 期限切れノードの回収 ───
    const now = Date.now();
    for (const node of nodes) {
      const age = now - node.lastUpdatedAt;

      if (node.state === 'converged' && age > this.config.convergedRetentionMs) {
        this.sources.removeNode(node.id);
        collected['converged-node']++;
        estimatedFreed += this.estimateNodeSize(node);
        this.log(`  Collected converged node: ${node.id} (age: ${Math.round(age / 1000)}s)`);

      } else if (node.state === 'error' && age > this.config.errorRetentionMs) {
        this.sources.removeNode(node.id);
        collected['error-node']++;
        estimatedFreed += this.estimateNodeSize(node);
        this.log(`  Collected error node: ${node.id}`);

      } else if (node.state === 'stagnant' && age > this.config.stagnantRetentionMs) {
        this.sources.removeNode(node.id);
        collected['stagnant-node']++;
        estimatedFreed += this.estimateNodeSize(node);
        this.log(`  Collected stagnant node: ${node.id}`);

      } else {
        retained++;

        // ─── 2. σ履歴の圧縮（生存ノードのみ） ───
        if (node.sigmaHistory.length > this.config.maxSigmaHistoryPerNode) {
          const result = this.compactSigmaHistory(
            node.id,
            node.sigmaHistory,
            this.config.maxSigmaHistoryPerNode,
          );
          collected['sigma-history'] += result.originalCount - result.compactedCount;
          estimatedFreed += (result.originalCount - result.compactedCount) * 64; // 概算
        }
      }
    }

    // ─── 3. IPC受信キューの回収 ───
    if (this.sources.getIPCInboxes && this.sources.trimIPCInbox) {
      const inboxes = this.sources.getIPCInboxes();
      for (const [nodeId, messages] of inboxes) {
        const cutoff = now - this.config.ipcMessageRetentionMs;
        const keepIds = messages.filter(m => m.timestamp > cutoff).map(m => m.id);
        const removed = messages.length - keepIds.length;
        if (removed > 0) {
          this.sources.trimIPCInbox(nodeId, keepIds);
          collected['ipc-message'] += removed;
          estimatedFreed += removed * 256; // 概算
        }
      }
    }

    // ─── 4. 障害レコードの回収 ───
    if (this.sources.purgeFaultRecords) {
      const purged = this.sources.purgeFaultRecords(this.config.faultRecordRetentionMs);
      collected['fault-record'] += purged;
      estimatedFreed += purged * 512; // 概算
    }

    // ─── 5. 空の場の検出 ───
    const remainingNodes = this.sources.getNodes();
    const fieldsInUse = new Set(remainingNodes.map(n => n.fieldId));
    // （実際の場の削除は外部に委ねるが、カウントだけ記録）
    // 現時点では場の全リストがないため、ここではemitのみ

    // ─── レポート作成 ───
    const totalCollected = Object.values(collected).reduce((a, b) => a + b, 0);
    const report: CollectionReport = {
      id: `gc-${++this.collectionCounter}`,
      startedAt,
      completedAt: Date.now(),
      collected,
      totalCollected,
      estimatedFreedBytes: estimatedFreed,
      retained,
    };

    this.reports.push(report);
    if (this.reports.length > this.maxReports) {
      this.reports = this.reports.slice(-this.maxReports);
    }

    if (totalCollected > 0) {
      this.log(`GC complete: collected ${totalCollected} items, freed ~${this.formatBytes(estimatedFreed)}, retained ${retained}`);
    }

    if (this.config.emitEvents) {
      this.emit('gc:complete', report);
    }

    return report;
  }

  // ─── σ履歴圧縮 ──────────────────────────────────────

  /**
   * σ履歴を「転換点保持」方式で圧縮する。
   *
   * 原則:
   *   - σ変化の大きい点（転換点）は保持
   *   - σ変化の小さい平坦期は間引き
   *   - 最初と最後のエントリは常に保持
   *
   * これは仏教の「捨」の実践:
   *   重要な記憶（転換点）は保持し、
   *   些末な記憶（平坦期）は手放す。
   */
  compactSigmaHistory(
    nodeId: string,
    history: Array<{ timestamp: number; sigma: number; delta: number }>,
    maxEntries: number,
  ): SigmaCompactionResult {
    const originalCount = history.length;

    if (history.length <= maxEntries) {
      return {
        nodeId,
        originalCount,
        compactedCount: history.length,
        keptIndices: history.map((_, i) => i),
      };
    }

    // 各エントリの「重要度」を計算
    const importance = history.map((entry, i) => {
      // 最初と最後は最高重要度
      if (i === 0 || i === history.length - 1) return Infinity;

      // δの絶対値が大きいほど重要（転換点）
      const deltaMagnitude = Math.abs(entry.delta);

      // 前後のδとの差が大きいほど重要（変曲点）
      const prevDelta = i > 0 ? Math.abs(history[i - 1].delta) : 0;
      const nextDelta = i < history.length - 1 ? Math.abs(history[i + 1].delta) : 0;
      const inflection = Math.abs(deltaMagnitude - prevDelta) + Math.abs(deltaMagnitude - nextDelta);

      return deltaMagnitude + inflection;
    });

    // 重要度順にソートしてtop N を保持
    const indexed = importance.map((imp, idx) => ({ imp, idx }));
    indexed.sort((a, b) => b.imp - a.imp);
    const keptIndices = indexed
      .slice(0, maxEntries)
      .map(x => x.idx)
      .sort((a, b) => a - b); // 時系列順に戻す

    const compacted = keptIndices.map(i => history[i]);

    // データソースに反映
    if (this.sources) {
      this.sources.updateSigmaHistory(nodeId, compacted);
    }

    return {
      nodeId,
      originalCount,
      compactedCount: compacted.length,
      keptIndices,
    };
  }

  // ─── ユーティリティ ──────────────────────────────────

  private estimateNodeSize(node: any): number {
    // ノードの概算メモリサイズ（バイト）
    const baseSize = 256; // 基本プロパティ
    const historySize = (node.sigmaHistory?.length || 0) * 64;
    return baseSize + historySize;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  // ─── 照会API ────────────────────────────────────────

  getReports(limit = 20): CollectionReport[] {
    return this.reports.slice(-limit);
  }

  getLatestReport(): CollectionReport | null {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
  }

  getStats(): {
    totalCollections: number;
    totalItemsCollected: number;
    totalEstimatedFreed: number;
    avgItemsPerCollection: number;
    lastCollectionAt: number | null;
  } {
    let totalItems = 0;
    let totalFreed = 0;

    for (const report of this.reports) {
      totalItems += report.totalCollected;
      totalFreed += report.estimatedFreedBytes;
    }

    const count = this.reports.length || 1;
    return {
      totalCollections: this.reports.length,
      totalItemsCollected: totalItems,
      totalEstimatedFreed: totalFreed,
      avgItemsPerCollection: totalItems / count,
      lastCollectionAt: this.reports.length > 0
        ? this.reports[this.reports.length - 1].completedAt
        : null,
    };
  }

  destroy(): void {
    this.stopAutoCollect();
    this.reports = [];
    this.sources = undefined;
    this.removeAllListeners();
  }
}
