/**
 * FormulaAxiomizer — 自然言語→公理→Rei-PL変換パイプライン
 *
 * 設計思想（「自然言語と数式」論文より）：
 *   自然言語は問いを立て、数式（公理）が構造を掘り、
 *   Rei-PLコードが検証可能な形式として出力される。
 *
 * パイプライン：
 *   自然言語入力
 *     → キーワード抽出
 *     → D-FUMT公理マッチング（関連度スコアリング）
 *     → 七価論理で信頼度評価
 *     → Rei-PLコードスニペット生成
 *     → 説明レポート出力
 */

import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import { type SevenLogicValue, toSymbol } from './seven-logic';

// ── キーワードマッピング ──
// 自然言語キーワード → D-FUMT公理カテゴリ/ID

const KEYWORD_AXIOM_MAP: Record<string, string[]> = {
  // 論理・真偽
  '真':       ['dfumt-catuskoti', 'dfumt-zero-pi'],
  '偽':       ['dfumt-catuskoti', 'dfumt-zero-state'],
  '矛盾':     ['dfumt-catuskoti', 'dfumt-idempotency'],
  '論理':     ['dfumt-catuskoti', 'dfumt-zero-pi'],
  '両立':     ['dfumt-catuskoti'],
  '否定':     ['dfumt-catuskoti', 'dfumt-zero-pi'],
  // 収束・安定
  '収束':     ['dfumt-idempotency', 'dfumt-center-periphery'],
  '安定':     ['dfumt-idempotency'],
  '冪等':     ['dfumt-idempotency'],
  // 無限・ゼロ
  '無限':     ['dfumt-zero-pi', 'dfumt-infinite-expansion'],
  'ゼロ':     ['dfumt-zero-state', 'dfumt-zero-pi'],
  '原点':     ['dfumt-zero-state'],
  '空':       ['dfumt-zero-state'],
  // 意識・感情
  '意識':     ['dfumt-consciousness-math', 'dfumt-life-creation'],
  '感情':     ['dfumt-cognitive-space'],
  '自己':     ['dfumt-consciousness-math'],
  '覚醒':     ['dfumt-consciousness-math'],
  // 中心・周囲
  '中心':     ['dfumt-center-periphery'],
  '周囲':     ['dfumt-center-periphery'],
  '関係':     ['dfumt-center-periphery', 'dfumt-isnt'],
  // 時間・変化
  '時間':     ['dfumt-temporal-number-system', 'dfumt-inverse-zero-pi'],
  '変化':     ['dfumt-temporal-number-system'],
  '過去':     ['dfumt-temporal-number-system'],
  '未来':     ['dfumt-temporal-number-system'],
  '流動':     ['dfumt-temporal-number-system'],
  // 空間・次元
  '空間':     ['dfumt-multidim-projection', 'dfumt-center-periphery'],
  '次元':     ['dfumt-multidim-projection'],
  '投影':     ['dfumt-multidim-projection'],
  // 宇宙・生命
  '宇宙':     ['dfumt-hdrqi', 'dfumt-life-creation'],
  '生命':     ['dfumt-life-creation'],
  '運命':     ['dfumt-probabilistic-destiny'],
  '確率':     ['dfumt-probabilistic-destiny', 'dfumt-pft'],
  // AI・情報
  'AI':       ['dfumt-eternal-infinite-eq'],
  '情報':     ['dfumt-isnt', 'dfumt-ngiet'],
  '圧縮':     ['dfumt-dszt'],
};

// ── 変換結果 ──

export interface AxiomizerResult {
  input: string;                    // 自然言語入力
  keywords: string[];               // 抽出されたキーワード
  matchedAxioms: AxiomMatch[];      // マッチした公理
  confidence: SevenLogicValue;      // 全体信頼度
  reiCode: string;                  // 生成されたRei-PLコード
  explanation: string;              // 説明文
}

