// ============================================================
// dalembert.ts — ダランベール法
//
// 負け→1単位増加, 勝ち→1単位減少
// 穏やかな追い上げ法（マーチンゲールより低リスク）
//
// D-FUMT対応: φ拡張理論（自己相似・漸進的変化）
// ============================================================

import { BetResult, StrategyState, createInitialState } from './martingale';

export function dalembertNextBet(state: StrategyState): number {
  return Math.max(state.baseUnit, state.currentBet);
}

export function dalembertStep(
  state: StrategyState,
  win: boolean,
): { state: StrategyState; result: BetResult } {
  const bet = state.currentBet;
  const profit = win ? bet : -bet;
  const newCumulative = state.cumulative + profit;
  const newTotalBet = state.totalBet + bet;

  const nextBet = win
    ? Math.max(state.baseUnit, bet - state.baseUnit)
    : bet + state.baseUnit;

  const result: BetResult = {
    round: state.round,
    bet,
    win,
    profit,
    cumulative: newCumulative,
    totalBetSoFar: newTotalBet,
  };

  const newState: StrategyState = {
    currentBet: nextBet,
    baseUnit: state.baseUnit,
    cumulative: newCumulative,
    totalBet: newTotalBet,
    round: state.round + 1,
    consecutiveLosses: win ? 0 : state.consecutiveLosses + 1,
  };

  return { state: newState, result };
}

export function dfumtDescription(): string {
  return [
    '【ダランベール法 × D-FUMT対応】',
    '',
    '⊕ 拡張（負け時）: bet += unit（線形増加）',
    '  → φ拡張の「漸進的自己相似拡大」と同型',
    '',
    '⊖ 縮小（勝ち時）: bet -= unit（線形減少）',
    '  → φ縮小の「黄金分割による最適収束」と同型',
    '',
    '数学的本質: 線形オシレーター（調和振動）',
    '  マーチンゲールより安全だが回収に時間がかかる',
  ].join('\n');
}

export { createInitialState };
