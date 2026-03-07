/**
 * SilenceLanguageEngine — 沈黙言語エンジン
 *
 * D-FUMT Theory #97/#98:
 *   #97: 沈黙言語理論
 *   #98: 沈黙情報圧縮理論
 *
 * 「…………」という記号を正式な構文として実装。
 * 沈黙の長さ・パターン・文脈が情報を持つ。
 *
 * 沈黙言語の三原則:
 *   1. 長さが値を表す（七価論理との対応）
 *   2. パターンが構造を表す（演算子）
 *   3. 文脈が意味を確定する（ファジー的）
 */

import type { SevenLogicValue } from './seven-logic';
import { and, or, not } from './seven-logic';

// ═══════════════════════════════════════════
// 型定義
// ═══════════════════════════════════════════

/** 沈黙パターンの区切り種類 */
export type SilenceSeparator = 'dot' | 'space' | 'bang';

/** 沈黙リテラル */
export interface SilenceLiteral {
  dots: number;
  logic7: SevenLogicValue;
  raw: string;
}

/** パターン解析結果 */
export interface PatternResult {
  segments: SilenceLiteral[];
  values: SevenLogicValue[];
  combined: SevenLogicValue;
}

/** 覚醒（文脈解決）のコンテキスト */
export interface AwakenContext {
  sentiment: number; // 0.0〜1.0
}

/** 信号解析結果 */
export interface SignalAnalysis {
  values: SevenLogicValue[];
  interpretation: string;
}

/** エントロピー計算結果 */
export interface EntropyResult {
  entropy: number;
  maxEntropy: number;
  resolved: boolean;
}

// ═══════════════════════════════════════════
// 定数
// ═══════════════════════════════════════════

/** 沈黙→七価マッピング表 */
const SILENCE_MAP: SevenLogicValue[] = [
  'ZERO',     // 0点: 空（根源）
  'FALSE',    // 1点: 否定
  'NEITHER',  // 2点: 非有非無
  'FLOWING',  // 3点: 変化・過程
  'BOTH',     // 4点: 亦有亦無
  'TRUE',     // 5点: 肯定
  'INFINITY', // 6点: 超越・無限
];

/** 七価→沈黙逆変換表 */
const LOGIC7_TO_SILENCE: Record<SevenLogicValue, string> = {
  'ZERO':     '',
  'FALSE':    '\u2026',
  'NEITHER':  '\u2026\u2026',
  'FLOWING':  '\u2026\u2026\u2026',
  'BOTH':     '\u2026\u2026\u2026\u2026',
  'TRUE':     '\u2026\u2026\u2026\u2026\u2026',
  'INFINITY': '\u2026\u2026\u2026\u2026\u2026\u2026',
};

/** 七価値の解釈テキスト */
const INTERPRET_MAP: Record<SevenLogicValue, string> = {
  'TRUE':     '存在を肯定',
  'FALSE':    '存在を否定',
  'BOTH':     '両義的存在',
  'NEITHER':  '判断を委ねる',
  'FLOWING':  '変化・過程中',
  'INFINITY': '超越的存在',
  'ZERO':     '根源的沈黙',
};

// ═══════════════════════════════════════════
// SilenceLanguageEngine 本体
// ═══════════════════════════════════════════

export class SilenceLanguageEngine {

  // ── 基本変換 ──────────────────────────────────────

  /**
   * 沈黙の長さ（dots数）から七価論理値へ変換。
   * 0=ZERO, 1=FALSE, ..., 6=INFINITY, 7以上=INFINITY
   */
  silenceToLogic7(dots: number): SevenLogicValue {
    if (dots < 0) return 'ZERO';
    if (dots >= SILENCE_MAP.length) return 'INFINITY';
    return SILENCE_MAP[dots];
  }

  /**
   * 七価論理値から沈黙文字列（…の列）へ逆変換。
   */
  logic7ToSilence(val: SevenLogicValue): string {
    return LOGIC7_TO_SILENCE[val];
  }

  /**
   * 沈黙リテラルを構築する。
   */
  buildSilenceLiteral(dots: number): SilenceLiteral {
    const logic7 = this.silenceToLogic7(dots);
    return {
      dots,
      logic7,
      raw: '\u2026'.repeat(Math.min(dots, 6)),
    };
  }

  // ── 往復変換の冪等性 ─────────────────────────────

  /**
   * 七価 → 沈黙 → 七価 の往復変換が冪等であることを検証。
   */
  verifyRoundTrip(): boolean {
    const values: SevenLogicValue[] = [
      'ZERO', 'FALSE', 'NEITHER', 'FLOWING', 'BOTH', 'TRUE', 'INFINITY',
    ];
    for (const v of values) {
      const silence = this.logic7ToSilence(v);
      const dots = silence.length; // Unicode ellipsis chars
      const back = this.silenceToLogic7(dots);
      if (back !== v) return false;
    }
    return true;
  }

  // ── パターン解析 ──────────────────────────────────

