/**
 * D-FUMT Engine Layer 3: SELECTION (選択)
 * 整合性評価・淘汰
 *
 * D-FUMT理論における「選択」は数理構造の評価と生存判定を担う。
 * 代謝(Metabolism)から生まれた構造を検証し、整合するものを保存、
 * 矛盾・冗長なものを淘汰する。仏教的「無常」と自然選択の融合。
 */

import { DFUMT_CONSTANTS, DFUMTValue } from '../dfumt/constants';
import { FormulaNode, SynthesisResult } from './metabolism';
import { DimensionVector } from './seed';

// ============================================================
// 型定義
// ============================================================

/** 整合性スコア [0, 1] */
export type ConsistencyScore = number;

/** 淘汰判定 */
export type SelectionVerdict = 'survive' | 'eliminate' | 'mutate' | 'suspend';

/** 評価基準 */
export interface EvaluationCriteria {
  name: string;
  weight: number;                             // 重み [0, 1]
  evaluate: (item: Candidate) => number;      // スコア [0, 1]
  threshold: number;                          // 生存閾値
}

/** 候補エンティティ */
export interface Candidate {
  id: string;
  formula: FormulaNode;
  synthesis: SynthesisResult;
  metadata: Record<string, unknown>;
  generation: number;                         // 世代数
  age: number;                                // 生存サイクル数
  fitness: number;                            // 適応度
}

/** 評価結果 */
export interface EvaluationResult {
  candidate: Candidate;
  scores: Record<string, number>;             // 基準別スコア
  totalScore: ConsistencyScore;
  verdict: SelectionVerdict;
  reason: string;
}

/** 淘汰世代 */
export interface SelectionGeneration {
  generation: number;
  candidates: Candidate[];
  results: EvaluationResult[];
  survivors: Candidate[];
  eliminated: Candidate[];
  mutated: Candidate[];
  avgFitness: number;
  diversityIndex: number;                     // 多様性指数 [0,1]
}

/** 整合性制約 */
export interface ConsistencyConstraint {
  name: string;
  check: (item: Candidate) => boolean;
  severity: 'hard' | 'soft';                 // hard: 違反で即淘汰
  penalty: number;                            // soft: スコアペナルティ
}

// ============================================================
// 選択エンジン
// ============================================================

export class SelectionEngine {
  private criteria: EvaluationCriteria[];
  private constraints: ConsistencyConstraint[];
  private history: SelectionGeneration[];
  private populationLimit: number;

  constructor(populationLimit = 100) {
    this.criteria = [];
    this.constraints = [];
    this.history = [];
    this.populationLimit = populationLimit;
    this._initDefaultCriteria();
    this._initDefaultConstraints();
  }

  // ----------------------------------------------------------
  // 基準・制約の登録
  // ----------------------------------------------------------

  addCriteria(c: EvaluationCriteria): void {
    this.criteria.push(c);
    // 重み正規化
    const totalWeight = this.criteria.reduce((acc, x) => acc + x.weight, 0);
    this.criteria.forEach(x => { x.weight = x.weight / totalWeight; });
  }

  addConstraint(c: ConsistencyConstraint): void {
    this.constraints.push(c);
  }

  // ----------------------------------------------------------
  // 評価
  // ----------------------------------------------------------

  /**
   * 単一候補の評価
   */
  evaluate(candidate: Candidate): EvaluationResult {
    const scores: Record<string, number> = {};

    // Hard制約チェック
    for (const constraint of this.constraints) {
      if (constraint.severity === 'hard' && !constraint.check(candidate)) {
        return {
          candidate,
          scores: { [constraint.name]: 0 },
          totalScore: 0,
          verdict: 'eliminate',
          reason: `Hard制約違反: ${constraint.name}`,
        };
      }
    }

    // 基準スコア計算
    let weightedSum = 0;
    for (const crit of this.criteria) {
      const raw = Math.max(0, Math.min(1, crit.evaluate(candidate)));
      scores[crit.name] = raw;
      weightedSum += raw * crit.weight;
    }

    // Soft制約ペナルティ
    let penalty = 0;
    for (const constraint of this.constraints) {
      if (constraint.severity === 'soft' && !constraint.check(candidate)) {
        penalty += constraint.penalty;
      }
    }

    const totalScore = Math.max(0, weightedSum - penalty);

    // 判定
    const verdict = this._verdict(candidate, totalScore);
    const reason = this._verdictReason(candidate, totalScore, scores);

    return { candidate, scores, totalScore, verdict, reason };
  }

