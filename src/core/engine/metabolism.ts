/**
 * D-FUMT Engine Layer 2: METABOLISM (代謝)
 * 公式変換・合成
 *
 * D-FUMT理論における「代謝」は数理構造の変換・合成・分解を担う。
 * 種(Seed)から生まれた値を変換し、新たな構造を合成する中間代謝層。
 */

import { DFUMT_CONSTANTS, DFUMTValue, DualValue } from '../dfumt/constants';
import { SeedEngine, DimensionVector, ZeroExtension } from './seed';

// ============================================================
// 型定義
// ============================================================

/** 公式ノード */
export interface FormulaNode {
  id: string;
  type: 'constant' | 'variable' | 'operator' | 'function' | 'dual';
  value?: DFUMTValue;
  symbol?: string;
  children: FormulaNode[];
  dual?: DualValue;
}

/** 変換規則 */
export interface TransformRule {
  name: string;
  pattern: (node: FormulaNode) => boolean;
  transform: (node: FormulaNode) => FormulaNode;
  priority: number;         // 高いほど先に適用
  reversible: boolean;      // 逆変換可能か
}

/** 合成結果 */
export interface SynthesisResult {
  formula: FormulaNode;
  complexity: number;       // 複雑度スコア
  depth: number;            // 木の深さ
  dualBalance: number;      // ⊕⊖バランス [-1, 1]
  energy: number;           // エネルギー（D-FUMT的情報量）
}

/** 代謝サイクル */
export interface MetabolicCycle {
  input: FormulaNode;
  steps: Array<{ rule: string; result: FormulaNode; delta: number }>;
  output: FormulaNode;
  totalDelta: number;       // 全体の変化量
  cycles: number;           // サイクル数
}

/** 合成パス */
export type SynthesisPath = FormulaNode[];

// ============================================================
// 代謝エンジン
// ============================================================

export class MetabolismEngine {
  private rules: TransformRule[];
  private seed: SeedEngine;
  private nodeCounter: number;

  constructor(seed?: SeedEngine) {
    this.seed = seed ?? new SeedEngine();
    this.rules = [];
    this.nodeCounter = 0;
    this._initDefaultRules();
  }

  // ----------------------------------------------------------
  // ノード生成
  // ----------------------------------------------------------

  makeConstant(value: DFUMTValue, symbol?: string): FormulaNode {
    return {
      id: `c${this.nodeCounter++}`,
      type: 'constant',
      value,
      symbol: symbol ?? String(value),
      children: [],
      dual: { positive: Math.abs(value), negative: -Math.abs(value) },
    };
  }

  makeVariable(symbol: string): FormulaNode {
    return {
      id: `v${this.nodeCounter++}`,
      type: 'variable',
      symbol,
      children: [],
    };
  }

  makeOperator(symbol: '+' | '-' | '*' | '/' | '^' | '⊕' | '⊖', ...children: FormulaNode[]): FormulaNode {
    return {
      id: `op${this.nodeCounter++}`,
      type: 'operator',
      symbol,
      children,
    };
  }

  makeFunction(symbol: string, ...children: FormulaNode[]): FormulaNode {
    return {
      id: `fn${this.nodeCounter++}`,
      type: 'function',
      symbol,
      children,
    };
  }

  makeDual(positive: FormulaNode, negative: FormulaNode): FormulaNode {
    return {
      id: `dual${this.nodeCounter++}`,
      type: 'dual',
      symbol: '⊕⊖',
      children: [positive, negative],
      dual: {
        positive: this._evaluate(positive) ?? 0,
        negative: this._evaluate(negative) ?? 0,
      },
    };
  }

  // ----------------------------------------------------------
  // 公式評価
  // ----------------------------------------------------------

  /**
   * FormulaNodeを数値評価（変数は0として扱う）
   */
  evaluate(node: FormulaNode, env: Record<string, DFUMTValue> = {}): DFUMTValue | null {
    return this._evaluate(node, env);
  }

  private _evaluate(node: FormulaNode, env: Record<string, DFUMTValue> = {}): DFUMTValue | null {
    switch (node.type) {
      case 'constant':
        return node.value ?? null;

      case 'variable':
        return node.symbol !== undefined && node.symbol in env
          ? env[node.symbol]
          : null;

      case 'dual': {
        const pos = this._evaluate(node.children[0], env);
        const neg = this._evaluate(node.children[1], env);
        if (pos === null || neg === null) return null;
        return pos + neg;  // 双対合成
      }

      case 'operator': {
        const vals = node.children.map(c => this._evaluate(c, env));
        if (vals.some(v => v === null)) return null;
        const [a, b] = vals as DFUMTValue[];

        switch (node.symbol) {
          case '+':  return a + b;
          case '-':  return a - b;
          case '*':  return a * b;
          case '/':  return b !== 0 ? a / b : null;
          case '^':  return Math.pow(a, b);
          case '⊕':  return Math.max(a, b);   // D-FUMT正方向演算
          case '⊖':  return Math.min(a, b);   // D-FUMT負方向演算
          default:   return null;
        }
      }

      case 'function': {
        const args = node.children.map(c => this._evaluate(c, env));
        if (args.some(v => v === null)) return null;
        const [x] = args as DFUMTValue[];

        switch (node.symbol) {
          case 'sin':    return Math.sin(x);
          case 'cos':    return Math.cos(x);
          case 'exp':    return Math.exp(x);
          case 'log':    return x > 0 ? Math.log(x) : null;
          case 'sqrt':   return x >= 0 ? Math.sqrt(x) : null;
          case 'phi':    return x * DFUMT_CONSTANTS.PHI;
          case 'pi_ext': return x * DFUMT_CONSTANTS.PI_EXT;
          case 'e_ext':  return x * DFUMT_CONSTANTS.E_EXT;
          default:       return null;
        }
      }

      default:
        return null;
    }
  }

