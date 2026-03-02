/**
 * Rei-AIOS テーマI — 数学知識ネットワーク統合 型定義
 *
 * arXiv・OEIS連携 + 記事の数式シミュレーター
 * 参考: 藤本伸樹 note記事「チャット数式化インタラクティブシミュレーション」
 */

// ============================================================
// arXiv
// ============================================================

export interface ArxivPaper {
  id:        string;   // arXiv ID (例: 2401.12345)
  title:     string;
  summary:   string;
  authors:   string[];
  published: string;   // ISO date string
  updated:   string;
  categories:string[];
  link:      string;
  /** D-FUMTエンジンへの入力ベクトル（タイトル長・著者数・カテゴリ数から生成） */
  dfumtVector: number[];
}

export interface ArxivFetchOptions {
  query:      string;
  maxResults: number;
  category?:  string;   // 例: 'math.GM', 'math.NT', 'cs.AI'
  sortBy?:    'relevance' | 'lastUpdatedDate' | 'submittedDate';
}

export interface ArxivState {
  papers:    ArxivPaper[];
  query:     string;
  fetchedAt: number;
  isLoading: boolean;
  error?:    string;
}

// ============================================================
// OEIS
// ============================================================

export interface OeisSequence {
  id:       string;   // 例: 'A000045'（フィボナッチ）
  name:     string;
  values:   number[];
  formula?: string;
  comment?: string;
  offset:   number;
  /** D-FUMTエンジン用に正規化した先頭10値 */
  dfumtVector: number[];
}

export interface OeisSearchOptions {
  query:     string;
  maxResults:number;
}

export interface OeisState {
  sequences: OeisSequence[];
  query:     string;
  fetchedAt: number;
  isLoading: boolean;
  error?:    string;
}

// ============================================================
// 数式シミュレーター（記事の数式）
// ============================================================

/** 教育価値関数 V(t) のパラメータ */
export interface EducationValueParams {
  V0:    number;   // 初期価値 [0, 100]
  lambda:number;   // 減衰率 λ [0, 1]
  alpha: number;   // 革新係数 α [0, 1]
  /** I(t): 情報流入関数の係数 */
  innovRate: number;
}

/** 収益化困難度指数 D のパラメータ */
export interface MonetizationParams {
  aiCapability:    number;  // AI能力 [0, 1]
  accessibility:   number;  // アクセス性 [0, 1]
  uniqueness:      number;  // 独自性 [0, 1]
  humanValue:      number;  // 人間価値 [0, 1]
}

/** ネットワーク密度パラメータ */
export interface NetworkParams {
  nodes: number;   // |V|: ノード数
  edges: number;   // |E|: エッジ数
}

/** シミュレーション時系列点 */
export interface SimPoint {
  t:          number;
  value:      number;   // V(t)
  difficulty: number;   // D
  entropy:    number;   // H(M)
  networkDensity: number; // D_nw
}

/** シミュレーション全結果 */
export interface SimResult {
  params: {
    education:    EducationValueParams;
    monetization: MonetizationParams;
    network:      NetworkParams;
  };
  timeline:    SimPoint[];   // t=0..20
  currentT:    number;
  summary: {
    peakValue:   number;
    minValue:    number;
    avgDifficulty: number;
    entropy:     number;
    networkDensity: number;
  };
  /** D-FUMTエンジン入力ベクトル（最新シム値から生成） */
  dfumtVector: number[];
}

// ============================================================
// 統合ナレッジ状態
// ============================================================

export interface KnowledgeState {
  arxiv:  ArxivState;
  oeis:   OeisState;
  sim:    SimResult | null;
  /** 直近のD-FUMTエンジン実行結果サマリー */
  lastDfumtSummary: string;
  updatedAt: number;
}

// ============================================================
// IPC チャンネル定数
// ============================================================

export const KNOWLEDGE_IPC = {
  OPEN:           'knowledge:open',
  CLOSE:          'knowledge:close',
  CLOSED:         'knowledge:closed',
  READY:          'knowledge:ready',
  // arXiv
  FETCH_ARXIV:    'knowledge:fetch-arxiv',
  ARXIV_RESULT:   'knowledge:arxiv-result',
  // OEIS
  FETCH_OEIS:     'knowledge:fetch-oeis',
  OEIS_RESULT:    'knowledge:oeis-result',
  // シミュレーター
  RUN_SIM:        'knowledge:run-sim',
  SIM_RESULT:     'knowledge:sim-result',
  // D-FUMTエンジン連携
  RUN_DFUMT:      'knowledge:run-dfumt',
  DFUMT_RESULT:   'knowledge:dfumt-result',
  // 状態全体
  STATE_UPDATE:   'knowledge:state-update',
} as const;

// ============================================================
// デフォルト値
// ============================================================

export const DEFAULT_EDU_PARAMS: EducationValueParams = {
  V0: 100, lambda: 0.3, alpha: 0.5, innovRate: 0.4,
};
export const DEFAULT_MON_PARAMS: MonetizationParams = {
  aiCapability: 0.7, accessibility: 0.8, uniqueness: 0.4, humanValue: 0.6,
};
export const DEFAULT_NET_PARAMS: NetworkParams = {
  nodes: 50, edges: 120,
};