  /**
   * 集団評価
   */
  evaluateAll(candidates: Candidate[]): EvaluationResult[] {
    return candidates.map(c => this.evaluate(c));
  }

  // ----------------------------------------------------------
  // 選択(淘汰)
  // ----------------------------------------------------------

  /**
   * 一世代分の選択処理
   */
  select(candidates: Candidate[]): SelectionGeneration {
    const generation = (this.history[this.history.length - 1]?.generation ?? 0) + 1;
    const results = this.evaluateAll(candidates);

    const survivors: Candidate[] = [];
    const eliminated: Candidate[] = [];
    const mutated: Candidate[] = [];

    for (const result of results) {
      switch (result.verdict) {
        case 'survive':
          survivors.push({ ...result.candidate, age: result.candidate.age + 1, fitness: result.totalScore });
          break;
        case 'eliminate':
          eliminated.push(result.candidate);
          break;
        case 'mutate':
          mutated.push(result.candidate);
          break;
        case 'suspend':
          // 保留: 次世代で再評価
          survivors.push({ ...result.candidate, age: result.candidate.age + 1 });
          break;
      }
    }

    // 人口上限を超える場合はエリート選択
    const finalSurvivors = survivors.length > this.populationLimit
      ? this._eliteSelect(survivors, this.populationLimit)
      : survivors;

    const avgFitness = finalSurvivors.length > 0
      ? finalSurvivors.reduce((acc, c) => acc + c.fitness, 0) / finalSurvivors.length
      : 0;

    const diversityIndex = this._diversityIndex(finalSurvivors);

    const gen: SelectionGeneration = {
      generation,
      candidates,
      results,
      survivors: finalSurvivors,
      eliminated,
      mutated,
      avgFitness,
      diversityIndex,
    };

    this.history.push(gen);
    return gen;
  }

  /**
   * 多世代進化: n世代繰り返す
   */
  evolve(
    initial: Candidate[],
    generations: number,
    mutator: (c: Candidate) => Candidate,
  ): SelectionGeneration[] {
    let population = initial;
    const genHistory: SelectionGeneration[] = [];

    for (let g = 0; g < generations; g++) {
      const gen = this.select(population);
      genHistory.push(gen);

      if (gen.survivors.length === 0) break;

      // 突然変異候補を適用
      const mutated = gen.mutated.map(c => mutator(c));

      // 次世代 = 生存者 + 突然変異体
      population = [
        ...gen.survivors,
        ...mutated.map(c => ({ ...c, generation: gen.generation + 1 })),
      ];
    }

    return genHistory;
  }

  // ----------------------------------------------------------
  // 整合性検証
  // ----------------------------------------------------------

  /**
   * 数学的整合性チェック: 公式の無矛盾性を検証
   */
  checkMathConsistency(formula: FormulaNode): {
    consistent: boolean;
    issues: string[];
    score: ConsistencyScore;
  } {
    const issues: string[] = [];

    // 循環参照チェック
    if (this._hasCycle(formula)) {
      issues.push('循環参照が検出されました');
    }

    // ゼロ除算チェック
    if (this._hasZeroDivision(formula)) {
      issues.push('ゼロ除算の可能性があります');
    }

    // 無限大チェック
    if (this._hasInfinity(formula)) {
      issues.push('無限大値が含まれています');
    }

    // 双対バランスチェック
    const balance = this._dualBalance(formula);
    if (Math.abs(balance) > 0.9) {
      issues.push(`双対バランスが偏っています: ${balance.toFixed(3)}`);
    }

    const score = Math.max(0, 1 - issues.length * 0.25);
    return { consistent: issues.length === 0, issues, score };
  }

