/**
 * Rei AIOS — Axiom Brancher
 * Rei公理ベース3軸分岐エンジン
 *
 * AI回答を1回取得 → Reiの公理で「構造的に異なる視点」をローカル生成
 * 3軸: 論理的（Logical）/ 実用的（Practical）/ 批判的（Critical）
 *
 * D-FUMT中心-周囲パターン:
 *   中心 = ユーザーの質問
 *   周囲 = AI回答 + 3軸分岐
 */

// ─── 型定義 ──────────────────────────────────────────

export interface BranchResult {
  /** 元のAI回答 */
  original: string;
  /** 3軸分岐 */
  branches: Branch[];
  /** 分岐メタデータ */
  meta: BranchMeta;
}

export interface Branch {
  axis: 'logical' | 'practical' | 'critical';
  label: string;
  content: string;
  confidence: number;   // 0.0 - 1.0
  tags: string[];
}

export interface BranchMeta {
  questionType: QuestionType;
  branchCount: number;
  processingMs: number;
}

export type QuestionType =
  | 'factual'       // 事実確認
  | 'analytical'    // 分析
  | 'creative'      // 創造
  | 'procedural'    // 手順
  | 'opinion'       // 意見
  | 'comparison'    // 比較
  | 'troubleshoot'  // 問題解決
  | 'general';      // 一般

// ─── 質問タイプ判定 ──────────────────────────────────

const QUESTION_PATTERNS: Array<{ type: QuestionType; patterns: RegExp[] }> = [
  {
    type: 'factual',
    patterns: [
      /^(what|who|when|where|何|誰|いつ|どこ)\s/i,
      /(とは|って何|ですか)/,
    ],
  },
  {
    type: 'procedural',
    patterns: [
      /^(how|どう|どのよう)/i,
      /(方法|手順|やり方|作り方|使い方)/,
      /(install|setup|configure|実装|設定)/i,
    ],
  },
  {
    type: 'analytical',
    patterns: [
      /(why|なぜ|原因|理由)/i,
      /(分析|解析|影響|効果)/,
    ],
  },
  {
    type: 'comparison',
    patterns: [
      /(vs|versus|比較|違い|差|どちら)/i,
      /(better|worse|良い|悪い|おすすめ)/i,
    ],
  },
  {
    type: 'creative',
    patterns: [
      /(create|design|作っ|書い|考え|アイデア)/i,
      /(提案|企画|プラン)/,
    ],
  },
  {
    type: 'troubleshoot',
    patterns: [
      /(error|bug|problem|issue|エラー|バグ|問題|動かない|できない)/i,
      /(fix|solve|解決|修正|対処)/i,
    ],
  },
  {
    type: 'opinion',
    patterns: [
      /(think|opinion|べき|思い|どう思)/i,
      /(recommend|suggest|勧め)/i,
    ],
  },
];

function detectQuestionType(question: string): QuestionType {
  for (const { type, patterns } of QUESTION_PATTERNS) {
    if (patterns.some(p => p.test(question))) {
      return type;
    }
  }
  return 'general';
}

// ─── 分岐テンプレート ────────────────────────────────

interface BranchTemplate {
  axis: Branch['axis'];
  label: string;
  prompt: (question: string, answer: string, qType: QuestionType) => string;
  tags: (qType: QuestionType) => string[];
}

const BRANCH_TEMPLATES: BranchTemplate[] = [
  {
    axis: 'logical',
    label: '論理的視点 (Logical)',
    prompt: (q, a, qType) => transformLogical(q, a, qType),
    tags: (qType) => ['logic', 'verification', qType],
  },
  {
    axis: 'practical',
    label: '実用的視点 (Practical)',
    prompt: (q, a, qType) => transformPractical(q, a, qType),
    tags: (qType) => ['practical', 'actionable', qType],
  },
  {
    axis: 'critical',
    label: '批判的視点 (Critical)',
    prompt: (q, a, qType) => transformCritical(q, a, qType),
    tags: (qType) => ['critical', 'risk', qType],
  },
];

// ─── テキスト処理ヘルパー ────────────────────────────

/** 元の回答から文章リストを抽出 */
function extractSentences(text: string): string[] {
  return text
    .split(/[。\.!！？?\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 5);
}

/** コードブロックを抽出 */
function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /```[\s\S]*?```/g;
  let m;
  while ((m = re.exec(text)) !== null) blocks.push(m[0]);
  return blocks;
}

