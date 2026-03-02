// ============================================================
// constants.ts — D-FUMT 定数一覧（28理論 = 14定数 × 拡張・縮小）
//
// 各定数は「拡張方向（⊕）」と「縮小方向（⊖）」を持つ。
// これが D-FUMT の双方向構造の核心である。
//
// @author Nobuki Fujimoto (D-FUMT)
// ============================================================

// ============================================================
// 数学定数
// ============================================================

/** π — 円周率（位相回転の基底） */
export const CONST_PI = Math.PI;

/** e — 自然対数の底（指数成長・減衰の基底） */
export const CONST_E = Math.E;

/** φ — 黄金比（自己相似・フィボナッチの基底） */
export const CONST_PHI = (1 + Math.sqrt(5)) / 2;

/** ∞ — 無限大（発散・収束の基底） */
export const CONST_INF = Infinity;

/** i — 虚数単位（複素平面の基底） */
export const CONST_I = { real: 0, imag: 1 };

/** √2 — ルート2（次元間距離の基底） */
export const CONST_SQRT2 = Math.SQRT2;

/** γ — オイラー・マスケローニ定数 */
export const CONST_GAMMA = 0.5772156649015328;

/** Ω — オメガ定数（W(1) = e^{-Ω}） */
export const CONST_OMEGA = 0.5671432904097838;

/** δ — フェイゲンバウム定数（カオス理論） */
export const CONST_FEIGENBAUM = 4.669201609102990;

// ============================================================
// 物理定数
// ============================================================

/** c — 光速（m/s） */
export const CONST_C = 299792458;

/** α — 微細構造定数 */
export const CONST_ALPHA = 7.2973525693e-3;

/** ℏ — ディラック定数（プランク定数 / 2π） */
export const CONST_HBAR = 1.0545718176461565e-34;

// ============================================================
// 数列定数
// ============================================================

