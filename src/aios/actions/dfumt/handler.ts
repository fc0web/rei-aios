/**
 * D-FUMT Action Handler — アクションハンドラー
 * AIからのアクション呼び出しを受け取り、D-FUMTエンジンを実行して結果を返す。
 *
 * Rei-AIOS AIアシスタントのtool_use / function_calling レスポンスを処理する。
 */

import { DFUMTEngine } from '../../../core/engine';
import { DFUMT_CONSTANTS } from '../dfumt/constants';
import { DFUMT_ACTIONS, getAction } from './actions';

// ============================================================
// 型定義
// ============================================================

/** アクション呼び出し入力 */
export interface ActionCall {
  name: string;
  arguments: Record<string, unknown>;
}

/** アクション実行結果 */
export interface ActionResult {
  action: string;
  success: boolean;
  data: unknown;
  error?: string;
  executionMs: number;
  summary: string;
}

/** ハンドラーオプション */
export interface HandlerOptions {
  timeout?: number;       // ms (default: 10000)
  verbose?: boolean;      // 詳細ログ
  maxVectorSize?: number; // 入力ベクトルの最大要素数
}

// ============================================================
// DFUMTActionHandler
// ============================================================

export class DFUMTActionHandler {
  private engine: DFUMTEngine;
  private options: Required<HandlerOptions>;

  constructor(options: HandlerOptions = {}) {
    this.engine = new DFUMTEngine({ precision: 1e-10, maxDepth: 32 });
    this.options = {
      timeout: options.timeout ?? 10_000,
      verbose: options.verbose ?? false,
      maxVectorSize: options.maxVectorSize ?? 64,
    };
  }

  // ----------------------------------------------------------
  // メインディスパッチ
  // ----------------------------------------------------------

  /**
   * アクション呼び出しを処理して結果を返す
   */
  async handle(call: ActionCall): Promise<ActionResult> {
    const start = Date.now();

    // アクション定義の存在確認
    const def = getAction(call.name);
    if (!def) {
      return this._error(call.name, `未知のアクション: ${call.name}`, start);
    }

    // 必須パラメータ検証
    const missing = def.required.filter(k => !(k in call.arguments));
    if (missing.length > 0) {
      return this._error(call.name, `必須パラメータが不足: ${missing.join(', ')}`, start);
    }

    // タイムアウト付きで実行
    try {
      const result = await Promise.race([
        this._dispatch(call),
        this._timeoutPromise(this.options.timeout, call.name),
      ]);
      if (this.options.verbose) {
        console.log(`[DFUMTAction] ${call.name} 完了 (${Date.now() - start}ms)`);
      }
      return { ...result, executionMs: Date.now() - start };
    } catch (err) {
      return this._error(call.name, String(err), start);
    }
  }

