/**
 * DFUMTEngine — D-FUMT計算エンジン（アクション用ラッパー）
 */
import { CONST_PHI, CONST_PI, CONST_E } from '../../core/dfumt/constants';

export interface DFUMTEngineConfig {
  precision?: number;
  maxDepth?: number;
}

export interface FormulaNode {
  type: string;
  value?: unknown;
  symbol?: string;
  children?: FormulaNode[];
}

export interface Candidate {
  value: unknown;
  score: number;
  history: unknown[];
}

export class DFUMTEngine {
  private precision: number;
  private maxDepth: number;

  readonly metabolism = {
    evaluate:  (formula: string): number | null => {
      try {
        const safe = formula.replace(/[^0-9+\-*/().,e ]/g, '');
        return safe.trim() ? (Function(`"use strict"; return (${safe})`)() as number) : null;
      } catch { return null; }
    },
    makeConstant: (_value: unknown, _symbol?: string): FormulaNode =>
      ({ type: 'constant', value: _value, symbol: _symbol }),
    synthesize: (nodes: FormulaNode[], op: string): FormulaNode =>
      ({ type: op, children: nodes }),
    reduce: (node: FormulaNode): FormulaNode => node,
    toSExpr: (node: FormulaNode): string => JSON.stringify(node),
    phiSpiral: (n: number): number => Math.pow(CONST_PHI, n),
  };

  readonly seed = {
    extend:      (v: number[]): number[] => v.map(x => x * CONST_PHI),
    contract:    (v: number[]): number[] => v.map(x => x / CONST_PHI),
    createMapping: (dim: number) => ({ input: Array(dim).fill(0), output: Array(dim).fill(0), phi: CONST_PHI }),
    elevate:     (v: number[]): number[] => [...v, v.reduce((a, b) => a + b, 0)],
    reduce:      (v: number[]): number[] => v.slice(0, -1),
    cancelDuals: (v: number[]): number[] => v.map((x, i) => i % 2 === 0 ? x : -x),
  };

  readonly selection = {
    evolve: (candidates: Candidate[]): Candidate[] =>
      candidates.map(c => ({ ...c, score: c.score * CONST_PHI })).sort((a, b) => b.score - a.score),
  };

  constructor(config: DFUMTEngineConfig = {}) {
    this.precision = config.precision ?? 1e-10;
    this.maxDepth  = config.maxDepth  ?? 32;
  }

  evaluateFormula(formula: string): number | null { return this.metabolism.evaluate(formula); }
  run(inputs: number[]): number[] { return this.seed.extend(inputs); }
  verify(value: unknown): boolean { return value !== null && value !== undefined; }

  get phi(): number { return CONST_PHI; }
  get pi():  number { return CONST_PI; }
  get e():   number { return CONST_E; }
  get eps(): number { return this.precision; }
  get depth(): number { return this.maxDepth; }
}