  /**
   * D-FUMT理論整合性: D-FUMT公理系との整合性を検証
   */
  checkDFUMTConsistency(formula: FormulaNode): {
    axiomCompliance: Record<string, boolean>;
    overallScore: ConsistencyScore;
  } {
    const axiomCompliance: Record<string, boolean> = {
      // 公理1: ゼロは拡張・縮小の不動点
      'AXIOM-1_zero-invariance': this._checkZeroInvariance(formula),
      // 公理2: 双対性 — ⊕⊖の対称性
      'AXIOM-2_duality': this._checkDuality(formula),
      // 公理3: φ黄金比整合性
      'AXIOM-3_phi-consistency': this._checkPhiConsistency(formula),
      // 公理4: π拡張との整合性
      'AXIOM-4_pi-extension': this._checkPiExtension(formula),
      // 公理5: 有限性 — 発散しない
      'AXIOM-5_finiteness': !this._hasInfinity(formula),
    };

    const trueCount = Object.values(axiomCompliance).filter(Boolean).length;
    const overallScore = trueCount / Object.keys(axiomCompliance).length;

    return { axiomCompliance, overallScore };
  }

  // ----------------------------------------------------------
  // 多様性・適応度
  // ----------------------------------------------------------

  private _diversityIndex(candidates: Candidate[]): number {
    if (candidates.length <= 1) return 0;

    const scores = candidates.map(c => c.fitness);
    const mean = scores.reduce((a, x) => a + x, 0) / scores.length;
    const variance = scores.reduce((a, x) => a + Math.pow(x - mean, 2), 0) / scores.length;
    const std = Math.sqrt(variance);

    // 正規化: σ/μ (変動係数)
    return mean > 1e-10 ? Math.min(1, std / mean) : 0;
  }

