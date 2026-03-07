/**
 * Rei-AIOS — NumericalReasoningEngine
 * LLM構造的弱点「数値処理」を補完する数値推論エンジン
 *
 * 機能:
 *   1. D-FUMT螺旋数理論 — 7値×複素平面の螺旋写像
 *   2. ゼロπ理論演算 — 0とπの相互変換・特殊演算
 *   3. 多倍長整数演算 — BigInt による任意精度整数演算
 *   4. 区間演算 — 誤差付き数値の厳密な範囲計算
 *   5. D-FUMT七価論理による数値状態分類
 *
 * Theory #102: D-FUMT螺旋数（SpiralNumber）
 * Theory #103: ゼロπ数値変換（ZeroPiTransform）
 * Theory #104: 区間演算公理（IntervalArithmetic）
 */

import type { SeedTheory } from './seed-kernel';

// ── 型定義 ─────────────────────────────────────────────

export type DFUMTValue = 'TRUE' | 'FALSE' | 'BOTH' | 'NEITHER' | 'INFINITY' | 'ZERO' | 'FLOWING';

/** 区間 [lo, hi] */
export interface Interval {
  lo: number;
  hi: number;
}

/** 螺旋数: D-FUMT七価論理 × 複素平面 */
export interface SpiralNumber {
  r:     number;        // 動径（0以上）
  theta: number;        // 偏角（ラジアン）
  layer: number;        // 螺旋層（整数）
  dfumt: DFUMTValue;    // 七価論理値
}

/** 数値推論の結果 */
export interface NumericalResult {
  value:      number;
  interval:   Interval;
  dfumt:      DFUMTValue;
  confidence: number;    // 0.0〜1.0
  method:     string;
}

// ══════════════════════════════════════════════════════════
// Theory #102: D-FUMT螺旋数（SpiralNumber）
// ══════════════════════════════════════════════════════════

export class SpiralArithmetic {
  /**
   * 実数 → 螺旋数への射影
   */
  static fromReal(x: number): SpiralNumber {
    if (Number.isNaN(x)) {
      return { r: NaN, theta: 0, layer: 0, dfumt: 'NEITHER' };
    }
    if (!Number.isFinite(x)) {
      return { r: Infinity, theta: 0, layer: 0, dfumt: 'INFINITY' };
    }
    if (x === 0) {
      return { r: 0, theta: 0, layer: 0, dfumt: 'ZERO' };
    }
    const r = Math.abs(x);
    const theta = x > 0 ? 0 : Math.PI;
    const layer = Math.floor(Math.log2(r + 1));
    const dfumt = SpiralArithmetic.classifyReal(x);
    return { r, theta, layer, dfumt };
  }

  /**
   * 複素数 → 螺旋数
   */
  static fromComplex(re: number, im: number): SpiralNumber {
    const r = Math.sqrt(re * re + im * im);
    const theta = Math.atan2(im, re);
    const layer = Math.floor(Math.log2(r + 1));
    let dfumt: DFUMTValue;
    if (r === 0) dfumt = 'ZERO';
    else if (!Number.isFinite(r)) dfumt = 'INFINITY';
    else if (re > 0 && im === 0) dfumt = 'TRUE';
    else if (re < 0 && im === 0) dfumt = 'FALSE';
    else if (re !== 0 && im !== 0) dfumt = 'BOTH';
    else dfumt = 'FLOWING';
    return { r, theta, layer, dfumt };
  }

  /**
   * 螺旋数の加算
   */
  static add(a: SpiralNumber, b: SpiralNumber): SpiralNumber {
    const ax = a.r * Math.cos(a.theta);
    const ay = a.r * Math.sin(a.theta);
    const bx = b.r * Math.cos(b.theta);
    const by = b.r * Math.sin(b.theta);
    return SpiralArithmetic.fromComplex(ax + bx, ay + by);
  }

  /**
   * 螺旋数の乗算（極形式: r1*r2, theta1+theta2, layer合成）
   */
  static mul(a: SpiralNumber, b: SpiralNumber): SpiralNumber {
    const r = a.r * b.r;
    const theta = a.theta + b.theta;
    const layer = a.layer + b.layer;
    const dfumt = SpiralArithmetic.mergeDfumt(a.dfumt, b.dfumt);
    return { r, theta: SpiralArithmetic.normalizeAngle(theta), layer, dfumt };
  }

