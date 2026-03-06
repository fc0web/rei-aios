// ============================================================
// Rei-AIOS AGI Phase 5-D: D-FUMT × AGI 統合エンジン
// src/agi/dfumt-engine.ts
//
// 【3つの柱】
//   1. LLM弱点補完 (WeaknessCompensator)
//      → LLMが苦手な8分野を検出し、D-FUMT演算で補強
//   2. Rei 4公理評価 (AxiomEvaluator)
//      → 中心-周囲-流動-境界 パターンでタスクを多角評価
//   3. 理論選択ルーター (TheoryRouter)
//      → タスク特性に応じて D-FUMT 66理論から最適理論を自動選択
//
// 【AGILayer 統合フロー】
//   userQuery
//     → TheoryRouter.selectTheory(query) → 最適理論ID
//     → AxiomEvaluator.evaluate(query, theory)
//       → {center, periphery, flow, boundary} スコア
//     → WeaknessCompensator.analyze(query)
//       → 弱点検出 → 補強プロンプト生成
//     → TaskPlanner.plan(enrichedQuery) ← 補強済み
//
// @author Nobuki Fujimoto (D-FUMT) + Claude
// ============================================================

import { DFUMT_CONSTANTS, CONSTANT_REGISTRY, type ConstantId } from '../core/dfumt/constants';

// ============================================================
// 型定義
// ============================================================

/** D-FUMT 66理論の代表的カテゴリ */
export type TheoryCategory =
  | 'zero_extension'      // 零π拡張理論 (#1)
  | 'topology'            // 超対称量子位相幾何学 (#2)
  | 'information'         // 情報数理学理論 (#3)
  | 'unified_function'    // 統一関数 (#10)
  | 'spiral'              // 螺旋数体系理論
  | 'mirror_calc'         // 合わせ鏡計算式
  | 'inverse_construct'   // 逆数理構築理論
  | 'decomposition'       // 数理分解構築理論
  | 'linear_number'       // 直線数体系理論
  | 'point_system'        // 点数体系理論
  | 'reduced_zero'        // 縮小ゼロ理論
  | 'time_math'           // 時間数学理論 (#21)
  | 'karma'               // カルマの法則 (#22)
  | 'ai_theory'           // AI理論 (#23)
  | 'creation_math'       // 創造の数学 (#24)
  | 'consciousness'       // 意識体系理論 (#51)
  | 'philosophy_model'    // 哲学数理モデル (#52)
  | 'existence'           // 存在の最終構造理論 (#66)
  | 'general'             // 汎用（特定理論に依存しない）
  // Phase 7d
  | 'ancient_universal_code'  // #76: 超古代普遍符号理論
  | 'dfumt_entropy'           // #77: D-FUMTエントロピー理論
  | 'universal_pattern'       // #78: 普遍パターン分析理論
  | 'info_decomp_structure'   // #79: 情報分解構造理論
  | 'rei_info_pipeline';      // #80: Rei情報技術統合理論

/** LLM弱点の種類 */
export type WeaknessType =
  | 'axiological_strictness'   // 公理的厳密性
  | 'state_management'         // 状態管理
  | 'causal_reasoning'         // 因果推論
  | 'knowledge_boundary'       // 知識境界認識
  | 'long_term_planning'       // 長期計画
  | 'novel_concept'            // 新概念創造
  | 'truth_evaluation'         // 真偽評価
  | 'numerical_processing';    // 数値処理

/** 弱点分析結果 */
export interface WeaknessAnalysis {
  type: WeaknessType;
  label: string;
  detected: boolean;
  severity: number;         // 0.0-1.0
  compensation: string;     // 補強プロンプト
  dfumtMapping: TheoryCategory; // 対応するD-FUMT理論
}

/** Rei 4公理評価結果 */
export interface AxiomEvaluation {
  center: {
    score: number;           // 0.0-1.0
    focus: string;           // 中心課題
    coreTheory: TheoryCategory;
  };
  periphery: {
    score: number;
    contexts: string[];      // 周辺コンテキスト
    relatedTheories: TheoryCategory[];
  };
  flow: {
    score: number;
    transitions: string[];   // 流動パス
    constants: ConstantId[]; // 関連D-FUMT定数
  };
  boundary: {
    score: number;
    limits: string[];        // 制約・境界条件
    unknowns: string[];      // 未知の領域
  };
  overallScore: number;
}