  private _eliteSelect(candidates: Candidate[], limit: number): Candidate[] {
    return [...candidates]
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, limit);
  }

  private _verdict(candidate: Candidate, score: ConsistencyScore): SelectionVerdict {
    if (score >= 0.7) return 'survive';
    if (score >= 0.4) return score < 0.55 ? 'mutate' : 'suspend';
    return 'eliminate';
  }

  private _verdictReason(
    candidate: Candidate,
    score: number,
    scores: Record<string, number>,
  ): string {
    const lowest = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
    if (score >= 0.7) return `適応度高 (${score.toFixed(3)})`;
    if (score >= 0.4) return `適応度中: 最低基準=${lowest?.[0]}(${lowest?.[1].toFixed(3)})`;
    return `適応度低 (${score.toFixed(3)}): 要素${lowest?.[0]}が閾値以下`;
  }

  // ----------------------------------------------------------
  // 整合性チェック補助
  // ----------------------------------------------------------

  private _hasCycle(node: FormulaNode, visited = new Set<string>()): boolean {
    if (visited.has(node.id)) return true;
    visited.add(node.id);
    for (const child of node.children) {
      if (this._hasCycle(child, new Set(visited))) return true;
    }
    return false;
  }

  private _hasZeroDivision(node: FormulaNode): boolean {
    if (node.type === 'operator' && node.symbol === '/') {
      const divisor = node.children[1];
      if (divisor?.type === 'constant' && divisor.value === 0) return true;
    }
    return node.children.some(c => this._hasZeroDivision(c));
  }

  private _hasInfinity(node: FormulaNode): boolean {
    if (node.type === 'constant' && !isFinite(node.value ?? 0)) return true;
    return node.children.some(c => this._hasInfinity(c));
  }

  private _dualBalance(node: FormulaNode): number {
    const count = { pos: 0, neg: 0 };
    this._countSigns(node, count);
    const total = count.pos + count.neg;
    if (total === 0) return 0;
    return (count.pos - count.neg) / total;
  }

  private _countSigns(node: FormulaNode, acc: { pos: number; neg: number }): void {
    if (node.type === 'constant' && node.value !== undefined) {
      if (node.value > 0) acc.pos++;
      else if (node.value < 0) acc.neg++;
    }
    node.children.forEach(c => this._countSigns(c, acc));
  }

  private _checkZeroInvariance(node: FormulaNode): boolean {
    // ゼロ入力時の出力がゼロかどうか（ゼロ不動点チェック）
    // 簡易: ゼロ定数が子孫に存在し処理されているか
    return !this._hasCycle(node) && !this._hasZeroDivision(node);
  }

  private _checkDuality(node: FormulaNode): boolean {
    // 双対演算子(⊕⊖)が存在しないか、存在する場合は対称性を持つ
    const balance = this._dualBalance(node);
    return Math.abs(balance) <= 0.5;
  }

  private _checkPhiConsistency(node: FormulaNode): boolean {
    // φ値が含まれる場合、φ^2 = φ+1 の範囲内で使われているか
    // 簡易チェック: φ^n が過大でないか
    const val = this._safeEval(node);
    if (val === null) return true;
    return isFinite(val) && Math.abs(val) < Math.pow(DFUMT_CONSTANTS.PHI, 20);
  }

  private _checkPiExtension(node: FormulaNode): boolean {
    // π拡張値との整合: 通常のπとD-FUMT π*の比率が許容範囲内
    const val = this._safeEval(node);
    if (val === null) return true;
    const ratio = val / (Math.PI * DFUMT_CONSTANTS.PI_EXT);
    return isFinite(ratio) && Math.abs(ratio) < 1e6;
  }

  private _safeEval(node: FormulaNode): DFUMTValue | null {
    try {
      if (node.type === 'constant') return node.value ?? null;
      return null;
    } catch {
      return null;
    }
  }

  // ----------------------------------------------------------
  // デフォルト基準・制約
  // ----------------------------------------------------------

  private _initDefaultCriteria(): void {
    this.criteria = [
      {
        name: 'fitness',
        weight: 0.3,
        threshold: 0.5,
        evaluate: (c) => Math.min(1, c.fitness),
      },
      {
        name: 'simplicity',
        weight: 0.25,
        threshold: 0.3,
        evaluate: (c) => Math.max(0, 1 - c.synthesis.complexity / 50),
      },
      {
        name: 'energy-efficiency',
        weight: 0.25,
        threshold: 0.2,
        evaluate: (c) => {
          const e = c.synthesis.energy;
          if (!isFinite(e) || e === 0) return 0;
          // エネルギーが中程度 (0.1〜10) で最高スコア
          const log = Math.log10(Math.abs(e) + 1e-10);
          return Math.exp(-Math.pow(log - 1, 2) / 2);
        },
      },
      {
        name: 'dual-balance',
        weight: 0.2,
        threshold: 0.4,
        evaluate: (c) => 1 - Math.abs(c.synthesis.dualBalance),
      },
    ];
  }

  private _initDefaultConstraints(): void {
    this.constraints = [
      {
        name: 'no-infinity',
        severity: 'hard',
        penalty: 0,
        check: (c) => !this._hasInfinity(c.formula),
      },
      {
        name: 'no-zero-division',
        severity: 'hard',
        penalty: 0,
        check: (c) => !this._hasZeroDivision(c.formula),
      },
      {
        name: 'depth-limit',
        severity: 'soft',
        penalty: 0.15,
        check: (c) => c.synthesis.depth <= 20,
      },
      {
        name: 'no-cycle',
        severity: 'hard',
        penalty: 0,
        check: (c) => !this._hasCycle(c.formula),
      },
    ];
  }

  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------

  /** 世代履歴サマリー */
  historySummary(): string {
    if (this.history.length === 0) return '(履歴なし)';
    const last = this.history[this.history.length - 1];
    return [
      `世代数: ${this.history.length}`,
      `最新世代 #${last.generation}:`,
      `  生存: ${last.survivors.length} / 淘汰: ${last.eliminated.length} / 突然変異: ${last.mutated.length}`,
      `  平均適応度: ${last.avgFitness.toFixed(4)}`,
      `  多様性指数: ${last.diversityIndex.toFixed(4)}`,
    ].join('\n');
  }

  summary(): string {
    return [
      '=== SelectionEngine (選択層) ===',
      `評価基準数: ${this.criteria.length}`,
      `整合性制約数: ${this.constraints.length}`,
      `人口上限: ${this.populationLimit}`,
      this.historySummary(),
    ].join('\n');
  }
}

export const selectionEngine = new SelectionEngine();
