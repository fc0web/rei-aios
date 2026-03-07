/**
 * Rei-AIOS STEP 23-C — ConceptGenesisEngine
 * 「概念を生む」能力
 *
 * 既存の理論体系で表現できない「空白」を検出し、
 * 新しい概念の候補を生成して人間の承認を待つ。
 *
 * 設計原則:
 *   - 完全自動化しない（最終承認は人間）
 *   - NEITHER/ZEROの集積から概念の萌芽を見つける
 *   - 複数エージェントの合意を要求する（独断を防ぐ）
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { SEED_KERNEL } from './seed-kernel';
import { SevenValueClassifier } from '../logic/seven-value-classifier';
import type { DFUMTValue } from '../memory/aios-memory';
import type { ILLMForQuestion, GeneratedQuestion } from './question-generator';
import type { HypothesisCandidate } from './hypothesis-engine';

// ─── 型定義 ──────────────────────────────────────────────────

export interface ConceptCandidate {
  id:              string;
  name:            string;
  nameEn:          string;
  definition:      string;
  axiom:           string;
  category:        string;
  keywords:        string[];
  dfumtValue:      DFUMTValue;
  noveltyScore:    number;
  evidences:       string[];
  agentConsensus:  AgentVote[];
  status:          'candidate' | 'review' | 'approved' | 'rejected';
  approvedBy?:     string;
  theoryNumber?:   number;
  createdAt:       number;
}

export interface AgentVote {
  agentName:  string;
  vote:       'support' | 'oppose' | 'neutral';
  reason:     string;
  dfumtValue: DFUMTValue;
}

// ─── 新規性スコア ──────────────────────────────────────────

function computeNovelty(definition: string, axiom: string): number {
  const text = `${definition} ${axiom}`.toLowerCase();
  const existingKeywords = SEED_KERNEL.flatMap(t => t.keywords);

  const keywordOverlap = existingKeywords.filter(kw => text.includes(kw.toLowerCase())).length;
  const keywordScore = 1 - Math.min(1, keywordOverlap / 8);

  let maxSim = 0;
  for (const t of SEED_KERNEL) {
    const ax = t.axiom.toLowerCase();
    const common = text.split('').filter(c => ax.includes(c)).length;
    const sim = common / Math.max(text.length, ax.length);
    if (sim > maxSim) maxSim = sim;
  }
  const axiomScore = 1 - maxSim;

  return keywordScore * 0.4 + axiomScore * 0.6;
}

// ─── ConceptGenesisEngine 本体 ───────────────────────────────

export class ConceptGenesisEngine {
  private db:   Database.Database;
  private clf:  SevenValueClassifier;
  private llm?: ILLMForQuestion;
  private log:  (msg: string) => void;

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

    this.db  = new Database(dbPath);
    this.clf = new SevenValueClassifier();
    this.llm = opts.llm;
    this.log = opts.log ?? (() => {});

    this._initSchema();
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS concepts (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        nameEn          TEXT NOT NULL DEFAULT '',
        definition      TEXT NOT NULL,
        axiom           TEXT NOT NULL,
        category        TEXT NOT NULL DEFAULT 'general',
        keywords        TEXT NOT NULL DEFAULT '[]',
        dfumtValue      TEXT NOT NULL DEFAULT 'NEITHER',
        noveltyScore    REAL NOT NULL DEFAULT 0,
        evidences       TEXT NOT NULL DEFAULT '[]',
        agentConsensus  TEXT NOT NULL DEFAULT '[]',
        status          TEXT NOT NULL DEFAULT 'candidate',
        approvedBy      TEXT,
        theoryNumber    INTEGER,
        createdAt       INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_c_status  ON concepts(status);
      CREATE INDEX IF NOT EXISTS idx_c_novelty ON concepts(noveltyScore DESC);
    `);
  }

  // ─── 1. 概念の萌芽を検出 ───────────────────────────────

  detectConceptSeeds(
    questions: GeneratedQuestion[],
    hypotheses: HypothesisCandidate[],
  ): { seeds: string[]; pattern: string } {
    const neitherQ = questions.filter(q => q.dfumtValue === 'NEITHER' || q.dfumtValue === 'ZERO');
    const neitherH = hypotheses.filter(h => h.dfumtValue === 'NEITHER' || h.dfumtValue === 'ZERO');

    const seeds = [
      ...neitherQ.map(q => q.question.slice(0, 60)),
      ...neitherH.map(h => h.axiom.slice(0, 60)),
    ];

    // 最頻出キーワードを抽出
    const allText = seeds.join(' ').toLowerCase();
    const words = allText.split(/[\s、。,]+/).filter(w => w.length > 2);
    const freq: Record<string, number> = {};
    for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
    const topWord = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';

    this.log(`[Concept] 概念の萌芽: ${seeds.length}件, パターン: "${topWord}"`);
    return { seeds, pattern: topWord };
  }

  // ─── 2. 新概念を生成 ──────────────────────────────────

  async generateConcept(seeds: string[], pattern: string): Promise<ConceptCandidate> {
    if (this.llm) {
      try {
        const systemPrompt = `D-FUMT理論家。JSON形式のみで回答:
{"name":"日本語名","nameEn":"englishName","definition":"定義100文字","axiom":"公理式50文字","category":"カテゴリ","keywords":["k1","k2"],"dfumtValue":"七価値"}`;
        const raw = await this.llm.generate(
          `以下から既存157理論にない新概念を提案:\n${seeds.slice(0, 5).join('\n')}\nパターン: "${pattern}"`,
          systemPrompt,
        );
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const p = JSON.parse(match[0]);
          const novelty = computeNovelty(p.definition ?? '', p.axiom ?? '');
          const concept: ConceptCandidate = {
            id: `concept_${Date.now()}`, name: p.name ?? '未名概念',
            nameEn: p.nameEn ?? 'unnamed', definition: p.definition ?? '',
            axiom: p.axiom ?? '', category: p.category ?? 'general',
            keywords: p.keywords ?? [], dfumtValue: p.dfumtValue ?? 'NEITHER',
            noveltyScore: novelty, evidences: seeds.slice(0, 3),
            agentConsensus: [], status: 'candidate', createdAt: Date.now(),
          };
          this._save(concept);
          return concept;
        }
      } catch { /* fall through */ }
    }
    return this._generateFallback(seeds, pattern);
  }

  // ─── 3. マルチエージェント合意 ──────────────────────────

  runAgentConsensus(concept: ConceptCandidate): AgentVote[] {
    const agents = [
      { name: '論理エージェント',   check: () => /[=→∀∃∧∨¬]/.test(concept.axiom) },
      { name: '量子エージェント',   check: () => concept.keywords.some(k => /量子|quantum/.test(k)) || concept.dfumtValue === 'BOTH' },
      { name: '龍樹エージェント',   check: () => concept.dfumtValue === 'NEITHER' || /空|emptiness/.test(concept.definition) },
      { name: '意識エージェント',   check: () => /意識|consciousness/.test(concept.definition) },
      { name: '数値エージェント',   check: () => /[0-9π∞]/.test(concept.axiom) },
    ];

    const votes: AgentVote[] = agents.map(a => {
      const relevant = a.check();
      return {
        agentName: a.name,
        vote: relevant ? 'support' as const : concept.noveltyScore > 0.6 ? 'neutral' as const : 'oppose' as const,
        reason: relevant ? `${a.name}の専門領域と関連` : `${a.name}の観点では関連薄い`,
        dfumtValue: (relevant ? 'TRUE' : 'ZERO') as DFUMTValue,
      };
    });

    concept.agentConsensus = votes;
    this.db.prepare('UPDATE concepts SET agentConsensus = ? WHERE id = ?')
      .run(JSON.stringify(votes), concept.id);

    this.log(`[Concept] エージェント合意: ${votes.filter(v => v.vote === 'support').length}/5 支持`);
    return votes;
  }

  // ─── 4. レビュー待ちに移動 ──────────────────────────────

  submitForReview(conceptId: string): void {
    this.db.prepare('UPDATE concepts SET status = ? WHERE id = ?').run('review', conceptId);
  }

  // ─── 5. 人間承認 → D-FUMT Theory登録 ───────────────────

  approve(conceptId: string, approvedBy: string, theoryNumber: number): ConceptCandidate | null {
    this.db.prepare('UPDATE concepts SET status = ?, approvedBy = ?, theoryNumber = ? WHERE id = ?')
      .run('approved', approvedBy, theoryNumber, conceptId);
    const row = this.db.prepare('SELECT * FROM concepts WHERE id = ?').get(conceptId) as any;
    return row ? this._rowToConcept(row) : null;
  }

  // ─── 全パイプライン ──────────────────────────────────────

  async runPipeline(
    questions: GeneratedQuestion[],
    hypotheses: HypothesisCandidate[],
  ): Promise<ConceptCandidate | null> {
    const { seeds, pattern } = this.detectConceptSeeds(questions, hypotheses);
    if (seeds.length < 3) {
      this.log('[Concept] 萌芽不足（3件未満）。スキップ。');
      return null;
    }
    const concept = await this.generateConcept(seeds, pattern);
    if (concept.noveltyScore < 0.4) {
      this.log(`[Concept] 新規性不足（${(concept.noveltyScore * 100).toFixed(0)}%）。スキップ。`);
      this._updateStatus(concept.id, 'rejected');
      return null;
    }
    this.runAgentConsensus(concept);
    this.submitForReview(concept.id);
    return concept;
  }

  // ─── レビュー待ち一覧 ───────────────────────────────────

  getPendingReview(): ConceptCandidate[] {
    return (this.db.prepare("SELECT * FROM concepts WHERE status = 'review' ORDER BY noveltyScore DESC").all() as any[])
      .map(this._rowToConcept);
  }

  // ─── フォールバック ──────────────────────────────────────

  private _generateFallback(seeds: string[], pattern: string): ConceptCandidate {
    const concept: ConceptCandidate = {
      id: `concept_fb_${Date.now()}`, name: `${pattern}論`, nameEn: `${pattern}Theory`,
      definition: `「${pattern}」に関するD-FUMT的概念（自動生成候補）`,
      axiom: `${pattern}(x) = NEITHER(x) AND ZERO(x) -> FLOWING`,
      category: 'general', keywords: [pattern], dfumtValue: 'NEITHER',
      noveltyScore: computeNovelty(`${pattern}に関する概念`, `${pattern}(x)`),
      evidences: seeds.slice(0, 3), agentConsensus: [],
      status: 'candidate', createdAt: Date.now(),
    };
    this._save(concept);
    return concept;
  }

  // ─── ヘルパー ────────────────────────────────────────────

  private _save(c: ConceptCandidate): void {
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO concepts
          (id, name, nameEn, definition, axiom, category, keywords, dfumtValue,
           noveltyScore, evidences, agentConsensus, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(c.id, c.name, c.nameEn, c.definition, c.axiom, c.category,
             JSON.stringify(c.keywords), c.dfumtValue, c.noveltyScore,
             JSON.stringify(c.evidences), JSON.stringify(c.agentConsensus),
             c.status, c.createdAt);
    } catch { /* 重複は無視 */ }
  }

  private _updateStatus(id: string, status: ConceptCandidate['status']): void {
    this.db.prepare('UPDATE concepts SET status = ? WHERE id = ?').run(status, id);
  }

  private _rowToConcept(row: any): ConceptCandidate {
    return {
      ...row,
      keywords: JSON.parse(row.keywords ?? '[]'),
      evidences: JSON.parse(row.evidences ?? '[]'),
      agentConsensus: JSON.parse(row.agentConsensus ?? '[]'),
    };
  }

  close(): void { this.db.close(); }
}