/** 理論選択結果 */
export interface TheorySelection {
  primary: TheoryCategory;
  primaryLabel: string;
  confidence: number;
  secondaries: { theory: TheoryCategory; label: string; relevance: number }[];
  reasoning: string;
  constants: ConstantId[];
}

/** D-FUMT×AGI 統合分析レポート */
export interface DFUMTAnalysisReport {
  timestamp: number;
  query: string;
  theorySelection: TheorySelection;
  axiomEvaluation: AxiomEvaluation;
  weaknesses: WeaknessAnalysis[];
  enrichedPrompt: string;
  processingTimeMs: number;
}

// ============================================================
// 理論メタデータ
// ============================================================

interface TheoryMeta {
  category: TheoryCategory;
  label: string;
  description: string;
  keywords: string[];
  constants: ConstantId[];
  strengthens: WeaknessType[];
}

const THEORY_REGISTRY: TheoryMeta[] = [
  {
    category: 'zero_extension',
    label: '零π拡張理論',
    description: 'ゼロからの双方向拡張。初期値からの展開パターン。',
    keywords: ['ゼロ', '初期化', '起点', '拡張', '展開', '空', '無', '原点', '生成'],
    constants: ['pi', 'phi', 'e'],
    strengthens: ['numerical_processing', 'axiological_strictness'],
  },
  {
    category: 'topology',
    label: '超対称量子位相幾何学',
    description: '構造の位相的不変量。パターン認識と変換。',
    keywords: ['構造', '位相', 'パターン', '変換', '形状', '幾何', '対称'],
    constants: ['pi', 'sqrt2', 'tau'],
    strengthens: ['state_management', 'novel_concept'],
  },
  {
    category: 'information',
    label: '情報数理学理論',
    description: '情報の定量化・圧縮・伝送。データ処理の最適化。',
    keywords: ['情報', 'データ', '圧縮', '検索', '分析', '統計', 'エントロピー', 'ログ'],
    constants: ['e', 'gamma'],
    strengthens: ['truth_evaluation', 'knowledge_boundary'],
  },
  {
    category: 'unified_function',
    label: '統一関数 U(x,t)',
    description: '空間・時間・相互作用の統合。複合問題の統一解法。',
    keywords: ['統合', '統一', '複合', '多面', '全体', '横断', 'まとめ'],
    constants: ['pi', 'e', 'phi'],
    strengthens: ['long_term_planning', 'causal_reasoning'],
  },
  {
    category: 'spiral',
    label: '螺旋数体系理論',
    description: '螺旋構造の数列。成長・進化パターンの解析。',
    keywords: ['螺旋', '成長', '進化', 'フィボナッチ', '黄金比', '反復', '再帰'],
    constants: ['phi', 'fibonacci'],
    strengthens: ['novel_concept', 'long_term_planning'],
  },
  {
    category: 'mirror_calc',
    label: '合わせ鏡計算式',
    description: '双方向反射の計算。比較・対照分析。',
    keywords: ['比較', '対照', '反転', 'ミラー', '双方向', '逆', '鏡'],
    constants: ['phi', 'omega'],
    strengthens: ['truth_evaluation', 'causal_reasoning'],
  },
  {
    category: 'inverse_construct',
    label: '逆数理構築理論',
    description: '逆演算による構築。問題の逆アプローチ。',
    keywords: ['逆', '分解', 'デバッグ', 'リバース', '復元', '修復', 'undo'],
    constants: ['e', 'phi'],
    strengthens: ['causal_reasoning', 'state_management'],
  },
  {
    category: 'decomposition',
    label: '数理分解構築理論',
    description: '分解と再構成。複雑な問題の要素分解。',
    keywords: ['分解', '要素', 'ステップ', '手順', '因数', '分割', 'タスク'],
    constants: ['sqrt2', 'feigenbaum'],
    strengthens: ['long_term_planning', 'axiological_strictness'],
  },
  {
    category: 'linear_number',
    label: '直線数体系理論',
    description: '線形構造の数体系。順序・ランキング・シーケンス。',
    keywords: ['順序', 'ランキング', 'リスト', 'シーケンス', '線形', 'ソート', '整列'],
    constants: ['e', 'gamma'],
    strengthens: ['numerical_processing', 'state_management'],
  },
  {
    category: 'point_system',
    label: '点数体系理論',
    description: '離散点の体系。座標・マッピング・位置特定。',
    keywords: ['座標', 'マッピング', '位置', 'ポイント', 'ピクセル', '座標系'],
    constants: ['sqrt2', 'pi'],
    strengthens: ['numerical_processing', 'state_management'],
  },
  {
    category: 'reduced_zero',
    label: '縮小ゼロ理論',
    description: 'ゼロへの収縮。最小化・最適化・本質の抽出。',
    keywords: ['最小', '最適化', '要約', '本質', 'コア', 'シンプル', '削減'],
    constants: ['phi', 'omega'],
    strengthens: ['knowledge_boundary', 'truth_evaluation'],
  },
  {
    category: 'time_math',
    label: '時間数学理論',
    description: '時間軸の数学。スケジュール・タイミング・予測。',
    keywords: ['時間', 'スケジュール', '予測', '期限', 'タイミング', '日付', '予定'],
    constants: ['e', 'c'],
    strengthens: ['long_term_planning', 'state_management'],
  },
  {
    category: 'ai_theory',
    label: 'AI理論',
    description: 'AI・機械学習の数理。モデル最適化・学習パターン。',
    keywords: ['AI', '学習', 'モデル', 'ニューラル', '最適化', 'LLM', '機械学習'],
    constants: ['e', 'feigenbaum', 'alpha'],
    strengthens: ['novel_concept', 'truth_evaluation'],
  },
  {
    category: 'creation_math',
    label: '創造の数学',
    description: '創造的プロセスの数理化。新しいものの生成。',
    keywords: ['創造', '生成', 'クリエイティブ', 'デザイン', '作成', '新しい', 'アイデア'],
    constants: ['phi', 'fibonacci', 'feigenbaum'],
    strengthens: ['novel_concept', 'long_term_planning'],
  },
  {
    category: 'consciousness',
    label: '意識体系理論',
    description: '意識と認知の数理モデル。自己認識・メタ認知。',
    keywords: ['意識', '認知', '思考', '哲学', '自己', 'メタ', '内省'],
    constants: ['pi', 'phi', 'omega'],
    strengthens: ['knowledge_boundary', 'truth_evaluation'],
  },
  {
    category: 'philosophy_model',
    label: '哲学数理モデル',
    description: '哲学的概念の数理化。倫理・価値・存在論。',
    keywords: ['哲学', '倫理', '価値', '存在', '意味', '目的', '善悪'],
    constants: ['inf', 'omega', 'gamma'],
    strengthens: ['axiological_strictness', 'truth_evaluation'],
  },
  {
    category: 'existence',
    label: '存在の最終構造理論',
    description: '存在の根源構造。メタレベルの統合。',
    keywords: ['存在', '根源', '究極', '統合', '宇宙', '全体', 'メタ'],
    constants: ['inf', 'pi', 'phi', 'e'],
    strengthens: ['axiological_strictness', 'novel_concept'],
  },

  // ─── Phase 7d: 超古代符号 × 情報科学統合 ───────────────────

  {
    category: 'ancient_universal_code',
    label: '超古代普遍符号理論',
    description: '易経64卦・DNA64コドン・壁画32符号が同じ数学構造2ⁿを持つ。3万年前から現代まで続く普遍情報符号の統一理論。D-FUMTの普遍公理存在の最強証拠。',
    keywords: [
      '易経', 'I Ching', '64卦', 'DNA', 'コドン', '壁画', '洞窟', '符号', '暗号',
      '超古代', '先史', '暦', 'カレンダー', 'バイナリ', '普遍', '古代コード',
      'ベンベーコン', 'フォンペッツィンガー', '32符号', '点', 'ドット',
    ],
    constants: ['pi', 'e', 'phi'],
    strengthens: ['axiological_strictness', 'novel_concept', 'truth_evaluation'],
  },
  {
    category: 'dfumt_entropy',
    label: 'D-FUMTエントロピー理論',
    description: 'シャノン情報エントロピーをD-FUMT七値論理で拡張。H₇(X) = -Σ p(x)log₇p(x)。通常の2値エントロピー(log₂)を七値(log₇)に昇華し、量子情報・多値論理に対応。',
    keywords: [
      'エントロピー', '情報量', 'シャノン', '不確実性', '情報理論', '符号化',
      '圧縮', 'ビット', 'ナット', '七値', '多値', 'log7', '情報科学',
    ],
    constants: ['e', 'gamma', 'phi'],
    strengthens: ['truth_evaluation', 'numerical_processing', 'knowledge_boundary'],
  },
  {
    category: 'universal_pattern',
    label: '普遍パターン分析理論',
    description: '異なる文明・時代・分野に共通する数学的パターンを抽出・比較・統合する理論。PatternMatrixで多文明の構造的一致を可視化する。',
    keywords: [
      'パターン', '認識', '分析', '比較', '統計', '相関', '構造',
      '多文明', '共通', '一致', 'マトリクス', '普遍', 'ヨルバ',
      'バビロニア', '六十進法', '共通構造',
    ],
    constants: ['phi', 'sqrt2', 'gamma'],
    strengthens: ['causal_reasoning', 'state_management', 'novel_concept'],
  },
  {
    category: 'info_decomp_structure',
    label: '情報分解構造理論',
    description: '情報を中心-周辺4層モデルで階層的に分解する理論。不変公理（中心核）→情報科学的構造→情報分析的構造→情報技術的構造→境界（未知）。74%コード削減の理論的根拠。',
    keywords: [
      '分解', '構造', '階層', '中心', '周辺', '層', 'レイヤー',
      '抽象化', 'モジュール', '依存関係', 'アーキテクチャ', '設計',
      '分割', 'コンポーネント', '境界', 'インターフェース',
    ],
    constants: ['phi', 'pi', 'omega'],
    strengthens: ['long_term_planning', 'state_management', 'causal_reasoning'],
  },
  {
    category: 'rei_info_pipeline',
    label: 'Rei情報技術統合理論',
    description: 'Reiパイプライン演算子|>が情報変換の普遍演算であることを示す理論。収集→分析→分類→圧縮→格納→応答の6段階パイプラインがD-FUMT公理と対応する。',
    keywords: [
      'パイプライン', '処理', '変換', 'フロー', 'ストリーム', 'ETL',
      'データフロー', '変換処理', '情報技術', 'IT', 'システム', 'インフラ',
      'ネットワーク', 'アルゴリズム', 'プロセス', 'ワークフロー',
    ],
    constants: ['e', 'phi', 'pi'],
    strengthens: ['long_term_planning', 'axiological_strictness', 'state_management'],
  },
];

