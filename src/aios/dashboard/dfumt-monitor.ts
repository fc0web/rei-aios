/**
 * Rei-AIOS テーマH — DFUMTMonitor
 * D-FUMTエンジンを定期実行してメトリクスを収集・ダッシュボードへ配信する。
 *
 * 中心-周囲パターン:
 *   中心 = DFUMTEngine.run() の実行結果
 *   周囲 = メトリクス収集 / 履歴管理 / IPC配信
 */

import { DFUMTEngine, EngineRunResult } from '../../core/engine';
import {
  EngineMetrics, DashboardState, MetricsSnapshot,
  DEFAULT_LAYER_STATE, defaultEngineMetrics,
} from './types';

const HISTORY_MAX = 120;  // 最大120スナップショット保持（~2分相当 @1秒間隔）

export class DFUMTMonitor {
  private engine:   DFUMTEngine;
  private metrics:  EngineMetrics;
  private history:  MetricsSnapshot[];
  private timerId:  ReturnType<typeof setInterval> | null;
  private intervalMs: number;
  private onUpdate: (state: DashboardState) => void;

  constructor(
    intervalMs = 2000,
    onUpdate: (state: DashboardState) => void = () => {},
  ) {
    this.engine      = new DFUMTEngine();
    this.metrics     = defaultEngineMetrics();
    this.history     = [];
    this.timerId     = null;
    this.intervalMs  = intervalMs;
    this.onUpdate    = onUpdate;
  }

  // ──────────────────────────────────────────────────────────
  // ライフサイクル
  // ──────────────────────────────────────────────────────────

  start(): void {
    if (this.timerId !== null) return;
    // 初回即時実行
    this._tick();
    this.timerId = setInterval(() => this._tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timerId !== null) { clearInterval(this.timerId); this.timerId = null; }
  }

  isRunning(): boolean { return this.timerId !== null; }

  resetMetrics(): void {
    this.metrics = defaultEngineMetrics();
    this.history = [];
    this._broadcast();
  }

  // ──────────────────────────────────────────────────────────
  // 手動実行（ダッシュボードUIから呼び出し）
  // ──────────────────────────────────────────────────────────

  runWith(input: number[]): MetricsSnapshot {
    return this._executeAndCollect(input);
  }

  getState(): DashboardState {
    return {
      engineMetrics: { ...this.metrics },
      historyWindow: [...this.history],
      isRunning:     this.isRunning(),
      connectedAt:   Date.now(),
    };
  }

  // ──────────────────────────────────────────────────────────
  // Private
  // ──────────────────────────────────────────────────────────

  /**
   * 定期ティック: ランダムベクトルを生成してエンジンを実行
   * デモ/ウォームアップ目的 — φ・π・0を含む多様なベクトル
   */
  private _tick(): void {
    const PHI = 1.6180339887;
    const vectors = [
      [0, 1, PHI, Math.PI],
      [0, 1, 2, 3, 5, 8],
      [PHI, PHI * PHI, Math.PI, Math.E],
      [0, Math.SQRT2, PHI, 0],
      [1, -1, PHI, -PHI],
    ];
    const v = vectors[this.metrics.runCount % vectors.length];
    this._executeAndCollect(v);
  }

  private _executeAndCollect(input: number[]): MetricsSnapshot {
    const t0 = Date.now();

    let result: EngineRunResult;
    try {
      result = this.engine.run(input, {
        expansionDepth:       3,
        targetDimension:      input.length * 2,
        evolutionGenerations: 4,
        synthesisMode:        'dual',
      });
    } catch {
      // エンジンエラー時はダミーを返す
      const snap: MetricsSnapshot = {
        timestamp:0, fitness:0, energy:0, survivors:0,
        complexity:0, dualBalance:0, elapsedMs:0,
      };
      return snap;
    }

    const elapsed = Date.now() - t0;
    const now     = Date.now();

    // ── Seed 状態 ──
    const ext = result.seed.extensions;
    const map = result.seed.mappings;
    this.metrics.seed.callCount++;
    this.metrics.seed.lastInputDim    = input.length;
    this.metrics.seed.lastTargetDim   = map[0]?.dimension ?? input.length * 2;
    this.metrics.seed.lastExpDepth    = ext[0]?.depth ?? 3;
    this.metrics.seed.lastExtensions  = ext.reduce((s, e) => s + (e.expanded?.length ?? 0), 0);
    this.metrics.seed.zeroBalance     = ext.reduce((s, e) => s + (e.dual?.positive ?? 0) - (e.dual?.negative ?? 0), 0) / Math.max(1, ext.length);
    this.metrics.seed.activeMs        = elapsed * 0.25;

    // ── Metabolism 状態 ──
    const formulas = result.metabolism.formulas;
    const reduced  = result.metabolism.reduced;
    this.metrics.metabolism.callCount++;
    this.metrics.metabolism.synthCount   += formulas.length;
    this.metrics.metabolism.reduceCount  += reduced.length;
    this.metrics.metabolism.lastComplexity = formulas.at(-1)?.complexity ?? 0;
    this.metrics.metabolism.lastDepth      = formulas.at(-1)?.depth      ?? 0;
    this.metrics.metabolism.dualBalance    = formulas.at(-1)?.dualBalance ?? 0;
    this.metrics.metabolism.lastEnergy     = formulas.at(-1)?.energy      ?? 0;
    this.metrics.metabolism.activeMs       = elapsed * 0.4;

    // ── Selection 状態 ──
    const gens     = result.selection.generations;
    const lastGen  = gens.at(-1);
    const survivors = result.selection.finalSurvivors;
    const totalCands = gens.reduce((s, g) => s + g.candidates.length, 0);
    const totalElim  = gens.reduce((s, g) => s + g.eliminated.length, 0);
    const totalMut   = gens.reduce((s, g) => s + g.mutated.length,   0);
    this.metrics.selection.callCount++;
    this.metrics.selection.totalCandidates += totalCands;
    this.metrics.selection.survivors        = survivors.length;
    this.metrics.selection.eliminated      += totalElim;
    this.metrics.selection.mutated         += totalMut;
    this.metrics.selection.lastGenCount     = gens.length;
    this.metrics.selection.avgFitness       = lastGen?.avgFitness ?? 0;
    this.metrics.selection.survivalRate     = totalCands > 0
      ? survivors.length / Math.max(1, formulas.length) : 0;
    this.metrics.selection.activeMs = elapsed * 0.35;

    // ── 全体 ──
    this.metrics.runCount++;
    this.metrics.totalMs        += elapsed;
    this.metrics.avgMs           = this.metrics.totalMs / this.metrics.runCount;
    this.metrics.lastInputVector = [...input];
    this.metrics.lastRunAt       = now;

    // ── スナップショット追加 ──
    const snap: MetricsSnapshot = {
      timestamp:   now,
      fitness:     this.metrics.selection.avgFitness,
      energy:      this.metrics.metabolism.lastEnergy,
      survivors:   survivors.length,
      complexity:  this.metrics.metabolism.lastComplexity,
      dualBalance: this.metrics.metabolism.dualBalance,
      elapsedMs:   elapsed,
    };
    this.history.push(snap);
    if (this.history.length > HISTORY_MAX) this.history.shift();

    this._broadcast();
    return snap;
  }

  private _broadcast(): void {
    this.onUpdate(this.getState());
  }
}
