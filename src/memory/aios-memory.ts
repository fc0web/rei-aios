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

import Database from 'better-sqlite3';
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

// ─── SQLiteバックエンド ──────────────────────────────────────────
export class AIOSMemory {
  private db: Database.Database;

  constructor(dbPath = './dist/aios-memory.db') {
    // :memory: はSQLiteインメモリDB（テスト用）
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this._initSchema();
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id           TEXT PRIMARY KEY,
        agentId      TEXT NOT NULL,
        kind         TEXT NOT NULL,
        content      TEXT NOT NULL,
        confidence   TEXT NOT NULL DEFAULT 'TRUE',
        tags         TEXT NOT NULL DEFAULT '[]',
        createdAt    TEXT NOT NULL,
        updatedAt    TEXT NOT NULL,
        accessCount  INTEGER NOT NULL DEFAULT 0,
        relatedIds   TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_agentId     ON memories(agentId);
      CREATE INDEX IF NOT EXISTS idx_kind        ON memories(kind);
      CREATE INDEX IF NOT EXISTS idx_confidence  ON memories(confidence);
      CREATE INDEX IF NOT EXISTS idx_createdAt   ON memories(createdAt);
      CREATE INDEX IF NOT EXISTS idx_accessCount ON memories(accessCount);
    `);
  }

  // ── 行 → MemoryEntry 変換 ────────────────────────────────
  private _rowToEntry(row: any): MemoryEntry {
    return {
      ...row,
      tags:       JSON.parse(row.tags       ?? '[]'),
      relatedIds: JSON.parse(row.relatedIds ?? '[]'),
    };
  }

  // ── 記憶の保存 ───────────────────────────────────────────
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
    const id  = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const entry: MemoryEntry = {
      id,
      agentId,
      kind,
      content,
      confidence: opts.confidence ?? 'TRUE',
      tags:       opts.tags       ?? [],
      createdAt:  now,
      updatedAt:  now,
      accessCount: 0,
      relatedIds: opts.relatedIds ?? [],
    };

    this.db.prepare(`
      INSERT INTO memories
        (id, agentId, kind, content, confidence, tags, createdAt, updatedAt, accessCount, relatedIds)
      VALUES
        (@id, @agentId, @kind, @content, @confidence, @tags, @createdAt, @updatedAt, @accessCount, @relatedIds)
    `).run({
      ...entry,
      tags:       JSON.stringify(entry.tags),
      relatedIds: JSON.stringify(entry.relatedIds),
    });

    return entry;
  }

  // ── 記憶の想起 ───────────────────────────────────────────
  recall(query: MemoryQuery): MemoryEntry[] {
    let sql  = 'SELECT * FROM memories WHERE 1=1';
    const params: any = {};

    if (query.agentId)    { sql += ' AND agentId = @agentId';       params.agentId    = query.agentId; }
    if (query.kind)       { sql += ' AND kind = @kind';             params.kind       = query.kind; }
    if (query.confidence) { sql += ' AND confidence = @confidence'; params.confidence = query.confidence; }
    if (query.keyword) {
      sql += ' AND (content LIKE @kw OR tags LIKE @kw)';
      params.kw = `%${query.keyword}%`;
    }

    sql += ' ORDER BY accessCount DESC LIMIT @limit';
    params.limit = query.limit ?? 10;

    const rows = this.db.prepare(sql).all(params) as any[];

    // tags フィルタリング（JSON配列内の検索を簡易化）
    let entries = rows.map(r => this._rowToEntry(r));
    if (query.tags && query.tags.length > 0) {
      entries = entries.filter(e =>
        query.tags!.some(tag => e.tags.includes(tag))
      );
    }

    // アクセス回数更新
    const updateStmt = this.db.prepare(
      'UPDATE memories SET accessCount = accessCount + 1, updatedAt = @now WHERE id = @id'
    );
    const updateMany = this.db.transaction((items: MemoryEntry[]) => {
      const now = new Date().toISOString();
      for (const e of items) updateStmt.run({ id: e.id, now });
    });
    updateMany(entries);

    return entries;
  }

  // ── 記憶の更新 ───────────────────────────────────────────
  update(id: string, updates: Partial<Pick<MemoryEntry,
    'content' | 'confidence' | 'tags' | 'relatedIds'>>): MemoryEntry | null {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = @id').get({ id }) as any;
    if (!row) return null;

    const entry = this._rowToEntry(row);
    const updated: MemoryEntry = {
      ...entry,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.db.prepare(`
      UPDATE memories SET
        content    = @content,
        confidence = @confidence,
        tags       = @tags,
        relatedIds = @relatedIds,
        updatedAt  = @updatedAt
      WHERE id = @id
    `).run({
      id,
      content:    updated.content,
      confidence: updated.confidence,
      tags:       JSON.stringify(updated.tags),
      relatedIds: JSON.stringify(updated.relatedIds),
      updatedAt:  updated.updatedAt,
    });

    return updated;
  }

  // ── 記憶の忘却 ───────────────────────────────────────────
  forget(id: string): boolean {
    const result = this.db.prepare('DELETE FROM memories WHERE id = @id').run({ id });
    return result.changes > 0;
  }

  // ── 統計 ─────────────────────────────────────────────────
  stats(): MemoryStats {
    const rows = this.db.prepare('SELECT * FROM memories').all() as any[];
    const entries = rows.map(r => this._rowToEntry(r));

    const byKind:       Record<string, number> = {};
    const byConfidence: Record<string, number> = {};
    const byAgent:      Record<string, number> = {};

    for (const e of entries) {
      byKind[e.kind]             = (byKind[e.kind]             ?? 0) + 1;
      byConfidence[e.confidence] = (byConfidence[e.confidence] ?? 0) + 1;
      byAgent[e.agentId]         = (byAgent[e.agentId]         ?? 0) + 1;
    }

    const avgAccessCount = entries.length > 0
      ? entries.reduce((s, e) => s + e.accessCount, 0) / entries.length
      : 0;

    return {
      totalEntries: entries.length,
      byKind:       byKind as Record<MemoryKind, number>,
      byConfidence: byConfidence as Record<DFUMTValue, number>,
      byAgent,
      avgAccessCount,
    };
  }

  // ── セッションコンテキスト生成 ───────────────────────────
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

  get size(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM memories').get() as any;
    return row.cnt;
  }

  // ── DBクローズ ───────────────────────────────────────────
  close(): void {
    this.db.close();
  }
}
