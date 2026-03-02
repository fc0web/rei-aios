// ============================================================
// parley.ts — パーレー法（逆マーチンゲール）
//
// 勝ち→賭け金を倍増, 負け→基本単位に戻る
// 利益を積み上げ、損失を最小化する戦略
//
// D-FUMT対応: π拡張理論（位相反転＝マーチンゲールの逆）
// ============================================================

import { BetResult, StrategyState, createInitialState } from './martingale';

export interface ParleyState extends StrategyState {
  readonly consecutiveWins: number;
  readonly targetWins: number; // 何連勝で利確するか
}

export function createParleyState(baseUnit: number = 1, targetWins: number = 3): ParleyState {
  return {
    currentBet: baseUnit,
    baseUnit,
    cumulative: 0,
    totalBet: 0,
    round: 1,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    targetWins,
  };
}

export function parleyStep(
  state: ParleyState,
  win: boolean,
): { state: ParleyState; result: BetResult } {
  const bet = state.currentBet;
  const profit = win ? bet : -bet;
  const newCumulative = state.cumulative + profit;
  const newTotalBet = state.totalBet + bet;

  const newConsecutiveWins = win ? state.consecutiveWins + 1 : 0;
  // 目標連勝達成or負け→基本単位に戻る
  const reachedTarget = win && newConsecutiveWins >= state.targetWins;
  const nextBet = (win && !reachedTarget)
    ? bet * 2
    : state.baseUnit;

  const result: BetResult = {
    round: state.round,
    bet,
    win,
    profit,
    cumulative: newCumulative,
    totalBetSoFar: newTotalBet,
  };

  const newState: ParleyState = {
    currentBet: nextBet,
    baseUnit: state.baseUnit,
    cumulative: newCumulative,
    totalBet: newTotalBet,
    round: state.round + 1,
    consecutiveLosses: win ? 0 : state.consecutiveLosses + 1,
    consecutiveWins: reachedTarget ? 0 : newConsecutiveWins,
    targetWins: state.targetWins,
  };

  return { state: newState, result };
}

export function dfumtDescription(): string {
  return [
    '【パーレー法 × D-FUMT対応】',
    '',
    '⊕ 拡張（勝ち時）: bet × 2（利益を再投資）',
    '  → π拡張の「位相反転」: マーチンゲールの鏡像',
    '',
    '⊖ 縮小（負けor目標達成時）: bet → unit',
    '  → π縮小の「原点への回帰」: 利益を確定して再スタート',
    '',
    '数学的本質: 利益のみリスクにさらす「家の金で遊ぶ」戦略',
    '  損失は常に1単位、利益は2^n単位の可能性',
  ].join('\n');
}

export { createInitialState };
