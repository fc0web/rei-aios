/**
 * Axiom OS Persona — 公理OS人物ペルソナによるLLM応答
 *
 * 公理OSの人物データからシステムプロンプトを自動生成し、
 * その人物として LLM が応答するペルソナチャット機能。
 */

import { AxiomOSConnector } from './axiom-os-connector';
import type { PersonRow, TheoryRow } from './axiom-os';

// ─── Types ───

/** LLM呼び出し関数。ILLMAdapter.complete() や AIOSEngine.chat() をラップして注入する。 */
export type LLMCallFn = (
  systemPrompt: string,
  userMessage: string,
) => Promise<string>;

export interface PersonaChatResult {
  personId: string;
  personName: string;
  systemPrompt: string;
  userMessage: string;
  response: string;
  relatedTheories: TheoryRow[];
}

export interface AutoChatResult extends PersonaChatResult {
  searchScore: number;
  candidateCount: number;
}

// ─── PersonaChat ───

export class PersonaChat {
  private connector: AxiomOSConnector;
  private llmCall: LLMCallFn;

  /**
   * @param connector AxiomOSConnector（公理OS検索用）
   * @param llmCall   LLM呼び出し関数。(systemPrompt, userMessage) => Promise<response>
   *
   * @example
   * ```typescript
   * // ILLMAdapter を使う場合
   * const adapter = llmManager.getAdapter('claude');
   * const persona = new PersonaChat(connector, async (sys, msg) => {
   *   const res = await adapter.complete({
   *     messages: [{ role: 'user', content: msg }],
   *     systemPrompt: sys,
   *   });
   *   return res.content;
   * });
   *
   * // AIOSEngine を使う場合
   * const persona = new PersonaChat(connector, async (sys, msg) => {
   *   const res = await engine.chat({ message: msg, systemPrompt: sys });
   *   return res.content;
   * });
   * ```
   */
  constructor(connector: AxiomOSConnector, llmCall: LLMCallFn) {
    this.connector = connector;
    this.llmCall = llmCall;
  }

  /**
   * 人物データからシステムプロンプトを自動生成する。
   */
  buildSystemPrompt(person: PersonRow, relatedTheories: TheoryRow[] = []): string {
    const lines: string[] = [];

    // ── 人物アイデンティティ ──
    lines.push(`あなたは${person.name_ja}（${person.name_en}）です。`);
    lines.push(`時代: ${person.period}`);
    lines.push(`地域: ${formatRegion(person.region)}`);
    lines.push(`専門: ${person.domains.join('、')}`);
    lines.push('');

    // ── 核心公理 ──
    lines.push(`【核心公理】`);
    lines.push(person.core_axiom);
    lines.push('');

    // ── 思想キーワード ──
    lines.push(`【思想キーワード】${person.thought_keywords.join('、')}`);
    lines.push('');

    // ── 関連D-FUMT理論（あれば）──
    if (relatedTheories.length > 0) {
      lines.push('【関連するD-FUMT理論】');
      for (const t of relatedTheories) {
        lines.push(`  - ${t.name}: ${t.axiom}`);
      }
      lines.push('');
    }

    // ── 応答指示 ──
    lines.push('【応答ルール】');
    lines.push(`- ${person.name_ja}の思想・世界観に基づいて応答してください。`);
    lines.push(`- ${person.name_ja}が生きた時代の言葉遣いや考え方を意識しつつ、現代の質問にも答えてください。`);
    lines.push(`- 核心公理と思想キーワードを自然に会話に織り込んでください。`);
    lines.push(`- 一人称は${pickFirstPerson(person)}を使ってください。`);
    lines.push(`- 必要に応じて比喩や逸話を用いてください。`);

    return lines.join('\n');
  }

  /**
   * 指定された人物として応答する。
   *
   * @param personId 公理OSの人物ID（例: 'buddha', 'socrates'）
   * @param userMessage ユーザーの質問
   */
  async chat(personId: string, userMessage: string): Promise<PersonaChatResult> {
    const thought = this.connector.getPersonThought(personId);
    if (!thought) {
      throw new Error(`Person not found: ${personId}`);
    }

    const systemPrompt = this.buildSystemPrompt(thought.person, thought.relatedTheories);
    const response = await this.llmCall(systemPrompt, userMessage);

    return {
      personId,
      personName: thought.person.name_ja,
      systemPrompt,
      userMessage,
      response,
      relatedTheories: thought.relatedTheories,
    };
  }

  /**
   * クエリに最も関連する人物を自動選択して応答する。
   *
   * @param userMessage ユーザーの質問（自然言語）
   */
  async autoChat(userMessage: string): Promise<AutoChatResult> {
    const hits = this.connector.searchPersons(userMessage);

    if (hits.length === 0) {
      throw new Error(`No matching person found for query: "${userMessage}"`);
    }

    const best = hits[0];
    const result = await this.chat(best.item.id, userMessage);

    return {
      ...result,
      searchScore: best.score,
      candidateCount: hits.length,
    };
  }

  /**
   * 上位N名の人物としてそれぞれ応答する（多視点応答）。
   */
  async multiChat(userMessage: string, maxPersons: number = 3): Promise<PersonaChatResult[]> {
    const hits = this.connector.searchPersons(userMessage);
    const top = hits.slice(0, maxPersons);
    const results: PersonaChatResult[] = [];

    for (const hit of top) {
      const result = await this.chat(hit.item.id, userMessage);
      results.push(result);
    }

    return results;
  }
}

// ─── Helpers ───

function formatRegion(region: string): string {
  const map: Record<string, string> = {
    east_asia: '東アジア',
    south_asia: '南アジア',
    europe_ancient: '古代ギリシア・ローマ',
    europe_modern: '近世〜近代ヨーロッパ',
  };
  return map[region] ?? region;
}

function pickFirstPerson(person: PersonRow): string {
  // 地域・時代に応じた一人称
  if (person.region === 'east_asia' || person.region === 'south_asia') {
    if (person.id === 'himiko') return '私（わらわ）';
    return '私（わたし）';
  }
  return '私';
}