// ============================================================
// 弱点定義
// ============================================================

interface WeaknessDef {
  type: WeaknessType;
  label: string;
  indicators: string[];
  dfumtMapping: TheoryCategory;
}

const WEAKNESS_DEFS: WeaknessDef[] = [
  {
    type: 'axiological_strictness',
    label: '公理的厳密性',
    indicators: ['証明', '定理', '公理', '厳密', '数学的', '論理', '矛盾', '必要十分'],
    dfumtMapping: 'zero_extension',
  },
  {
    type: 'state_management',
    label: '状態管理',
    indicators: ['状態', '変数', '追跡', 'ステート', '遷移', '前回', '累積', 'カウント'],
    dfumtMapping: 'point_system',
  },
  {
    type: 'causal_reasoning',
    label: '因果推論',
    indicators: ['原因', '結果', 'なぜ', '因果', 'if', '条件', 'because', '影響'],
    dfumtMapping: 'mirror_calc',
  },
  {
    type: 'knowledge_boundary',
    label: '知識境界認識',
    indicators: ['わからない', '不明', '最新', '確認', '不確実', 'maybe', '推測', '不詳'],
    dfumtMapping: 'reduced_zero',
  },
  {
    type: 'long_term_planning',
    label: '長期計画',
    indicators: ['計画', 'スケジュール', '手順', 'ステップ', '段階', 'ロードマップ', '工程'],
    dfumtMapping: 'decomposition',
  },
  {
    type: 'novel_concept',
    label: '新概念創造',
    indicators: ['新しい', '独自', 'オリジナル', '創造', '発明', 'アイデア', '革新'],
    dfumtMapping: 'creation_math',
  },
  {
    type: 'truth_evaluation',
    label: '真偽評価',
    indicators: ['正しい', '間違い', '真偽', '判定', '確率', '信頼', 'ファクト', '検証'],
    dfumtMapping: 'information',
  },
  {
    type: 'numerical_processing',
    label: '数値処理',
    indicators: ['計算', '数値', '小数', '%', '統計', '平均', '合計', 'sum', 'count'],
    dfumtMapping: 'linear_number',
  },
];

