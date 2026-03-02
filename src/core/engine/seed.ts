/**
 * D-FUMT Engine Layer 1: SEED (種)
 * ゼロ拡張縮小・多次元写像
 *
 * D-FUMT理論における「種」は宇宙の初期状態を表す。
 * ゼロ(∅)から拡張し、任意次元に写像する根源的操作を担う。
 */

import { DFUMT_CONSTANTS, DFUMTValue, DualValue } from '../dfumt/constants';

// ============================================================
// 型定義
// ============================================================

/** 次元ベクトル: n次元空間における座標 */
export type DimensionVector = number[];

/** 写像結果 */
export interface MappingResult {
  source: DimensionVector;
  target: DimensionVector;
  dimension: number;
  expansionFactor: number;
  contractionFactor: number;
  isZeroFixed: boolean;       // ゼロ不動点フラグ
}

/** ゼロ拡張操作 */
export interface ZeroExtension {
  origin: DFUMTValue;         // 拡張元の値
  expanded: DFUMTValue[];     // 拡張後の値列
  depth: number;              // 拡張深度
  dual: DualValue;            // ⊕⊖双対
}

/** 縮小操作 */
export interface ZeroContraction {
  values: DFUMTValue[];       // 縮小前の値列
  contracted: DFUMTValue;     // 縮小後の値
  lossRatio: number;          // 情報損失率 [0,1]
}

/** 多次元写像記述子 */
export interface MultidimMapping {
  sourceDim: number;
  targetDim: number;
  kernel: (v: DimensionVector) => DimensionVector;
  isInjective: boolean;
  isSurjective: boolean;
  fixedPoints: DimensionVector[];
}

// ============================================================
// ゼロ拡張縮小エンジン
// ============================================================

/**
 * SeedEngine: D-FUMT種層の核心
 * ゼロを起点として多次元空間を生成・縮退させる
 */
export class SeedEngine {
  private readonly precision: number;
  private readonly maxDepth: number;
  private extensionCache: Map<string, ZeroExtension>;

  constructor(precision = 1e-10, maxDepth = 64) {
    this.precision = precision;
    this.maxDepth = maxDepth;
    this.extensionCache = new Map();
  }

  // ----------------------------------------------------------
  // ゼロ拡張
  // ----------------------------------------------------------

  /**
   * ゼロ拡張: 単一値から多次元空間への拡張
   * D-FUMT理論: 0 → {0⊕, 0⊖, ε₁, ε₂, ...}
   */
  extend(origin: DFUMTValue, depth: number = 1): ZeroExtension {
    const key = `${origin}_${depth}`;
    if (this.extensionCache.has(key)) {
      return this.extensionCache.get(key)!;
    }

    if (depth > this.maxDepth) {
      throw new RangeError(`拡張深度が上限(${this.maxDepth})を超えました: ${depth}`);
    }

    const expanded: DFUMTValue[] = [];

    if (origin === 0) {
      // ゼロの特殊拡張: D-FUMT零拡張理論
      // 0 は消えずに ⊕方向と⊖方向へ分岐する
      for (let k = 1; k <= depth; k++) {
        const eps = this.precision * Math.pow(DFUMT_CONSTANTS.PHI, k);
        expanded.push(+eps);   // ⊕方向
        expanded.push(-eps);   // ⊖方向
      }
      expanded.push(0);        // 不動点として保持
    } else {
      // 非ゼロ値の拡張: フィボナッチ的階層展開
      for (let k = 0; k < depth; k++) {
        const scale = Math.pow(DFUMT_CONSTANTS.PHI, k) / Math.pow(DFUMT_CONSTANTS.E_EXT, k + 1);
        expanded.push(origin * scale);
        if (k > 0) {
          expanded.push(-origin * scale);
        }
      }
    }

    const result: ZeroExtension = {
      origin,
      expanded,
      depth,
      dual: { positive: Math.abs(origin), negative: -Math.abs(origin) },
    };

    this.extensionCache.set(key, result);
    return result;
  }

  /**
   * 逐次拡張: 深度方向への反復拡張（Genesis Ladder的）
   */
  extendRecursive(origin: DFUMTValue, targetDepth: number): ZeroExtension[] {
    const ladder: ZeroExtension[] = [];
    let current = origin;

    for (let d = 1; d <= targetDepth; d++) {
      const ext = this.extend(current, d);
      ladder.push(ext);
      // 次の階層のoriginは拡張の最初の正値
      if (ext.expanded.length > 0) {
        current = ext.expanded[0];
      }
    }

    return ladder;
  }

