/**
 * Rei-AIOS — SevenValueClassifier
 * 自然言語テキストをD-FUMT七価論理値に分類する。
 *
 * 手法:
 *   1. パターンマッチング（ネガティブ・ポジティブ・特殊）
 *   2. 文脈共起スコアリング（否定語・二値語・流動語などの共起）
 *   3. D-FUMT理論キーワードとの意味的類似度（コサイン類似）
 *   4. スコア合算 → 七価値への写像
 */

import type { DFUMTValue } from '../memory/aios-memory';

// ─── 型定義 ──────────────────────────────────────────────────

export interface ClassificationResult {
  value:      DFUMTValue;
  confidence: number;        // 0〜1
  scores:     Record<DFUMTValue, number>;  // 各値のスコア
  reasons:    string[];      // 判定根拠
  context:    string;        // 判定に使ったテキスト
}

// ─── パターン定義 ──────────────────────────────────────────

interface PatternRule {
  pattern: RegExp;
  value:   DFUMTValue;
  weight:  number;       // スコア加算量
  reason:  string;
}

// 日本語・英語両対応
const PATTERNS: PatternRule[] = [
  // ── NEITHER（龍樹的否定・両者否定）──────────────────────
  { pattern: /実体を持たな|自性がな|空である|śūnyatā|emptiness|non-self/i,       value: 'NEITHER', weight: 0.8, reason: '龍樹的空性' },
  { pattern: /でもなく.*でもない|neither.*nor|not.*and.*not/i,                  value: 'NEITHER', weight: 0.7, reason: '両者否定構文' },
  { pattern: /矛盾|paradox|contradiction|paraconsistent/i,                     value: 'NEITHER', weight: 0.6, reason: '矛盾語' },
  { pattern: /四句分別|catuskoṭi|tetralemma/i,                                  value: 'NEITHER', weight: 0.9, reason: '四句否定' },

  // ── BOTH（重ね合わせ・両立）──────────────────────────────
  { pattern: /重ね合わせ|superposition|superimposition/i,                       value: 'BOTH', weight: 0.85, reason: '量子重ね合わせ' },
  { pattern: /かつ.*かつ|both.*and|同時に.*真|simultaneously true/i,            value: 'BOTH', weight: 0.7,  reason: '同時真構文' },
  { pattern: /IIT|情報統合|integrated information|consciousness.*information/i,  value: 'BOTH', weight: 0.65, reason: 'IIT意識理論' },
  { pattern: /二重性|duality|dual nature|wave.*particle/i,                      value: 'BOTH', weight: 0.7,  reason: '二重性・波粒二重性' },
  { pattern: /補完|complementary|互いに.*依存|mutual.*dependence/i,             value: 'BOTH', weight: 0.55, reason: '相互補完' },

  // ── FLOWING（時間変化・動的真理）────────────────────────
  { pattern: /時間とともに|変化し続ける|時間依存|temporally/i,                  value: 'FLOWING', weight: 0.8, reason: '時間変化語' },
  { pattern: /flow|flowing|process|evolv|dynamic.*truth/i,                     value: 'FLOWING', weight: 0.65, reason: '流動・プロセス語' },
  { pattern: /縁起|dependent origination|pratītyasamutpāda/i,                  value: 'FLOWING', weight: 0.9, reason: '縁起（仏教的流動）' },
  { pattern: /transition|state change|phase shift|波束収縮/i,                   value: 'FLOWING', weight: 0.6, reason: '状態遷移語' },

  // ── INFINITY（無限・普遍）────────────────────────────────
  { pattern: /無限|infinite|unbounded|transfinite|∞/i,                         value: 'INFINITY', weight: 0.75, reason: '無限語' },
  { pattern: /普遍的に|universal.*law|for all.*x|∀/i,                          value: 'INFINITY', weight: 0.65, reason: '普遍量化' },
  { pattern: /can.*expand.*infinitely|無限展開|普遍的に成立/i,                  value: 'INFINITY', weight: 0.7,  reason: '無限展開' },

  // ── ZERO（未定義・潜在・未観測）─────────────────────────
  { pattern: /未定義|undefined|unknown state|潜在的|not yet observed/i,         value: 'ZERO', weight: 0.8, reason: '未定義・潜在語' },
  { pattern: /before measurement|観測前|collapsed.*to.*zero/i,                  value: 'ZERO', weight: 0.7, reason: '未観測状態' },
  { pattern: /沈黙|silence|void|nothingness|無の/i,                             value: 'ZERO', weight: 0.6, reason: '無・沈黙語' },

  // ── FALSE（否定・偽）─────────────────────────────────────
  { pattern: /ではない|is not|false|incorrect|disproven|refuted/i,              value: 'FALSE', weight: 0.5, reason: '否定語' },
  { pattern: /誤り|wrong|mistake|invalid|unsound/i,                             value: 'FALSE', weight: 0.55, reason: '誤りを示す語' },

  // ── TRUE（肯定・真）──────────────────────────────────────
  { pattern: /である|is true|proven|theorem|established|verified/i,            value: 'TRUE', weight: 0.4, reason: '肯定語' },
  { pattern: /定理|axiom|principle|law|公理/i,                                  value: 'TRUE', weight: 0.5, reason: '定理・公理語' },
];

