/**
 * UniversalLogicEngine — 統一論理体系エンジン
 *
 * Phase 6k: D-FUMT 論理統一場理論の形式的実装。
 * 四句分別（龍樹・2世紀）・Łukasiewicz3値論理（1920年）・
 * ファジー論理（Zadeh・1965年）・n値論理を七価論理に統一する。
 *
 * 射影定理: ∀ L_n（n値論理体系）, ∃ π: L_n → L_7
 */

import type { SevenLogicValue } from './seven-logic';

// ═══════════════════════════════════════════
// 型定義
// ═══════════════════════════════════════════

export type UniversalLogicType =
  | { kind: 'Discrete';    value: SevenLogicValue }
  | { kind: 'Continuous';  value: number }
  | { kind: 'NValued';     n: number; index: number }
  | { kind: 'Catuskoti';   value: 0 | 1 | 2 | 3 }
  | { kind: 'Lukasiewicz'; value: 0 | 1 | 2 }
  | { kind: 'Quantum';     re: number; im: number };

export type MembershipShape = 'triangular' | 'trapezoidal' | 'gaussian' | 'sigmoid';

// ═══════════════════════════════════════════
// UniversalLogicEngine
// ═══════════════════════════════════════════

export class UniversalLogicEngine {

  // ── 四句分別 → 七価マッピング ──────────────────────

  /**
   * 龍樹の四句分別を七価論理にマッピング。
   * 四句分別は七価の「核」として完全対応する。
   *
   * @param value 0=有(TRUE), 1=無(FALSE), 2=亦有亦無(BOTH), 3=非有非無(NEITHER)
   */
  catuskotiToLogic7(value: 0 | 1 | 2 | 3): SevenLogicValue {
    const map: Record<number, SevenLogicValue> = {
      0: 'TRUE',
      1: 'FALSE',
      2: 'BOTH',
      3: 'NEITHER',
    };
    return map[value];
  }

  // ── Łukasiewicz3値 → 七価マッピング ────────────────

  /**
   * Łukasiewicz3値論理を七価論理にマッピング。
   * 不定値（indeterminate）は NEITHER に対応。
   *
   * @param value 0=FALSE, 1=UNKNOWN(不定), 2=TRUE
   */
  lukasiewiczToLogic7(value: 0 | 1 | 2): SevenLogicValue {
    const map: Record<number, SevenLogicValue> = {
      0: 'FALSE',
      1: 'NEITHER',
      2: 'TRUE',
    };
    return map[value];
  }

  // ── ファジー値 → 七価マッピング ────────────────────

  /**
   * ファジー値 [0.0, 1.0] を七価論理にマッピング。
   * 境界外の値は ZERO / INFINITY に対応。
   */
  fuzzyToLogic7(f: number): SevenLogicValue {
    if (f === 0.0)                  return 'FALSE';
    if (f === 1.0)                  return 'TRUE';
    if (f < 0.0)                    return 'ZERO';
    if (f > 1.0)                    return 'INFINITY';
    if (Math.abs(f - 0.5) < 1e-10) return 'NEITHER';
    if (f < 0.3)                    return 'FALSE';
    if (f > 0.7)                    return 'TRUE';
    return 'FLOWING';
  }

  // ── n値論理 → 七価マッピング ───────────────────────

  /**
   * n値論理の第i値を七価論理にマッピング。
   * 端点は TRUE/FALSE、中間値は NEITHER/FLOWING。
   */
  nvaluedToLogic7(n: number, index: number): SevenLogicValue {
    if (index === 0)     return 'FALSE';
    if (index === n - 1) return 'TRUE';
    const mid = (n - 1) / 2;
    if (Math.abs(index - mid) < 0.5) {
      return n % 2 === 1 ? 'NEITHER' : 'FLOWING';
    }
    return 'FLOWING';
  }

  // ── 統一正規化関数 ─────────────────────────────────

  /**
   * 全論理体系を七価論理に正規化する統一射影関数。
   * 射影定理: ∀ L_n, ∃ π: L_n → L_7
   */
  normalizeToLogic7(val: UniversalLogicType): SevenLogicValue {
    switch (val.kind) {
      case 'Discrete':    return val.value;
      case 'Continuous':  return this.fuzzyToLogic7(val.value);
      case 'NValued':     return this.nvaluedToLogic7(val.n, val.index);
      case 'Catuskoti':   return this.catuskotiToLogic7(val.value);
      case 'Lukasiewicz': return this.lukasiewiczToLogic7(val.value);
      case 'Quantum': {
        const prob = val.re ** 2 + val.im ** 2;
        return this.fuzzyToLogic7(prob);
      }
    }
  }

  // ── Łukasiewicz ファジー演算子 ─────────────────────

