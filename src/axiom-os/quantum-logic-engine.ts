/**
 * Rei-AIOS — QuantumLogicEngine
 * Phase 7: 量子論理とD-FUMT七価論理の統合エンジン
 *
 * 理論#99: 量子重ね合わせ公理（Superposition Axiom）
 * 理論#100: 射影測定公理（Projection Measurement Axiom）
 * 理論#101: 量子非分配律（Quantum Non-Distributivity）
 */

import type { DFUMTValue } from '../memory/aios-memory';

// ─── 量子状態の型 ─────────────────────────────────────────

/** 複素数（簡易表現）*/
export interface Complex {
  re: number;   // 実部
  im: number;   // 虚部
}

/** 量子ビット（qubit）の状態ベクトル */
export interface QubitState {
  alpha: Complex;   // |0> の振幅
  beta:  Complex;   // |1> の振幅
  label?: string;   // 状態ラベル（任意）
}

/** 量子測定の結果 */
export interface MeasurementResult {
  outcome:     0 | 1;
  probability: number;
  collapsed:   QubitState;    // 測定後の状態
  dfumtBefore: DFUMTValue;    // 測定前のD-FUMT値
  dfumtAfter:  DFUMTValue;    // 測定後のD-FUMT値（FLOWING）
}

/** 量子論理ゲートの種類 */
export type QuantumGate = 'H' | 'X' | 'Y' | 'Z' | 'CNOT' | 'T' | 'S';

// ─── ユーティリティ ──────────────────────────────────────

function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}
function complexAbs2(c: Complex): number {
  return c.re * c.re + c.im * c.im;
}
function complexScale(s: number, c: Complex): Complex {
  return { re: s * c.re, im: s * c.im };
}
const INV_SQRT2 = 1 / Math.SQRT2;  // 1/sqrt(2)

// ─── 量子状態 → D-FUMT七価値変換 ──────────────────────────

/**
 * 量子ビット状態をD-FUMT七価論理値に変換する。
 *
 * 変換ルール（Theory #99）:
 *   |0> （alpha~1, beta~0）     → FALSE
 *   |1> （alpha~0, beta~1）     → TRUE
 *   alpha|0>+beta|1> （均等）   → BOTH（重ね合わせ）
 *   alpha|0>+beta|1> （不均等） → FLOWING（波束収縮途中）
 *   |empty> （alpha=beta=0）    → ZERO（真空状態）
 *   測定不能（NaN）             → NEITHER
 */
export function qubitToDFUMT(state: QubitState): DFUMTValue {
  const p0 = complexAbs2(state.alpha);
  const p1 = complexAbs2(state.beta);
  const total = p0 + p1;

  if (isNaN(p0) || isNaN(p1)) return 'NEITHER';
  if (total < 1e-10)           return 'ZERO';

  // 正規化確率
  const prob0 = p0 / total;
  const prob1 = p1 / total;

  if (prob0 > 0.95)            return 'FALSE';    // |0>
  if (prob1 > 0.95)            return 'TRUE';     // |1>
  if (Math.abs(prob0 - prob1) < 0.05) return 'BOTH';   // 均等重ね合わせ
  return 'FLOWING';                                // 不均等重ね合わせ
}

// ─── Theory #99: 量子重ね合わせ公理 ─────────────────────

export class SuperpositionAxiom {
  static readonly THEORY_ID = 'dfumt-quantum-superposition';
  static readonly AXIOM = 'alpha|0>+beta|1>=BOTH (|alpha|^2+|beta|^2=1)';

  /**
   * アダマールゲート: |0> → (|0>+|1>)/sqrt(2)
   * 基底状態を均等重ね合わせに変換する。
   */
  static hadamard(state: QubitState): QubitState {
    const newAlpha = complexAdd(
      complexScale(INV_SQRT2, state.alpha),
      complexScale(INV_SQRT2, state.beta)
    );
    const newBeta = complexAdd(
      complexScale(INV_SQRT2, state.alpha),
      complexScale(-INV_SQRT2, state.beta)
    );
    return { alpha: newAlpha, beta: newBeta, label: `H(${state.label ?? '?'})` };
  }