// ─── D-FUMTキーワードベクトル ─────────────────────────────

const DFUMT_VECTORS: Record<DFUMTValue, string[]> = {
  TRUE:     ['真理', 'truth', 'axiom', '公理', 'theorem', '定理', 'established', 'verified', 'certain'],
  FALSE:    ['偽', 'false', 'refuted', '誤り', 'contradiction', 'wrong', 'invalid'],
  BOTH:     ['両方', 'both', 'dual', '二重', 'complementary', 'superposition', 'IIT', '意識', 'quantum'],
  NEITHER:  ['空', 'empty', 'void', 'neither', '龍樹', 'nagarjuna', 'śūnyatā', '無自性', 'not-self'],
  INFINITY: ['無限', 'infinite', '∞', 'unbounded', 'universal', '普遍', 'transfinite'],
  ZERO:     ['ゼロ', 'zero', 'null', 'undefined', '未定義', 'potential', 'latent', '潜在'],
  FLOWING:  ['流動', 'flow', 'change', '変化', 'temporal', '縁起', 'process', 'dynamic', 'evolving'],
};

// ─── コサイン類似度（簡易・Bag-of-Words）────────────────────

function cosineSimilarity(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  const hits  = keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
  return hits / Math.sqrt(Math.max(1, keywords.length));
}

// ─── 共起スコアリング ──────────────────────────────────────

function cooccurrenceBonus(text: string, value: DFUMTValue): number {
  const lower = text.toLowerCase();
  let bonus = 0;

  if (value === 'NEITHER') {
    const hasNeg1 = /ない|not|no\s/.test(lower);
    const hasNeg2 = /でも|also\snot|nor/.test(lower);
    if (hasNeg1 && hasNeg2) bonus += 0.15;
  }

  if (value === 'BOTH') {
    const hasBoth = /both|and|かつ|同時/.test(lower);
    const hasConj = /while|although|however|一方で/.test(lower);
    if (hasBoth) bonus += 0.10;
    if (hasConj) bonus += 0.05;
  }

  if (value === 'FLOWING') {
    const hasTense = /will|was|becomes|なる|なった/.test(lower);
    const hasTime  = /time|when|during|moment|時間|瞬間/.test(lower);
    if (hasTense && hasTime) bonus += 0.12;
  }

  return bonus;
}

// ─── メインクラス ─────────────────────────────────────────

export class SevenValueClassifier {
  /**
   * テキストを七価論理値に分類する。
   */
  classify(text: string): ClassificationResult {
    const scores: Record<DFUMTValue, number> = {
      TRUE: 0.1, FALSE: 0, BOTH: 0, NEITHER: 0,
      INFINITY: 0, ZERO: 0, FLOWING: 0,
    };
    const reasons: string[] = [];

    // ── 1. パターンマッチング ──────────────────────────
    for (const rule of PATTERNS) {
      if (rule.pattern.test(text)) {
        scores[rule.value] += rule.weight;
        reasons.push(`${rule.reason} → ${rule.value}(+${rule.weight.toFixed(2)})`);
      }
    }

    // ── 2. D-FUMTベクトル類似度 ───────────────────────
    for (const [val, kws] of Object.entries(DFUMT_VECTORS) as [DFUMTValue, string[]][]) {
      const sim = cosineSimilarity(text, kws);
      if (sim > 0.05) {
        scores[val] += sim * 0.5;
      }
    }

    // ── 3. 共起ボーナス ────────────────────────────────
    for (const val of Object.keys(scores) as DFUMTValue[]) {
      scores[val] += cooccurrenceBonus(text, val);
    }

    // ── 4. 最高スコア値を選択 ─────────────────────────
    const best = (Object.entries(scores) as [DFUMTValue, number][])
      .sort((a, b) => b[1] - a[1])[0];

    const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);
    const confidence = totalScore > 0 ? best[1] / totalScore : 0;

    if (reasons.length === 0) {
      reasons.push('デフォルト: スコアが低いため TRUE と判定');
    }

    return {
      value:      best[1] > 0.1 ? best[0] : 'TRUE',
      confidence: Math.min(1.0, confidence),
      scores,
      reasons,
      context:    text.slice(0, 100),
    };
  }

  /**
   * バッチ分類（複数テキストを一度に処理）
   */
  classifyBatch(texts: string[]): ClassificationResult[] {
    return texts.map(t => this.classify(t));
  }

  /**
   * 七価値の説明文を返す（教育用）
   */
  static describe(value: DFUMTValue): string {
    const descriptions: Record<DFUMTValue, string> = {
      TRUE:     '⊤ — 確実に真。定理・公理・検証済みの事実。',
      FALSE:    '⊥ — 確実に偽。反証済み・論理的に不可能。',
      BOTH:     'B — 真でも偽でもある。重ね合わせ・補完的二重性。',
      NEITHER:  'N — 真でも偽でもない。龍樹的空性・両者否定。',
      INFINITY: '∞ — 無限に展開する真理。普遍法則・無限定理。',
      ZERO:     '〇 — 未定義・潜在状態。観測前・問いかけ前の真理。',
      FLOWING:  '～ — 時間とともに変化する真理。縁起・プロセス。',
    };
    return descriptions[value];
  }
}