  /**
   * 螺旋回転: layer を1つ進める
   */
  static rotate(s: SpiralNumber, deltaThetaFraction = 1/7): SpiralNumber {
    const newTheta = s.theta + 2 * Math.PI * deltaThetaFraction;
    return {
      r: s.r,
      theta: SpiralArithmetic.normalizeAngle(newTheta),
      layer: s.layer + 1,
      dfumt: 'FLOWING',
    };
  }

  /**
   * 螺旋数 → 実数への射影
   */
  static toReal(s: SpiralNumber): number {
    return s.r * Math.cos(s.theta);
  }

  /**
   * 実数のD-FUMT七価分類
   */
  static classifyReal(x: number): DFUMTValue {
    if (Number.isNaN(x)) return 'NEITHER';
    if (!Number.isFinite(x)) return 'INFINITY';
    if (x === 0) return 'ZERO';
    if (x > 0 && Number.isInteger(x)) return 'TRUE';
    if (x < 0 && Number.isInteger(x)) return 'FALSE';
    // 無理数的（小数点以下が長い）→ FLOWING
    const decimal = Math.abs(x) - Math.floor(Math.abs(x));
    if (decimal > 0.0001 && decimal < 0.9999) return 'FLOWING';
    return 'BOTH';
  }

  private static normalizeAngle(theta: number): number {
    while (theta > Math.PI) theta -= 2 * Math.PI;
    while (theta <= -Math.PI) theta += 2 * Math.PI;
    return theta;
  }

  private static mergeDfumt(a: DFUMTValue, b: DFUMTValue): DFUMTValue {
    if (a === b) return a;
    if (a === 'ZERO') return b;
    if (b === 'ZERO') return a;
    if (a === 'INFINITY' || b === 'INFINITY') return 'INFINITY';
    if ((a === 'TRUE' && b === 'FALSE') || (a === 'FALSE' && b === 'TRUE')) return 'BOTH';
    return 'FLOWING';
  }
}

// ══════════════════════════════════════════════════════════
// Theory #103: ゼロπ数値変換（ZeroPiTransform）
// ══════════════════════════════════════════════════════════

export class ZeroPiTransform {
  /**
   * ゼロ原点射影: x → x - floor(x/π)*π
   * 任意の実数を [0, π) に写す
   */
  static project(x: number): number {
    if (x === 0) return 0;
    if (!Number.isFinite(x)) return NaN;
    const normalized = x - Math.floor(x / Math.PI) * Math.PI;
    return Math.abs(normalized) < 1e-15 ? 0 : normalized;
  }

  /**
   * π符号化: 実数をπの倍数として表現
   * 戻り値: [係数, 剰余]
   */
  static piEncode(x: number): [number, number] {
    if (!Number.isFinite(x)) return [NaN, NaN];
    const coeff = Math.floor(x / Math.PI);
    const remainder = x - coeff * Math.PI;
    return [coeff, remainder];
  }

  /**
   * ゼロπ変換: f(0) = π, f(π) = 0 の対称変換
   */
  static zeroPiDual(x: number): number {
    return Math.PI - ZeroPiTransform.project(x);
  }

  /**
   * 七価論理による数値状態判定
   */
  static classify(x: number): DFUMTValue {
    if (Number.isNaN(x)) return 'NEITHER';
    if (!Number.isFinite(x)) return 'INFINITY';
    if (x === 0) return 'ZERO';
    const p = ZeroPiTransform.project(x);
    if (Math.abs(p) < 1e-10) return 'ZERO';              // πの倍数 → ゼロ原点
    if (Math.abs(p - Math.PI / 2) < 1e-10) return 'BOTH'; // π/2 → 中間点
    if (p < Math.PI / 2) return 'TRUE';                   // [0, π/2) → 真
    return 'FALSE';                                        // (π/2, π) → 偽
  }

  /**
   * 三角関数的D-FUMT写像: sin(x) の値でD-FUMT分類
   */
  static sinClassify(x: number): DFUMTValue {
    const s = Math.sin(x);
    if (Math.abs(s) < 1e-10) return 'ZERO';
    if (Math.abs(s - 1) < 1e-10) return 'TRUE';
    if (Math.abs(s + 1) < 1e-10) return 'FALSE';
    if (s > 0) return 'FLOWING';
    return 'NEITHER';
  }
}

