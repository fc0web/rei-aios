// ============================================================
// martingale.ts — マーチンゲール法 & 派生戦略
//
// マーチンゲール法: 負けたら賭け金を2倍にする
// グランマーチンゲール: 負けたら2倍+1単位
//
// D-FUMT対応: e拡張理論（指数成長）と対応
//   ⊕ 拡張: 賭け金の指数的増加
//   ⊖ 縮小: 勝利による元の単位への回帰
//
// @author Nobuki Fujimoto (D-FUMT)
// ============================================================

export interface BetResult {
  readonly round: number;
  readonly bet: number;
  readonly win: boolean;
  readonly profit: number;
  readonly cumulative: number;
  readonly totalBetSoFar: number;
}

export interface StrategyState {
  readonly currentBet: number;
  readonly baseUnit: number;
  readonly cumulative: number;
  readonly totalBet: number;
  readonly round: number;
  readonly consecutiveLosses: number;
}

// ============================================================
// マーチンゲール法
// ============================================================

/**
 * マーチンゲール: 負け→2倍, 勝ち→基本単位に戻る
 * 数式: bet(n) = baseUnit × 2^(連敗数)
 */
export function martingaleNextBet(state: StrategyState): number {
  return state.baseUnit * Math.pow(2, state.consecutiveLosses);
}

/**
 * グランマーチンゲール: 負け→2倍+1単位
 * 数式: bet(n) = baseUnit × 2^n + baseUnit × n
 */
export function grandMartingaleNextBet(state: StrategyState): number {
  const n = state.consecutiveLosses;
  return state.baseUnit * Math.pow(2, n) + state.baseUnit * n;
}

/**
 * マーチンゲール状態を1ステップ更新
 */
export function martingaleStep(
  state: StrategyState,
  win: boolean,
  variant: 'standard' | 'grand' = 'standard',
): { state: StrategyState; result: BetResult } {
  const bet = variant === 'grand'
    ? grandMartingaleNextBet(state)
    : martingaleNextBet(state);

  const profit = win ? bet : -bet;
  const newCumulative = state.cumulative + profit;
  const newTotalBet = state.totalBet + bet;

  const result: BetResult = {
    round: state.round,
    bet,
    win,
    profit,
    cumulative: newCumulative,
    totalBetSoFar: newTotalBet,
  };

  const newState: StrategyState = {
    currentBet: win
      ? state.baseUnit
      : (variant === 'grand'
          ? grandMartingaleNextBet({ ...state, consecutiveLosses: state.consecutiveLosses + 1 })
          : martingaleNextBet({ ...state, consecutiveLosses: state.consecutiveLosses + 1 })),
    baseUnit: state.baseUnit,
    cumulative: newCumulative,
    totalBet: newTotalBet,
    round: state.round + 1,
    consecutiveLosses: win ? 0 : state.consecutiveLosses + 1,
  };

  return { state: newState, result };
}

/**
 * 初期状態を生成
 */
export function createInitialState(baseUnit: number = 1): StrategyState {
  return {
    currentBet: baseUnit,
    baseUnit,
    cumulative: 0,
    totalBet: 0,
    round: 1,
    consecutiveLosses: 0,
  };
}

/**
 * マーチンゲールの破産リスク計算
 * 資金がbudgetの場合、何連敗で破産するか
 * 数式: n = floor(log2(budget / baseUnit + 1))
 */
export function bankruptcyRisk(baseUnit: number, budget: number): {
  maxLossStreak: number;
  requiredBudgetForN: (n: number) => number;
} {
  const maxLossStreak = Math.floor(Math.log2(budget / baseUnit + 1));
  const requiredBudgetForN = (n: number) =>
    baseUnit * (Math.pow(2, n) - 1);

  return { maxLossStreak, requiredBudgetForN };
}

/**
 * 期待値計算（二項確率モデル）
 * p: 勝率, odds: 払い戻し倍率
 * EV = p × odds - (1-p)
 */
export function expectedValue(winRate: number, odds: number = 1): number {
  return winRate * odds - (1 - winRate);
}

/**
 * マーチンゲール法のD-FUMT記述
 * e拡張理論との対応を返す
 */
export function dfumtDescription(): string {
  return [
    '【マーチンゲール法 × D-FUMT対応】',
    '',
    '⊕ 拡張（連敗時）: bet(n) = unit × 2^n',
    '  → e拡張理論の指数成長と同型',
    '  → 連敗数 n が添字次数に対応',
    '',
    '⊖ 縮小（勝利時）: bet → unit（基本単位）',
    '  → 縮小理論の「固定点への収束」と同型',
    '  → 利益は常に +unit（一定の収穫）',
    '',
    '破産条件: budget < unit × (2^n - 1)',
    '  → ∞拡張理論の「無限への発散」に対応',
    '  → 資金が有限である限り、発散は有限ステップで停止',
    '',
    '数学的本質: 有限資金下での指数関数的リスク',
  ].join('\n');
}
