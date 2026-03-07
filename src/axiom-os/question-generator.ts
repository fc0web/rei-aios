/**
 * Rei-AIOS STEP 23-A — QuestionGenerator
 * 「問いを立てる」能力
 *
 * SEED_KERNELの矛盾・空白・境界領域から
 * 自律的に「問い」を生成し記録する。
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { SEED_KERNEL } from './seed-kernel';
import { ContradictionDetectorEnhanced } from '../logic/contradiction-detector-enhanced';
import { SevenValueClassifier } from '../logic/seven-value-classifier';
import type { DFUMTValue } from '../memory/aios-memory';
import type { AxiomStatement } from '../logic/contradiction-detector-enhanced';

// ─── 型定義 ──────────────────────────────────────────────────

export type QuestionType =
  | 'contradiction'
  | 'boundary'
  | 'gap'
  | 'deepening'
  | 'synthesis';

export interface GeneratedQuestion {
  id:           string;
  type:         QuestionType;
  question:     string;
  relatedIds:   string[];
  dfumtValue:   DFUMTValue;
  urgency:      number;
  llmPrompt:    string;
  llmAnswer?:   string;
  status:       'open' | 'investigating' | 'resolved';
  createdAt:    number;
  resolvedAt?:  number;
}

export interface ILLMForQuestion {
  generate(prompt: string, systemPrompt?: string): Promise<string>;
}

// ─── QuestionGenerator 本体 ───────────────────────────────────

export class QuestionGenerator {
  private db:       Database.Database;
  private detector: ContradictionDetectorEnhanced;
  private clf:      SevenValueClassifier;
  private llm?:     ILLMForQuestion;
  private log:      (msg: string) => void;

  constructor(opts: {
    dbPath?: string;
    llm?:    ILLMForQuestion;
    log?:    (msg: string) => void;
  } = {}) {
    const dbPath = opts.dbPath ?? ':memory:';
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    this.db       = new Database(dbPath);
    this.detector = new ContradictionDetectorEnhanced();
    this.clf      = new SevenValueClassifier();
    this.llm      = opts.llm;
    this.log      = opts.log ?? (() => {});

    this._initSchema();
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS questions (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        question    TEXT NOT NULL,
        relatedIds  TEXT NOT NULL DEFAULT '[]',
        dfumtValue  TEXT NOT NULL DEFAULT 'NEITHER',
        urgency     REAL NOT NULL DEFAULT 0.5,
        llmPrompt   TEXT NOT NULL DEFAULT '',
        llmAnswer   TEXT,
        status      TEXT NOT NULL DEFAULT 'open',
        createdAt   INTEGER NOT NULL,
        resolvedAt  INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_q_status  ON questions(status);
      CREATE INDEX IF NOT EXISTS idx_q_urgency ON questions(urgency DESC);
    `);
  }

  // ─── 1. 矛盾から問いを生成 ───────────────────────────────

  generateFromContradictions(): GeneratedQuestion[] {
    const statements: AxiomStatement[] = SEED_KERNEL.map(t => ({
      id: t.id, content: t.axiom, dfumtValue: 'TRUE' as DFUMTValue,
      category: t.category, keywords: t.keywords,
    }));

    const report = this.detector.detectAll(statements);
    const questions: GeneratedQuestion[] = [];

    for (const c of report.contradictions) {
      if (c.level === 'NONE' || c.level === 'WEAK') continue;

      const q: GeneratedQuestion = {
        id:         `q_contra_${c.axiomA.id}_${c.axiomB.id}`.slice(0, 60),
        type:       'contradiction',
        question:   `「${c.axiomA.content.slice(0, 40)}」と「${c.axiomB.content.slice(0, 40)}」は矛盾するか？`,
        relatedIds: [c.axiomA.id, c.axiomB.id],
        dfumtValue: 'NEITHER',
        urgency:    c.level === 'CRITICAL' ? 0.9 : c.level === 'STRONG' ? 0.7 : 0.5,
        llmPrompt:  `D-FUMT理論で以下の2公理の矛盾を解釈せよ:\nA: "${c.axiomA.content}"\nB: "${c.axiomB.content}"`,
        status:     'open',
        createdAt:  Date.now(),
      };
      this._save(q);
      questions.push(q);
    }

    this.log(`[QGen] 矛盾から${questions.length}件の問いを生成`);
    return questions;
  }

  // ─── 2. 空白領域から問いを生成 ──────────────────────────

  generateFromGaps(): GeneratedQuestion[] {
    const questions: GeneratedQuestion[] = [];
    const categoryCounts: Record<string, number> = {};
    for (const t of SEED_KERNEL) {
      categoryCounts[t.category] = (categoryCounts[t.category] ?? 0) + 1;
    }

    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count >= 3) continue;

      const q: GeneratedQuestion = {
        id:         `q_gap_${cat}_${Date.now()}`,
        type:       'gap',
        question:   `D-FUMTの「${cat}」カテゴリには${count}理論しかない。未発見の公理は？`,
        relatedIds: SEED_KERNEL.filter(t => t.category === cat).map(t => t.id),
        dfumtValue: 'ZERO',
        urgency:    0.6,
        llmPrompt:  `D-FUMTの「${cat}」カテゴリ（現在${count}理論）で見落とされている公理を提案せよ。`,
        status:     'open',
        createdAt:  Date.now(),
      };
      this._save(q);
      questions.push(q);
    }

    this.log(`[QGen] 空白領域から${questions.length}件の問いを生成`);
    return questions;
  }

  // ─── 3. 境界から問いを生成 ──────────────────────────────

  generateFromBoundaries(): GeneratedQuestion[] {
    const questions: GeneratedQuestion[] = [];
    const categoryPairs: [string, string][] = [
      ['logic', 'consciousness'],
      ['quantum', 'mathematics'],
      ['zero_extension', 'logic'],
      ['computation', 'consciousness'],
      ['numerical', 'quantum'],
    ];

    for (const [catA, catB] of categoryPairs) {
      const theoriesA = SEED_KERNEL.filter(t => t.category === catA);
      const theoriesB = SEED_KERNEL.filter(t => t.category === catB);
      if (theoriesA.length === 0 || theoriesB.length === 0) continue;

      const q: GeneratedQuestion = {
        id:         `q_boundary_${catA}_${catB}`,
        type:       'boundary',
        question:   `「${catA}」と「${catB}」の境界でD-FUMTはどう統合されるか？`,
        relatedIds: [
          ...theoriesA.slice(0, 2).map(t => t.id),
          ...theoriesB.slice(0, 2).map(t => t.id),
        ],
        dfumtValue: 'BOTH',
        urgency:    0.55,
        llmPrompt:  `D-FUMTにおいて「${catA}」と「${catB}」の境界領域の統合公理を提案せよ。`,
        status:     'open',
        createdAt:  Date.now(),
      };
      this._save(q);
      questions.push(q);
    }

    this.log(`[QGen] 境界から${questions.length}件の問いを生成`);
    return questions;
  }

  // ─── 全問い生成を一括実行 ───────────────────────────────

  async runAll(): Promise<{
    contradictions: number; gaps: number; boundaries: number; total: number;
  }> {
    const c = this.generateFromContradictions();
    const g = this.generateFromGaps();
    const b = this.generateFromBoundaries();
    return { contradictions: c.length, gaps: g.length, boundaries: b.length, total: c.length + g.length + b.length };
  }

  // ─── 問いの取得 ──────────────────────────────────────────

  getOpenQuestions(limit = 10): GeneratedQuestion[] {
    return (this.db.prepare(
      'SELECT * FROM questions WHERE status = ? ORDER BY urgency DESC LIMIT ?'
    ).all('open', limit) as any[]).map(this._rowToQ);
  }

  getAllQuestions(): GeneratedQuestion[] {
    return (this.db.prepare('SELECT * FROM questions ORDER BY createdAt DESC').all() as any[])
      .map(this._rowToQ);
  }

  get questionCount(): number {
    return (this.db.prepare('SELECT COUNT(*) as cnt FROM questions').get() as any).cnt;
  }

  // ─── 永続化ヘルパー ──────────────────────────────────────

  private _save(q: GeneratedQuestion): void {
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO questions
          (id, type, question, relatedIds, dfumtValue, urgency, llmPrompt, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(q.id, q.type, q.question, JSON.stringify(q.relatedIds),
             q.dfumtValue, q.urgency, q.llmPrompt, q.status, q.createdAt);
    } catch { /* 重複は無視 */ }
  }

  private _rowToQ(row: any): GeneratedQuestion {
    return { ...row, relatedIds: JSON.parse(row.relatedIds ?? '[]') };
  }

  close(): void { this.db.close(); }
}
