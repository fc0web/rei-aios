/**
 * Rei-AIOS テーマH — D-FUMTダッシュボード型定義
 */

// ============================================================
// エンジン層状態
// ============================================================

/** 種(Seed)層のリアルタイム状態 */
export interface SeedLayerState {
  callCount:       number;
  lastInputDim:    number;
  lastTargetDim:   number;
  lastExpDepth:    number;
  lastExtensions:  number;   // 拡張数
  fixedPoints:     number;   // 不動点数
  zeroBalance:     number;   // ⊕⊖バランス [-1, 1]
  cacheHitRate:    number;   // [0, 1]
  activeMs:        number;   // 処理時間ms
}

/** 代謝(Metabolism)層のリアルタイム状態 */
export interface MetabolismLayerState {
  callCount:       number;
  synthCount:      number;   // 合成回数
  reduceCount:     number;   // 簡約回数
  lastComplexity:  number;
  lastDepth:       number;
  dualBalance:     number;   // ⊕⊖バランス [-1, 1]
  lastEnergy:      number;   // D-FUMT的情報量
  piExtCount:      number;   // π̂拡張適用回数
  activeMs:        number;
}

/** 選択(Selection)層のリアルタイム状態 */
export interface SelectionLayerState {
  callCount:       number;
  totalCandidates: number;
  survivors:       number;
  eliminated:      number;
  mutated:         number;
  lastGenCount:    number;   // 最終世代数
  avgFitness:      number;   // 平均適応度
  survivalRate:    number;   // [0, 1]
  activeMs:        number;
}

/** エンジン全体メトリクス */
export interface EngineMetrics {
  runCount:        number;   // run() 呼び出し総数
  totalMs:         number;   // 累積処理時間
  avgMs:           number;   // 平均処理時間
  lastInputVector: number[]; // 直近入力ベクトル
  lastRunAt:       number;   // Unix timestamp
  seed:      SeedLayerState;
  metabolism:MetabolismLayerState;
  selection: SelectionLayerState;
}

/** ダッシュボード全体状態 */
export interface DashboardState {
  engineMetrics:  EngineMetrics;
  historyWindow:  MetricsSnapshot[]; // 直近N件の履歴
  isRunning:      boolean;
  connectedAt:    number;
}

/** 履歴スナップショット（グラフ描画用） */
export interface MetricsSnapshot {
  timestamp:   number;
  fitness:     number;
  energy:      number;
  survivors:   number;
  complexity:  number;
  dualBalance: number;
  elapsedMs:   number;
}

// ============================================================
// IPC チャンネル定数
// ============================================================

export const DASHBOARD_IPC = {
  OPEN:          'dashboard:open',
  CLOSE:         'dashboard:close',
  STATE_UPDATE:  'dashboard:state-update',
  RUN_ENGINE:    'dashboard:run-engine',
  RESET_METRICS: 'dashboard:reset-metrics',
  READY:         'dashboard:ready',
  CLOSED:        'dashboard:closed',
} as const;

// ============================================================
// デフォルト値
// ============================================================

export const DEFAULT_LAYER_STATE = {
  seed: (): SeedLayerState => ({
    callCount:0, lastInputDim:0, lastTargetDim:0, lastExpDepth:0,
    lastExtensions:0, fixedPoints:0, zeroBalance:0, cacheHitRate:0, activeMs:0,
  }),
  metabolism: (): MetabolismLayerState => ({
    callCount:0, synthCount:0, reduceCount:0, lastComplexity:0, lastDepth:0,
    dualBalance:0, lastEnergy:0, piExtCount:0, activeMs:0,
  }),
  selection: (): SelectionLayerState => ({
    callCount:0, totalCandidates:0, survivors:0, eliminated:0, mutated:0,
    lastGenCount:0, avgFitness:0, survivalRate:0, activeMs:0,
  }),
};

export function defaultEngineMetrics(): EngineMetrics {
  return {
    runCount:0, totalMs:0, avgMs:0,
    lastInputVector:[], lastRunAt:0,
    seed:       DEFAULT_LAYER_STATE.seed(),
    metabolism: DEFAULT_LAYER_STATE.metabolism(),
    selection:  DEFAULT_LAYER_STATE.selection(),
  };
}
