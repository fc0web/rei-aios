/**
 * 公理OS — CRUD 操作クラス
 *
 * better-sqlite3 の同期APIで全テーブルの基本操作を提供する。
 */

import type Database from 'better-sqlite3';
import { openDatabase } from './db';
import { SEED_PERSONS, SEED_THEORIES, SEED_AXIOMS } from './seed';
import type {
  PersonRow, PersonInsert, PersonUpdate,
  TheoryRow, TheoryInsert, TheoryUpdate,
  AxiomRow, AxiomInsert, AxiomUpdate,
  MemoryRow, MemoryInsert, MemoryUpdate,
} from './types';

// ─── JSON / Boolean ヘルパー ───

function toJson(arr: string[]): string {
  return JSON.stringify(arr);
}

function fromJson(text: any): string[] {
  if (Array.isArray(text)) return text;
  if (typeof text === 'string') {
    try { return JSON.parse(text); } catch { return []; }
  }
  return [];
}

function toBool(v: any): boolean {
  return v === 1 || v === true;
}

function fromBool(v: boolean): number {
  return v ? 1 : 0;
}

// ─── Row マッパー ───

function toPersonRow(raw: any): PersonRow {
  return {
    id: raw.id,
    name_ja: raw.name_ja,
    name_en: raw.name_en,
    period: raw.period,
    region: raw.region,
    domains: fromJson(raw.domains),
    core_axiom: raw.core_axiom,
    thought_keywords: fromJson(raw.thought_keywords),
    is_free: toBool(raw.is_free),
    created_at: raw.created_at,
  };
}

function toTheoryRow(raw: any): TheoryRow {
  return {
    id: raw.id,
    name: raw.name,
    axiom: raw.axiom,
    description: raw.description,
    category: raw.category,
    constant_ref: raw.constant_ref ?? null,
    created_at: raw.created_at,
  };
}

function toAxiomRow(raw: any): AxiomRow {
  return {
    id: raw.id,
    concept: raw.concept,
    name_ja: raw.name_ja,
    name_en: raw.name_en,
    tier: raw.tier,
    category: raw.category,
    definition: raw.definition,
    detailed_explanation: raw.detailed_explanation,
    related_concepts: fromJson(raw.related_concepts),
    tags: fromJson(raw.tags),
    is_free: toBool(raw.is_free),
    created_at: raw.created_at,
  };
}

function toMemoryRow(raw: any): MemoryRow {
  return {
    id: raw.id,
    kind: raw.kind,
    timestamp: raw.timestamp,
    context: raw.context,
    content: raw.content,
    tags: fromJson(raw.tags),
    outcome: raw.outcome,
    created_at: raw.created_at,
  };
}

// ═══════════════════════════════════════════
// AxiomOSStore
// ═══════════════════════════════════════════