  /** Łukasiewicz t-norm: max(0, a + b - 1) */
  fuzzyAnd(a: number, b: number): number {
    return Math.max(0.0, a + b - 1.0);
  }

  /** Łukasiewicz t-conorm: min(1, a + b) */
  fuzzyOr(a: number, b: number): number {
    return Math.min(1.0, a + b);
  }

  /** 標準否定: 1 - a */
  fuzzyNot(a: number): number {
    return 1.0 - a;
  }

  /** ファジーXOR: |a - b| */
  fuzzyXor(a: number, b: number): number {
    return Math.abs(a - b);
  }

  // ── メンバーシップ関数 ─────────────────────────────

  /**
   * メンバーシップ関数を計算する。
   * @param shape 形状 (triangular, trapezoidal, gaussian, sigmoid)
   * @param params 形状パラメータ
   * @param x 入力値
   */
  membership(shape: MembershipShape, params: number[], x: number): number {
    switch (shape) {
      case 'triangular':   return this.triangularMembership(params, x);
      case 'trapezoidal':  return this.trapezoidalMembership(params, x);
      case 'gaussian':     return this.gaussianMembership(params, x);
      case 'sigmoid':      return this.sigmoidMembership(params, x);
    }
  }

  /** 三角メンバーシップ関数 [a, b, c] */
  triangularMembership(params: number[], x: number): number {
    const [a, b, c] = params;
    if (x <= a || x >= c) return 0.0;
    if (x === b) return 1.0;
    if (x < b) return (x - a) / (b - a);
    return (c - x) / (c - b);
  }

  /** 台形メンバーシップ関数 [a, b, c, d] */
  trapezoidalMembership(params: number[], x: number): number {
    const [a, b, c, d] = params;
    if (x <= a || x >= d) return 0.0;
    if (x >= b && x <= c) return 1.0;
    if (x < b) return (x - a) / (b - a);
    return (d - x) / (d - c);
  }

  /** ガウスメンバーシップ関数 [center, sigma] */
  gaussianMembership(params: number[], x: number): number {
    const [c, sigma] = params;
    return Math.exp(-0.5 * ((x - c) / sigma) ** 2);
  }

  /** シグモイドメンバーシップ関数 [center, k] */
  sigmoidMembership(params: number[], x: number): number {
    const [c, k] = params;
    return 1.0 / (1.0 + Math.exp(-k * (x - c)));
  }

  // ── 検証メソッド ───────────────────────────────────

  /**
   * 龍樹（2世紀）とŁukasiewicz（1920年）の「不定」概念が
   * 七価論理のNEITHERに統一されることを検証する核心定理。
   */
  verifyNagarjunaLukasiewiczUnification(): boolean {
    const nagarjunaNEITHER = this.catuskotiToLogic7(3);    // 非有非無
    const lukasiewiczNEITHER = this.lukasiewiczToLogic7(1); // 不定
    return nagarjunaNEITHER === lukasiewiczNEITHER && nagarjunaNEITHER === 'NEITHER';
  }

  /**
   * 四句分別が七価論理の「核」（部分集合）であることを検証。
   * INFINITY / ZERO / FLOWING には射影されない。
   */
  verifyCatuskotiIsSubset(): boolean {
    const catuskotiValues: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];
    const extendedValues: SevenLogicValue[] = ['INFINITY', 'ZERO', 'FLOWING'];

    for (const v of catuskotiValues) {
      const mapped = this.catuskotiToLogic7(v);
      if (extendedValues.includes(mapped)) return false;
    }
    return true;
  }

  /**
   * Łukasiewicz3値がnvalued(3)のエイリアスであることを検証。
   */
  verifyLukasiewiczIsNValuedAlias(): boolean {
    for (let i = 0; i < 3; i++) {
      const luk = this.lukasiewiczToLogic7(i as 0 | 1 | 2);
      const nval = this.nvaluedToLogic7(3, i);
      if (luk !== nval) return false;
    }
    return true;
  }

  /**
   * 射影定理: 全論理体系が七価に射影可能であることを検証。
   */
  verifyProjectionTheorem(): boolean {
    const sevenValues: SevenLogicValue[] = [
      'TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING',
    ];

    // テスト: 各体系の射影結果が七価のいずれかであること
    const tests: UniversalLogicType[] = [
      { kind: 'Discrete',    value: 'TRUE' },
      { kind: 'Continuous',  value: 0.85 },
      { kind: 'NValued',     n: 5, index: 2 },
      { kind: 'Catuskoti',   value: 2 },
      { kind: 'Lukasiewicz', value: 1 },
      { kind: 'Quantum',     re: 0.6, im: 0.8 },
    ];

    for (const t of tests) {
      const result = this.normalizeToLogic7(t);
      if (!sevenValues.includes(result)) return false;
    }
    return true;
  }
}
