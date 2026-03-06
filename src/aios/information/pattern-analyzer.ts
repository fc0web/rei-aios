/**
 * Rei-AIOS Phase 7d — 普遍パターン分析器
 * Theory #78: 多文明共通構造の抽出・比較・統合
 *
 * @author Nobuki Fujimoto (D-FUMT) + Claude
 */

import { UNIVERSAL_CODE_MATRIX } from './ancient-code-mapper';

// --- 型定義 ---

export interface PatternEntry {
  name: string;
  value: number;
  base: number;
  exponent: number;
  civilization: string;
  era: string;
  purpose: string;
}

export interface PatternAnalysisResult {
  /** 共通基底（2ⁿ構造があれば2） */
  commonBase: number;
  /** 共通性スコア（0〜1.0） */
  commonalityScore: number;
  /** 発見されたパターン群 */
  patterns: PatternEntry[];
  /** D-FUMT理論との対応 */
  dfumtMapping: string;
  /** note.com記事向けの要約 */
  articleSummary: string;
  theoryRef: 78;
}

// --- パターンデータベース ---

export const UNIVERSAL_PATTERNS: PatternEntry[] = [
  { name: '易経', value: 64, base: 2, exponent: 6, civilization: '中国', era: '紀元前3000年', purpose: '宇宙予測' },
  { name: 'DNA', value: 64, base: 2, exponent: 6, civilization: '生命体（普遍）', era: '約40億年前', purpose: '生命設計' },
  { name: '壁画32符号', value: 32, base: 2, exponent: 5, civilization: 'ユーラシア', era: '約3万年前', purpose: '環境記録' },
  { name: 'バビロニア六十進法', value: 60, base: 60, exponent: 1, civilization: 'メソポタミア', era: '紀元前2000年', purpose: '時間・角度' },
  { name: 'ヨルバ族イファ占術', value: 256, base: 2, exponent: 8, civilization: 'アフリカ', era: '古代', purpose: '知識体系' },
  { name: 'ASCII文字コード', value: 128, base: 2, exponent: 7, civilization: '現代', era: '1963年', purpose: '文字符号化' },
  { name: 'D-FUMT七値論理', value: 7, base: 7, exponent: 1, civilization: '日本（藤本）', era: '現代', purpose: '普遍論理' },
  { name: 'catuskoti四値', value: 4, base: 2, exponent: 2, civilization: 'インド（仏教）', era: '紀元前', purpose: '論理体系' },
];

// --- 分析関数 ---

/**
 * パターン群の共通構造を分析する
 */
export function analyzePatterns(patterns: PatternEntry[] = UNIVERSAL_PATTERNS): PatternAnalysisResult {
  // 2ⁿ構造を持つパターンの割合
  const binaryBased = patterns.filter(p => p.base === 2);
  const commonalityScore = binaryBased.length / patterns.length;

  const dfumtMapping = `
D-FUMT七値論理は7進数（7¹=7）ですが、内部にcatuskoti（2²=4値）を包含し、
2ⁿ族との橋渡しをしています。
  ⊤/⊥ → 二値の核心（2¹）
  ⊤/⊥/Both/Neither → catuskoti（2²）
  ＋∞/〇/～ → D-FUMT拡張（七値完全体）
`.trim();

  const articleSummary = `
易経（64卦）・DNA（64コドン）・洞窟壁画（32符号）・
現代コンピュータ（バイナリ）は全て 2ⁿ を共通基底として持ちます。
3万年の時を超え、異なる文明が同じ数学構造に辿り着いたことは、
D-FUMTが提唱する「普遍数学公理の存在」を強く支持しています。
`.trim();

  return {
    commonBase: 2,
    commonalityScore,
    patterns,
    dfumtMapping,
    articleSummary,
    theoryRef: 78,
  };
}

/**
 * 特定のパターンとD-FUMT七値の対応を生成する
 */
export function mapPatternToDFUMT(value: number): string {
  if (value === 64) return '64 = 2⁶ → D-FUMTの六段階公理展開と同型';
  if (value === 32) return '32 = 2⁵ → D-FUMTのcatuskoti(2²)の拡張';
  if (value === 7)  return '7 = D-FUMT七値そのもの';
  if (value === 4)  return '4 = catuskoti（D-FUMTの核心部分集合）';
  if (value % 64 === 0) return `${value} = 64の倍数 → 易経・DNAと同族`;
  return `${value} → D-FUMT七値体系との対応を分析中`;
}