  // ----------------------------------------------------------
  // ゼロ縮小
  // ----------------------------------------------------------

  /**
   * ゼロ縮小: 多次元値列を単一値へ縮退
   * 情報損失を最小化するMin-Loss縮小
   */
  contract(values: DFUMTValue[]): ZeroContraction {
    if (values.length === 0) {
      return { values: [], contracted: 0, lossRatio: 0 };
    }

    const n = values.length;
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;

    // 双対対称性の評価
    const positiveSum = values.filter(v => v >= 0).reduce((a, v) => a + v, 0);
    const negativeSum = Math.abs(values.filter(v => v < 0).reduce((a, v) => a + v, 0));
    const symmetryBalance = Math.abs(positiveSum - negativeSum);
    const totalMagnitude = positiveSum + negativeSum;

    // 情報損失率: 対称性が完全なほど損失ゼロ（双対消去）
    const lossRatio = totalMagnitude > this.precision
      ? symmetryBalance / totalMagnitude
      : 0;

    // ゼロ近傍なら完全縮小
    const contracted: DFUMTValue =
      Math.abs(mean) < this.precision ? 0 : mean;

    return { values, contracted, lossRatio };
  }

  /**
   * 双対消去縮小: ⊕⊖対称ペアを相殺して縮小
   */
  cancelDuals(values: DFUMTValue[]): ZeroContraction {
    const sorted = [...values].sort((a, b) => a - b);
    const remaining: DFUMTValue[] = [];
    let lo = 0, hi = sorted.length - 1;

    while (lo < hi) {
      const sum = sorted[lo] + sorted[hi];
      if (Math.abs(sum) < this.precision) {
        lo++; hi--;  // 対消滅
      } else if (sum < 0) {
        remaining.push(sorted[lo++]);
      } else {
        remaining.push(sorted[hi--]);
      }
    }
    if (lo === hi) remaining.push(sorted[lo]);

    const contracted = remaining.reduce((a, v) => a + v, 0);
    const lossRatio = remaining.length / values.length;

    return { values, contracted, lossRatio };
  }

  // ----------------------------------------------------------
  // 多次元写像
  // ----------------------------------------------------------

  /**
   * 次元昇格写像: n次元 → m次元 (m > n)
   * D-FUMT π拡張を利用した次元埋め込み
   */
  elevate(v: DimensionVector, targetDim: number): MappingResult {
    const sourceDim = v.length;
    if (targetDim < sourceDim) {
      throw new RangeError(`昇格には targetDim(${targetDim}) > sourceDim(${sourceDim}) が必要です`);
    }

    const target: DimensionVector = [...v];

    // 不足次元をD-FUMT定数で補完
    for (let i = sourceDim; i < targetDim; i++) {
      const base = v[i % sourceDim] ?? 0;
      const phase = (i * Math.PI) / DFUMT_CONSTANTS.PI_EXT;
      target.push(base * Math.cos(phase) * DFUMT_CONSTANTS.PHI);
    }

    const expansionFactor = targetDim / Math.max(sourceDim, 1);

    return {
      source: v,
      target,
      dimension: targetDim,
      expansionFactor,
      contractionFactor: 1 / expansionFactor,
      isZeroFixed: v.every(x => Math.abs(x) < this.precision),
    };
  }

  /**
   * 次元降格写像: n次元 → m次元 (m < n)
   * 主成分的縮退（情報最大保存）
   */
  reduce(v: DimensionVector, targetDim: number): MappingResult {
    const sourceDim = v.length;
    if (targetDim > sourceDim) {
      throw new RangeError(`降格には targetDim(${targetDim}) < sourceDim(${sourceDim}) が必要です`);
    }

    const target: DimensionVector = [];

    // ブロック平均による次元圧縮
    const blockSize = sourceDim / targetDim;
    for (let i = 0; i < targetDim; i++) {
      const start = Math.floor(i * blockSize);
      const end = Math.floor((i + 1) * blockSize);
      const block = v.slice(start, end);
      const mean = block.reduce((a, x) => a + x, 0) / block.length;
      target.push(mean);
    }

    const contractionFactor = targetDim / sourceDim;

    return {
      source: v,
      target,
      dimension: targetDim,
      expansionFactor: sourceDim / targetDim,
      contractionFactor,
      isZeroFixed: v.every(x => Math.abs(x) < this.precision),
    };
  }

