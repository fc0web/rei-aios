// ============================================================
// simulator.ts — 戦略シミュレーター & 統計分析
//
// 各追い上げ法を任意の試行回数でシミュレートし、
// 統計的に比較する研究ツール。
//
// D-FUMT: 全戦略をconstants.tsの定数で記述・比較
// ============================================================

import { createInitialState, martingaleStep, expectedValue } from './strategies/martingale';
import { dalembertStep } from './strategies/dalembert';
import { createFibonacciState, fibonacciStep } from './strategies/fibonacci-bet';
import { createParleyState, parleyStep } from './strategies/parley';
import { BetResult } from './strategies/martingale';

export type StrategyName = 'martingale' | 'grand-martingale' | 'dalembert' | 'fibonacci' | 'parley';

export interface SimulationConfig {
  readonly strategy: StrategyName;
  readonly baseUnit: number;
  readonly rounds: number;
  readonly winRate: number;       // 0.0 〜 1.0
  readonly budget: number;        // 最大損失上限（0=無制限）
  readonly targetWins?: number;   // パーレー用
  readonly seed?: number;         // 乱数シード（再現性）
}

export interface SimulationResult {
  readonly config: SimulationConfig;
  readonly results: BetResult[];
  readonly stats: SimulationStats;
}

export interface SimulationStats {
  readonly totalRounds: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly finalCumulative: number;
  readonly maxCumulative: number;
  readonly minCumulative: number;
  readonly maxBet: number;
  readonly totalBet: number;
  readonly roi: number;           // 投資収益率 = cumulative / totalBet
  readonly bankruptRound: number | null; // 破産したラウンド（null=破産なし）
}

// ============================================================
// シミュレーション実行
// ============================================================

/**
 * 簡易乱数生成（シード付き）
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * シミュレーション実行
 */
export function simulate(config: SimulationConfig): SimulationResult {
  const rand = config.seed !== undefined
    ? seededRandom(config.seed)
    : Math.random;

  const results: BetResult[] = [];
  let bankruptRound: number | null = null;

  // 戦略別の初期状態
  let martState = createInitialState(config.baseUnit);
  let fibState = createFibonacciState(config.baseUnit);
  let parleyState = createParleyState(config.baseUnit, config.targetWins ?? 3);

  for (let i = 0; i < config.rounds; i++) {
    const win = rand() < config.winRate;
    let result: BetResult;

    switch (config.strategy) {
      case 'martingale': {
        const step = martingaleStep(martState, win, 'standard');
        martState = step.state;
        result = step.result;
        break;
      }
      case 'grand-martingale': {
        const step = martingaleStep(martState, win, 'grand');
        martState = step.state;
        result = step.result;
        break;
      }
      case 'dalembert': {
        const step = dalembertStep(martState, win);
        martState = step.state;
        result = step.result;
        break;
      }
      case 'fibonacci': {
        const step = fibonacciStep(fibState, win);
        fibState = step.state;
        result = step.result;
        break;
      }
      case 'parley': {
        const step = parleyStep(parleyState, win);
        parleyState = step.state;
        result = step.result;
        break;
      }
      default:
        throw new Error(`Unknown strategy: ${config.strategy}`);
    }

    results.push(result);

    // 破産チェック
    if (config.budget > 0 && result.cumulative <= -config.budget) {
      bankruptRound = i + 1;
      break;
    }
  }

  const stats = computeStats(results, bankruptRound);
  return { config, results, stats };
}

function computeStats(results: BetResult[], bankruptRound: number | null): SimulationStats {
  if (results.length === 0) {
    return {
      totalRounds: 0, wins: 0, losses: 0, winRate: 0,
      finalCumulative: 0, maxCumulative: 0, minCumulative: 0,
      maxBet: 0, totalBet: 0, roi: 0, bankruptRound: null,
    };
  }

  const wins = results.filter(r => r.win).length;
  const cumulatives = results.map(r => r.cumulative);
  const final = results[results.length - 1];

  return {
    totalRounds: results.length,
    wins,
    losses: results.length - wins,
    winRate: wins / results.length,
    finalCumulative: final.cumulative,
    maxCumulative: Math.max(...cumulatives),
    minCumulative: Math.min(...cumulatives),
    maxBet: Math.max(...results.map(r => r.bet)),
    totalBet: final.totalBetSoFar,
    roi: final.totalBetSoFar > 0 ? final.cumulative / final.totalBetSoFar : 0,
    bankruptRound,
  };
}

// ============================================================
// 比較分析
// ============================================================

/**
 * 全戦略を同条件で比較するレポートを生成
 */
export function compareAllStrategies(
  baseUnit: number,
  rounds: number,
  winRate: number,
  budget: number,
  seed: number = 42,
): string {
  const strategies: StrategyName[] = ['martingale', 'grand-martingale', 'dalembert', 'fibonacci', 'parley'];
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════╗');
  lines.push('║   追い上げ法 比較分析 — D-FUMT Research Tool ║');
  lines.push('╚══════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`設定: 基本単位=${baseUnit}, 試行=${rounds}回, 勝率=${(winRate*100).toFixed(1)}%, 資金=${budget}`);
  lines.push(`期待値: ${expectedValue(winRate).toFixed(4)} (${expectedValue(winRate) >= 0 ? 'プラス期待値' : 'マイナス期待値'})`);
  lines.push('');

  for (const strategy of strategies) {
    const result = simulate({ strategy, baseUnit, rounds, winRate, budget, seed });
    const s = result.stats;
    lines.push(`【${strategy}】`);
    lines.push(`  最終損益: ${s.finalCumulative >= 0 ? '+' : ''}${s.finalCumulative.toFixed(1)}`);
    lines.push(`  ROI: ${(s.roi * 100).toFixed(2)}%`);
    lines.push(`  最大賭け金: ${s.maxBet}`);
    lines.push(`  破産: ${s.bankruptRound ? `${s.bankruptRound}ラウンド目` : 'なし'}`);
    lines.push('');
  }

  lines.push('─── Rei (0₀式) — 数式で世界を記述する ───');
  return lines.join('\n');
}