  /**
   * 状態が重ね合わせかどうかを判定する（Theory #99の検証）
   */
  static isSuperposition(state: QubitState): boolean {
    const p0 = complexAbs2(state.alpha);
    const p1 = complexAbs2(state.beta);
    const total = p0 + p1;
    if (total < 1e-10) return false;
    const prob0 = p0 / total;
    const prob1 = p1 / total;
    return prob0 > 0.02 && prob1 > 0.02;
  }

  /** D-FUMT評価 */
  static evaluate(state: QubitState): DFUMTValue {
    return qubitToDFUMT(state);
  }
}

// ─── Theory #100: 射影測定公理 ───────────────────────────

export class ProjectionMeasurementAxiom {
  static readonly THEORY_ID = 'dfumt-quantum-measurement';
  static readonly AXIOM = '測定: alpha|0>+beta|1> -> |0>(確率|alpha|^2) or |1>(確率|beta|^2) = FLOWING';

  /**
   * 計算基底での測定シミュレーション。
   *
   * @param state   測定前の量子状態
   * @param random  [0,1) の乱数（省略時: Math.random()）
   */
  static measure(state: QubitState, random?: number): MeasurementResult {
    const r = random ?? Math.random();
    const p0 = complexAbs2(state.alpha) / (complexAbs2(state.alpha) + complexAbs2(state.beta) || 1);
    const dfumtBefore = qubitToDFUMT(state);

    let outcome: 0 | 1;
    let collapsed: QubitState;
    let probability: number;

    if (r < p0) {
      // |0> に収縮
      outcome     = 0;
      probability = p0;
      collapsed   = { alpha: { re: 1, im: 0 }, beta: { re: 0, im: 0 }, label: '|0>' };
    } else {
      // |1> に収縮
      outcome     = 1;
      probability = 1 - p0;
      collapsed   = { alpha: { re: 0, im: 0 }, beta: { re: 1, im: 0 }, label: '|1>' };
    }

    // 測定後は FLOWING（波束収縮 = 状態が変化した）
    const dfumtAfter: DFUMTValue = 'FLOWING';

    return { outcome, probability, collapsed, dfumtBefore, dfumtAfter };
  }

  /**
   * 期待値計算: <psi|Z|psi> = |alpha|^2 - |beta|^2
   */
  static expectationZ(state: QubitState): number {
    const p0 = complexAbs2(state.alpha);
    const p1 = complexAbs2(state.beta);
    return p0 - p1;
  }
}

// ─── Theory #101: 量子非分配律 ───────────────────────────

export class QuantumNonDistributivity {
  static readonly THEORY_ID = 'dfumt-quantum-non-distributivity';
  static readonly AXIOM = 'A AND (B OR C) != (A AND B) OR (A AND C) （量子命題論理）';

  /**
   * 非分配律の具体的な例示（D-FUMT値で表現）
   */
  static demonstrateNonDistributivity(): {
    classical: string;
    quantum: string;
    dfumtValue: DFUMTValue;
    explanation: string;
  } {
    return {
      classical:   'A AND (B OR C) = (A AND B) OR (A AND C) [古典論理: 等価]',
      quantum:     'A AND (B OR C) != (A AND B) OR (A AND C) [量子論理: 非分配]',
      dfumtValue:  'NEITHER',
      explanation: '量子命題論理では射影の順序依存性により分配律が崩れる。'
        + 'D-FUMTのNEITHER値（空性）との対応: 観測前の状態は確定した論理値を持たない。',
    };
  }