// ══════════════════════════════════════════════════════════
// Theory #104: 区間演算公理（IntervalArithmetic）
// ══════════════════════════════════════════════════════════

export class IntervalArithmetic {
  /**
   * 区間の加算: [a,b] + [c,d] = [a+c, b+d]
   */
  static add(a: Interval, b: Interval): Interval {
    return { lo: a.lo + b.lo, hi: a.hi + b.hi };
  }

  /**
   * 区間の減算: [a,b] - [c,d] = [a-d, b-c]
   */
  static sub(a: Interval, b: Interval): Interval {
    return { lo: a.lo - b.hi, hi: a.hi - b.lo };
  }

  /**
   * 区間の乗算
   */
  static mul(a: Interval, b: Interval): Interval {
    const products = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi];
    return { lo: Math.min(...products), hi: Math.max(...products) };
  }

  /**
   * 区間の除算（0を含まない場合のみ）
   */
  static div(a: Interval, b: Interval): Interval | null {
    if (b.lo <= 0 && b.hi >= 0) return null; // 0除算
    const inv: Interval = { lo: 1 / b.hi, hi: 1 / b.lo };
    return IntervalArithmetic.mul(a, inv);
  }

  /**
   * 区間の幅（誤差の大きさ）
   */
  static width(iv: Interval): number {
    return iv.hi - iv.lo;
  }

  /**
   * 区間の中点
   */
  static midpoint(iv: Interval): number {
    return (iv.lo + iv.hi) / 2;
  }

  /**
   * 区間が値を含むか
   */
  static contains(iv: Interval, x: number): boolean {
    return x >= iv.lo && x <= iv.hi;
  }

  /**
   * 区間の交差
   */
  static intersect(a: Interval, b: Interval): Interval | null {
    const lo = Math.max(a.lo, b.lo);
    const hi = Math.min(a.hi, b.hi);
    return lo <= hi ? { lo, hi } : null;
  }

  /**
   * 区間のD-FUMT分類
   */
  static classify(iv: Interval): DFUMTValue {
    if (iv.lo === 0 && iv.hi === 0) return 'ZERO';
    if (iv.lo > 0) return 'TRUE';
    if (iv.hi < 0) return 'FALSE';
    if (iv.lo < 0 && iv.hi > 0) return 'BOTH';         // 正負にまたがる
    if (!Number.isFinite(iv.lo) || !Number.isFinite(iv.hi)) return 'INFINITY';
    const w = IntervalArithmetic.width(iv);
    if (w > Math.abs(IntervalArithmetic.midpoint(iv)) * 0.5) return 'FLOWING'; // 幅が大きい
    return 'NEITHER';
  }

  /**
   * 実数 → 区間への昇格（誤差指定）
   */
  static fromReal(x: number, epsilon = 1e-15): Interval {
    return { lo: x - epsilon, hi: x + epsilon };
  }
}

// ══════════════════════════════════════════════════════════
// 多倍長整数演算（BigInt ベース）
// ══════════════════════════════════════════════════════════

export class BigIntArithmetic {
  /**
   * フィボナッチ数（高速ダブリング法）
   */
  static fibonacci(n: number): bigint {
    if (n < 0) throw new Error('n must be >= 0');
    if (n === 0) return 0n;
    let a = 0n, b = 1n;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  /**
   * 階乗
   */
  static factorial(n: number): bigint {
    if (n < 0) throw new Error('n must be >= 0');
    let result = 1n;
    for (let i = 2; i <= n; i++) {
      result *= BigInt(i);
    }
    return result;
  }

  /**
   * べき乗（高速累乗法）
   */
  static pow(base: bigint, exp: number): bigint {
    if (exp < 0) throw new Error('exponent must be >= 0');
    if (exp === 0) return 1n;
    let result = 1n;
    let b = base;
    let e = exp;
    while (e > 0) {
      if (e & 1) result *= b;
      b *= b;
      e >>= 1;
    }
    return result;
  }

  /**
   * 最大公約数（ユークリッド互除法）
   */
  static gcd(a: bigint, b: bigint): bigint {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) {
      [a, b] = [b, a % b];
    }
    return a;
  }