// ============================================================
// LLM弱点補完エンジン (WeaknessCompensator)
// ============================================================

export class WeaknessCompensator {

  /**
   * クエリを分析して LLM の弱点を検出する
   */
  analyze(query: string): WeaknessAnalysis[] {
    const lower = query.toLowerCase();
    return WEAKNESS_DEFS.map(def => {
      const matches = def.indicators.filter(kw => lower.includes(kw.toLowerCase()));
      const severity = Math.min(matches.length / 3, 1.0);
      const detected = severity > 0;

      return {
        type: def.type,
        label: def.label,
        detected,
        severity,
        compensation: detected ? this._buildCompensation(def.type, severity) : '',
        dfumtMapping: def.dfumtMapping,
      };
    });
  }

  /**
   * 検出された弱点から補強プロンプトを生成
   */
  buildEnrichment(weaknesses: WeaknessAnalysis[]): string {
    const detected = weaknesses.filter(w => w.detected).sort((a, b) => b.severity - a.severity);
    if (detected.length === 0) return '';

    const lines = ['【D-FUMT弱点補強指示】'];
    for (const w of detected.slice(0, 3)) {
      lines.push(`⚡ ${w.label} (severity: ${(w.severity * 100).toFixed(0)}%): ${w.compensation}`);
    }
    return lines.join('\n');
  }