export class AxiomOSStore {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:', options?: { seed?: boolean }) {
    this.db = openDatabase(dbPath);
    if (options?.seed) {
      this.seedDatabase();
    }
  }

  close(): void {
    this.db.close();
  }

  // ─── Seed ───

  private seedDatabase(): void {
    const tx = this.db.transaction(() => {
      for (const p of SEED_PERSONS) this.createPerson(p);
      for (const t of SEED_THEORIES) this.createTheory(t);
      for (const a of SEED_AXIOMS) this.createAxiom(a);
    });
    tx();
  }

  // ═══════════════════════════════════════════
  // persons CRUD
  // ═══════════════════════════════════════════

  createPerson(data: PersonInsert): PersonRow {
    this.db.prepare(`
      INSERT INTO persons (id, name_ja, name_en, period, region, domains, core_axiom, thought_keywords, is_free)
      VALUES (@id, @name_ja, @name_en, @period, @region, @domains, @core_axiom, @thought_keywords, @is_free)
    `).run({
      ...data,
      domains: toJson(data.domains),
      thought_keywords: toJson(data.thought_keywords),
      is_free: fromBool(data.is_free),
    });
    return this.getPersonById(data.id)!;
  }

  getPersonById(id: string): PersonRow | undefined {
    const raw = this.db.prepare('SELECT * FROM persons WHERE id = ?').get(id);
    return raw ? toPersonRow(raw) : undefined;
  }

  getAllPersons(): PersonRow[] {
    return this.db.prepare('SELECT * FROM persons ORDER BY created_at').all().map(toPersonRow);
  }

  updatePerson(id: string, data: PersonUpdate): PersonRow | undefined {
    const existing = this.getPersonById(id);
    if (!existing) return undefined;

    const merged = {
      name_ja: data.name_ja ?? existing.name_ja,
      name_en: data.name_en ?? existing.name_en,
      period: data.period ?? existing.period,
      region: data.region ?? existing.region,
      domains: toJson(data.domains ?? existing.domains),
      core_axiom: data.core_axiom ?? existing.core_axiom,
      thought_keywords: toJson(data.thought_keywords ?? existing.thought_keywords),
      is_free: fromBool(data.is_free ?? existing.is_free),
    };

    this.db.prepare(`
      UPDATE persons SET name_ja=@name_ja, name_en=@name_en, period=@period, region=@region,
        domains=@domains, core_axiom=@core_axiom, thought_keywords=@thought_keywords, is_free=@is_free
      WHERE id = @id
    `).run({ id, ...merged });

    return this.getPersonById(id);
  }

  deletePerson(id: string): boolean {
    const result = this.db.prepare('DELETE FROM persons WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getPersonsByRegion(region: string): PersonRow[] {
    return this.db.prepare('SELECT * FROM persons WHERE region = ? ORDER BY created_at')
      .all(region).map(toPersonRow);
  }

  // ═══════════════════════════════════════════
  // theories CRUD
  // ═══════════════════════════════════════════

  createTheory(data: TheoryInsert): TheoryRow {
    this.db.prepare(`
      INSERT INTO theories (id, name, axiom, description, category, constant_ref)
      VALUES (@id, @name, @axiom, @description, @category, @constant_ref)
    `).run(data);
    return this.getTheoryById(data.id)!;
  }

  getTheoryById(id: string): TheoryRow | undefined {
    const raw = this.db.prepare('SELECT * FROM theories WHERE id = ?').get(id);
    return raw ? toTheoryRow(raw) : undefined;
  }

  getAllTheories(): TheoryRow[] {
    return this.db.prepare('SELECT * FROM theories ORDER BY created_at').all().map(toTheoryRow);
  }

  updateTheory(id: string, data: TheoryUpdate): TheoryRow | undefined {
    const existing = this.getTheoryById(id);
    if (!existing) return undefined;

    const merged = {
      name: data.name ?? existing.name,
      axiom: data.axiom ?? existing.axiom,
      description: data.description ?? existing.description,
      category: data.category ?? existing.category,
      constant_ref: data.constant_ref !== undefined ? data.constant_ref : existing.constant_ref,
    };

    this.db.prepare(`
      UPDATE theories SET name=@name, axiom=@axiom, description=@description,
        category=@category, constant_ref=@constant_ref
      WHERE id = @id
    `).run({ id, ...merged });

    return this.getTheoryById(id);
  }

  deleteTheory(id: string): boolean {
    const result = this.db.prepare('DELETE FROM theories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getTheoriesByCategory(category: string): TheoryRow[] {
    return this.db.prepare('SELECT * FROM theories WHERE category = ? ORDER BY created_at')
      .all(category).map(toTheoryRow);
  }

  // ═══════════════════════════════════════════
  // axioms CRUD
  // ═══════════════════════════════════════════

  createAxiom(data: AxiomInsert): AxiomRow {
    this.db.prepare(`
      INSERT INTO axioms (id, concept, name_ja, name_en, tier, category, definition,
        detailed_explanation, related_concepts, tags, is_free)
      VALUES (@id, @concept, @name_ja, @name_en, @tier, @category, @definition,
        @detailed_explanation, @related_concepts, @tags, @is_free)
    `).run({
      ...data,
      related_concepts: toJson(data.related_concepts),
      tags: toJson(data.tags),
      is_free: fromBool(data.is_free),
    });
    return this.getAxiomById(data.id)!;
  }

  getAxiomById(id: string): AxiomRow | undefined {
    const raw = this.db.prepare('SELECT * FROM axioms WHERE id = ?').get(id);
    return raw ? toAxiomRow(raw) : undefined;
  }

  getAllAxioms(): AxiomRow[] {
    return this.db.prepare('SELECT * FROM axioms ORDER BY created_at').all().map(toAxiomRow);
  }

  updateAxiom(id: string, data: AxiomUpdate): AxiomRow | undefined {
    const existing = this.getAxiomById(id);
    if (!existing) return undefined;

    const merged = {
      concept: data.concept ?? existing.concept,
      name_ja: data.name_ja ?? existing.name_ja,
      name_en: data.name_en ?? existing.name_en,
      tier: data.tier ?? existing.tier,
      category: data.category ?? existing.category,
      definition: data.definition ?? existing.definition,
      detailed_explanation: data.detailed_explanation ?? existing.detailed_explanation,
      related_concepts: toJson(data.related_concepts ?? existing.related_concepts),
      tags: toJson(data.tags ?? existing.tags),
      is_free: fromBool(data.is_free ?? existing.is_free),
    };

    this.db.prepare(`
      UPDATE axioms SET concept=@concept, name_ja=@name_ja, name_en=@name_en, tier=@tier,
        category=@category, definition=@definition, detailed_explanation=@detailed_explanation,
        related_concepts=@related_concepts, tags=@tags, is_free=@is_free
      WHERE id = @id
    `).run({ id, ...merged });

    return this.getAxiomById(id);
  }

  deleteAxiom(id: string): boolean {
    const result = this.db.prepare('DELETE FROM axioms WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getAxiomsByCategory(category: string): AxiomRow[] {
    return this.db.prepare('SELECT * FROM axioms WHERE category = ? ORDER BY created_at')
      .all(category).map(toAxiomRow);
  }

  searchAxiomsByTag(tag: string): AxiomRow[] {
    return this.db.prepare(`SELECT * FROM axioms WHERE tags LIKE ? ORDER BY created_at`)
      .all(`%"${tag}"%`).map(toAxiomRow);
  }

  // ═══════════════════════════════════════════
  // memories CRUD
  // ═══════════════════════════════════════════

  createMemory(data: MemoryInsert): MemoryRow {
    this.db.prepare(`
      INSERT INTO memories (id, kind, timestamp, context, content, tags, outcome)
      VALUES (@id, @kind, @timestamp, @context, @content, @tags, @outcome)
    `).run({
      ...data,
      tags: toJson(data.tags),
    });
    return this.getMemoryById(data.id)!;
  }

  getMemoryById(id: string): MemoryRow | undefined {
    const raw = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
    return raw ? toMemoryRow(raw) : undefined;
  }

  getAllMemories(): MemoryRow[] {
    return this.db.prepare('SELECT * FROM memories ORDER BY timestamp DESC').all().map(toMemoryRow);
  }

  updateMemory(id: string, data: MemoryUpdate): MemoryRow | undefined {
    const existing = this.getMemoryById(id);
    if (!existing) return undefined;

    const merged = {
      kind: data.kind ?? existing.kind,
      timestamp: data.timestamp ?? existing.timestamp,
      context: data.context ?? existing.context,
      content: data.content ?? existing.content,
      tags: toJson(data.tags ?? existing.tags),
      outcome: data.outcome ?? existing.outcome,
    };

    this.db.prepare(`
      UPDATE memories SET kind=@kind, timestamp=@timestamp, context=@context,
        content=@content, tags=@tags, outcome=@outcome
      WHERE id = @id
    `).run({ id, ...merged });

    return this.getMemoryById(id);
  }

  deleteMemory(id: string): boolean {
    const result = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getRecentMemories(limit: number): MemoryRow[] {
    return this.db.prepare('SELECT * FROM memories ORDER BY timestamp DESC LIMIT ?')
      .all(limit).map(toMemoryRow);
  }

  getMemoriesByKind(kind: string): MemoryRow[] {
    return this.db.prepare('SELECT * FROM memories WHERE kind = ? ORDER BY timestamp DESC')
      .all(kind).map(toMemoryRow);
  }
}
