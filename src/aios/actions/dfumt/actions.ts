/**
 * D-FUMT Actions — アクション定義
 * Rei-AIOS AIアシスタントがD-FUMTエンジンを呼び出すための
 * ファンクションコーリング互換アクション定義。
 *
 * OpenAI / Anthropic / Gemini 各LLMのtool-use形式に対応。
 */

// ============================================================
// 型定義
// ============================================================

/** LLM互換パラメータスキーマ */
export interface ParameterSchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: (string | number)[];
  items?: ParameterSchema;
  properties?: Record<string, ParameterSchema>;
  required?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

/** アクション定義 */
export interface DFUMTActionDef {
  name: string;
  description: string;
  category: 'seed' | 'metabolism' | 'selection' | 'engine' | 'verify';
  parameters: Record<string, ParameterSchema>;
  required: string[];
  examples: Array<{ input: Record<string, unknown>; description: string }>;
}

/** OpenAI tool形式 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ParameterSchema>;
      required: string[];
    };
  };
}

/** Anthropic tool形式 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, ParameterSchema>;
    required: string[];
  };
}

// ============================================================
// アクション定義一覧
// ============================================================

export const DFUMT_ACTIONS: DFUMTActionDef[] = [

  // --- Seed (種) アクション ---

  {
    name: 'dfumt_seed_extend',
    description:
      'D-FUMT種層: 数値をゼロ拡張します。単一の値から⊕⊖双方向への拡張値列を生成します。' +
      '0を入力すると宇宙の初期状態（ゼロ拡張）を模倣します。',
    category: 'seed',
    parameters: {
      origin: {
        type: 'number',
        description: '拡張元の数値。0を指定するとD-FUMT零拡張が適用されます。',
        default: 0,
      },
      depth: {
        type: 'integer',
        description: '拡張深度。深いほど多くの値列が生成されます。',
        minimum: 1,
        maximum: 32,
        default: 3,
      },
    },
    required: ['origin'],
    examples: [
      { input: { origin: 0, depth: 3 }, description: 'ゼロからの3階層拡張' },
      { input: { origin: 1.618, depth: 2 }, description: 'φ(黄金比)の2階層拡張' },
    ],
  },

  {
    name: 'dfumt_seed_contract',
    description:
      'D-FUMT種層: 値列をゼロ縮小します。複数の値を1つの値に縮退させ、' +
      '情報損失率(lossRatio)を返します。双対ペア(⊕⊖)は相殺消滅します。',
    category: 'seed',
    parameters: {
      values: {
        type: 'array',
        description: '縮小する数値の配列',
        items: { type: 'number', description: '数値要素' },
      },
      mode: {
        type: 'string',
        description: '縮小モード: "minloss"=最小損失縮小, "dual"=双対消去縮小',
        enum: ['minloss', 'dual'],
        default: 'dual',
      },
    },
    required: ['values'],
    examples: [
      { input: { values: [1, -1, 2, -2, 0.5], mode: 'dual' }, description: '双対消去による縮小' },
    ],
  },

  {
    name: 'dfumt_seed_map',
    description:
      'D-FUMT種層: 次元写像を実行します。入力ベクトルを指定次元に昇格または降格します。' +
      'D-FUMT固有写像(π拡張+φ螺旋)、線形写像、フーリエ写像から選択できます。',
    category: 'seed',
    parameters: {
      vector: {
        type: 'array',
        description: '入力ベクトル（数値の配列）',
        items: { type: 'number', description: 'ベクトル要素' },
      },
      target_dim: {
        type: 'integer',
        description: '写像先の次元数',
        minimum: 1,
        maximum: 256,
      },
      mapping_type: {
        type: 'string',
        description: '写像タイプ: "dfumt"=D-FUMT固有, "linear"=線形, "fourier"=フーリエ',
        enum: ['dfumt', 'linear', 'fourier'],
        default: 'dfumt',
      },
    },
    required: ['vector', 'target_dim'],
    examples: [
      { input: { vector: [1, 2, 3], target_dim: 6, mapping_type: 'dfumt' }, description: '3D→6D D-FUMT写像' },
      { input: { vector: [1, 2, 3, 4], target_dim: 2, mapping_type: 'linear' }, description: '4D→2D 降格写像' },
    ],
  },

  // --- Metabolism (代謝) アクション ---

  {
    name: 'dfumt_metabolism_synthesize',
    description:
      'D-FUMT代謝層: 2つの数値または公式を合成します。' +
      'dual(双対)モードではD-FUMT⊕⊖合成、compose(関数合成)では f∘g を生成します。' +
      '合成結果の複雑度・深さ・エネルギーを返します。',
    category: 'metabolism',
    parameters: {
      value_a: {
        type: 'number',
        description: '合成元の値A',
      },
      value_b: {
        type: 'number',
        description: '合成元の値B',
      },
      mode: {
        type: 'string',
        description: '合成モード: "dual"=双対合成, "add"=加算, "mul"=乗算, "compose"=関数合成',
        enum: ['dual', 'add', 'mul', 'compose'],
        default: 'dual',
      },
    },
    required: ['value_a', 'value_b'],
    examples: [
      { input: { value_a: 1.618, value_b: 3.14159, mode: 'dual' }, description: 'φとπの双対合成' },
      { input: { value_a: 2, value_b: 3, mode: 'mul' }, description: '積合成' },
    ],
  },

  {
    name: 'dfumt_metabolism_reduce',
    description:
      'D-FUMT代謝層: 公式を変換規則で繰り返し簡約します。' +
      '定数畳み込み・ゼロ除去・双対消去・φ恒等式などを適用し、' +
      '最小形(不動点)まで変換します。変換ステップ数と総変化量を返します。',
    category: 'metabolism',
    parameters: {
      value: {
        type: 'number',
        description: '簡約する数値',
      },
      max_steps: {
        type: 'integer',
        description: '最大変換ステップ数',
        minimum: 1,
        maximum: 1000,
        default: 100,
      },
    },
    required: ['value'],
    examples: [
      { input: { value: Math.pow(1.618, 2), max_steps: 50 }, description: 'φ^2をφ+1に簡約' },
    ],
  },

  {
    name: 'dfumt_metabolism_phi_spiral',
    description:
      'D-FUMT代謝層: 値にφ(黄金比)螺旋合成を適用します。' +
      '指定ターン数だけφのべき乗を積み重ね、螺旋的に拡張した公式を生成します。',
    category: 'metabolism',
    parameters: {
      value: {
        type: 'number',
        description: '螺旋合成の基底値',
      },
      turns: {
        type: 'integer',
        description: '螺旋ターン数 (1〜12)',
        minimum: 1,
        maximum: 12,
        default: 3,
      },
    },
    required: ['value'],
    examples: [
      { input: { value: 1, turns: 5 }, description: '1からの5ターンφ螺旋' },
    ],
  },

  // --- Selection (選択) アクション ---

  {
    name: 'dfumt_selection_evaluate',
    description:
      'D-FUMT選択層: 数値・公式の適応度を評価します。' +
      '適応度・単純性・エネルギー効率・双対バランスを採点し、' +
      '"survive/eliminate/mutate/suspend" の4種判定を返します。',
    category: 'selection',
    parameters: {
      value: {
        type: 'number',
        description: '評価する数値',
      },
      generation: {
        type: 'integer',
        description: '世代番号（0始まり）',
        minimum: 0,
        default: 0,
      },
    },
    required: ['value'],
    examples: [
      { input: { value: 1.618, generation: 0 }, description: 'φ値の適応度評価' },
      { input: { value: 0, generation: 1 }, description: 'ゼロの評価' },
    ],
  },

  {
    name: 'dfumt_selection_evolve',
    description:
      'D-FUMT選択層: 値集団を多世代進化させます。' +
      '各世代で淘汰・突然変異を繰り返し、最終生存者と適応度推移を返します。',
    category: 'selection',
    parameters: {
      values: {
        type: 'array',
        description: '初期集団の数値配列',
        items: { type: 'number', description: '個体値' },
      },
      generations: {
        type: 'integer',
        description: '進化世代数',
        minimum: 1,
        maximum: 50,
        default: 5,
      },
    },
    required: ['values'],
    examples: [
      { input: { values: [0, 1, 1.618, 2.718, 3.14159], generations: 5 }, description: 'D-FUMT定数集団の5世代進化' },
    ],
  },

  // --- Engine (統合) アクション ---

  {
    name: 'dfumt_engine_run',
    description:
      'D-FUMTエンジンをフルパイプラインで実行します。' +
      '種(Seed)→代謝(Metabolism)→選択(Selection)の3層を一括実行し、' +
      '総合結果サマリーを返します。D-FUMT理論の包括的分析に使用します。',
    category: 'engine',
    parameters: {
      input_vector: {
        type: 'array',
        description: '入力ベクトル（数値の配列）',
        items: { type: 'number', description: 'ベクトル要素' },
      },
      expansion_depth: {
        type: 'integer',
        description: '種拡張深度',
        minimum: 1,
        maximum: 16,
        default: 3,
      },
      evolution_generations: {
        type: 'integer',
        description: '進化世代数',
        minimum: 1,
        maximum: 20,
        default: 5,
      },
      synthesis_mode: {
        type: 'string',
        description: '合成モード',
        enum: ['dual', 'add', 'mul', 'compose'],
        default: 'dual',
      },
    },
    required: ['input_vector'],
    examples: [
      {
        input: { input_vector: [0, 1, 1.618, 3.14159], expansion_depth: 3, evolution_generations: 5 },
        description: 'D-FUMT定数ベクトルのフル分析',
      },
    ],
  },

  // --- Verify (検証) アクション ---

  {
    name: 'dfumt_verify',
    description:
      'D-FUMT公理系との整合性を検証します。' +
      'ゼロ不変・双対性・φ整合・π拡張・有限性の5公理に対するコンプライアンスと' +
      '数学的整合性（循環参照・ゼロ除算・無限大）を同時チェックします。',
    category: 'verify',
    parameters: {
      value: {
        type: 'number',
        description: '検証する数値',
      },
    },
    required: ['value'],
    examples: [
      { input: { value: 1.618033988 }, description: 'φ値の公理整合性検証' },
      { input: { value: Infinity }, description: '無限大の検証（失敗ケース）' },
    ],
  },
];

// ============================================================
// フォーマット変換ユーティリティ
// ============================================================

/** OpenAI tool形式に変換 */
export function toOpenAITools(actions: DFUMTActionDef[] = DFUMT_ACTIONS): OpenAITool[] {
  return actions.map(a => ({
    type: 'function' as const,
    function: {
      name: a.name,
      description: a.description,
      parameters: {
        type: 'object' as const,
        properties: a.parameters,
        required: a.required,
      },
    },
  }));
}

/** Anthropic tool形式に変換 */
export function toAnthropicTools(actions: DFUMTActionDef[] = DFUMT_ACTIONS): AnthropicTool[] {
  return actions.map(a => ({
    name: a.name,
    description: a.description,
    input_schema: {
      type: 'object' as const,
      properties: a.parameters,
      required: a.required,
    },
  }));
}

/** カテゴリでフィルタ */
export function getActionsByCategory(
  category: DFUMTActionDef['category'],
  actions: DFUMTActionDef[] = DFUMT_ACTIONS,
): DFUMTActionDef[] {
  return actions.filter(a => a.category === category);
}

/** 名前でアクション取得 */
export function getAction(name: string): DFUMTActionDef | undefined {
  return DFUMT_ACTIONS.find(a => a.name === name);
}
