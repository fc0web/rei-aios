/**
 * Rei-AIOS STEP 9-A — AIOSMemory
 * AIの状態永続性（SQLiteベース長期記憶）
 *
 * 記憶の種類:
 *   - episodic: 会話・出来事の記録
 *   - semantic: 知識・事実の記録
 *   - procedural: 手順・スキルの記録
 *   - axiom: D-FUMT公理の記録
 */

import * as fs from 'fs';
import * as path from 'path';

export type MemoryKind = 'episodic' | 'semantic' | 'procedural' | 'axiom';
export type DFUMTValue = 'TRUE' | 'FALSE' | 'BOTH' | 'NEITHER' | 'INFINITY' | 'ZERO' | 'FLOWING';

export interface MemoryEntry {
  id: string;
  agentId: string;          // どのAIの記憶か
  kind: MemoryKind;
  content: string;          // 記憶の内容
  confidence: DFUMTValue;   // 七価論理による確信度
  tags: string[];
  createdAt: string;
  updatedAt: string;
  accessCount: number;      // アクセス回数（重要度の指標）
  relatedIds: string[];     // 関連記憶のID
}

export interface MemoryQuery {
  agentId?: string;
  kind?: MemoryKind;
  tags?: string[];
  confidence?: DFUMTValue;
  keyword?: string;
  limit?: number;
}

export interface MemoryStats {
  totalEntries: number;
  byKind: Record<MemoryKind, number>;
  byConfidence: Record<DFUMTValue, number>;
  byAgent: Record<string, number>;
  avgAccessCount: number;
}

// ─── インメモリSQLite代替（SQLiteなしで動作） ──────────────────
export class AIOSMemory {
  private store: Map<string, MemoryEntry> = new Map();
  private dbPath: string;

  constructor(dbPath = './dist/aios-memory.json') {
    this.dbPath = dbPath;
    this._load();
  }

  // ── 記憶の保存 ──────────────────────────────────────────────
  remember(
    agentId: string,
    kind: MemoryKind,
    content: string,
    opts: {
      confidence?: DFUMTValue;
      tags?: string[];
      relatedIds?: string[];
    } = {}
  ): MemoryEntry {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const entry: MemoryEntry = {
      id,
      agentId,
      kind,
      content,
      confidence: opts.confidence ?? 'TRUE',
      tags: opts.tags ?? [],
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      relatedIds: opts.relatedIds ?? [],
    };

    this.store.set(id, entry);
    this._save();
    return entry;
  }

  // ── 記憶の想起 ──────────────────────────────────────────────
  recall(query: MemoryQuery): MemoryEntry[] {
    let results = Array.from(this.store.values());

    if (query.agentId) {
      results = results.filter(e => e.agentId === query.agentId);
    }
    if (query.kind) {
      results = results.filter(e => e.kind === query.kind);
    }
    if (query.confidence) {
      results = results.filter(e => e.confidence === query.confidence);
    }
    if (query.tags && query.tags.length > 0) {
      results = results.filter(e =>
        query.tags!.some(tag => e.tags.includes(tag))
      );
    }
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      results = results.filter(e =>
        e.content.toLowerCase().includes(kw) ||
        e.tags.some(t => t.toLowerCase().includes(kw))
      );
    }

    // アクセス回数を更新
    for (const entry of results) {
      entry.accessCount++;
      entry.updatedAt = new Date().toISOString();
    }

    // 重要度順（アクセス回数）にソート
    results.sort((a, b) => b.accessCount - a.accessCount);

    this._save();
    return results.slice(0, query.limit ?? 10);
  }

  // ── 記憶の更新 ──────────────────────────────────────────────
  update(id: string, updates: Partial<Pick<MemoryEntry,
    'content' | 'confidence' | 'tags' | 'relatedIds'>>): MemoryEntry | null {
    const entry = this.store.get(id);
    if (!entry) return null;

    Object.assign(entry, updates, { updatedAt: new Date().toISOString() });
    this.store.set(id, entry);
    this._save();
    return entry;
  }

  // ── 記憶の忘却（D-FUMT: ZERO） ──────────────────────────────
  forget(id: string): boolean {
    const deleted = this.store.delete(id);
    if (deleted) this._save();
    return deleted;
  }

  // ── 記憶の統計 ──────────────────────────────────────────────
  stats(): MemoryStats {
    const entries = Array.from(this.store.values());
    const byKind: Record<string, number> = {};
    const byConfidence: Record<string, number> = {};
    const byAgent: Record<string, number> = {};

    for (const e of entries) {
      byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
      byConfidence[e.confidence] = (byConfidence[e.confidence] ?? 0) + 1;
      byAgent[e.agentId] = (byAgent[e.agentId] ?? 0) + 1;
    }

    const avgAccessCount = entries.length > 0
      ? entries.reduce((s, e) => s + e.accessCount, 0) / entries.length
      : 0;

    return {
      totalEntries: entries.length,
      byKind: byKind as Record<MemoryKind, number>,
      byConfidence: byConfidence as Record<DFUMTValue, number>,
      byAgent,
      avgAccessCount,
    };
  }

  // ── セッションコンテキスト生成 ──────────────────────────────
  // AIが新しい会話を始める前に「自分が何を知っているか」を要約する
  buildContext(agentId: string, maxEntries = 5): string {
    const recent = this.recall({ agentId, limit: maxEntries });
    if (recent.length === 0) return `[${agentId}]: 記憶なし（新しいセッション）`;

    const lines = recent.map(e => {
      const symbol = {
        TRUE:'⊤', FALSE:'⊥', BOTH:'B', NEITHER:'N',
        INFINITY:'∞', ZERO:'〇', FLOWING:'～'
      }[e.confidence] ?? '?';
      return `  [${symbol}] ${e.kind}: ${e.content.slice(0, 80)}`;
    });

    return `[${agentId}の記憶コンテキスト]\n${lines.join('\n')}`;
  }

  // ── 永続化 ──────────────────────────────────────────────────
  private _save(): void {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = JSON.stringify(Array.from(this.store.entries()), null, 2);
      fs.writeFileSync(this.dbPath, data, 'utf8');
    } catch { /* 保存失敗は無視（テスト環境対応） */ }
  }

  private _load(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
        this.store = new Map(data);
      }
    } catch { /* 読み込み失敗は無視 */ }
  }

  get size(): number { return this.store.size; }
}