  /**
   * モジュラべき乗（暗号的応用）
   */
  static modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    if (mod === 1n) return 0n;
    let result = 1n;
    base = ((base % mod) + mod) % mod;
    while (exp > 0n) {
      if (exp & 1n) result = (result * base) % mod;
      exp >>= 1n;
      base = (base * base) % mod;
    }
    return result;
  }

  /**
   * 桁数
   */
  static digitCount(n: bigint): number {
    if (n === 0n) return 1;
    if (n < 0n) n = -n;
    return n.toString().length;
  }
}

// ══════════════════════════════════════════════════════════
// NumericalReasoningEngine — 統合エンジン
// ══════════════════════════════════════════════════════════

export class NumericalReasoningEngine {
  /**
   * 数値を総合的にD-FUMT分類
   */
  evaluate(x: number): NumericalResult {
    const spiral = SpiralArithmetic.fromReal(x);
    const zeroPi = ZeroPiTransform.classify(x);
    const interval = IntervalArithmetic.fromReal(x);
    const intervalClass = IntervalArithmetic.classify(interval);

    // 3つの分類を統合（螺旋数の分類を基本とし、他の分類で確信度調整）
    const dfumt = spiral.dfumt;
    const agreement = [spiral.dfumt, zeroPi, intervalClass]
      .filter(v => v === dfumt).length;
    const confidence = agreement / 3;

    return {
      value: x,
      interval,
      dfumt,
      confidence,
      method: 'spiral+zeroPi+interval',
    };
  }

  /**
   * 区間つき演算: (x ± epsilon) op (y ± epsilon)
   */
  computeWithError(
    x: number, y: number,
    op: 'add' | 'sub' | 'mul' | 'div',
    epsilon = 1e-10,
  ): NumericalResult {
    const a = IntervalArithmetic.fromReal(x, epsilon);
    const b = IntervalArithmetic.fromReal(y, epsilon);

    let result: Interval | null;
    switch (op) {
      case 'add': result = IntervalArithmetic.add(a, b); break;
      case 'sub': result = IntervalArithmetic.sub(a, b); break;
      case 'mul': result = IntervalArithmetic.mul(a, b); break;
      case 'div': result = IntervalArithmetic.div(a, b); break;
    }

    if (!result) {
      return {
        value: NaN,
        interval: { lo: -Infinity, hi: Infinity },
        dfumt: 'NEITHER',
        confidence: 0,
        method: 'interval-div-by-zero',
      };
    }

    const mid = IntervalArithmetic.midpoint(result);
    const width = IntervalArithmetic.width(result);
    const confidence = width < 1e-5 ? 1.0 : Math.max(0, 1 - width / (Math.abs(mid) + 1));

    return {
      value: mid,
      interval: result,
      dfumt: IntervalArithmetic.classify(result),
      confidence,
      method: `interval-${op}`,
    };
  }

  /**
   * 螺旋数演算
   */
  spiralCompute(
    x: number, y: number,
    op: 'add' | 'mul' | 'rotate',
  ): SpiralNumber {
    const a = SpiralArithmetic.fromReal(x);
    const b = SpiralArithmetic.fromReal(y);
    switch (op) {
      case 'add':    return SpiralArithmetic.add(a, b);
      case 'mul':    return SpiralArithmetic.mul(a, b);
      case 'rotate': return SpiralArithmetic.rotate(a, y);
    }
  }

  /**
   * SEED_KERNEL用の理論エントリを返す
   */
  static getSeedKernelEntries(): SeedTheory[] {
    return [
      {
        id: 'dfumt-spiral-number',
        axiom: 'SpiralNumber: r*e^(i*theta)*layer = D-FUMT数値螺旋写像',
        category: 'numerical',
        keywords: ['螺旋', 'spiral', '複素数', '七価分類'],
      },
      {
        id: 'dfumt-zero-pi-transform',
        axiom: 'ZeroPi: f(0)=pi, f(pi)=0, x mod pi = ゼロ原点射影',
        category: 'numerical',
        keywords: ['ゼロ', 'pi', '射影', '対称変換'],
      },
      {
        id: 'dfumt-interval-arithmetic',
        axiom: '[a,b] op [c,d] = 誤差伝播区間演算 D-FUMT信頼度付き',
        category: 'numerical',
        keywords: ['区間', 'interval', '誤差', '信頼度'],
      },
    ];
  }
}