/** F — フィボナッチ数列生成関数 */
export function fibonacci(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

/** τ — 円周率の2倍（完全回転） */
export const CONST_TAU = 2 * Math.PI;

// ============================================================
// 定数識別子
// ============================================================

export type ConstantId =
  | 'pi' | 'e' | 'phi' | 'inf'
  | 'i' | 'sqrt2' | 'gamma' | 'omega' | 'feigenbaum'
  | 'c' | 'alpha' | 'hbar'
  | 'fibonacci' | 'tau';

/** 定数メタデータ */
export interface ConstantMeta {
  readonly id: ConstantId;
  readonly symbol: string;
  readonly value: number;
  readonly domain: 'mathematics' | 'physics' | 'sequence';
  readonly description: string;
  /** 拡張方向の性質 */
  readonly extensionNature: string;
  /** 縮小方向の性質 */
  readonly reductionNature: string;
}

/** 14定数のメタデータ一覧 */
export const CONSTANT_REGISTRY: Record<ConstantId, ConstantMeta> = {
  pi: {
    id: 'pi', symbol: 'π', value: CONST_PI,
    domain: 'mathematics',
    description: '円周率 — 位相回転の基底',
    extensionNature: '回転の深化（多重位相）',
    reductionNature: '回転の収束（位相の折りたたみ）',
  },
  e: {
    id: 'e', symbol: 'e', value: CONST_E,
    domain: 'mathematics',
    description: '自然対数の底 — 指数成長・減衰の基底',
    extensionNature: '指数的膨張（成長の加速）',
    reductionNature: '対数的収縮（情報の圧縮）',
  },
  phi: {
    id: 'phi', symbol: 'φ', value: CONST_PHI,
    domain: 'mathematics',
    description: '黄金比 — 自己相似・フィボナッチの基底',
    extensionNature: '自己相似的拡大（フラクタル成長）',
    reductionNature: '黄金分割による収束（最適縮小）',
  },
  inf: {
    id: 'inf', symbol: '∞', value: CONST_INF,
    domain: 'mathematics',
    description: '無限大 — 発散・収束の基底',
    extensionNature: '無限への発散（次元超越）',
    reductionNature: '無限小への収束（零点接近）',
  },
  i: {
    id: 'i', symbol: 'i', value: NaN, // 実数表現不可
    domain: 'mathematics',
    description: '虚数単位 — 複素平面の基底',
    extensionNature: '複素空間への拡張',
    reductionNature: '実軸への射影',
  },
  sqrt2: {
    id: 'sqrt2', symbol: '√2', value: CONST_SQRT2,
    domain: 'mathematics',
    description: '√2 — 次元間距離の基底',
    extensionNature: '対角方向への拡張',
    reductionNature: '軸方向への縮小',
  },
  gamma: {
    id: 'gamma', symbol: 'γ', value: CONST_GAMMA,
    domain: 'mathematics',
    description: 'オイラー・マスケローニ定数',
    extensionNature: '調和級数的拡張',
    reductionNature: '残差収束',
  },
  omega: {
    id: 'omega', symbol: 'Ω', value: CONST_OMEGA,
    domain: 'mathematics',
    description: 'オメガ定数 — Lambert W関数の固定点',
    extensionNature: '自己参照的拡張',
    reductionNature: '固定点への収束',
  },
  feigenbaum: {
    id: 'feigenbaum', symbol: 'δ', value: CONST_FEIGENBAUM,
    domain: 'mathematics',
    description: 'フェイゲンバウム定数 — カオスの普遍定数',
    extensionNature: '分岐的拡張（カオス発生）',
    reductionNature: '周期への収束（秩序回復）',
  },
  c: {
    id: 'c', symbol: 'c', value: CONST_C,
    domain: 'physics',
    description: '光速 — 情報伝達の上限',
    extensionNature: '時空間的拡張',
    reductionNature: '時空間的縮小（相対論的収縮）',
  },
  alpha: {
    id: 'alpha', symbol: 'α', value: CONST_ALPHA,
    domain: 'physics',
    description: '微細構造定数 — 電磁相互作用の強度',
    extensionNature: '量子的拡張（相互作用増強）',
    reductionNature: '量子的縮小（脱結合）',
  },
  hbar: {
    id: 'hbar', symbol: 'ℏ', value: CONST_HBAR,
    domain: 'physics',
    description: 'ディラック定数 — 量子作用の単位',
    extensionNature: '量子状態の拡張（重ね合わせ増大）',
    reductionNature: '量子状態の縮小（波束収縮）',
  },
  fibonacci: {
    id: 'fibonacci', symbol: 'F', value: NaN, // 数列のため単一値なし
    domain: 'sequence',
    description: 'フィボナッチ数列 — 生命成長の数列',
    extensionNature: '次項への成長（加算的拡張）',
    reductionNature: '前項への回帰（減算的縮小）',
  },
  tau: {
    id: 'tau', symbol: 'τ', value: CONST_TAU,
    domain: 'mathematics',
    description: '円周率の2倍 — 完全回転',
    extensionNature: '完全回転の多重化',
    reductionNature: '完全回転の分割（弧度縮小）',
  },
};

/**
 * ドメイン別に定数を取得
 */
export function getConstantsByDomain(domain: ConstantMeta['domain']): ConstantMeta[] {
  return Object.values(CONSTANT_REGISTRY).filter(c => c.domain === domain);
}

/**
 * 定数の双方向性サマリを出力
 */
export function describeConstant(id: ConstantId): string {
  const meta = CONSTANT_REGISTRY[id];
  return [
    `【${meta.symbol}】${meta.description}`,
    `  ⊕ 拡張: ${meta.extensionNature}`,
    `  ⊖ 縮小: ${meta.reductionNature}`,
  ].join('\n');
}

// ============================================================
// DFUMT_CONSTANTS — エンジン用まとめオブジェクト
// （engine/seed.ts, metabolism.ts, selection.tsから参照）
// ============================================================

export const DFUMT_CONSTANTS = {
  PHI:         (1 + Math.sqrt(5)) / 2,
  PI:          Math.PI,
  E:           Math.E,
  TAU:         2 * Math.PI,
  SQRT2:       Math.SQRT2,
  GAMMA:       0.5772156649015328,
  OMEGA:       0.5671432904097838,
  FEIGENBAUM:  4.669201609102990,
  INF:         Infinity,
  PI_EXT:      Math.PI * ((1 + Math.sqrt(5)) / 2),  // π × φ（位相拡張）
  E_EXT:       Math.E  * ((1 + Math.sqrt(5)) / 2),  // e × φ（指数拡張）
} as const;

// ============================================================
// 型定義
// ============================================================

/** D-FUMT値（拡張方向⊕ / 縮小方向⊖ の双対数値） */
export type DFUMTValue = number;

/** 双対値（正方向・負方向の対） */
export interface DualValue {
  positive: number;
  negative: number;
}