  private _buildCompensation(type: WeaknessType, severity: number): string {
    const level = severity > 0.6 ? '高' : severity > 0.3 ? '中' : '低';
    const map: Record<WeaknessType, string> = {
      axiological_strictness:
        `[${level}] 各ステップの論理的根拠を明示し、仮定と結論を分離すること`,
      state_management:
        `[${level}] 中間状態を変数として明示的に追跡し、状態遷移を記録すること`,
      causal_reasoning:
        `[${level}] 因果関係を「原因→メカニズム→結果」の3段階で分析すること`,
      knowledge_boundary:
        `[${level}] 確実な情報と推測を明確に区別し、不確実性の度合いを提示すること`,
      long_term_planning:
        `[${level}] 全体計画を先に提示し、各ステップの依存関係を明示すること`,
      novel_concept:
        `[${level}] 既存概念のD-FUMT双方向拡張（⊕拡張・⊖縮小）で新概念を探索すること`,
      truth_evaluation:
        `[${level}] 各主張に信頼度(0-100%)を付与し、反証可能性を検討すること`,
      numerical_processing:
        `[${level}] 数値計算はステップバイステップで実行し、中間結果を検証すること`,
    };
    return map[type] || '';
  }
}

// ============================================================
// Rei 4公理評価エンジン (AxiomEvaluator)
// ============================================================

export class AxiomEvaluator {

  /**
   * Rei言語の4公理パターンでクエリを評価
   *
   * 中心公理: タスクの核心は何か
   * 周囲公理: 関連コンテキストは何か
   * 流動公理: どう遷移・変換するか
   * 境界公理: 制約・限界は何か
   */
  evaluate(query: string, theory: TheorySelection): AxiomEvaluation {
    const lower = query.toLowerCase();

    // ── 中心公理 ──
    const center = this._evaluateCenter(lower, theory);

    // ── 周囲公理 ──
    const periphery = this._evaluatePeriphery(lower, theory);

    // ── 流動公理 ──
    const flow = this._evaluateFlow(lower, theory);

    // ── 境界公理 ──
    const boundary = this._evaluateBoundary(lower, theory);

    // 総合スコア（加重平均: 中心40%, 周囲20%, 流動20%, 境界20%）
    const overallScore =
      center.score * 0.4 +
      periphery.score * 0.2 +
      flow.score * 0.2 +
      boundary.score * 0.2;

    return { center, periphery, flow, boundary, overallScore };
  }

