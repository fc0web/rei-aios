/**
 * Rei-AIOS — HistorianDB
 * SQLiteベースの講師データベース。
 * 1000名規模の拡張に対応する。
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import {
  HISTORIAN_DB,
  type HistorianPersona,
  type HistorianDomain,
  type HistorianRegion,
} from './historian-personas';
import { HISTORIAN_SEEDS, buildPromptTemplate, type HistorianSeed } from './historian-seed';

export class HistorianDB {
  private db: Database.Database;

  constructor(dbPath = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this._initSchema();
    this._seed();
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS historians (
        id        TEXT PRIMARY KEY,
        nameJa    TEXT NOT NULL,
        nameEn    TEXT NOT NULL,
        period    TEXT NOT NULL,
        region    TEXT NOT NULL,
        domains   TEXT NOT NULL DEFAULT '[]',
        coreAxiom TEXT NOT NULL,
        style     TEXT NOT NULL DEFAULT '',
        isFree    INTEGER NOT NULL DEFAULT 1,
        source    TEXT NOT NULL DEFAULT 'seed'
      );
      CREATE INDEX IF NOT EXISTS idx_region  ON historians(region);
      CREATE INDEX IF NOT EXISTS idx_isFree  ON historians(isFree);
    `);
  }

  // ─── 初期データ投入 ──────────────────────────────────────

  private _seed(): void {
    const count = (this.db.prepare('SELECT COUNT(*) as cnt FROM historians').get() as any).cnt;
    if (count > 0) return;

    // コアキャラクター（TypeScriptから）
    const insertCore = this.db.prepare(`
      INSERT OR IGNORE INTO historians (id, nameJa, nameEn, period, region, domains, coreAxiom, style, isFree, source)
      VALUES (@id, @nameJa, @nameEn, @period, @region, @domains, @coreAxiom, @style, @isFree, 'core')
    `);

    const seedCore = this.db.transaction(() => {
      for (const h of HISTORIAN_DB) {
        insertCore.run({
          id:        h.id,
          nameJa:    h.nameJa,
          nameEn:    h.nameEn,
          period:    h.period,
          region:    h.region,
          domains:   JSON.stringify(h.domains),
          coreAxiom: h.coreAxiom,
          style:     h.responseStyle,
          isFree:    h.isFree ? 1 : 0,
        });
      }
    });
    seedCore();

    // 拡張データ（HISTORIAN_SEEDS）
    const insertSeed = this.db.prepare(`
      INSERT OR IGNORE INTO historians (id, nameJa, nameEn, period, region, domains, coreAxiom, style, isFree, source)
      VALUES (@id, @nameJa, @nameEn, @period, @region, @domains, @coreAxiom, @style, @isFree, 'seed')
    `);

    const seedExtend = this.db.transaction(() => {
      for (const s of HISTORIAN_SEEDS) {
        insertSeed.run({
          ...s,
          domains: JSON.stringify(s.domains),
          isFree:  s.isFree ? 1 : 0,
        });
      }
    });
    seedExtend();
  }

  // ─── 検索・取得 ──────────────────────────────────────────

  getById(id: string): HistorianPersona | null {
    const row = this.db.prepare('SELECT * FROM historians WHERE id = @id').get({ id }) as any;
    return row ? this._rowToPersona(row) : null;
  }

  getByRegion(region: HistorianRegion, limit = 20): HistorianPersona[] {
    return (this.db.prepare(
      'SELECT * FROM historians WHERE region = @region LIMIT @limit'
    ).all({ region, limit }) as any[]).map(r => this._rowToPersona(r));
  }

  getByDomain(domain: HistorianDomain, limit = 20): HistorianPersona[] {
    return (this.db.prepare(
      "SELECT * FROM historians WHERE domains LIKE @domain LIMIT @limit"
    ).all({ domain: `%${domain}%`, limit }) as any[]).map(r => this._rowToPersona(r));
  }

  getFree(limit = 50): HistorianPersona[] {
    return (this.db.prepare(
      'SELECT * FROM historians WHERE isFree = 1 LIMIT @limit'
    ).all({ limit }) as any[]).map(r => this._rowToPersona(r));
  }

  /** テキスト検索（名前・公理・スタイル） */
  search(query: string, limit = 10): HistorianPersona[] {
    return (this.db.prepare(`
      SELECT * FROM historians
      WHERE nameJa LIKE @q OR nameEn LIKE @q OR coreAxiom LIKE @q
      LIMIT @limit
    `).all({ q: `%${query}%`, limit }) as any[]).map(r => this._rowToPersona(r));
  }

  /** ランダムに取得 */
  getRandom(count = 3): HistorianPersona[] {
    return (this.db.prepare(
      'SELECT * FROM historians ORDER BY RANDOM() LIMIT @count'
    ).all({ count }) as any[]).map(r => this._rowToPersona(r));
  }

  // ─── 追加 ────────────────────────────────────────────────

  add(seed: HistorianSeed): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO historians
        (id, nameJa, nameEn, period, region, domains, coreAxiom, style, isFree, source)
      VALUES
        (@id, @nameJa, @nameEn, @period, @region, @domains, @coreAxiom, @style, @isFree, 'user')
    `).run({
      ...seed,
      domains: JSON.stringify(seed.domains),
      isFree:  seed.isFree ? 1 : 0,
    });
  }

  // ─── 統計 ────────────────────────────────────────────────

  getStats(): {
    total:     number;
    byRegion:  Record<string, number>;
    bySource:  Record<string, number>;
  } {
    const total    = this.count;
    const regions  = this.db.prepare(
      'SELECT region, COUNT(*) as cnt FROM historians GROUP BY region'
    ).all() as any[];
    const sources  = this.db.prepare(
      'SELECT source, COUNT(*) as cnt FROM historians GROUP BY source'
    ).all() as any[];

    return {
      total,
      byRegion: Object.fromEntries(regions.map((r: any) => [r.region, r.cnt])),
      bySource: Object.fromEntries(sources.map((s: any) => [s.source, s.cnt])),
    };
  }

  // ─── ヘルパー ────────────────────────────────────────────

  private _rowToPersona(row: any): HistorianPersona {
    const seed: HistorianSeed = {
      id:        row.id,
      nameJa:    row.nameJa,
      nameEn:    row.nameEn,
      period:    row.period,
      region:    row.region as HistorianRegion,
      domains:   JSON.parse(row.domains ?? '[]'),
      coreAxiom: row.coreAxiom,
      style:     row.style,
      isFree:    row.isFree === 1,
    };

    return {
      ...seed,
      responseStyle:  seed.style,
      keyQuotes:      [seed.coreAxiom],
      promptTemplate: buildPromptTemplate(seed),
    };
  }

  get count(): number {
    return (this.db.prepare('SELECT COUNT(*) as cnt FROM historians').get() as any).cnt;
  }

  close(): void { this.db.close(); }
}
