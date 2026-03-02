// ============================================================
// Rei-AIOS AGI Layer — Phase 3: Context Memory
// src/agi/context-memory.ts
//
// AGILayerにセッション間記憶能力を付与する。
//
// 【アーキテクチャ】
//
//   ┌─────────────────────────────────┐
//   │         ContextMemory           │
//   │                                 │
//   │  ┌────────────┐  ┌──────────┐  │
//   │  │ Short-Term │  │Long-Term │  │
//   │  │  (直近50件) │  │(JSON永続)│  │
//   │  └──────┬─────┘  └────┬─────┘  │
//   │         │              │        │
//   │  ┌──────▼──────────────▼──────┐ │
//   │  │     MemoryRetriever        │ │
//   │  │  (キーワード + 時系列検索)  │ │
//   │  └────────────────────────────┘ │
//   │  ┌────────────────────────────┐ │
//   │  │    MemoryCompressor        │ │
//   │  │ (LLMで古い記憶をサマリー化) │ │
//   │  └────────────────────────────┘ │
//   └─────────────────────────────────┘
//
// 【特徴】
//   - タスク実行後に自動記憶（AGILayerから呼び出し）
//   - 類似タスクの過去実績を自動参照してPromptを強化
//   - セッション間でJSON永続化
//   - 古いエントリはLLMで自動サマリー（メモリ圧縮）
//   - タグベースの分類と検索
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

import { TaskPlan, TaskResult } from './task-types';

// ──────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────

/** 記憶の種類 */
export type MemoryKind =
  | 'task_execution'   // タスク実行記録
  | 'insight'          // LLMが抽出したインサイト
  | 'summary'          // 複数記憶のサマリー
  | 'user_preference'  // ユーザー操作傾向
  | 'error_pattern';   // エラーパターン（自己修復連携）

/** 1件の記憶エントリ */
export interface MemoryEntry {
  id: string;                 // UUID風ID
  kind: MemoryKind;
  timestamp: number;          // Unix ms
  query: string;              // 元のユーザー指示
  summary: string;            // 人間可読サマリー
  tags: string[];             // 検索用タグ
  outcome: 'success' | 'partial' | 'failure';
  details?: {
    planId?: string;
    subtaskCount?: number;
    duration?: number;        // ms
    errorMessage?: string;
    repairApplied?: boolean;
    arbitrageUsed?: boolean;
  };
  // サマリーエントリの場合
  compressedFrom?: string[];  // 元エントリIDリスト
}

/** 検索オプション */
export interface MemorySearchOptions {
  query?: string;              // キーワード検索
  kind?: MemoryKind;
  outcome?: 'success' | 'partial' | 'failure';
  tags?: string[];
  sinceMs?: number;            // 直近N ms以内
  limit?: number;              // 最大取得件数
}

/** 検索結果 */
export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;               // 関連度スコア 0~1
}

/** Phase 3 設定 */
export interface ContextMemoryConfig {
  shortTermCapacity: number;   // STMの最大件数
  longTermPath: string;        // JSON永続化パス
  compressionThreshold: number; // この件数を超えたら圧縮
  compressionTargetCount: number; // 圧縮後に残すサマリー件数
  autoRetrieveOnRun: boolean;  // run()時に自動で関連記憶を参照
  maxContextEntries: number;   // Promptに注入する最大エントリ数
}

export const DEFAULT_MEMORY_CONFIG: ContextMemoryConfig = {
  shortTermCapacity: 50,
  longTermPath: './data/agi-memory.json',
  compressionThreshold: 200,
  compressionTargetCount: 20,
  autoRetrieveOnRun: true,
  maxContextEntries: 5,
};

/** メモリ統計 */
export interface MemoryStats {
  totalEntries: number;
  shortTermCount: number;
  longTermCount: number;
  byOutcome: Record<string, number>;
  byKind: Record<string, number>;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}