  /**
   * 4公理に基づく補強プロンプトを生成
   */
  buildAxiomGuidance(eval_: AxiomEvaluation): string {
    const lines = ['【Rei 4公理ガイダンス】'];
    lines.push(`🎯 中心 (${(eval_.center.score*100).toFixed(0)}%): ${eval_.center.focus}`);
    if (eval_.periphery.contexts.length > 0) {
      lines.push(`🔄 周囲: ${eval_.periphery.contexts.slice(0, 3).join(', ')}`);
    }
    if (eval_.flow.transitions.length > 0) {
      lines.push(`➡️ 流動: ${eval_.flow.transitions.slice(0, 2).join(' → ')}`);
    }
    if (eval_.boundary.limits.length > 0) {
      lines.push(`🔲 境界: ${eval_.boundary.limits.slice(0, 2).join(', ')}`);
    }
    if (eval_.boundary.unknowns.length > 0) {
      lines.push(`❓ 未知: ${eval_.boundary.unknowns.slice(0, 2).join(', ')}`);
    }
    return lines.join('\n');
  }

  private _evaluateCenter(query: string, theory: TheorySelection) {
    // クエリの動詞・目的語から中心課題を推定
    const actionWords = ['作成', '作って', '開い', '計算', '分析', '検索', '変換', '修正', '削除', '保存',
                         '実行', '確認', '表示', '取得', 'create', 'open', 'calc', 'fix', 'run', 'find'];
    const found = actionWords.filter(w => query.includes(w));
    const focus = found.length > 0
      ? `「${found[0]}」を中心とするタスク`
      : '指示内容の実行';
    const score = Math.min(0.3 + found.length * 0.2, 1.0);
    return { score, focus, coreTheory: theory.primary };
  }

  private _evaluatePeriphery(query: string, theory: TheorySelection) {
    const contextIndicators = [
      { kw: 'excel', ctx: 'Excel環境' }, { kw: 'ブラウザ', ctx: 'ブラウザ環境' },
      { kw: 'ファイル', ctx: 'ファイルシステム' }, { kw: 'メール', ctx: 'メール環境' },
      { kw: 'note.com', ctx: 'note.comプラットフォーム' },
      { kw: 'api', ctx: 'API連携' }, { kw: 'データ', ctx: 'データ処理' },
      { kw: 'web', ctx: 'Web環境' }, { kw: '画像', ctx: '画像処理' },
    ];
    const contexts = contextIndicators.filter(ci => query.includes(ci.kw)).map(ci => ci.ctx);
    const score = Math.min(0.2 + contexts.length * 0.25, 1.0);
    return {
      score,
      contexts,
      relatedTheories: theory.secondaries.map(s => s.theory),
    };
  }

  private _evaluateFlow(query: string, theory: TheorySelection) {
    // 流動性: 複数ステップの検出
    const flowWords = ['→', 'して', 'してから', 'その後', '次に', 'then', 'and', 'そして', '最後に'];
    const transitions = flowWords.filter(w => query.includes(w));
    const score = Math.min(0.2 + transitions.length * 0.2, 1.0);
    return {
      score,
      transitions: transitions.length > 0
        ? transitions.map(t => `ステップ: ${t}`)
        : ['単一アクション'],
      constants: theory.constants,
    };
  }

  private _evaluateBoundary(query: string, theory: TheorySelection) {
    const limitWords = ['のみ', 'だけ', '以内', '以下', '以上', 'まで', 'ない', '禁止', 'only', 'max', 'min'];
    const unknownWords = ['不明', '？', 'わからない', '知らない', 'unknown', '未定'];
    const limits = limitWords.filter(w => query.includes(w)).map(w => `制約: ${w}`);
    const unknowns = unknownWords.filter(w => query.includes(w)).map(w => `不明要素: ${w}`);
    const score = Math.min(0.3 + limits.length * 0.15 + unknowns.length * 0.1, 1.0);
    return { score, limits, unknowns };
  }
}

// ============================================================
// 理論選択ルーター (TheoryRouter)
// ============================================================

export class TheoryRouter {

