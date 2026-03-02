// ============================================================
// universal-extension.ts — 汎用拡張・縮小フレームワーク
//
// π拡張理論（pi-extension.ts）を一般化し、
// e・φ・∞ にも同じ双方向構造を適用する。
//
// 双方向構造:
//   ⊕ 拡張: C → C₀ → C₀₀ → ... (次元を深める)
//   ⊖ 縮小: C₀₀ → C₀ → C   (次元を戻す)
//
// @author Nobuki Fujimoto (D-FUMT)
// ============================================================

import { ConstantId, CONSTANT_REGISTRY } from './constants';

// ============================================================
// 型定義
// ============================================================

export type SubscriptChar = string;

/** 汎用拡張数 */
export interface UniversalExtension {
  readonly constantId: ConstantId;
  readonly chars: ReadonlyArray<SubscriptChar>;
  readonly degree: number;
  /** 定数固有の値（拡張に応じて変化） */
  readonly value: number;
  /** 変換モード */
  readonly mode: ExtensionMode;
}

/** 拡張モード — 各定数の性質に応じた計算方式 */
export type ExtensionMode =
  | 'additive'      // 加算的: value + base × degree
  | 'multiplicative' // 乗算的: value × base^degree
  | 'logarithmic'   // 対数的: value × log(degree + 1)
  | 'fibonacci'     // フィボナッチ的: F(degree) × base
  | 'inverse';      // 逆数的: value / degree（縮小向き）

/** 変換履歴 */
export interface ExtensionEntry {
  readonly operation: 'extend' | 'reduce';
  readonly char?: SubscriptChar;
  readonly fromDegree: number;
  readonly toDegree: number;
  readonly fromValue: number;
  readonly toValue: number;
  readonly timestamp: number;
}

/** 変換σ（蓄積履歴） */
export interface ExtensionSigma {
  readonly history: ReadonlyArray<ExtensionEntry>;
  readonly totalExtensions: number;
  readonly totalReductions: number;
}

// ============================================================
// 定数固有の値計算
// ============================================================

/**
 * 各定数の拡張値を計算する
 * ⊕: degree が増えるにつれて値がどう変化するかを定義
 */
export function computeExtensionValue(
  constantId: ConstantId,
  degree: number,
  mode: ExtensionMode,
): number {
  const base = CONSTANT_REGISTRY[constantId]?.value ?? 1;

  if (degree === 0) return base;

  switch (constantId) {
    case 'e':
      // e拡張: 指数成長 e^1 → e^e → e^(e^e) ...
      return mode === 'multiplicative'
        ? Math.pow(base, degree)
        : base + degree * Math.log(base);

    case 'phi':
      // φ拡張: 黄金比の自己相似 φ → φ² → φ³ ...
      return mode === 'fibonacci'
        ? base * (degree + 1) / degree  // φ^n / φ^(n-1) = φ に収束
        : Math.pow(base, degree);

    case 'inf':
      // ∞拡張: 無限の階層 ∞ → ∞² → ∞^∞ ...
      // 実装上はオーダーで表現
      return mode === 'additive'
        ? base  // ∞は加算しても∞
        : base; // ∞は乗算しても∞（階層は degree で管理）

    case 'pi':
      // π拡張: pi-extension.ts と整合
      return base * degree;

    default:
      // 汎用: 乗算的拡張
      return Math.pow(base, degree);
  }
}

/**
 * 各定数の縮小値を計算する
 * ⊖: degree が減るにつれて値がどう変化するか
 */
export function computeReductionValue(
  constantId: ConstantId,
  degree: number,
  mode: ExtensionMode,
): number {
  const base = CONSTANT_REGISTRY[constantId]?.value ?? 1;

  if (degree === 0) return base;

  switch (constantId) {
    case 'e':
      // e縮小: 対数的収縮 e^n → e^(n-1) → ... → e^1
      return Math.pow(base, degree);

    case 'phi':
      // φ縮小: 黄金分割 φ → 1/φ → φ-1 → ...
      return Math.pow(base, -degree + 1);

    case 'inf':
      // ∞縮小: 無限小への接近 ∞ → 1/∞ = 0
      return degree > 0 ? 1 / degree : base;

    case 'pi':
      return base / (degree > 0 ? degree : 1);

    default:
      return base / Math.pow(base, degree - 1);
  }
}

// ============================================================
// コンストラクタ
// ============================================================

/**
 * 汎用拡張数を生成
 */
export function universalExt(
  constantId: ConstantId,
  chars: SubscriptChar[] = [],
  mode: ExtensionMode = 'multiplicative',
): UniversalExtension {
  const degree = chars.length;
  return {
    constantId,
    chars: Object.freeze([...chars]),
    degree,
    value: computeExtensionValue(constantId, degree, mode),
    mode,
  };
}

// ============================================================
// A2操作: ⊕拡張 / ⊖縮小
// ============================================================

/**
 * ⊕ 拡張: 添字を1つ追加し、次元を深める
 */
export function extend(
  ue: UniversalExtension,
  char: SubscriptChar = 'o',
): UniversalExtension {
  const newChars = [...ue.chars, char];
  return universalExt(ue.constantId, newChars, ue.mode);
}

/**
 * ⊖ 縮小: 添字を1つ除去し、次元を戻す
 * degree=0 の場合は変化なし
 */
export function reduce(
  ue: UniversalExtension,
): UniversalExtension {
  if (ue.degree === 0) return ue;
  const newChars = ue.chars.slice(0, -1);
  return universalExt(ue.constantId, [...newChars], ue.mode);
}

/**
 * 指定次数まで拡張
 */