  /**
   * ヒルベルト空間での量子AND演算（射影の合成）
   */
  static quantumAnd(a: DFUMTValue, b: DFUMTValue): DFUMTValue {
    if (a === b)         return a;
    if (a === 'ZERO' || b === 'ZERO')       return 'ZERO';
    if (a === 'BOTH' || b === 'BOTH')       return 'FLOWING';
    if (a === 'NEITHER' && b === 'NEITHER') return 'NEITHER';
    if (a === 'TRUE' && b === 'FALSE')      return 'NEITHER';
    if (a === 'FALSE' && b === 'TRUE')      return 'NEITHER';
    return 'BOTH';
  }

  static quantumOr(a: DFUMTValue, b: DFUMTValue): DFUMTValue {
    if (a === b)         return a;
    if (a === 'INFINITY' || b === 'INFINITY') return 'INFINITY';
    if (a === 'BOTH' && b === 'BOTH')         return 'BOTH';
    if (a === 'TRUE' || b === 'TRUE')         return 'TRUE';
    if (a === 'FLOWING' || b === 'FLOWING')   return 'FLOWING';
    return 'NEITHER';
  }
}

// ─── QuantumLogicEngine（統合クラス）────────────────────

export class QuantumLogicEngine {
  readonly superposition  = SuperpositionAxiom;
  readonly measurement    = ProjectionMeasurementAxiom;
  readonly nonDistrib     = QuantumNonDistributivity;

  /** |0> の標準状態 */
  static readonly ZERO_STATE:  QubitState = { alpha: { re: 1, im: 0 }, beta: { re: 0, im: 0 }, label: '|0>' };
  /** |1> の標準状態 */
  static readonly ONE_STATE:   QubitState = { alpha: { re: 0, im: 0 }, beta: { re: 1, im: 0 }, label: '|1>' };
  /** |+> = (|0>+|1>)/sqrt(2) */
  static readonly PLUS_STATE:  QubitState = { alpha: { re: INV_SQRT2, im: 0 }, beta: { re: INV_SQRT2, im: 0 }, label: '|+>' };

  /**
   * 任意の量子状態をD-FUMT七価値に変換する
   */
  toDFUMT(state: QubitState): DFUMTValue {
    return qubitToDFUMT(state);
  }

  /**
   * D-FUMT七価値から代表量子状態を返す
   */
  fromDFUMT(value: DFUMTValue): QubitState {
    switch (value) {
      case 'TRUE':     return { ...QuantumLogicEngine.ONE_STATE };
      case 'FALSE':    return { ...QuantumLogicEngine.ZERO_STATE };
      case 'BOTH':     return { ...QuantumLogicEngine.PLUS_STATE };
      case 'NEITHER':  return { alpha: { re: INV_SQRT2, im: 0 },  beta: { re: -INV_SQRT2, im: 0 }, label: '|->' };
      case 'INFINITY': return { alpha: { re: 0, im: INV_SQRT2 },  beta: { re: 0, im: INV_SQRT2 }, label: '|i+>' };
      case 'ZERO':     return { alpha: { re: 0, im: 0 },           beta: { re: 0, im: 0 },          label: '|empty>' };
      case 'FLOWING':  return { alpha: { re: 0.8, im: 0 },         beta: { re: 0.6, im: 0 },        label: '|f>' };
    }
  }

  /**
   * Theory #99〜#101 の SEED_KERNEL エントリを返す
   */
  static getSeedKernelEntries() {
    return [
      {
        id:       SuperpositionAxiom.THEORY_ID,
        axiom:    SuperpositionAxiom.AXIOM,
        category: 'quantum',
        keywords: ['量子', 'superposition', '重ね合わせ', 'qubit', 'BOTH'],
      },
      {
        id:       ProjectionMeasurementAxiom.THEORY_ID,
        axiom:    ProjectionMeasurementAxiom.AXIOM,
        category: 'quantum',
        keywords: ['測定', 'measurement', '波束収縮', 'FLOWING', '射影'],
      },
      {
        id:       QuantumNonDistributivity.THEORY_ID,
        axiom:    QuantumNonDistributivity.AXIOM,
        category: 'quantum',
        keywords: ['非分配律', 'non-distributive', 'NEITHER', 'quantum logic', 'ヒルベルト'],
      },
    ];
  }
}