  /**
   * 不動点探索: 写像 f において f(x) = x となる点を探す
   * 反復法による数値解
   */
  findFixedPoints(
    f: (v: DimensionVector) => DimensionVector,
    dim: number,
    iterations = 1000,
  ): DimensionVector[] {
    const candidates: DimensionVector[] = [
      new Array(dim).fill(0),                              // ゼロベクトル
      new Array(dim).fill(1),                              // 単位ベクトル
      new Array(dim).fill(DFUMT_CONSTANTS.PHI),            // φ点
      new Array(dim).fill(-DFUMT_CONSTANTS.PHI),           // -φ点
    ];

    const fixedPoints: DimensionVector[] = [];

    for (const seed of candidates) {
      let current = [...seed];
      for (let i = 0; i < iterations; i++) {
        const next = f(current);
        const diff = next.reduce((acc, x, idx) => acc + Math.abs(x - current[idx]), 0);
        if (diff < this.precision * dim) {
          fixedPoints.push(current);
          break;
        }
        // ダンピング付き更新
        current = current.map((x, idx) => x * 0.5 + next[idx] * 0.5);
      }
    }

    return this._deduplicateVectors(fixedPoints);
  }

  /**
   * 多次元写像記述子を生成
   */
  createMapping(
    sourceDim: number,
    targetDim: number,
    type: 'linear' | 'fourier' | 'dfumt' = 'dfumt',
  ): MultidimMapping {
    let kernel: (v: DimensionVector) => DimensionVector;
    let isInjective = false;
    let isSurjective = false;

    switch (type) {
      case 'linear':
        kernel = (v) => {
          if (targetDim >= sourceDim) return this.elevate(v, targetDim).target;
          return this.reduce(v, targetDim).target;
        };
        isInjective = targetDim >= sourceDim;
        isSurjective = targetDim <= sourceDim;
        break;

      case 'fourier':
        kernel = (v) => {
          const target: DimensionVector = [];
          for (let k = 0; k < targetDim; k++) {
            let re = 0, im = 0;
            for (let n = 0; n < v.length; n++) {
              const angle = (2 * Math.PI * k * n) / v.length;
              re += v[n] * Math.cos(angle);
              im += v[n] * Math.sin(angle);
            }
            target.push(Math.sqrt(re * re + im * im) / v.length);
          }
          return target;
        };
        isInjective = false;
        isSurjective = true;
        break;

      case 'dfumt':
      default:
        // D-FUMT固有写像: π拡張 + φ螺旋
        kernel = (v) => {
          const target: DimensionVector = [];
          for (let k = 0; k < targetDim; k++) {
            const idx = k % v.length;
            const phase = (k * DFUMT_CONSTANTS.PI_EXT) / targetDim;
            const spiral = Math.pow(DFUMT_CONSTANTS.PHI, k / targetDim);
            target.push(v[idx] * Math.cos(phase) * spiral);
          }
          return target;
        };
        isInjective = targetDim >= sourceDim;
        isSurjective = targetDim <= sourceDim;
        break;
    }

    const fixedPoints = this.findFixedPoints(kernel, sourceDim);

    return { sourceDim, targetDim, kernel, isInjective, isSurjective, fixedPoints };
  }

  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------

  private _deduplicateVectors(vecs: DimensionVector[]): DimensionVector[] {
    const unique: DimensionVector[] = [];
    for (const v of vecs) {
      const isDup = unique.some(u =>
        u.length === v.length &&
        u.every((x, i) => Math.abs(x - v[i]) < this.precision),
      );
      if (!isDup) unique.push(v);
    }
    return unique;
  }

  /** キャッシュクリア */
  clearCache(): void {
    this.extensionCache.clear();
  }

  /** エンジン状態サマリー */
  summary(): string {
    return [
      '=== SeedEngine (種層) ===',
      `精度 : ${this.precision}`,
      `最大拡張深度: ${this.maxDepth}`,
      `キャッシュ件数: ${this.extensionCache.size}`,
    ].join('\n');
  }
}

// デフォルトエクスポート
export const seedEngine = new SeedEngine();
