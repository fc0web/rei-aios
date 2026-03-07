/**
 * Rei-AIOS STEP 23-B — HypothesisEngine
 * 「仮説を作る」能力
 *
 * 問いからLLMが仮説公理を生成し、
 * Rei-PLコード生成で検証してTheoryEvolutionに登録する。
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { SEED_KERNEL } from './seed-kernel';
import { TheoryEvolution, type EvolvedTheory } from './theory-evolution';
import { ContradictionDetectorEnhanced } from '../logic/contradiction-detector-enhanced';
import { ReiPLAxiomGenerator } from './rei-pl-axiom-generator';
import type { GeneratedQuestion, ILLMForQuestion } from './question-generator';
import type { AxiomStatement } from '../logic/contradiction-detector-enhanced';
import type { DFUMTValue } from '../memory/aios-memory';

// ─── 型定義 ──────────────────────────────────────────────────

export interface HypothesisCandidate {
  id:           string;
  questionId:   string;
  axiom:        string;
  category:     string;
  keywords:     string[];
  dfumtValue:   DFUMTValue;
  reiCode:      string;
  verified:     boolean;
  wasmResult?:  string;
  evolvedId?:   string;
  status:       'draft' | 'testing' | 'verified' | 'rejected' | 'promoted';
  createdAt:    number;
  reasoning:    string;
}

// ─── HypothesisEngine 本体 ──────────────────────────────────

export class HypothesisEngine {
  private db:        Database.Database;
  private evolution: TheoryEvolution;
  private detector:  ContradictionDetectorEnhanced;
  private generator: ReiPLAxiomGenerator;
  private llm?:      ILLMForQuestion;
  private log:       (msg: string) => void;

  constructor(opts: {
    dbPath?:   string;
    llm?:      ILLMForQuestion;
    log?:      (msg: string) => void;
  } = {}) {
    const dbPath = opts.dbPath ?? ':memory:';
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    this.db        = new Database(dbPath);
    this.evolution = new TheoryEvolution();
    this.detector  = new ContradictionDetectorEnhanced();
    this.generator = new ReiPLAxiomGenerator();
    this.llm       = opts.llm;
    this.log       = opts.log ?? (() => {});

    this._initSchema();
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hypotheses (
        id          TEXT PRIMARY KEY,
        questionId  TEXT NOT NULL,
        axiom       TEXT NOT NULL,
        category    TEXT NOT NULL DEFAULT 'general',
        keywords    TEXT NOT NULL DEFAULT '[]',
        dfumtValue  TEXT NOT NULL DEFAULT 'FLOWING',
        reiCode     TEXT NOT NULL DEFAULT '',
        verified    INTEGER NOT NULL DEFAULT 0,
        wasmResult  TEXT,
        evolvedId   TEXT,
        status      TEXT NOT NULL DEFAULT 'draft',
        createdAt   INTEGER NOT NULL,
        reasoning   TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_h_status     ON hypotheses(status);
      CREATE INDEX IF NOT EXISTS idx_h_questionId ON hypotheses(questionId);
    `);
  }

  // ─── 1. 仮説を生成（LLM or フォールバック） ───────────

  async generateFromQuestion(q: GeneratedQuestion): Promise<HypothesisCandidate> {
    if (this.llm) {
      try {
        const systemPrompt = `D-FUMT研究AI。JSON形式のみで回答:
{"axiom":"公理テキスト50文字以内","category":"logic|mathematics|quantum|general等","keywords":["k1","k2"],"dfumtValue":"七価値","reasoning":"理由100文字以内"}`;
        const raw = await this.llm.generate(
          `問い「${q.question}」に対する仮説公理を1つ生成:`, systemPrompt
        );
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const p = JSON.parse(match[0]);
          const hypo = this._buildHypo(q.id, p.axiom ?? '', p.category ?? 'general',
            p.keywords ?? [], p.dfumtValue ?? 'FLOWING', p.reasoning ?? '');
          this._save(hypo);
          return hypo;
        }
      } catch { /* fall through to fallback */ }
    }
    return this._generateFallback(q);
  }

  // ─── 2. 矛盾チェック ────────────────────────────────────

  checkContradiction(hypo: HypothesisCandidate): boolean {
    const stmts: AxiomStatement[] = SEED_KERNEL.slice(0, 30).map(t => ({
      id: t.id, content: t.axiom, dfumtValue: 'TRUE' as DFUMTValue,
      category: t.category, keywords: t.keywords,
    }));
    stmts.push({
      id: hypo.id, content: hypo.axiom, dfumtValue: hypo.dfumtValue,
      category: hypo.category, keywords: hypo.keywords,
    });

    const report = this.detector.detectAll(stmts);
    const critical = report.contradictions.find(
      c => (c.level === 'CRITICAL' || c.level === 'STRONG') &&
           (c.axiomA.id === hypo.id || c.axiomB.id === hypo.id)
    );
    if (critical) {
      this._updateStatus(hypo.id, 'rejected');
      this.log(`[Hypo] 矛盾検出 → 却下: ${hypo.axiom.slice(0, 40)}`);
      return false;
    }
    return true;
  }

  // ─── 3. Rei-PLコード生成検証 ────────────────────────────

  verifyWithReiPL(hypo: HypothesisCandidate): boolean {
    this._updateStatus(hypo.id, 'testing');
    const seedTheory = { id: hypo.id, axiom: hypo.axiom, category: hypo.category, keywords: hypo.keywords };
    const generated = this.generator.generate(seedTheory);

    if (generated.reiCode.length > 0) {
      this.db.prepare('UPDATE hypotheses SET reiCode = ?, verified = 1, status = ? WHERE id = ?')
        .run(generated.reiCode, 'verified', hypo.id);
      hypo.reiCode = generated.reiCode;
      hypo.verified = true;
      hypo.status = 'verified';
      this.log(`[Hypo] Rei-PL検証成功: ${hypo.axiom.slice(0, 50)}`);
      return true;
    }
    this._updateStatus(hypo.id, 'rejected');
    return false;
  }

  // ─── 4. TheoryEvolutionに登録 ───────────────────────────

  registerToEvolution(hypo: HypothesisCandidate): EvolvedTheory | null {
    if (hypo.status !== 'verified') return null;
    const evolved = this.evolution.proposeNew({
      id: hypo.id, axiom: hypo.axiom, category: hypo.category,
      keywords: hypo.keywords, source: 'ai_discovery',
      parentIds: hypo.questionId ? [hypo.questionId] : [],
    });
    if (evolved) {
      this.db.prepare('UPDATE hypotheses SET evolvedId = ?, status = ? WHERE id = ?')
        .run(evolved.id, 'promoted', hypo.id);
      hypo.evolvedId = evolved.id;
      hypo.status = 'promoted';
      this.log(`[Hypo] Evolution登録: ${evolved.id}`);
    }
    return evolved;
  }

  // ─── 5. 全パイプライン実行 ──────────────────────────────

  async runPipeline(questions: GeneratedQuestion[]): Promise<{
    generated: number; verified: number; promoted: number; rejected: number;
  }> {
    let generated = 0, verified = 0, promoted = 0, rejected = 0;
    for (const q of questions.slice(0, 5)) {
      const hypo = await this.generateFromQuestion(q);
      generated++;
      if (!this.checkContradiction(hypo)) { rejected++; continue; }
      if (!this.verifyWithReiPL(hypo)) { rejected++; continue; }
      verified++;
      if (this.registerToEvolution(hypo)) promoted++;
    }
    return { generated, verified, promoted, rejected };
  }

  // ─── フォールバック ──────────────────────────────────────

  private _generateFallback(q: GeneratedQuestion): HypothesisCandidate {
    const related = SEED_KERNEL.find(t => q.relatedIds.includes(t.id));
    const axiom = related ? `${related.axiom} かつ 拡張可能` : `仮説: ${q.question.slice(0, 30)}`;
    const hypo = this._buildHypo(q.id, axiom, related?.category ?? 'general',
      related?.keywords ?? [], 'FLOWING', 'フォールバック生成');
    this._save(hypo);
    return hypo;
  }

  private _buildHypo(qId: string, axiom: string, category: string,
    keywords: string[], dfumtValue: DFUMTValue, reasoning: string): HypothesisCandidate {
    return {
      id: `hypo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      questionId: qId, axiom, category, keywords, dfumtValue,
      reiCode: '', verified: false, status: 'draft', createdAt: Date.now(), reasoning,
    };
  }

  // ─── ヘルパー ────────────────────────────────────────────

  private _save(hypo: HypothesisCandidate): void {
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO hypotheses
          (id, questionId, axiom, category, keywords, dfumtValue, reiCode, verified, status, createdAt, reasoning)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(hypo.id, hypo.questionId, hypo.axiom, hypo.category,
             JSON.stringify(hypo.keywords), hypo.dfumtValue, hypo.reiCode,
             hypo.verified ? 1 : 0, hypo.status, hypo.createdAt, hypo.reasoning);
    } catch { /* 重複は無視 */ }
  }

  private _updateStatus(id: string, status: HypothesisCandidate['status']): void {
    this.db.prepare('UPDATE hypotheses SET status = ? WHERE id = ?').run(status, id);
  }

  getAll(): HypothesisCandidate[] {
    return (this.db.prepare('SELECT * FROM hypotheses ORDER BY createdAt DESC').all() as any[])
      .map(r => ({ ...r, keywords: JSON.parse(r.keywords ?? '[]'), verified: r.verified === 1 }));
  }

  getEvolution(): TheoryEvolution { return this.evolution; }

  close(): void { this.db.close(); }
}
