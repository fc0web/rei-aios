/**
 * ReiEntropyZero — シャノンエントロピー × ZERO値の数学的接続
 *
 * D-FUMT Theory #69: エントロピーゼロ理論
 * 「ZERO状態は最大エントロピー（最大潜在情報量）を持つ」
 *
 * 核心命題:
 *   H(ZERO) = log2(n)  <- n個の可能性が等確率で潜在
 *   H(TRUE) = 0         <- 確定状態はエントロピーゼロ
 *   H(BOTH) = 1         <- 二値が等確率 = 1bit の不確定性
 *   H(FLOWING) = f(t)   <- 時間依存のエントロピー
 *   H(INFINITY) = Infinity <- 無限の可能性
 *   H(NEITHER) = ?      <- 測定不能（量子的）
 *   H(FALSE) = 0        <- 確定否定もエントロピーゼロ
 */

import { type SevenLogicValue } from './seven-logic';

export interface EntropyResult {
  value: number;            // シャノンエントロピー（bits）
  normalized: number;       // 0.0〜1.0 正規化値
  logicTag: SevenLogicValue; // エントロピー値の七価解釈
  interpretation: string;   // 日本語解釈
}

export interface DistributionAnalysis {
  entropy: number;
  maxEntropy: number;
  normalized: number;
  zeroAlignment: number;    // ZERO値との整合度（0〜1）
  dominantTag: SevenLogicValue;
  suggestion: string;       // 「このデータはZEROに近い」等
}

export class ReiEntropyZero {

  /**
   * 七価論理値の理論的エントロピーを返す
   *
   * ZERO  = log2(7) ~ 2.807 bits（全7値が等確率で潜在）
   * TRUE  = 0 bits（確定）
   * FALSE = 0 bits（確定否定）
   * BOTH  = 1 bit（二値等確率）
   * NEITHER = NaN（測定不能）
   * FLOWING = 時刻tに依存（動的）
   * INFINITY = Infinity
   */
  theoreticalEntropy(tag: SevenLogicValue): EntropyResult {
    const log2_7 = Math.log2(7);

    const table: Record<SevenLogicValue, { value: number; interpretation: string }> = {
      ZERO:     { value: log2_7,   interpretation: '最大潜在情報量——マヤのゼロ「未決定の宇宙」' },
      TRUE:     { value: 0,        interpretation: '確定状態——エントロピーゼロ' },
      FALSE:    { value: 0,        interpretation: '確定否定——エントロピーゼロ' },
      BOTH:     { value: 1,        interpretation: '二値不確定——1bitの矛盾エントロピー' },
      NEITHER:  { value: NaN,      interpretation: '測定不能——量子的重ね合わせ' },
      FLOWING:  { value: log2_7 / 2, interpretation: '動的エントロピー——時間とともに変化中' },
      INFINITY: { value: Infinity, interpretation: '無限エントロピー——全可能性が開いている' },
    };

    const entry = table[tag];
    const normalized = isFinite(entry.value)
      ? entry.value / log2_7
      : 1.0;

    return {
      value: entry.value,
      normalized,
      logicTag: tag,
      interpretation: entry.interpretation,
    };
  }

  /**
   * 実データの分布からシャノンエントロピーを計算し、
   * 七価論理値に変換する
   *
   * @param distribution - { 値: 確率 } のマップ（合計~1.0）
   */
  calcEntropy(distribution: Record<string, number>): DistributionAnalysis {
    const probs = Object.values(distribution).filter(p => p > 0);
    const n = probs.length;

    if (n === 0) {
      return {
        entropy: 0, maxEntropy: 0, normalized: 0,
        zeroAlignment: 1.0,
        dominantTag: 'ZERO',
        suggestion: 'データなし——ZERO状態（潜在的宇宙）',
      };
    }

    // シャノンエントロピー H = -Sum p log2 p
    const H = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
    const Hmax = Math.log2(n);  // 一様分布時の最大エントロピー
    const normalized = Hmax > 0 ? H / Hmax : 0;

    // ZERO整合度 = 正規化エントロピー（1.0に近いほどZEROに近い）
    const zeroAlignment = normalized;

    // 七価タグへの変換
    const dominantTag: SevenLogicValue =
      normalized > 0.95  ? 'ZERO'     :  // ほぼ一様分布 = 最大潜在
      normalized > 0.7   ? 'FLOWING'  :  // 高エントロピー = 流動
      normalized > 0.4   ? 'NEITHER'  :  // 中エントロピー = 不確定
      normalized > 0.1   ? 'BOTH'     :  // 低エントロピー = 二値的
                           'TRUE';       // 極低エントロピー = 確定

    const suggestion =
      zeroAlignment > 0.9 ? 'ZERO に近い——潜在情報量最大、マヤのゼロ状態' :
      zeroAlignment > 0.6 ? 'FLOWING に近い——情報が流動中' :
      zeroAlignment > 0.3 ? 'NEITHER——情報構造が不明確' :
                            'TRUE/FALSE 方向——情報が収束しつつある';

    return {
      entropy: H,
      maxEntropy: Hmax,
      normalized,
      zeroAlignment,
      dominantTag,
      suggestion,
    };
  }

  /**
   * 七価論理値の列からエントロピーを計算する
   * （推論の「不確実性」を測る）
   */
  calcLogicEntropy(tags: SevenLogicValue[]): DistributionAnalysis {
    const counts: Record<string, number> = {};
    for (const tag of tags) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
    const total = tags.length;
    const distribution: Record<string, number> = {};
    for (const [tag, count] of Object.entries(counts)) {
      distribution[tag] = count / total;
    }
    return this.calcEntropy(distribution);
  }
}