/** コードブロックを除いた文章のみ抽出 */
function extractTextOnly(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '[コードブロック省略]').trim();
}

/**
 * 論理的視点用変換
 * - 構造・因果・前提条件にフォーカス
 * - 感情的表現を除去し、命題形式に変換
 */
function transformLogical(question: string, answer: string, qType: QuestionType): string {
  const sentences = extractSentences(extractTextOnly(answer));
  const codes = extractCodeBlocks(answer);

  // 論理的に重要な文を抽出（原因・条件・結論を含む文を優先）
  const logicalKeywords = /なぜ|原因|理由|ため|から|ので|よって|したがって|条件|前提|結論|つまり|すなわち|because|therefore|thus|since|if|when/i;
  const logicalSentences = sentences.filter(s => logicalKeywords.test(s)).slice(0, 4);
  const otherSentences = sentences.filter(s => !logicalKeywords.test(s)).slice(0, 2);

  const keyContent = [...logicalSentences, ...otherSentences].join('。') + (logicalSentences.length > 0 ? '。' : '');

  const codeNote = codes.length > 0 ? `\n\n【構造的観点からのコード評価】\n${codes[0]}\n→ このコードの前提条件と副作用を確認すること。` : '';

  switch (qType) {
    case 'factual':
      return `【論理検証】\n${keyContent}\n\n▼ 前提の確認\nこの回答が成立する前提条件は何か。前提が崩れた場合、結論はどう変わるか検証が必要。${codeNote}`;
    case 'procedural':
      return `【手順の論理的依存関係】\n${keyContent}\n\n▼ ステップ分析\n各手順の必要十分条件を確認。順序の変更が可能かどうか、スキップできるステップはあるか。${codeNote}`;
    case 'troubleshoot':
      return `【根本原因分析 (RCA)】\n${keyContent}\n\n▼ 因果チェーン\n表面的症状と根本原因を区別すること。提示された解決策は原因を断つか、症状を抑えるだけか。${codeNote}`;
    default:
      return `【論理的構造の分析】\n${keyContent}\n\n▼ 整合性チェック\n主張・根拠・結論の三段論法として成立しているか。隠れた前提や論理の飛躍がないか確認。${codeNote}`;
  }
}

/**
 * 実用的視点用変換
 * - アクションアイテムと手順にフォーカス
 * - 「すぐできること」を抽出
 */
function transformPractical(question: string, answer: string, qType: QuestionType): string {
  const sentences = extractSentences(extractTextOnly(answer));
  const codes = extractCodeBlocks(answer);

  // 実用的な文を抽出（動詞・手順・具体的な数値を含む文）
  const actionKeywords = /する|できる|使|実行|開く|入力|設定|起動|クリック|インストール|実装|確認|run|use|install|open|click|set|execute/i;
  const actionSentences = sentences.filter(s => actionKeywords.test(s)).slice(0, 4);
  const summary = actionSentences.join('。') + (actionSentences.length > 0 ? '。' : sentences.slice(0, 2).join('。') + '。');

  const codeSection = codes.length > 0
    ? `\n\n▼ すぐ使えるコード\n${codes[0]}`
    : '';

  switch (qType) {
    case 'procedural':
      return `【即実践ガイド】\n${summary}\n\n▼ 最小実装パス (MVP)\n1. まず試すべき最小ステップを特定する\n2. よくある失敗パターンを事前に確認する\n3. 成功の確認方法を決めておく${codeSection}`;
    case 'troubleshoot':
      return `【即効解決手順】\n${summary}\n\n▼ 優先度別アクション\n① 今すぐできる一時回避策\n② 恒久的な解決策\n③ 再発防止策${codeSection}`;
    case 'creative':
      return `【72時間実現プラン】\n${summary}\n\n▼ 最小実現ステップ\n1日目: 最小構成で動くものを作る\n2日目: 主要機能を追加する\n3日目: テストと改善${codeSection}`;
    default:
      return `【実践への落とし込み】\n${summary}\n\n▼ 今日からできること\n制約条件（時間・コスト・スキル）を踏まえた最優先アクションを特定。完璧を求めず80%の完成度で試す。${codeSection}`;
  }
}