  // ----------------------------------------------------------
  // 変換規則
  // ----------------------------------------------------------

  addRule(rule: TransformRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 単一変換ステップ: マッチした最初の規則を適用
   */
  applyOnce(node: FormulaNode): { changed: boolean; result: FormulaNode; ruleName?: string } {
    // 子ノードに再帰適用
    let changed = false;
    const newChildren = node.children.map(child => {
      const res = this.applyOnce(child);
      if (res.changed) changed = true;
      return res.result;
    });
    const nodeWithNewChildren: FormulaNode = { ...node, children: newChildren };

    // このノード自身への規則適用
    for (const rule of this.rules) {
      if (rule.pattern(nodeWithNewChildren)) {
        return { changed: true, result: rule.transform(nodeWithNewChildren), ruleName: rule.name };
      }
    }

    return { changed, result: nodeWithNewChildren };
  }

  /**
   * 繰り返し変換: 不動点に収束するまで適用
   */
  reduce(node: FormulaNode, maxSteps = 100): MetabolicCycle {
    const steps: MetabolicCycle['steps'] = [];
    let current = node;

    for (let i = 0; i < maxSteps; i++) {
      const res = this.applyOnce(current);
      if (!res.changed) break;

      const prevVal = this._evaluate(current) ?? 0;
      const nextVal = this._evaluate(res.result) ?? 0;
      const delta = Math.abs(nextVal - prevVal);

      steps.push({
        rule: res.ruleName ?? 'unknown',
        result: res.result,
        delta,
      });
      current = res.result;
    }

    const totalDelta = steps.reduce((acc, s) => acc + s.delta, 0);
    return { input: node, steps, output: current, totalDelta, cycles: steps.length };
  }

  // ----------------------------------------------------------
  // 合成
  // ----------------------------------------------------------

  /**
   * 二公式の合成: D-FUMT合成則に従い新構造を生成
   */
  synthesize(a: FormulaNode, b: FormulaNode, mode: 'add' | 'mul' | 'dual' | 'compose' = 'dual'): SynthesisResult {
    let formula: FormulaNode;

    switch (mode) {
      case 'add':
        formula = this.makeOperator('+', a, b);
        break;
      case 'mul':
        formula = this.makeOperator('*', a, b);
        break;
      case 'dual':
        formula = this.makeDual(a, b);
        break;
      case 'compose':
        // b の変数ノードを a で置換（関数合成）
        formula = this._substituteFirst(b, a);
        break;
    }

    return this._analyze(formula);
  }

  /**
   * 複数公式の連鎖合成: [f1, f2, ..., fn] → fn ∘ ... ∘ f1
   */
  chain(formulas: FormulaNode[]): SynthesisResult {
    if (formulas.length === 0) {
      return this._analyze(this.makeConstant(0));
    }
    let result = formulas[0];
    for (let i = 1; i < formulas.length; i++) {
      result = this.synthesize(result, formulas[i], 'compose').formula;
    }
    return this._analyze(result);
  }

  /**
   * D-FUMT特有: π拡張による公式拡張
   */
  piExtend(node: FormulaNode): SynthesisResult {
    const piNode = this.makeConstant(DFUMT_CONSTANTS.PI_EXT, 'π*');
    const extended = this.makeOperator('*', node, piNode);
    return this._analyze(extended);
  }

  /**
   * D-FUMT特有: φ螺旋合成
   */
  phiSpiral(node: FormulaNode, turns: number): SynthesisResult {
    let current = node;
    for (let t = 0; t < turns; t++) {
      const phiNode = this.makeConstant(Math.pow(DFUMT_CONSTANTS.PHI, t + 1), `φ^${t + 1}`);
      current = this.makeOperator('*', current, phiNode);
    }
    return this._analyze(current);
  }

  // ----------------------------------------------------------
  // 分析
  // ----------------------------------------------------------

  private _analyze(formula: FormulaNode): SynthesisResult {
    const depth = this._depth(formula);
    const complexity = this._complexity(formula);
    const dualBalance = this._dualBalance(formula);
    const value = this._evaluate(formula) ?? 0;
    const energy = Math.abs(value) * (1 + complexity / 10);

    return { formula, complexity, depth, dualBalance, energy };
  }

  private _depth(node: FormulaNode): number {
    if (node.children.length === 0) return 0;
    return 1 + Math.max(...node.children.map(c => this._depth(c)));
  }

  private _complexity(node: FormulaNode): number {
    const base = node.type === 'function' ? 2 : 1;
    return base + node.children.reduce((acc, c) => acc + this._complexity(c), 0);
  }

  private _dualBalance(node: FormulaNode): number {
    const val = this._evaluate(node);
    if (val === null || !isFinite(val)) return 0;
    const maxMag = Math.max(Math.abs(val), 1e-10);
    return Math.tanh(val / maxMag);
  }

  private _substituteFirst(target: FormulaNode, replacement: FormulaNode): FormulaNode {
    if (target.type === 'variable') {
      return { ...replacement };
    }
    const [first, ...rest] = target.children;
    if (first === undefined) return target;
    return {
      ...target,
      children: [this._substituteFirst(first, replacement), ...rest],
    };
  }

  // ----------------------------------------------------------
  // デフォルト変換規則の初期化
  // ----------------------------------------------------------

  private _initDefaultRules(): void {
    // 定数畳み込み: c1 + c2 → c
    this.addRule({
      name: 'constant-fold-add',
      priority: 100,
      reversible: false,
      pattern: (n) =>
        n.type === 'operator' && n.symbol === '+' &&
        n.children.length === 2 &&
        n.children[0].type === 'constant' &&
        n.children[1].type === 'constant',
      transform: (n) => {
        const a = n.children[0].value ?? 0;
        const b = n.children[1].value ?? 0;
        return this.makeConstant(a + b, `(${a}+${b})`);
      },
    });

    // 定数畳み込み: c1 * c2 → c
    this.addRule({
      name: 'constant-fold-mul',
      priority: 100,
      reversible: false,
      pattern: (n) =>
        n.type === 'operator' && n.symbol === '*' &&
        n.children.length === 2 &&
        n.children[0].type === 'constant' &&
        n.children[1].type === 'constant',
      transform: (n) => {
        const a = n.children[0].value ?? 0;
        const b = n.children[1].value ?? 0;
        return this.makeConstant(a * b, `(${a}*${b})`);
      },
    });

    // ゼロ加算除去: x + 0 → x
    this.addRule({
      name: 'add-zero',
      priority: 90,
      reversible: true,
      pattern: (n) =>
        n.type === 'operator' && n.symbol === '+' &&
        n.children.some(c => c.type === 'constant' && c.value === 0),
      transform: (n) => {
        const nonZero = n.children.find(c => !(c.type === 'constant' && c.value === 0));
        return nonZero ?? this.makeConstant(0);
      },
    });

    // 乗算1除去: x * 1 → x
    this.addRule({
      name: 'mul-one',
      priority: 90,
      reversible: true,
      pattern: (n) =>
        n.type === 'operator' && n.symbol === '*' &&
        n.children.some(c => c.type === 'constant' && c.value === 1),
      transform: (n) => {
        const nonOne = n.children.find(c => !(c.type === 'constant' && c.value === 1));
        return nonOne ?? this.makeConstant(1);
      },
    });

    // 双対消去: ⊕(x, -x) → 0
    this.addRule({
      name: 'dual-cancel',
      priority: 80,
      reversible: false,
      pattern: (n) => {
        if (n.type !== 'dual') return false;
        const pos = this._evaluate(n.children[0]);
        const neg = this._evaluate(n.children[1]);
        if (pos === null || neg === null) return false;
        return Math.abs(pos + neg) < 1e-10;
      },
      transform: () => this.makeConstant(0, '∅'),
    });

    // φ^2 → φ + 1 (黄金比恒等式)
    this.addRule({
      name: 'phi-identity',
      priority: 70,
      reversible: true,
      pattern: (n) =>
        n.type === 'operator' && n.symbol === '^' &&
        n.children[0]?.type === 'constant' &&
        Math.abs((n.children[0].value ?? 0) - DFUMT_CONSTANTS.PHI) < 1e-10 &&
        n.children[1]?.type === 'constant' &&
        n.children[1].value === 2,
      transform: () => {
        const phi = this.makeConstant(DFUMT_CONSTANTS.PHI, 'φ');
        const one = this.makeConstant(1);
        return this.makeOperator('+', phi, one);
      },
    });
  }

  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------

  /** FormulaNodeをS式文字列に変換 */
  toSExpr(node: FormulaNode): string {
    if (node.children.length === 0) {
      return node.symbol ?? String(node.value ?? '?');
    }
    const args = node.children.map(c => this.toSExpr(c)).join(' ');
    return `(${node.symbol} ${args})`;
  }

  summary(): string {
    return [
      '=== MetabolismEngine (代謝層) ===',
      `登録変換規則数: ${this.rules.length}`,
      `ノードカウンタ: ${this.nodeCounter}`,
      `規則一覧: ${this.rules.map(r => r.name).join(', ')}`,
    ].join('\n');
  }
}

export const metabolismEngine = new MetabolismEngine();