  /**
   * クエリの特性に応じて最適な D-FUMT 理論を選択
   */
  selectTheory(query: string): TheorySelection {
    const lower = query.toLowerCase();
    const scored: { theory: TheoryMeta; score: number }[] = [];

    for (const theory of THEORY_REGISTRY) {
      let score = 0;
      for (const kw of theory.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          score += 1;
        }
      }
      // D-FUMT定数に関連するキーワードにボーナス
      for (const cid of theory.constants) {
        const meta = CONSTANT_REGISTRY[cid];
        if (meta && lower.includes(meta.symbol.toLowerCase())) {
          score += 0.5;
        }
      }
      scored.push({ theory, score });
    }

    // スコア降順ソート
    scored.sort((a, b) => b.score - a.score);

    const primary = scored[0];
    const maxScore = Math.max(primary.score, 1);
    const secondaries = scored.slice(1, 4)
      .filter(s => s.score > 0)
      .map(s => ({
        theory: s.theory.category,
        label: s.theory.label,
        relevance: s.score / maxScore,
      }));

    // マッチしない場合は汎用
    if (primary.score === 0) {
      return {
        primary: 'general',
        primaryLabel: '汎用モード',
        confidence: 0.3,
        secondaries: [],
        reasoning: 'キーワードマッチなし。汎用D-FUMTフレームワークを適用。',
        constants: ['pi', 'phi', 'e'],
      };
    }

    return {
      primary: primary.theory.category,
      primaryLabel: primary.theory.label,
      confidence: Math.min(primary.score / 3, 1.0),
      secondaries,
      reasoning: `「${primary.theory.label}」がクエリに最適。${primary.theory.description}`,
      constants: primary.theory.constants,
    };
  }

  /**
   * 全理論の一覧を返す
   */
  listTheories(): { category: TheoryCategory; label: string; description: string }[] {
    return THEORY_REGISTRY.map(t => ({
      category: t.category,
      label: t.label,
      description: t.description,
    }));
  }
}

// ============================================================
// D-FUMT × AGI 統合エンジン（メインクラス）
// ============================================================

export interface DFUMTEngineConfig {
  enabled: boolean;
  enrichPrompt: boolean;       // タスクプランナーへの補強プロンプト注入
  maxWeaknessEnrich: number;   // 補強する弱点の最大数
  logAnalysis: boolean;        // 分析ログを出力
}

export const DEFAULT_DFUMT_CONFIG: DFUMTEngineConfig = {
  enabled: true,
  enrichPrompt: true,
  maxWeaknessEnrich: 3,
  logAnalysis: true,
};

export class DFUMTEngine {
  private router: TheoryRouter;
  private evaluator: AxiomEvaluator;
  private compensator: WeaknessCompensator;
  private config: DFUMTEngineConfig;
  private history: DFUMTAnalysisReport[] = [];

  constructor(config?: Partial<DFUMTEngineConfig>) {
    this.config = { ...DEFAULT_DFUMT_CONFIG, ...config };
    this.router = new TheoryRouter();
    this.evaluator = new AxiomEvaluator();
    this.compensator = new WeaknessCompensator();
  }