// ──────────────────────────────────────────
// ContextMemory クラス
// ──────────────────────────────────────────

export class ContextMemory {
  private shortTerm: MemoryEntry[] = [];      // 高速アクセス (in-memory)
  private longTerm: MemoryEntry[] = [];       // 永続ストア (JSON)
  private config: ContextMemoryConfig;
  private llmCall: ((system: string, message: string) => Promise<string>) | null;

  constructor(
    config?: Partial<ContextMemoryConfig>,
    llmCall?: (system: string, message: string) => Promise<string>
  ) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.llmCall = llmCall || null;
    this._loadLongTerm();
  }

  // ──────────────────────────────────────────
  // 記憶の追加
  // ──────────────────────────────────────────

  /**
   * タスク実行完了後に呼び出す。
   * AGILayer.run() から自動呼び出しされる。
   */
  async recordTaskExecution(
    plan: TaskPlan,
    results: Map<string, TaskResult>,
    summary: string
  ): Promise<MemoryEntry> {
    const doneCount = plan.subtasks.filter(t => t.status === 'done').length;
    const failCount = plan.subtasks.filter(t => t.status === 'failed').length;
    const duration = plan.completedAt ? plan.completedAt - plan.createdAt : 0;

    const outcome: MemoryEntry['outcome'] =
      failCount === 0 ? 'success' :
      doneCount > 0   ? 'partial' : 'failure';

    // タグを自動抽出（タスクタイプ + キーワード）
    const taskTypes = [...new Set(plan.subtasks.map(t => t.type))];
    const autoTags = this._extractTags(plan.originalQuery, taskTypes);

    const entry: MemoryEntry = {
      id: this._genId(),
      kind: 'task_execution',
      timestamp: Date.now(),
      query: plan.originalQuery,
      summary,
      tags: autoTags,
      outcome,
      details: {
        planId: plan.id,
        subtaskCount: plan.subtasks.length,
        duration,
      }
    };

    await this._add(entry);
    return entry;
  }

  /**
   * エラーパターンを記録（SelfRepairと連携）
   */
  async recordErrorPattern(
    query: string,
    errorMessage: string,
    repairStrategy: string,
    repairSuccess: boolean
  ): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: this._genId(),
      kind: 'error_pattern',
      timestamp: Date.now(),
      query,
      summary: `エラー: ${errorMessage.slice(0, 100)} → 修復戦略: ${repairStrategy} (${repairSuccess ? '成功' : '失敗'})`,
      tags: ['error', repairStrategy, repairSuccess ? 'repair_success' : 'repair_fail'],
      outcome: repairSuccess ? 'partial' : 'failure',
      details: { errorMessage, repairApplied: true }
    };
    await this._add(entry);
    return entry;
  }

  /**
   * ユーザー操作の傾向を記録
   */
  async recordUserPreference(preference: string, tags: string[] = []): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: this._genId(),
      kind: 'user_preference',
      timestamp: Date.now(),
      query: preference,
      summary: preference,
      tags: ['preference', ...tags],
      outcome: 'success',
    };
    await this._add(entry);
    return entry;
  }

  /**
   * 汎用エントリ追加（renderer側から直接記録する用途）
   */
  async addEntry(partial: {
    kind: MemoryKind;
    query: string;
    summary: string;
    tags: string[];
    outcome: MemoryEntry['outcome'];
    details?: MemoryEntry['details'];
  }): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: this._genId(),
      kind: partial.kind,
      timestamp: Date.now(),
      query: partial.query,
      summary: partial.summary,
      tags: partial.tags,
      outcome: partial.outcome,
      details: partial.details,
    };
    await this._add(entry);
    return entry;
  }

  // ──────────────────────────────────────────
  // 記憶の検索
  // ──────────────────────────────────────────

  /**
   * キーワード + フィルタで記憶を検索
   */
  search(options: MemorySearchOptions): MemorySearchResult[] {
    const limit = options.limit ?? 10;
    const all = [...this.shortTerm, ...this.longTerm];

    // フィルタリング
    let filtered = all.filter(entry => {
      if (options.kind && entry.kind !== options.kind) return false;
      if (options.outcome && entry.outcome !== options.outcome) return false;
      if (options.sinceMs && entry.timestamp < Date.now() - options.sinceMs) return false;
      if (options.tags?.length) {
        const hasAllTags = options.tags.every(tag => entry.tags.includes(tag));
        if (!hasAllTags) return false;
      }
      return true;
    });

    // スコアリング
    const scored = filtered.map(entry => ({
      entry,
      score: this._scoreEntry(entry, options.query)
    }));

    // スコア降順ソート → limit件
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * クエリに関連する記憶をLLM Promptに注入できる形で取得
   */
  getContextForQuery(query: string): string {
    if (!this.config.autoRetrieveOnRun) return '';

    const results = this.search({
      query,
      limit: this.config.maxContextEntries
    });

    if (results.length === 0) return '';

    const lines: string[] = ['【過去の関連実行履歴】'];
    for (const { entry, score } of results) {
      const date = new Date(entry.timestamp).toLocaleString('ja-JP');
      const icon = entry.outcome === 'success' ? '✅' :
                   entry.outcome === 'partial' ? '⚠️' : '❌';
      lines.push(`${icon} [${date}] ${entry.query}`);
      lines.push(`   → ${entry.summary}`);
      if (entry.details?.duration) {
        lines.push(`   所要時間: ${(entry.details.duration / 1000).toFixed(1)}秒`);
      }
    }
    lines.push('');

    return lines.join('\n');
  }

  /**
   * 直近N件のSTMエントリを取得
   */
  getRecentEntries(n: number = 10): MemoryEntry[] {
    // STM + LTM を統合して最新順に返す（重複IDを除去）
    const seen = new Set<string>();
    const all: MemoryEntry[] = [];
    for (const e of [...this.shortTerm, ...this.longTerm]) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        all.push(e);
      }
    }
    return all
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, n);
  }

  /**
   * ★ Phase 5-C: 全エントリ取得（重複除去済み）
   */
  getAllEntries(): MemoryEntry[] {
    const seen = new Set<string>();
    const all: MemoryEntry[] = [];
    for (const e of [...this.shortTerm, ...this.longTerm]) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        all.push(e);
      }
    }
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * ★ Phase 5-C: 個別エントリ削除
   */
  deleteEntry(id: string): boolean {
    const stmLen = this.shortTerm.length;
    const ltmLen = this.longTerm.length;
    this.shortTerm = this.shortTerm.filter(e => e.id !== id);
    this.longTerm = this.longTerm.filter(e => e.id !== id);
    const deleted = this.shortTerm.length < stmLen || this.longTerm.length < ltmLen;
    if (deleted) {
      this._saveLongTerm();
      console.log(`[Memory] エントリ削除: ${id}`);
    }
    return deleted;
  }

  /**
   * ★ Phase 5-C: タイムライン集計データ（日別・種類別）
   */
  getTimelineData(): { date: string; success: number; failure: number; partial: number; total: number }[] {
    const all = this.getAllEntries();
    const buckets: Record<string, { success: number; failure: number; partial: number; total: number }> = {};

    for (const e of all) {
      const date = new Date(e.timestamp).toISOString().slice(0, 10);
      if (!buckets[date]) buckets[date] = { success: 0, failure: 0, partial: 0, total: 0 };
      buckets[date].total++;
      if (e.outcome === 'success') buckets[date].success++;
      else if (e.outcome === 'failure') buckets[date].failure++;
      else buckets[date].partial++;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30) // 直近30日
      .map(([date, data]) => ({ date, ...data }));
  }

  /**
   * ★ Phase 5-C: タグ分布データ
   */
  getTagDistribution(): { tag: string; count: number }[] {
    const all = this.getAllEntries();
    const counts: Record<string, number> = {};
    for (const e of all) {
      for (const t of e.tags || []) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([tag, count]) => ({ tag, count }));
  }

  // ──────────────────────────────────────────
  // 記憶の圧縮（メモリ管理）
  // ──────────────────────────────────────────

  /**
   * 古い記憶をLLMでサマリー化する。
   * longTermがcompressionThresholdを超えたら自動起動。
   */
  async compressIfNeeded(): Promise<boolean> {
    if (this.longTerm.length < this.config.compressionThreshold) return false;
    if (!this.llmCall) {
      // LLMなし → 単純に古いものを削除
      const keep = this.config.compressionTargetCount * 2;
      this.longTerm = this.longTerm
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, keep);
      this._saveLongTerm();
      return true;
    }

    // LLMありの場合: 古いN件をまとめてサマリー
    const sorted = [...this.longTerm].sort((a, b) => a.timestamp - b.timestamp);
    const toCompress = sorted.slice(0, this.longTerm.length - this.config.compressionTargetCount);
    const toKeep = sorted.slice(this.longTerm.length - this.config.compressionTargetCount);

    try {
      const summaryText = await this._generateCompressionSummary(toCompress);
      const compressedEntry: MemoryEntry = {
        id: this._genId(),
        kind: 'summary',
        timestamp: Date.now(),
        query: `${toCompress.length}件の実行履歴サマリー`,
        summary: summaryText,
        tags: ['compressed', 'summary'],
        outcome: 'success',
        compressedFrom: toCompress.map(e => e.id)
      };

      this.longTerm = [compressedEntry, ...toKeep];
      this._saveLongTerm();
      console.log(`[Memory] ${toCompress.length}件 → サマリー1件に圧縮`);
      return true;
    } catch (e) {
      console.warn('[Memory] 圧縮失敗:', e);
      return false;
    }
  }

  // ──────────────────────────────────────────
  // 永続化
  // ──────────────────────────────────────────

  private _loadLongTerm(): void {
    try {
      const filePath = this.config.longTermPath;
      if (!fs.existsSync(filePath)) return;
      const raw = fs.readFileSync(filePath, 'utf-8');
      this.longTerm = JSON.parse(raw) as MemoryEntry[];
      // ★ 修正: 起動時にLTMの直近件数をSTMにも復元（記憶タブに表示されるよう）
      this.shortTerm = this.longTerm
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.config.shortTermCapacity);
      console.log(`[Memory] 長期記憶ロード: ${this.longTerm.length}件 (STM復元: ${this.shortTerm.length}件)`);
    } catch (e) {
      console.warn('[Memory] 長期記憶ロード失敗:', e);
      this.longTerm = [];
    }
  }

  private _saveLongTerm(): void {
    try {
      const filePath = this.config.longTermPath;
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(this.longTerm, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Memory] 長期記憶保存失敗:', e);
    }
  }

  // ──────────────────────────────────────────
  // 統計
  // ──────────────────────────────────────────

  getStats(): MemoryStats {
    const all = [...this.shortTerm, ...this.longTerm];
    const byOutcome: Record<string, number> = {};
    const byKind: Record<string, number> = {};

    for (const e of all) {
      byOutcome[e.outcome] = (byOutcome[e.outcome] || 0) + 1;
      byKind[e.kind] = (byKind[e.kind] || 0) + 1;
    }

    const timestamps = all.map(e => e.timestamp);
    return {
      totalEntries: all.length,
      shortTermCount: this.shortTerm.length,
      longTermCount: this.longTerm.length,
      byOutcome,
      byKind,
      oldestTimestamp: timestamps.length ? Math.min(...timestamps) : null,
      newestTimestamp: timestamps.length ? Math.max(...timestamps) : null,
    };
  }

  /**
   * 全記憶を消去（デバッグ・リセット用）
   */
  clear(target: 'all' | 'short' | 'long' = 'all'): void {
    if (target === 'all' || target === 'short') this.shortTerm = [];
    if (target === 'all' || target === 'long') {
      this.longTerm = [];
      this._saveLongTerm();
    }
    console.log(`[Memory] クリア完了: ${target}`);
  }

  // ──────────────────────────────────────────
  // プライベートヘルパー
  // ──────────────────────────────────────────

  private async _add(entry: MemoryEntry): Promise<void> {
    // STMに追加
    this.shortTerm.unshift(entry);
    if (this.shortTerm.length > this.config.shortTermCapacity) {
      // STMからあふれたものをLTMへ昇格
      const overflow = this.shortTerm.splice(this.config.shortTermCapacity);
      this.longTerm.push(...overflow);
    }

    // ★ 修正: STM追加時に即LTMにも保存して永続化（再起動後も残る）
    const alreadyInLTM = this.longTerm.some(e => e.id === entry.id);
    if (!alreadyInLTM) {
      this.longTerm.unshift(entry);
    }
    this._saveLongTerm();

    // 圧縮チェック（非同期・ノンブロッキング）
    this.compressIfNeeded().catch(e => console.warn('[Memory] 圧縮エラー:', e));
  }

  /**
   * 関連度スコアの計算
   * キーワード一致 + 鮮度 の複合スコア
   */
  private _scoreEntry(entry: MemoryEntry, query?: string): number {
    let score = 0;

    // 鮮度スコア（1日以内 → 0.5, 1週間以内 → 0.3, それ以前 → 0.1）
    const ageMs = Date.now() - entry.timestamp;
    const ageDay = ageMs / (1000 * 60 * 60 * 24);
    score += ageDay < 1 ? 0.5 : ageDay < 7 ? 0.3 : 0.1;

    // 成功ボーナス
    if (entry.outcome === 'success') score += 0.2;
    else if (entry.outcome === 'partial') score += 0.1;

    if (!query) return score;

    // キーワードマッチスコア
    const tokens = this._tokenize(query);
    const entryText = `${entry.query} ${entry.summary} ${entry.tags.join(' ')}`.toLowerCase();

    let matchCount = 0;
    for (const token of tokens) {
      if (entryText.includes(token)) matchCount++;
    }
    score += tokens.length > 0 ? (matchCount / tokens.length) * 0.5 : 0;

    return Math.min(score, 1);
  }

  private _tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\u3040-\u9FFF\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  private _extractTags(query: string, taskTypes: string[]): string[] {
    const tags = [...taskTypes];

    // 操作対象のキーワードを抽出
    const keywords = [
      'notepad', 'excel', 'browser', 'chrome', 'edge',
      'file', 'folder', 'clipboard',
      'd-fumt', 'rei', 'dfumt',
      'search', 'web', 'download',
      'google', 'docs', 'mail',
    ];
    const lower = query.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw)) tags.push(kw);
    }

    return [...new Set(tags)];
  }

  private async _generateCompressionSummary(entries: MemoryEntry[]): Promise<string> {
    if (!this.llmCall) {
      return `${entries.length}件の実行履歴（${
        new Date(entries[0].timestamp).toLocaleDateString('ja-JP')
      } ～ ${
        new Date(entries[entries.length - 1].timestamp).toLocaleDateString('ja-JP')
      }）`;
    }

    const lines = entries.map(e => `- ${e.outcome === 'success' ? '✅' : '❌'} ${e.query}: ${e.summary}`);
    const prompt = `以下はRei-AIOSの実行履歴です。重要なパターンや学習事項を3-5文で日本語サマリーにしてください:\n\n${lines.join('\n')}`;

    try {
      const result = await this.llmCall(
        'あなたはRei-AIOSのメモリ管理AIです。実行履歴から学習パターンを抽出します。',
        prompt
      );
      return result.slice(0, 500); // 最大500文字
    } catch {
      return `${entries.length}件の実行履歴サマリー（自動圧縮）`;
    }
  }

  private _genId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }
}