export function extendTo(
  ue: UniversalExtension,
  targetDegree: number,
  char: SubscriptChar = 'o',
): UniversalExtension {
  let current = ue;
  while (current.degree < targetDegree) {
    current = extend(current, char);
  }
  return current;
}

/**
 * 指定次数まで縮小
 */
export function reduceTo(
  ue: UniversalExtension,
  targetDegree: number,
): UniversalExtension {
  let current = ue;
  while (current.degree > targetDegree && current.degree > 0) {
    current = reduce(current);
  }
  return current;
}

/**
 * ⊕⊖の逆元性を検証
 */
export function verifyInverse(
  ue: UniversalExtension,
  char: SubscriptChar = 'o',
): boolean {
  const extended = extend(ue, char);
  const reduced = reduce(extended);
  return (
    reduced.degree === ue.degree &&
    reduced.chars.every((c, i) => c === ue.chars[i])
  );
}

// ============================================================
// 記法変換
// ============================================================

export interface UniversalNotation {
  readonly sensory: string;    // C_ooo
  readonly dialogue: string;   // C_o3
  readonly structural: string; // C(o,3)
}

/**
 * 4層記法（感覚・対話・構造）を生成
 */
export function toNotation(ue: UniversalExtension): UniversalNotation {
  const meta = CONSTANT_REGISTRY[ue.constantId];
  const symbol = meta?.symbol ?? ue.constantId;
  const chars = ue.chars;

  const charCounts: Record<string, number> = {};
  for (const c of chars) {
    charCounts[c] = (charCounts[c] || 0) + 1;
  }

  const sensory = symbol + chars.join('');

  const dialogueParts = Object.entries(charCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([char, count]) => `${char}${count}`)
    .join('');
  const dialogue = `${symbol}_${dialogueParts || '0'}`;

  const structuralParts = Object.entries(charCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([char, count]) => `${char},${count}`)
    .join(',');
  const structural = `${symbol}(${structuralParts || '0,0'})`;

  return { sensory, dialogue, structural };
}

// ============================================================
// σ蓄積
// ============================================================

export function emptySigma(): ExtensionSigma {
  return { history: [], totalExtensions: 0, totalReductions: 0 };
}

export function extendWithSigma(
  ue: UniversalExtension,
  sigma: ExtensionSigma,
  char: SubscriptChar = 'o',
): { result: UniversalExtension; sigma: ExtensionSigma } {
  const result = extend(ue, char);
  const entry: ExtensionEntry = {
    operation: 'extend', char,
    fromDegree: ue.degree, toDegree: result.degree,
    fromValue: ue.value, toValue: result.value,
    timestamp: Date.now(),
  };
  return {
    result,
    sigma: {
      history: [...sigma.history, entry],
      totalExtensions: sigma.totalExtensions + 1,
      totalReductions: sigma.totalReductions,
    },
  };
}

export function reduceWithSigma(
  ue: UniversalExtension,
  sigma: ExtensionSigma,
): { result: UniversalExtension; sigma: ExtensionSigma } {
  const result = reduce(ue);
  const entry: ExtensionEntry = {
    operation: 'reduce',
    fromDegree: ue.degree, toDegree: result.degree,
    fromValue: ue.value, toValue: result.value,
    timestamp: Date.now(),
  };
  return {
    result,
    sigma: {
      history: [...sigma.history, entry],
      totalExtensions: sigma.totalExtensions,
      totalReductions: sigma.totalReductions + 1,
    },
  };
}

// ============================================================
// レポート生成
// ============================================================

/**
 * 双方向構造のサマリを生成
 */
export function generateReport(ue: UniversalExtension): string {
  const meta = CONSTANT_REGISTRY[ue.constantId];
  const notation = toNotation(ue);
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════╗');
  lines.push(`║  ${meta?.symbol ?? ue.constantId} 拡張理論 — D-FUMT Universal    ║`);
  lines.push('╚══════════════════════════════════════╝');
  lines.push('');
  lines.push(`定数: ${meta?.symbol} — ${meta?.description}`);
  lines.push(`記法（感覚層）: ${notation.sensory}`);
  lines.push(`記法（対話層）: ${notation.dialogue}`);
  lines.push(`記法（構造層）: ${notation.structural}`);
  lines.push('');
  lines.push(`拡張次数: ${ue.degree}`);
  lines.push(`現在値: ${isFinite(ue.value) ? ue.value.toFixed(8) : '∞'}`);
  lines.push(`モード: ${ue.mode}`);
  lines.push('');
  lines.push(`⊕ 拡張方向: ${meta?.extensionNature}`);
  lines.push(`⊖ 縮小方向: ${meta?.reductionNature}`);
  lines.push('');
  lines.push('─── Rei (0₀式) — 存在のためのことば ───');

  return lines.join('\n');
}

/**
 * 4定数（π・e・φ・∞）の比較表を生成
 */
export function compareFourConstants(degree: number): string {
  const ids: ConstantId[] = ['pi', 'e', 'phi', 'inf'];
  const lines: string[] = [];

  lines.push(`=== 4定数 拡張比較表（次数: ${degree}）===`);
  lines.push('');

  for (const id of ids) {
    const ext = universalExt(id, Array(degree).fill('o'));
    const red = universalExt(id, Array(Math.max(0, degree - 1)).fill('o'));
    const meta = CONSTANT_REGISTRY[id];
    lines.push(`【${meta.symbol}】次数${degree}`);
    lines.push(`  ⊕ 拡張値: ${isFinite(ext.value) ? ext.value.toFixed(6) : '∞'}`);
    lines.push(`  ⊖ 縮小値（次数${degree - 1}）: ${isFinite(red.value) ? red.value.toFixed(6) : '∞'}`);
    lines.push('');
  }

  return lines.join('\n');
}
