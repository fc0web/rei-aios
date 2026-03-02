// ============================================================
// fibonacci-bet.ts — フィボナッチ法
//
// フィボナッチ数列に沿って賭け金を管理する
// 負け→数列を1つ進む, 勝ち→数列を2つ戻る
//
// D-FUMT対応: φ拡張理論（フィボナッチ＝黄金比の具現化）
// ============================================================

import { BetResult, StrategyState } from './martingale';

/** フィボナッチ数列（先頭20項） */
export const FIBONACCI_SEQUENCE = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765];

export interface FibonacciState extends StrategyState {
  readonly fibIndex: number;
}

export function fibonacciNextBet(state: FibonacciState, baseUnit: number): number {
  const fib = FIBONACCI_SEQUENCE[state.fibIndex] ?? FIBONACCI_SEQUENCE[FIBONACCI_SEQUENCE.length - 1];
  return baseUnit * fib;
}

export function createFibonacciState(baseUnit: number = 1): FibonacciState {
  return {
    currentBet: baseUnit,
    baseUnit,
    cumulative: 0,
    totalBet: 0,
    round: 1,
    consecutiveLosses: 0,
    fibIndex: 0,
  };
}

export function fibonacciStep(
  state: FibonacciState,
  win: boolean,
): { state: FibonacciState; result: BetResult } {
  const bet = fibonacciNextBet(state, state.baseUnit);
  const profit = win ? bet : -bet;
  const newCumulative = state.cumulative + profit;
  const newTotalBet = state.totalBet + bet;

  // 勝ち→2つ戻る, 負け→1つ進む
  const newFibIndex = win
    ? Math.max(0, state.fibIndex - 2)
    : Math.min(FIBONACCI_SEQUENCE.length - 1, state.fibIndex + 1);

  const result: BetResult = {
    round: state.round,
    bet,
    win,
    profit,
    cumulative: newCumulative,
    totalBetSoFar: newTotalBet,
  };

  const newState: FibonacciState = {
    currentBet: state.baseUnit * (FIBONACCI_SEQUENCE[newFibIndex] ?? 1),
    baseUnit: state.baseUnit,
    cumulative: newCumulative,
    totalBet: newTotalBet,
    round: state.round + 1,
    consecutiveLosses: win ? 0 : state.consecutiveLosses + 1,
    fibIndex: newFibIndex,
  };

  return { state: newState, result };
}

export function dfumtDescription(): string {
  return [
    '【フィボナッチ法 × D-FUMT対応】',
    '',
    '⊕ 拡張（負け時）: index += 1（数列を前進）',
    '  → F(n) = F(n-1) + F(n-2): φ^n に収束する自己相似性',
    '',
    '⊖ 縮小（勝ち時）: index -= 2（数列を2ステップ後退）',
    '  → φ拡張の逆元操作: 2ステップ縮小で利益確保',
    '',
    '数学的本質: lim F(n+1)/F(n) = φ（黄金比）',
    '  フィボナッチ法はφ拡張理論の直接的な具現化',
  ].join('\n');
}