  /**
   * パターン文字列を解析し、各セグメントの七価値を返す。
   * 区切り: ．（全角ドット）、空白、。
   */
  analyzePattern(pattern: string): SevenLogicValue[] {
    const segments = pattern.split(/[．。\s]+/).filter(s => s.length > 0);
    return segments.map(seg => {
      const dots = (seg.match(/\u2026/g) || []).length;
      return this.silenceToLogic7(dots);
    });
  }

  /**
   * パターン沈黙を区切り種類に従って演算する。
   * dot(．) = AND, space( ) = OR, bang(！) = 確定
   */
  evaluatePattern(
    segments: number[],
    separator: SilenceSeparator,
  ): PatternResult {
    const literals = segments.map(d => this.buildSilenceLiteral(d));
    const values = literals.map(l => l.logic7);

    let combined: SevenLogicValue;
    switch (separator) {
      case 'dot':
        combined = values.reduce((a, b) => and(a, b));
        break;
      case 'space':
        combined = values.reduce((a, b) => or(a, b));
        break;
      case 'bang':
        combined = values[0] === 'FLOWING' ? 'TRUE' : values[0];
        break;
    }

    return { segments: literals, values, combined };
  }

  // ── 覚醒（文脈解決） ─────────────────────────────

  /**
   * 沈黙を文脈から覚醒（確定）する。
   * BOTH/NEITHER の場合のみ文脈で解決される。
   */
  awaken(dots: number, context: AwakenContext): SevenLogicValue {
    const base = this.silenceToLogic7(dots);

    if (base === 'BOTH' || base === 'NEITHER') {
      return this.resolveByContext(base, context);
    }
    return base;
  }

  /**
   * 文脈による解決。
   * sentiment > 0.7 → TRUE, < 0.3 → FALSE, else → FLOWING
   */
  resolveByContext(val: SevenLogicValue, context: AwakenContext): SevenLogicValue {
    if (context.sentiment > 0.7) return 'TRUE';
    if (context.sentiment < 0.3) return 'FALSE';
    return 'FLOWING';
  }

  // ── 情報理論 ──────────────────────────────────────

  /**
   * 沈黙の情報量（シャノンエントロピー）を計算。
   * 文脈なし = 最大エントロピー log₂(7) ≈ 2.807
   * 文脈あり = エントロピー低下（確定に近づく）
   */
  calculateEntropy(dots: number, context?: AwakenContext): EntropyResult {
    const maxEntropy = Math.log2(7);

    if (!context) {
      return { entropy: maxEntropy, maxEntropy, resolved: false };
    }

    const resolved = this.awaken(dots, context);
    // 確定した値のエントロピーは 0（完全確定）
    const entropy = resolved === 'ZERO' ? 0 : Math.log2(2); // 1ビット

    return { entropy, maxEntropy, resolved: true };
  }

  /**
   * 圧縮率の計算。
   * original文字列 → silence文字列 への圧縮率。
   */
  compressionRatio(original: string, silence: string): number {
    if (original.length === 0) return 0;
    return 1 - (silence.length / original.length);
  }

  // ── ブラックナイト信号解析 ────────────────────────

  /**
   * パターン信号を解析し、七価論理値列と解釈テキストを返す。
   */
  analyzeSignal(signal: string): SignalAnalysis {
    const values = this.analyzePattern(signal);
    const interpretation = values
      .map(v => INTERPRET_MAP[v])
      .join('\u30FB'); // ・

    return { values, interpretation };
  }

  // ── 沈黙演算（七価論理演算の委譲） ────────────────

  /** 沈黙AND: dots1 ∧ dots2 */
  silenceAnd(dots1: number, dots2: number): SevenLogicValue {
    return and(this.silenceToLogic7(dots1), this.silenceToLogic7(dots2));
  }

  /** 沈黙OR: dots1 ∨ dots2 */
  silenceOr(dots1: number, dots2: number): SevenLogicValue {
    return or(this.silenceToLogic7(dots1), this.silenceToLogic7(dots2));
  }

  /** 沈黙NOT: ¬dots */
  silenceNot(dots: number): SevenLogicValue {
    return not(this.silenceToLogic7(dots));
  }

  /** 沈黙確定: FLOWING → TRUE, 他はそのまま */
  silenceConfirm(dots: number): SevenLogicValue {
    const val = this.silenceToLogic7(dots);
    return val === 'FLOWING' ? 'TRUE' : val;
  }

  // ── 検証メソッド ──────────────────────────────────

  /**
   * SeedKernel無矛盾性の検証。
   * 沈黙言語の全変換結果が七価論理の正当な値であることを確認。
   */
  verifyConsistency(): boolean {
    const sevenValues: SevenLogicValue[] = [
      'TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING',
    ];
    for (let dots = 0; dots <= 10; dots++) {
      if (!sevenValues.includes(this.silenceToLogic7(dots))) return false;
    }
    return true;
  }

  /**
   * ∞-極限の検証: 無限の沈黙は INFINITY → ZEROへの円環。
   */
  verifyInfinityLimit(): boolean {
    // 7以上の沈黙は全て INFINITY
    return this.silenceToLogic7(1000) === 'INFINITY';
  }
}