/**
 * 批判的視点用変換
 * - リスク・例外・盲点にフォーカス
 * - 反証・代替案を提示
 */
function transformCritical(question: string, answer: string, qType: QuestionType): string {
  const sentences = extractSentences(extractTextOnly(answer));
  const codes = extractCodeBlocks(answer);

  // 断言・絶対的表現を含む文（批判対象として抽出）
  const absoluteKeywords = /必ず|常に|絶対|すべて|always|never|must|only|best|最良|最適|唯一/i;
  const absoluteSentences = sentences.filter(s => absoluteKeywords.test(s)).slice(0, 3);
  const normalSentences = sentences.slice(0, 3);
  const targetSentences = absoluteSentences.length > 0 ? absoluteSentences : normalSentences;
  const target = targetSentences.join('。') + '。';

  const codeRisk = codes.length > 0
    ? `\n\n▼ コードのリスクポイント\n${codes[0]}\n→ エラーハンドリングの欠如、境界値の未処理、副作用の確認が必要。`
    : '';

  switch (qType) {
    case 'factual':
      return `【情報の信頼性評価】\n対象: ${target}\n\n▼ 批判的検討\n• この情報が誤っている条件はあるか？\n• 反例や例外ケースは存在するか？\n• 情報の鮮度（時期・バージョン依存）は問題ないか？${codeRisk}`;
    case 'procedural':
      return `【失敗シナリオ分析】\n対象: ${target}\n\n▼ この手順で失敗する条件\n• 環境依存の前提条件が隠れていないか\n• 手順の省略・変更で生じるリスク\n• エラー発生時のリカバリ方法が示されているか${codeRisk}`;
    case 'troubleshoot':
      return `【誤診の可能性】\n対象: ${target}\n\n▼ 代替仮説\n• 提示された原因以外の可能性は？\n• この解決策が新たな問題を引き起こす可能性は？\n• より深い根本原因が隠れていないか？${codeRisk}`;
    default:
      return `【批判的検討】\n対象: ${target}\n\n▼ 弱点・盲点の指摘\n• 考慮されていない重要な代替案は何か\n• 「前提が崩れるシナリオ」を想定しているか\n• この回答が通用しない状況・条件はあるか${codeRisk}`;
  }
}

// ─── AxiomBrancher クラス ────────────────────────────

export class AxiomBrancher {
  /**
   * AI回答を受け取り、3軸分岐を生成
   * ★ ローカル処理のみ、追加のAI呼び出しなし
   */
  branch(question: string, aiResponse: string): BranchResult {
    const startTime = Date.now();
    const qType = detectQuestionType(question);

    const branches: Branch[] = BRANCH_TEMPLATES.map(template => ({
      axis: template.axis,
      label: template.label,
      content: template.prompt(question, aiResponse, qType),
      confidence: this.calcConfidence(qType, template.axis),
      tags: template.tags(qType),
    }));

    return {
      original: aiResponse,
      branches,
      meta: {
        questionType: qType,
        branchCount: branches.length,
        processingMs: Date.now() - startTime,
      },
    };
  }

  /**
   * 質問タイプと軸の組み合わせによる信頼度スコア
   */
  private calcConfidence(qType: QuestionType, axis: Branch['axis']): number {
    const matrix: Record<QuestionType, Record<Branch['axis'], number>> = {
      factual:      { logical: 0.9, practical: 0.7, critical: 0.8 },
      analytical:   { logical: 0.9, practical: 0.6, critical: 0.9 },
      creative:     { logical: 0.5, practical: 0.9, critical: 0.7 },
      procedural:   { logical: 0.7, practical: 0.9, critical: 0.6 },
      opinion:      { logical: 0.6, practical: 0.7, critical: 0.9 },
      comparison:   { logical: 0.8, practical: 0.8, critical: 0.8 },
      troubleshoot: { logical: 0.8, practical: 0.9, critical: 0.7 },
      general:      { logical: 0.7, practical: 0.7, critical: 0.7 },
    };
    return matrix[qType]?.[axis] ?? 0.7;
  }

  /**
   * 質問タイプを外部から取得
   */
  getQuestionType(question: string): QuestionType {
    return detectQuestionType(question);
  }
}
