/**
 * Rei-AIOS — AxiomCandidateExtractor
 * arXiv論文からD-FUMT公理候補を自動抽出する。
 *
 * 手法: キーワードスコアリング + 七価論理分類
 * LLM不要（ルールベース）で動作する。
 */

import type { ArxivPaper } from '../aios/knowledge/types';
import type { DFUMTValue } from '../memory/aios-memory';

export interface AxiomCandidate {
  sourceId:    string;         // arXivのID (例: "2401.12345")
  sourceTitle: string;
  axiom:       string;         // 抽出した公理テキスト
  category:    string;         // D-FUMTカテゴリ
  keywords:    string[];
  dfumtValue:  DFUMTValue;     // 七価論理による信頼度
  confidence:  number;         // 0〜1（スコアリング結果）
  evidence:    string;         // 根拠テキスト（summaryの断片）
}

// ─── D-FUMTカテゴリマッピング ──────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'logic':          ['logic', 'theorem', 'proof', 'axiom', 'formal', 'inference', 'modal'],
  'consciousness':  ['consciousness', 'qualia', 'awareness', 'integrated', 'phenomenal', 'IIT'],
  'mathematics':    ['topology', 'category', 'manifold', 'algebraic', 'geometric', 'number theory'],
  'quantum':        ['quantum', 'superposition', 'entanglement', 'wave function', 'decoherence'],
  'computation':    ['computation', 'algorithm', 'complexity', 'recursive', 'lambda', 'turing'],
  'ai-integration': ['neural network', 'machine learning', 'large language', 'transformer', 'reasoning'],
  'philosophy':     ['ontology', 'epistemology', 'metaphysics', 'dependent', 'emptiness'],
  'zero_extension': ['zero', 'null', 'void', 'negation', 'absence', 'nothing'],
  'general':        [],  // フォールバック
};

// ─── 七価論理マッピング ────────────────────────────────────

function classifyDfumt(score: number, text: string): DFUMTValue {
  const lower = text.toLowerCase();

  if (lower.includes('contradict') || lower.includes('paradox') || lower.includes('refut')) {
    return 'NEITHER';
  }
  if (lower.includes('both') || lower.includes('dual') || lower.includes('complementary')) {
    return 'BOTH';
  }
  if (lower.includes('evolv') || lower.includes('dynamic') || lower.includes('temporal')) {
    return 'FLOWING';
  }
  if (lower.includes('infinite') || lower.includes('unbounded') || lower.includes('universal')) {
    return 'INFINITY';
  }
  if (lower.includes('undefined') || lower.includes('unknown') || lower.includes('potential')) {
    return 'ZERO';
  }

  if (score >= 0.7) return 'TRUE';
  if (score >= 0.4) return 'BOTH';
  return 'FALSE';
}

// ─── カテゴリ判定 ─────────────────────────────────────────

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  let best  = 'general';
  let bestN = 0;

  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.length === 0) continue;
    const n = kws.filter(kw => lower.includes(kw)).length;
    if (n > bestN) { bestN = n; best = cat; }
  }
  return best;
}

// ─── キーワード抽出 ───────────────────────────────────────

function extractKeywords(text: string): string[] {
  const allKws = Object.values(CATEGORY_KEYWORDS).flat();
  const lower  = text.toLowerCase();
  return allKws.filter(kw => kw.length > 3 && lower.includes(kw)).slice(0, 8);
}

// ─── 公理テキスト生成 ─────────────────────────────────────

function makeAxiomText(paper: ArxivPaper): string {
  // summaryの最初の文（=主張）を公理テキストとして使う
  const sentences = paper.summary
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.length > 20 && s.length < 200);

  const first = sentences[0] ?? paper.title;
  // 80文字以内に要約
  return first.length > 80
    ? first.slice(0, 77) + '...'
    : first;
}

// ─── メインクラス ─────────────────────────────────────────

export class AxiomCandidateExtractor {
  /**
   * arXiv論文リストから公理候補を抽出する。
   * confidence >= minConfidence のものだけ返す（デフォルト 0.4）
   */
  extract(papers: ArxivPaper[], minConfidence = 0.4): AxiomCandidate[] {
    const candidates: AxiomCandidate[] = [];

    for (const paper of papers) {
      const text  = `${paper.title} ${paper.summary}`;
      const lower = text.toLowerCase();

      // ── スコアリング ─────────────────────────────────
      let score = 0;
      const allKws = Object.values(CATEGORY_KEYWORDS).flat();
      const matchCount = allKws.filter(kw => lower.includes(kw)).length;
      score = Math.min(1.0, matchCount / 8);  // 8ヒットで満点

      // 哲学・論理・数学タイトルにボーナス
      if (/logic|axiom|theorem|consciousness|quantum|dependent/i.test(paper.title)) {
        score = Math.min(1.0, score + 0.2);
      }

      if (score < minConfidence) continue;

      const category = detectCategory(text);
      const keywords = extractKeywords(text);
      const axiom    = makeAxiomText(paper);
      const dfumt    = classifyDfumt(score, paper.summary);

      // 証拠テキスト（summaryの最初の100文字）
      const evidence = paper.summary.slice(0, 100).trim();

      candidates.push({
        sourceId:    paper.id,
        sourceTitle: paper.title,
        axiom,
        category,
        keywords,
        dfumtValue:  dfumt,
        confidence:  score,
        evidence,
      });
    }

    // 信頼度順にソート
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }
}