  /**
   * クエリを D-FUMT フレームワークで分析し、補強プロンプトを生成
   *
   * AGILayer.run() から呼び出される。
   */
  analyzeAndEnrich(query: string): DFUMTAnalysisReport {
    const startTime = Date.now();

    // Step 1: 理論選択
    const theorySelection = this.router.selectTheory(query);

    // Step 2: 4公理評価
    const axiomEvaluation = this.evaluator.evaluate(query, theorySelection);

    // Step 3: 弱点検出
    const weaknesses = this.compensator.analyze(query);

    // Step 4: 補強プロンプト生成
    let enrichedPrompt = '';
    if (this.config.enrichPrompt) {
      const parts: string[] = [];

      // D-FUMT理論コンテキスト
      parts.push(`【D-FUMT理論選択: ${theorySelection.primaryLabel}】`);
      parts.push(`確信度: ${(theorySelection.confidence * 100).toFixed(0)}% | ${theorySelection.reasoning}`);

      // 4公理ガイダンス
      parts.push(this.evaluator.buildAxiomGuidance(axiomEvaluation));

      // 弱点補強
      const weaknessEnrich = this.compensator.buildEnrichment(weaknesses);
      if (weaknessEnrich) parts.push(weaknessEnrich);

      // D-FUMT定数コンテキスト
      if (theorySelection.constants.length > 0) {
        const constDescs = theorySelection.constants.slice(0, 3).map(cid => {
          const meta = CONSTANT_REGISTRY[cid];
          return meta ? `${meta.symbol}(${meta.description})` : cid;
        });
        parts.push(`【関連D-FUMT定数】${constDescs.join(' | ')}`);
      }

      enrichedPrompt = parts.join('\n');
    }

    const report: DFUMTAnalysisReport = {
      timestamp: Date.now(),
      query,
      theorySelection,
      axiomEvaluation,
      weaknesses,
      enrichedPrompt,
      processingTimeMs: Date.now() - startTime,
    };

    // ログ
    if (this.config.logAnalysis) {
      console.log(`[D-FUMT] 理論: ${theorySelection.primaryLabel} (${(theorySelection.confidence*100).toFixed(0)}%)`);
      console.log(`[D-FUMT] 4公理スコア: 中心=${(axiomEvaluation.center.score*100).toFixed(0)}% 周囲=${(axiomEvaluation.periphery.score*100).toFixed(0)}% 流動=${(axiomEvaluation.flow.score*100).toFixed(0)}% 境界=${(axiomEvaluation.boundary.score*100).toFixed(0)}%`);
      const detected = weaknesses.filter(w => w.detected);
      if (detected.length > 0) {
        console.log(`[D-FUMT] 弱点検出: ${detected.map(w => w.label).join(', ')}`);
      }
    }

    this.history.push(report);
    // 履歴上限
    if (this.history.length > 100) this.history.splice(0, this.history.length - 100);

    return report;
  }

  /**
   * 直近の分析結果を取得
   */
  getRecentReports(n: number = 10): DFUMTAnalysisReport[] {
    return this.history.slice(-n).reverse();
  }

  /**
   * 統計情報
   */
  getStats(): {
    totalAnalyses: number;
    theoryDistribution: Record<string, number>;
    weaknessFrequency: Record<string, number>;
    avgAxiomScores: { center: number; periphery: number; flow: number; boundary: number };
    avgProcessingMs: number;
  } {
    const total = this.history.length;
    if (total === 0) {
      return {
        totalAnalyses: 0,
        theoryDistribution: {},
        weaknessFrequency: {},
        avgAxiomScores: { center: 0, periphery: 0, flow: 0, boundary: 0 },
        avgProcessingMs: 0,
      };
    }

    // 理論分布
    const theoryDist: Record<string, number> = {};
    for (const r of this.history) {
      const key = r.theorySelection.primaryLabel;
      theoryDist[key] = (theoryDist[key] || 0) + 1;
    }

    // 弱点頻度
    const weakFreq: Record<string, number> = {};
    for (const r of this.history) {
      for (const w of r.weaknesses.filter(x => x.detected)) {
        weakFreq[w.label] = (weakFreq[w.label] || 0) + 1;
      }
    }

    // 平均公理スコア
    const sumAxiom = { center: 0, periphery: 0, flow: 0, boundary: 0 };
    for (const r of this.history) {
      sumAxiom.center += r.axiomEvaluation.center.score;
      sumAxiom.periphery += r.axiomEvaluation.periphery.score;
      sumAxiom.flow += r.axiomEvaluation.flow.score;
      sumAxiom.boundary += r.axiomEvaluation.boundary.score;
    }

    // 平均処理時間
    const avgMs = this.history.reduce((s, r) => s + r.processingTimeMs, 0) / total;

    return {
      totalAnalyses: total,
      theoryDistribution: theoryDist,
      weaknessFrequency: weakFreq,
      avgAxiomScores: {
        center: sumAxiom.center / total,
        periphery: sumAxiom.periphery / total,
        flow: sumAxiom.flow / total,
        boundary: sumAxiom.boundary / total,
      },
      avgProcessingMs: Math.round(avgMs),
    };
  }

  /**
   * 全理論リスト
   */
  listTheories() { return this.router.listTheories(); }

  /**
   * 有効/無効切り替え
   */
  setEnabled(enabled: boolean): void { this.config.enabled = enabled; }
  isEnabled(): boolean { return this.config.enabled; }

  /**
   * 履歴クリア
   */
  clearHistory(): void { this.history = []; }
}