export interface AxiomMatch {
  axiom: SeedTheory;
  relevanceScore: number;           // 関連度 0.0〜1.0
  matchedKeywords: string[];        // マッチしたキーワード
}

// ── FormulaAxiomizer 本体 ──

export class FormulaAxiomizer {

  /**
   * メインAPI: 自然言語 → 公理 → Rei-PLコード
   */
  axiomize(naturalLanguage: string): AxiomizerResult {
    // Step 1: キーワード抽出
    const keywords = this.extractKeywords(naturalLanguage);

    // Step 2: 公理マッチング
    const matchedAxioms = this.matchAxioms(keywords);

    // Step 3: 信頼度評価
    const confidence = this.evalConfidence(matchedAxioms);

    // Step 4: Rei-PLコード生成
    const reiCode = this.generateReiCode(naturalLanguage, matchedAxioms);

    // Step 5: 説明文生成
    const explanation = this.generateExplanation(naturalLanguage, matchedAxioms, confidence);

    return { input: naturalLanguage, keywords, matchedAxioms, confidence, reiCode, explanation };
  }

  /**
   * 公理IDを直接指定してRei-PLコードを生成する
   */
  fromAxiomIds(axiomIds: string[], varName = 'result'): string {
    const axioms = axiomIds
      .map(id => SEED_KERNEL.find(s => s.id === id))
      .filter((s): s is SeedTheory => s !== null && s !== undefined);
    return this.generateReiCode('', axioms.map(a => ({ axiom: a, relevanceScore: 1.0, matchedKeywords: [] })), varName);
  }

  /**
   * キーワードから関連する公理をリストアップする
   */
  searchAxioms(keywords: string[]): AxiomMatch[] {
    return this.matchAxioms(keywords);
  }

  // ── プライベートメソッド ──

  /** 自然言語からキーワードを抽出する */
  private extractKeywords(text: string): string[] {
    const found: string[] = [];
    for (const keyword of Object.keys(KEYWORD_AXIOM_MAP)) {
      if (text.includes(keyword)) found.push(keyword);
    }
    // 英語キーワードも対応
    const enKeywords: Record<string, string> = {
      'logic': '論理', 'consciousness': '意識', 'infinite': '無限',
      'zero': 'ゼロ', 'contradiction': '矛盾', 'time': '時間',
      'space': '空間', 'center': '中心', 'convergence': '収束',
    };
    for (const [en, ja] of Object.entries(enKeywords)) {
      if (text.toLowerCase().includes(en) && !found.includes(ja)) {
        found.push(ja);
      }
    }
    return found.length > 0 ? found : ['論理']; // デフォルト
  }

