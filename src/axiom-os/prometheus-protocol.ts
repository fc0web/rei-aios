/**
 * PrometheusProtocol — 知識降下プロトコル
 *
 * D-FUMT Theory #74: プロメテウス知識降下理論
 * 「SEED_KERNELの公理を人間・外部システムに渡すには
 *  受け手のレベルに応じた変換が必要」
 *
 * 降下レベル:
 *   LEVEL_0 (神の火の原型)   -> 生の公理テキスト
 *   LEVEL_1 (たいまつ)       -> 七価論理値 + 1行説明
 *   LEVEL_2 (かがり火)       -> 自然言語要約
 *   LEVEL_3 (家の炉)         -> 具体的コード例付き
 *   LEVEL_4 (子供の炎)       -> 比喩・ストーリー形式
 */

import { type SeedTheory, SEED_KERNEL } from './seed-kernel';
import { type SevenLogicValue, toSymbol } from './seven-logic';

export type DescentLevel = 0 | 1 | 2 | 3 | 4;

export interface KnowledgePacket {
  sourceId: string;           // 元の理論ID
  level: DescentLevel;
  recipient: string;          // 受け手の識別（'human' | 'llm' | 'external-api' | 'rei-pl'）
  content: string;            // 変換されたコンテンツ
  logicTag: SevenLogicValue;  // この知識の七価状態
  fireMetaphor: string;       // プロメテウスの火の比喩
  createdAt: number;
}

export interface DescentReport {
  totalTheories: number;
  packets: KnowledgePacket[];
  averageLevel: number;
  summary: string;
}

export class PrometheusProtocol {

  /**
   * 理論を指定レベルに降下させてパケットを生成する
   */
  descend(
    theory: SeedTheory,
    level: DescentLevel,
    recipient = 'human',
  ): KnowledgePacket {

    const content = this.transform(theory, level);
    const logicTag = this.theoryToLogic(theory);
    const fireMetaphor = this.fireMetaphor(level);

    return {
      sourceId: theory.id,
      level,
      recipient,
      content,
      logicTag,
      fireMetaphor,
      createdAt: Date.now(),
    };
  }

  /**
   * SEED_KERNEL全体を指定レベルに降下させる
   * （プロメテウスが全人類に火を与える）
   */
  descendAll(level: DescentLevel, recipient = 'human'): DescentReport {
    const packets = SEED_KERNEL.map(t => this.descend(t, level, recipient));
    const avgLevel = level;
    return {
      totalTheories: SEED_KERNEL.length,
      packets,
      averageLevel: avgLevel,
      summary: `${SEED_KERNEL.length}理論をLevel ${level}（${this.fireMetaphor(level)}）に降下`,
    };
  }

  /**
   * 受け手の種別から最適な降下レベルを自動選択する
   */
  autoDescend(theory: SeedTheory, recipient: string): KnowledgePacket {
    const levelMap: Record<string, DescentLevel> = {
      'rei-pl':       0,  // コンパイラ -> 生の公理
      'external-api': 1,  // 外部API -> 七価 + 1行
      'llm':          2,  // LLM -> 自然言語要約
      'human':        3,  // 人間 -> コード例付き
      'child':        4,  // 初学者 -> 比喩・ストーリー
    };
    const level = levelMap[recipient] ?? 2;
    return this.descend(theory, level, recipient);
  }

  /**
   * note.com 記事向けエクスポート（Level 3相当）
   */
  exportForNote(theoryIds?: string[]): string {
    const theories = theoryIds
      ? SEED_KERNEL.filter(t => theoryIds.includes(t.id))
      : SEED_KERNEL.slice(0, 10); // デフォルトは最初の10件

    const lines = ['# D-FUMT 理論集（プロメテウス降下 Level 3）\n'];
    for (const t of theories) {
      const packet = this.descend(t, 3, 'human');
      lines.push(`## ${t.id}`);
      lines.push(packet.content);
      lines.push('');
    }
    return lines.join('\n');
  }

  // ── 変換エンジン ──

  private transform(theory: SeedTheory, level: DescentLevel): string {
    switch (level) {
      case 0:
        // 生の公理（神の火の原型）
        return `${theory.axiom}`;

      case 1:
        // 七価 + 1行説明（たいまつ）
        return `[${toSymbol(this.theoryToLogic(theory))}] ${theory.id}: ${theory.axiom} (${theory.category})`;

      case 2:
        // 自然言語要約（かがり火）
        return `**${theory.id}** [${theory.category}]\n` +
               `公理: ${theory.axiom}\n` +
               `キーワード: ${theory.keywords.join(', ')}`;

      case 3:
        // コード例付き（家の炉）
        return `**${theory.id}**\n` +
               `> ${theory.axiom}\n\n` +
               `カテゴリ: \`${theory.category}\`\n` +
               `関連キーワード: ${theory.keywords.map(k => `\`${k}\``).join(', ')}\n` +
               `\`\`\`rei\n// Theory: ${theory.id}\naxiom "${theory.id}" requires ${theory.keywords[0] ?? 'truth'}\n\`\`\``;

      case 4:
        // 比喩・ストーリー形式（子供の炎）
        return this.toStory(theory);

      default:
        return theory.axiom;
    }
  }

  private toStory(theory: SeedTheory): string {
    // カテゴリ別の比喩マップ
    const metaphors: Record<string, string> = {
      'logic':          `もし「真」と「偽」の両方が正しいとしたら？——${theory.axiom}`,
      'mathematics':    `数の世界の不思議な法則——${theory.axiom}`,
      'consciousness':  `意識とは何か、という問い——${theory.axiom}`,
      'eastern-philosophy': `東洋の賢者が問いかける——${theory.axiom}`,
      'computation':    `コンピュータが「考える」とき——${theory.axiom}`,
      'quantum':        `量子の世界では、見るまで答えは決まらない——${theory.axiom}`,
      'cosmic':         `宇宙の根本にある法則——${theory.axiom}`,
    };
    return metaphors[theory.category] ??
           `D-FUMTの言葉で語るなら——${theory.axiom}`;
  }

  private theoryToLogic(theory: SeedTheory): SevenLogicValue {
    const map: Record<string, SevenLogicValue> = {
      'logic':          'TRUE',
      'mathematics':    'TRUE',
      'computation':    'TRUE',
      'consciousness':  'FLOWING',
      'eastern-philosophy': 'BOTH',
      'quantum':        'NEITHER',
      'cosmic':         'INFINITY',
      'general':        'ZERO',
    };
    return map[theory.category] ?? 'FLOWING';
  }

  private fireMetaphor(level: DescentLevel): string {
    const map: Record<DescentLevel, string> = {
      0: '神の火の原型（生の公理）',
      1: 'たいまつ（七価 + 1行）',
      2: 'かがり火（自然言語）',
      3: '家の炉（コード例付き）',
      4: '子供の炎（比喩・物語）',
    };
    return map[level];
  }
}
