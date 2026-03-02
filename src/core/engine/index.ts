/**
 * D-FUMT Engine — 3層統合エントリーポイント
 *
 *   種 (Seed)        — ゼロ拡張縮小・多次元写像
 *   代謝 (Metabolism) — 公式変換・合成
 *   選択 (Selection)  — 整合性評価・淘汰
 *
 * 使用例:
 *   import { DFUMTEngine } from './engine';
 *   const engine = new DFUMTEngine();
 *   const result = engine.run([0, 1, Math.PI]);
 */

export * from './seed';
export * from './metabolism';
export * from './selection';

import { SeedEngine, DimensionVector, MappingResult } from './seed';
import { MetabolismEngine, FormulaNode, SynthesisResult } from './metabolism';
import { SelectionEngine, Candidate, SelectionGeneration, EvaluationResult } from './selection';
import { DFUMT_CONSTANTS } from '../dfumt/constants';

// ============================================================
// 統合パイプライン型
// ============================================================

export interface EngineRunOptions {
  expansionDepth?: number;        // 種拡張深度
  targetDimension?: number;       // 写像先次元
  evolutionGenerations?: number;  // 進化世代数
  synthesisMode?: 'add' | 'mul' | 'dual' | 'compose';
}

export interface EngineRunResult {
  seed: {
    extensions: ReturnType<SeedEngine['extend']>[];
    mappings: MappingResult[];
  };
  metabolism: {
    formulas: SynthesisResult[];
    reduced: ReturnType<MetabolismEngine['reduce']>[];
  };
  selection: {
    generations: SelectionGeneration[];
    finalSurvivors: Candidate[];
  };
  summary: string;
}

// ============================================================
// DFUMTEngine — 統合エンジン
// ============================================================

export class DFUMTEngine {
  readonly seed: SeedEngine;
  readonly metabolism: MetabolismEngine;
  readonly selection: SelectionEngine;

  private candidateCounter = 0;

  constructor(options?: {
    precision?: number;
    maxDepth?: number;
    populationLimit?: number;
  }) {
    this.seed = new SeedEngine(options?.precision, options?.maxDepth);
    this.metabolism = new MetabolismEngine(this.seed);
    this.selection = new SelectionEngine(options?.populationLimit);
  }

  // ----------------------------------------------------------
  // フルパイプライン実行
  // ----------------------------------------------------------

  /**
   * 入力ベクトルからD-FUMTパイプラインを実行
   *
   * 1. Seed: 各値をゼロ拡張し、多次元写像
   * 2. Metabolism: 公式ノードを合成・変換
   * 3. Selection: 整合性評価・淘汰
   */
  run(input: DimensionVector, opts: EngineRunOptions = {}): EngineRunResult {
    const {
      expansionDepth = 3,
      targetDimension = input.length * 2,
      evolutionGenerations = 5,
      synthesisMode = 'dual',
    } = opts;

    // --- Phase 1: Seed (種) ---
    const extensions = input.map(v => this.seed.extend(v, expansionDepth));
    const mappings = [
      this.seed.elevate(input, targetDimension),
      this.seed.reduce(input, Math.max(1, Math.floor(input.length / 2))),
    ];

    // --- Phase 2: Metabolism (代謝) ---
    const baseFormulas = input.map((v, i) => {
      if (v === 0) return this.metabolism.makeConstant(0, '∅');
      if (Math.abs(v - DFUMT_CONSTANTS.PHI) < 1e-6) return this.metabolism.makeConstant(v, 'φ');
      if (Math.abs(v - Math.PI) < 1e-6) return this.metabolism.makeConstant(v, 'π');
      return this.metabolism.makeConstant(v, `x${i}`);
    });

    const synthResults: SynthesisResult[] = [];
    for (let i = 0; i + 1 < baseFormulas.length; i++) {
      synthResults.push(
        this.metabolism.synthesize(baseFormulas[i], baseFormulas[i + 1], synthesisMode),
      );
    }
    if (baseFormulas.length >= 2) {
      synthResults.push(this.metabolism.chain(baseFormulas));
    }

    const reduced = synthResults.map(sr => this.metabolism.reduce(sr.formula));

    // --- Phase 3: Selection (選択) ---
    const candidates: Candidate[] = synthResults.map((sr, i) => ({
      id: `cand_${this.candidateCounter++}`,
      formula: sr.formula,
      synthesis: sr,
      metadata: { inputIndex: i, inputLength: input.length },
      generation: 0,
      age: 0,
      fitness: sr.energy / (1 + sr.complexity),
    }));

    const mutator = (c: Candidate): Candidate => {
      const phiExtended = this.metabolism.piExtend(c.formula);
      return {
        ...c,
        id: `mut_${this.candidateCounter++}`,
        formula: phiExtended.formula,
        synthesis: phiExtended,
        fitness: phiExtended.energy / (1 + phiExtended.complexity),
      };
    };

    const generations = this.selection.evolve(candidates, evolutionGenerations, mutator);
    const finalGen = generations[generations.length - 1];
    const finalSurvivors = finalGen?.survivors ?? [];

    // --- サマリー ---
    const summaryLines = [
      '=== DFUMTEngine 実行サマリー ===',
      `入力次元 : ${input.length}D → 写像先: ${targetDimension}D`,
      `拡張深度 : ${expansionDepth}`,
      `合成公式数: ${synthResults.length}`,
      `進化世代数: ${generations.length}`,
      `最終生存数: ${finalSurvivors.length}`,
      '',
      this.seed.summary(),
      '',
      this.metabolism.summary(),
      '',
      this.selection.summary(),
    ];

    return {
      seed: { extensions, mappings },
      metabolism: { formulas: synthResults, reduced },
      selection: { generations, finalSurvivors },
      summary: summaryLines.join('\n'),
    };
  }

  // ----------------------------------------------------------
  // 便利メソッド
  // ----------------------------------------------------------

  /** 単一公式の整合性フルチェック */
  verify(formula: FormulaNode): {
    math: ReturnType<SelectionEngine['checkMathConsistency']>;
    dfumt: ReturnType<SelectionEngine['checkDFUMTConsistency']>;
    overall: number;
  } {
    const math = this.selection.checkMathConsistency(formula);
    const dfumt = this.selection.checkDFUMTConsistency(formula);
    const overall = (math.score + dfumt.overallScore) / 2;
    return { math, dfumt, overall };
  }

  /** 候補をゼロから生成して評価 */
  evaluateFormula(formula: FormulaNode): EvaluationResult {
    const synthesis = this.metabolism.synthesize(formula, formula, 'dual');
    const candidate: Candidate = {
      id: `eval_${this.candidateCounter++}`,
      formula,
      synthesis,
      metadata: {},
      generation: 0,
      age: 0,
      fitness: synthesis.energy / (1 + synthesis.complexity),
    };
    return this.selection.evaluate(candidate);
  }
}

// デフォルトエンジンインスタンス
export const dfumtEngine = new DFUMTEngine();
