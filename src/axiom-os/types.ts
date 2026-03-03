/**
 * 公理OS SQLite層 — 型定義
 *
 * 既存インターフェース (HistorianPersona, AxiomEntry, MemoryEntry) との
 * 対応関係を明示した、SQLiteテーブル用の軽量インターフェース。
 */

// ─── persons テーブル ───────────────────────────────────────────

export interface PersonRow {
  id: string;
  name_ja: string;
  name_en: string;
  period: string;
  region: string;
  domains: string[];
  core_axiom: string;
  thought_keywords: string[];
  is_free: boolean;
  created_at: string;
}

export type PersonInsert = Omit<PersonRow, 'created_at'>;
export type PersonUpdate = Partial<Omit<PersonRow, 'id' | 'created_at'>>;

// ─── theories テーブル ──────────────────────────────────────────

export interface TheoryRow {
  id: string;
  name: string;
  axiom: string;
  description: string;
  category: string;
  constant_ref: string | null;
  created_at: string;
}

export type TheoryInsert = Omit<TheoryRow, 'created_at'>;
export type TheoryUpdate = Partial<Omit<TheoryRow, 'id' | 'created_at'>>;

// ─── axioms テーブル ────────────────────────────────────────────

export interface AxiomRow {
  id: string;
  concept: string;
  name_ja: string;
  name_en: string;
  tier: string;
  category: string;
  definition: string;
  detailed_explanation: string;
  related_concepts: string[];
  tags: string[];
  is_free: boolean;
  created_at: string;
}

export type AxiomInsert = Omit<AxiomRow, 'created_at'>;
export type AxiomUpdate = Partial<Omit<AxiomRow, 'id' | 'created_at'>>;

// ─── memories テーブル ──────────────────────────────────────────

export interface MemoryRow {
  id: string;
  kind: string;
  timestamp: number;
  context: string;
  content: string;
  tags: string[];
  outcome: string;
  created_at: string;
}

export type MemoryInsert = Omit<MemoryRow, 'created_at'>;
export type MemoryUpdate = Partial<Omit<MemoryRow, 'id' | 'created_at'>>;