  /** キーワードから公理をマッチングしスコアリングする */
  private matchAxioms(keywords: string[]): AxiomMatch[] {
    const scoreMap = new Map<string, { score: number; matchedKws: string[] }>();

    for (const kw of keywords) {
      const axiomIds = KEYWORD_AXIOM_MAP[kw] ?? [];
      for (const id of axiomIds) {
        const existing = scoreMap.get(id) ?? { score: 0, matchedKws: [] };
        scoreMap.set(id, {
          score: existing.score + 1,
          matchedKws: [...existing.matchedKws, kw],
        });
      }
    }

    const maxScore = Math.max(...[...scoreMap.values()].map(v => v.score), 1);

    return [...scoreMap.entries()]
      .map(([id, { score, matchedKws }]) => {
        const axiom = SEED_KERNEL.find(s => s.id === id);
        if (!axiom) return null;
        return {
          axiom,
          relevanceScore: score / maxScore,
          matchedKeywords: matchedKws,
        };
      })
      .filter((m): m is AxiomMatch => m !== null)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5); // 上位5公理
  }

  /** マッチ結果から全体信頼度を評価する */
  private evalConfidence(matches: AxiomMatch[]): SevenLogicValue {
    if (matches.length === 0)    return 'ZERO';
    const topScore = matches[0]?.relevanceScore ?? 0;
    if (topScore >= 1.0)         return 'TRUE';
    if (topScore >= 0.6)         return 'FLOWING';
    if (topScore >= 0.3)         return 'NEITHER';
    return 'ZERO';
  }

  /** マッチした公理からRei-PLコードを生成する */
  private generateReiCode(
    input: string,
    matches: AxiomMatch[],
    varName = 'result',
  ): string {
    if (matches.length === 0) {
      return `// 入力: ${input}\n// 対応する公理が見つかりませんでした\nlet ${varName} = 〇`;
    }

    const lines: string[] = [
      `// Formula Axiomizer 生成コード`,
      `// 入力: 「${input || '（公理直接指定）'}」`,
      `// 使用公理: ${matches.map(m => m.axiom.id).join(', ')}`,
      ``,
    ];

    // 各公理に対応するRei-PLスニペットを生成
    matches.forEach((match, i) => {
      const varSuffix = i === 0 ? varName : `${varName}_${i}`;
      lines.push(...this.axiomToReiSnippet(match.axiom, varSuffix));
    });

    // 最終結果の合成
    if (matches.length > 1) {
      const resultVars = matches.map((_, i) => i === 0 ? varName : `${varName}_${i}`);
      lines.push(``, `// 合成結果`);
      lines.push(`let final = ${resultVars[0]} ∧ ${resultVars.slice(1).join(' ∧ ')}`);
      lines.push(`final |> print`);
    } else {
      lines.push(`${varName} |> print`);
    }

    return lines.join('\n');
  }

  /** 公理→Rei-PLスニペット変換 */
  private axiomToReiSnippet(axiom: SeedTheory, varName: string): string[] {
    switch (axiom.category) {
      case 'logic':
        return [
          `// [${axiom.id}] ${axiom.axiom}`,
          `let ${varName} = ⊤ ∧ ¬⊥   // 四値論理の基本`,
          `${varName} |> print`,
        ];
      case 'computation':
        return [
          `// [${axiom.id}] ${axiom.axiom}`,
          `let ${varName} = Ω Ω both  // 冪等性収束: both→⊤`,
          `${varName} |> print`,
        ];
      case 'consciousness':
        return [
          `// [${axiom.id}] ${axiom.axiom}`,
          `let ${varName} = future 〇  // 意識: 未観測→流動`,
          `${varName} |> print`,
        ];
      case 'zero_extension':
        return [
          `// [${axiom.id}] ${axiom.axiom}`,
          `let ${varName} = 〇 >> 1    // ゼロ拡張`,
          `${varName} |> print`,
        ];
      case 'expansion':
        return [
          `// [${axiom.id}] ${axiom.axiom}`,
          `let ${varName} = ∞          // 無限展開`,
          `${varName} |> print`,
        ];
      default:
        return [
          `// [${axiom.id}] ${axiom.axiom}`,
          `let ${varName} = ～         // 流動状態（評価継続）`,
          `${varName} |> print`,
        ];
    }
  }

  /** 説明文を生成する */
  private generateExplanation(
    input: string,
    matches: AxiomMatch[],
    confidence: SevenLogicValue,
  ): string {
    if (matches.length === 0) {
      return `「${input}」に対応するD-FUMT公理が見つかりませんでした。`;
    }
    const topAxiom = matches[0].axiom;
    const lines = [
      `入力「${input}」の公理化:`,
      `  最適公理: ${topAxiom.id}（${topAxiom.axiom}）`,
      `  カテゴリ: ${topAxiom.category}`,
      `  関連公理数: ${matches.length}件`,
      `  信頼度: ${toSymbol(confidence)}`,
    ];
    if (matches.length > 1) {
      lines.push(`  関連公理: ${matches.slice(1).map(m => m.axiom.id).join(', ')}`);
    }
    return lines.join('\n');
  }
}