  /**
   * 複数アクションを順次実行
   */
  async handleBatch(calls: ActionCall[]): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    for (const call of calls) {
      results.push(await this.handle(call));
    }
    return results;
  }

  // ----------------------------------------------------------
  // ディスパッチロジック
  // ----------------------------------------------------------

  private async _dispatch(call: ActionCall): Promise<Omit<ActionResult, 'executionMs'>> {
    const a = call.arguments;

    switch (call.name) {

      // --- Seed ---

      case 'dfumt_seed_extend': {
        const origin = this._num(a.origin, 0);
        const depth = this._int(a.depth, 3);
        const ext = this.engine.seed.extend(origin, depth);
        return {
          action: call.name,
          success: true,
          data: {
            origin: ext.origin,
            expanded: ext.expanded,
            depth: ext.depth,
            dual: ext.dual,
            expandedCount: ext.expanded.length,
          },
          summary:
            `origin=${origin} を深度${depth}で拡張 → ${ext.expanded.length}値生成` +
            ` (⊕${ext.dual.positive.toFixed(6)} / ⊖${ext.dual.negative.toFixed(6)})`,
        };
      }

      case 'dfumt_seed_contract': {
        const values = this._numArray(a.values);
        const mode = String(a.mode ?? 'dual');
        const result = mode === 'dual'
          ? this.engine.seed.cancelDuals(values)
          : this.engine.seed.contract(values);
        return {
          action: call.name,
          success: true,
          data: result,
          summary:
            `${values.length}値 → ${result.contracted.toFixed(8)}` +
            ` (情報損失率: ${(result.lossRatio * 100).toFixed(1)}%)`,
        };
      }

      case 'dfumt_seed_map': {
        const vector = this._numArray(a.vector);
        const targetDim = this._int(a.target_dim, vector.length * 2);
        const mappingType = String(a.mapping_type ?? 'dfumt') as 'dfumt' | 'linear' | 'fourier';

        const isElevate = targetDim >= vector.length;
        let result;
        if (mappingType === 'dfumt') {
          const mapping = this.engine.seed.createMapping(vector.length, targetDim, 'dfumt');
          result = {
            source: vector,
            target: mapping.kernel(vector),
            dimension: targetDim,
            isInjective: mapping.isInjective,
            isSurjective: mapping.isSurjective,
            fixedPoints: mapping.fixedPoints,
          };
        } else if (isElevate) {
          result = this.engine.seed.elevate(vector, targetDim);
        } else {
          result = this.engine.seed.reduce(vector, targetDim);
        }

        return {
          action: call.name,
          success: true,
          data: result,
          summary: `${vector.length}D → ${targetDim}D 写像(${mappingType}) 完了`,
        };
      }

      // --- Metabolism ---

      case 'dfumt_metabolism_synthesize': {
        const va = this._num(a.value_a, 0);
        const vb = this._num(a.value_b, 0);
        const mode = String(a.mode ?? 'dual') as 'add' | 'mul' | 'dual' | 'compose';

        const nodeA = this.engine.metabolism.makeConstant(va, `a(${va})`);
        const nodeB = this.engine.metabolism.makeConstant(vb, `b(${vb})`);
        const synth = this.engine.metabolism.synthesize(nodeA, nodeB, mode);
        const value = this.engine.metabolism.evaluate(synth.formula);

        return {
          action: call.name,
          success: true,
          data: {
            value,
            complexity: synth.complexity,
            depth: synth.depth,
            dualBalance: synth.dualBalance,
            energy: synth.energy,
            expression: this.engine.metabolism.toSExpr(synth.formula),
          },
          summary:
            `[${va}] ⊗(${mode}) [${vb}] → ${value?.toFixed(8) ?? 'null'}` +
            ` (複雑度:${synth.complexity} エネルギー:${synth.energy.toFixed(4)})`,
        };
      }

      case 'dfumt_metabolism_reduce': {
        const value = this._num(a.value, 0);
        const maxSteps = this._int(a.max_steps, 100);
        const node = this.engine.metabolism.makeConstant(value);
        const cycle = this.engine.metabolism.reduce(node, maxSteps);
        const outputVal = this.engine.metabolism.evaluate(cycle.output);

        return {
          action: call.name,
          success: true,
          data: {
            input: value,
            output: outputVal,
            cycles: cycle.cycles,
            totalDelta: cycle.totalDelta,
            steps: cycle.steps.map(s => ({ rule: s.rule, delta: s.delta })),
            expression: this.engine.metabolism.toSExpr(cycle.output),
          },
          summary:
            `${value} → ${outputVal?.toFixed(8) ?? 'null'}` +
            ` (${cycle.cycles}ステップ, Δ${cycle.totalDelta.toFixed(6)})`,
        };
      }

      case 'dfumt_metabolism_phi_spiral': {
        const value = this._num(a.value, 1);
        const turns = this._int(a.turns, 3);
        const node = this.engine.metabolism.makeConstant(value);
        const spiral = this.engine.metabolism.phiSpiral(node, turns);
        const resultVal = this.engine.metabolism.evaluate(spiral.formula);

        return {
          action: call.name,
          success: true,
          data: {
            input: value,
            turns,
            output: resultVal,
            energy: spiral.energy,
            complexity: spiral.complexity,
            expression: this.engine.metabolism.toSExpr(spiral.formula),
          },
          summary:
            `${value} × φ螺旋(${turns}ターン) → ${resultVal?.toFixed(8) ?? 'null'}` +
            ` (エネルギー: ${spiral.energy.toFixed(4)})`,
        };
      }

      // --- Selection ---

      case 'dfumt_selection_evaluate': {
        const value = this._num(a.value, 0);
        const generation = this._int(a.generation, 0);
        const node = this.engine.metabolism.makeConstant(value);
        const result = this.engine.evaluateFormula(node);

        return {
          action: call.name,
          success: true,
          data: {
            value,
            verdict: result.verdict,
            totalScore: result.totalScore,
            scores: result.scores,
            reason: result.reason,
          },
          summary:
            `value=${value} → 判定:${result.verdict.toUpperCase()}` +
            ` (総合スコア: ${result.totalScore.toFixed(4)})`,
        };
      }

      case 'dfumt_selection_evolve': {
        const values = this._numArray(a.values);
        const generations = this._int(a.generations, 5);

        // 候補生成
        const candidates = values.map((v, i) => {
          const node = this.engine.metabolism.makeConstant(v);
          const synth = this.engine.metabolism.synthesize(node, node, 'dual');
          return {
            id: `init_${i}`,
            formula: node,
            synthesis: synth,
            metadata: { initialValue: v } as Record<string, unknown>,
            generation: 0,
            age: 0,
            fitness: Math.abs(v) / (1 + Math.abs(v)),
          };
        });

        const mutator = (c: typeof candidates[0]) => {
          const newVal = (this.engine.metabolism.evaluate(c.formula) ?? 0) * DFUMT_CONSTANTS.PHI;
          const newNode = this.engine.metabolism.makeConstant(newVal);
          const newSynth = this.engine.metabolism.synthesize(newNode, newNode, 'dual');
          return {
            ...c,
            id: `mut_${c.id}`,
            formula: newNode,
            synthesis: newSynth,
            fitness: Math.abs(newVal) / (1 + Math.abs(newVal)),
          };
        };

        const gens = this.engine.selection.evolve(candidates, generations, mutator);
        const lastGen = gens[gens.length - 1];

        return {
          action: call.name,
          success: true,
          data: {
            totalGenerations: gens.length,
            survivors: lastGen?.survivors.map(s => ({
              id: s.id,
              fitness: s.fitness,
              age: s.age,
              value: this.engine.metabolism.evaluate(s.formula),
            })) ?? [],
            eliminated: lastGen?.eliminated.length ?? 0,
            avgFitness: lastGen?.avgFitness ?? 0,
            diversityIndex: lastGen?.diversityIndex ?? 0,
            fitnessHistory: gens.map(g => ({
              generation: g.generation,
              avg: g.avgFitness,
              diversity: g.diversityIndex,
            })),
          },
          summary:
            `${values.length}個体 × ${generations}世代 → ` +
            `生存${lastGen?.survivors.length ?? 0}個, ` +
            `淘汰${lastGen?.eliminated.length ?? 0}個, ` +
            `平均適応度: ${(lastGen?.avgFitness ?? 0).toFixed(4)}`,
        };
      }

      // --- Engine フルパイプライン ---

      case 'dfumt_engine_run': {
        const vector = this._numArray(a.input_vector);
        const result = this.engine.run(vector, {
          expansionDepth: this._int(a.expansion_depth, 3),
          evolutionGenerations: this._int(a.evolution_generations, 5),
          synthesisMode: String(a.synthesis_mode ?? 'dual') as 'dual' | 'add' | 'mul' | 'compose',
        });

        return {
          action: call.name,
          success: true,
          data: {
            inputDimension: vector.length,
            extensionCount: result.seed.extensions.length,
            mappingCount: result.seed.mappings.length,
            formulaCount: result.metabolism.formulas.length,
            generationCount: result.selection.generations.length,
            survivorCount: result.selection.finalSurvivors.length,
            survivors: result.selection.finalSurvivors.map(s => ({
              id: s.id,
              fitness: s.fitness,
              value: this.engine.metabolism.evaluate(s.formula),
            })),
          },
          summary: result.summary,
        };
      }

      // --- Verify ---

      case 'dfumt_verify': {
        const value = this._num(a.value, 0);
        const node = this.engine.metabolism.makeConstant(value);
        const result = this.engine.verify(node);

        const axiomList = Object.entries(result.dfumt.axiomCompliance)
          .map(([k, v]) => `${v ? '✓' : '✗'} ${k}`)
          .join(', ');

        return {
          action: call.name,
          success: true,
          data: {
            value,
            mathConsistency: result.math,
            dfumtConsistency: result.dfumt,
            overallScore: result.overall,
          },
          summary:
            `value=${value} 整合スコア: ${(result.overall * 100).toFixed(1)}%` +
            ` [${axiomList}]`,
        };
      }

      default:
        return this._error(call.name, `ディスパッチ未実装: ${call.name}`, Date.now());
    }
  }

  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------

  private _num(v: unknown, fallback: number): number {
    const n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  private _int(v: unknown, fallback: number): number {
    return Math.max(1, Math.round(this._num(v, fallback)));
  }

  private _numArray(v: unknown): number[] {
    if (!Array.isArray(v)) return [];
    return v
      .slice(0, this.options.maxVectorSize)
      .map(x => this._num(x, 0));
  }

  private _error(action: string, message: string, startMs: number): ActionResult {
    return {
      action,
      success: false,
      data: null,
      error: message,
      executionMs: Date.now() - startMs,
      summary: `❌ エラー: ${message}`,
    };
  }

  private _timeoutPromise(ms: number, action: string): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`タイムアウト(${ms}ms): ${action}`)), ms),
    );
  }

  /** 利用可能なアクション一覧を返す */
  listActions(): { name: string; category: string; description: string }[] {
    return DFUMT_ACTIONS.map(a => ({
      name: a.name,
      category: a.category,
      description: a.description.slice(0, 60) + '...',
    }));
  }
}

export const dfumtHandler = new DFUMTActionHandler();
