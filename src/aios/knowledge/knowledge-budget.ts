/**
 * Rei-AIOS — KnowledgeBudget
 * 知識取得の容量管理・自動停止・クリーンアップを担当する。
 *
 * 七価論理による優先度:
 *   TRUE/FLOWING  → 長期保持（30日）
 *   BOTH/NEITHER  → 中期保持（14日）
 *   ZERO/FALSE    → 短期保持（7日）→ 自動削除候補
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── 型定義 ──────────────────────────────────────────────────

export interface BudgetConfig {
  maxTotalEntries:  number;   // 総エントリ上限（デフォルト: 500）
  maxPerCategory:   number;   // カテゴリ別上限（デフォルト: 50）
  maxFileSizeBytes: number;   // ファイルサイズ上限（デフォルト: 10MB）
  fetchIntervalMs:  number;   // 自動取得間隔（デフォルト: 24時間）
  retentionDays: {            // 関連度別保持日数
    TRUE:     number;         // デフォルト: 30日
    FLOWING:  number;         // デフォルト: 30日
    BOTH:     number;         // デフォルト: 14日
    NEITHER:  number;         // デフォルト: 14日
    ZERO:     number;         // デフォルト:  7日
    FALSE:    number;         // デフォルト:  7日
    INFINITY: number;         // デフォルト: 30日
  };
}

export interface BudgetStatus {
  totalEntries:     number;
  maxTotalEntries:  number;
  usagePercent:     number;   // 0-100
  byCategory:       Record<string, number>;
  fileSizeBytes:    number;
  isFull:           boolean;  // 上限到達
  isPaused:         boolean;  // 自動取得停止中
  lastFetchAt:      number;   // 最後の取得時刻（UNIXms）
  nextFetchAt:      number;   // 次回取得可能時刻
  canFetchNow:      boolean;  // 今すぐ取得可能か
  recommendation:   string;   // 推奨アクション
}

export interface BudgetEntry {
  id:          string;
  category:    string;
  relevance:   string;   // D-FUMT七価値
  createdAt:   number;   // UNIXms
  accessCount: number;
  sizeBytes:   number;
}

const DEFAULT_CONFIG: BudgetConfig = {
  maxTotalEntries:  500,
  maxPerCategory:   50,
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  fetchIntervalMs:  24 * 60 * 60 * 1000, // 24時間
  retentionDays: {
    TRUE:     30,
    FLOWING:  30,
    BOTH:     14,
    NEITHER:  14,
    ZERO:      7,
    FALSE:     7,
    INFINITY: 30,
  },
};

// ─── メインクラス ─────────────────────────────────────────────

export class KnowledgeBudget {
  private config:    BudgetConfig;
  private entries:   Map<string, BudgetEntry> = new Map();
  private isPaused:  boolean = false;
  private lastFetch: number  = 0;
  private statePath: string;

  constructor(
    statePath = './dist/knowledge-budget.json',
    config: Partial<BudgetConfig> = {}
  ) {
    this.config    = { ...DEFAULT_CONFIG, ...config };
    this.statePath = statePath;
    this._load();
  }

  // ── 取得前チェック（メイン関門） ─────────────────────────────
  canFetch(category: string): {
    allowed: boolean;
    reason: string;
    suggestion?: string;
  } {
    // 手動停止中
    if (this.isPaused) {
      return {
        allowed: false,
        reason: '手動停止中',
        suggestion: 'resume() を呼んで再開してください',
      };
    }

    // 取得間隔チェック
    const elapsed = Date.now() - this.lastFetch;
    if (this.lastFetch > 0 && elapsed < this.config.fetchIntervalMs) {
      const remainMin = Math.ceil((this.config.fetchIntervalMs - elapsed) / 60000);
      return {
        allowed: false,
        reason: `取得間隔制限中（あと${remainMin}分）`,
        suggestion: `次回取得可能: ${new Date(this.lastFetch + this.config.fetchIntervalMs).toLocaleString('ja-JP')}`,
      };
    }

    // 総上限チェック
    if (this.entries.size >= this.config.maxTotalEntries) {
      return {
        allowed: false,
        reason: `総エントリ上限到達（${this.entries.size}/${this.config.maxTotalEntries}件）`,
        suggestion: 'cleanup() でZERO/FALSE エントリを削除してから再取得してください',
      };
    }

    // カテゴリ別上限チェック
    const categoryCount = this._countByCategory(category);
    if (categoryCount >= this.config.maxPerCategory) {
      return {
        allowed: false,
        reason: `${category} の上限到達（${categoryCount}/${this.config.maxPerCategory}件）`,
        suggestion: `${category} の古いエントリを削除するか、別カテゴリを取得してください`,
      };
    }

    return { allowed: true, reason: '取得可能' };
  }

  // ── エントリ登録 ──────────────────────────────────────────────
  register(entry: Omit<BudgetEntry, 'accessCount' | 'createdAt'>): boolean {
    const check = this.canFetch(entry.category);
    if (!check.allowed) {
      console.warn(`[Budget] ${check.reason}`);
      return false;
    }
    this.entries.set(entry.id, {
      ...entry,
      accessCount: 0,
      createdAt: Date.now(),
    });
    this.lastFetch = Date.now();
    this._save();
    return true;
  }

  // ── 期限切れ・低関連度エントリの自動クリーンアップ ─────────────
  cleanup(): {
    deleted: number;
    freedEntries: number;
    details: string[];
  } {
    const now = Date.now();
    const deleted: string[] = [];
    const details: string[] = [];

    for (const [id, entry] of this.entries) {
      const retention = this.config.retentionDays[
        entry.relevance as keyof typeof this.config.retentionDays
      ] ?? 7;
      const maxAge = retention * 24 * 60 * 60 * 1000;
      const age    = now - entry.createdAt;

      if (age > maxAge) {
        this.entries.delete(id);
        deleted.push(id);
        details.push(
          `削除: ${entry.category}/${id.slice(0, 8)} (${entry.relevance}, ${Math.floor(age / 86400000)}日経過)`
        );
      }
    }

    if (deleted.length > 0) this._save();

    return {
      deleted: deleted.length,
      freedEntries: deleted.length,
      details,
    };
  }

  // ── 手動停止・再開 ────────────────────────────────────────────
  pause():  void { this.isPaused = true;  this._save(); console.log('[Budget] 自動取得を停止しました'); }
  resume(): void { this.isPaused = false; this._save(); console.log('[Budget] 自動取得を再開しました'); }

  // ── 現在の状態 ────────────────────────────────────────────────
  status(): BudgetStatus {
    const total       = this.entries.size;
    const max         = this.config.maxTotalEntries;
    const usagePct    = Math.round((total / max) * 100);
    const nextFetch   = this.lastFetch + this.config.fetchIntervalMs;
    const canFetch    = !this.isPaused && Date.now() >= nextFetch && total < max;
    const fileSize    = this._estimateFileSize();

    // カテゴリ別集計
    const byCategory: Record<string, number> = {};
    for (const e of this.entries.values()) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    }

    // 推奨アクション
    let recommendation = '正常稼働中';
    if (usagePct >= 90)      recommendation = '容量90%超: cleanup()を実行してください';
    else if (usagePct >= 75) recommendation = '容量75%超: 近日中にcleanup()を推奨';
    else if (this.isPaused)  recommendation = '停止中: resume()で再開できます';

    return {
      totalEntries: total,
      maxTotalEntries: max,
      usagePercent: usagePct,
      byCategory,
      fileSizeBytes: fileSize,
      isFull:    total >= max,
      isPaused:  this.isPaused,
      lastFetchAt:  this.lastFetch,
      nextFetchAt:  nextFetch,
      canFetchNow:  canFetch,
      recommendation,
    };
  }

  // ── 関連度別集計 ──────────────────────────────────────────────
  statsByRelevance(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const e of this.entries.values()) {
      result[e.relevance] = (result[e.relevance] ?? 0) + 1;
    }
    return result;
  }

  // ── 内部メソッド ──────────────────────────────────────────────
  private _countByCategory(category: string): number {
    let count = 0;
    for (const e of this.entries.values()) {
      if (e.category === category) count++;
    }
    return count;
  }

  private _estimateFileSize(): number {
    let size = 0;
    for (const e of this.entries.values()) {
      size += e.sizeBytes;
    }
    return size;
  }

  private _load(): void {
    try {
      if (fs.existsSync(this.statePath)) {
        const data = JSON.parse(fs.readFileSync(this.statePath, 'utf-8'));
        this.isPaused  = data.isPaused  ?? false;
        this.lastFetch = data.lastFetch ?? 0;
        this.entries   = new Map(Object.entries(data.entries ?? {}));
      }
    } catch { /* 初回は空で開始 */ }
  }

  private _save(): void {
    try {
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.statePath, JSON.stringify({
        isPaused:  this.isPaused,
        lastFetch: this.lastFetch,
        entries:   Object.fromEntries(this.entries),
      }, null, 2));
    } catch (e: any) {
      console.warn('[Budget] 保存失敗:', e.message);
    }
  }
}
