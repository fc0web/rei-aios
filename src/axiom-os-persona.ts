/**
 * Axiom OS Persona — 公理OS人物ペルソナによるLLM応答
 *
 * 公理OSの人物データからシステムプロンプトを自動生成し、
 * その人物として LLM が応答するペルソナチャット機能。
 */

import { AxiomOSConnector } from './axiom-os-connector';
import type { PersonRow, TheoryRow } from './axiom-os';
import { toSymbol } from './axiom-os/seven-logic';
import type { SevenLogicValue } from './axiom-os/seven-logic';

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

export interface SevenLogicEval {
  concept: string;           // Extracted concept from user message
  value: SevenLogicValue;    // e.g. 'BOTH'
  symbol: string;            // e.g. 'B'
  reasoning: string;         // Why this value was assigned
}

export interface SevenLogicPersonaResponse {
  personId: string;
  personName: string;
  message: string;           // LLM response
  sevenLogicEval: SevenLogicEval | null;
  relatedTheories: string[]; // D-FUMT theory IDs
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
   * D-FUMT七価論理でユーザーの概念を評価する。
   */
  private evaluateConceptSevenLogic(
    person: PersonRow,
    userMessage: string,
    theories: TheoryRow[],
  ): SevenLogicEval | null {
    const dfumtTheories = theories.filter(t => t.id.startsWith('dfumt-'));
    if (dfumtTheories.length === 0) return null;

    // Extract concept: find first matching thought_keyword in userMessage
    let concept = '';
    for (const kw of person.thought_keywords) {
      if (userMessage.includes(kw)) {
        concept = kw;
        break;
      }
    }
    if (!concept) {
      // Fallback: use first token-like segment from userMessage
      const match = userMessage.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ffA-Za-z]{2,}/);
      concept = match ? match[0] : userMessage.slice(0, 10);
    }

    // Mapping heuristic based on philosophical tradition
    const buddhist = ['空', '無常', '縁起', '中道', '四諦', '八正道', '中論', '中観派', '二諦説', '八不中道'];
    const taoist = ['無為', '道', '自然', '無為自然', '柔弱', '道徳経', '陰陽', '虚'];
    const ancient = ['卜占', '鬼道', '邪馬台国', '祭政一致', '神託', '魏志倭人伝'];
    const infinite = ['弁証法', '再帰', '無限', '螺旋', '止揚'];
    const negation = ['無', '否定', '虚無', '空虚'];
    const affirmation = ['善', '真理', 'イデア', '仁', '礼', '義', '智'];

    let value: SevenLogicValue;
    let reasoning: string;

    if (buddhist.some(k => userMessage.includes(k))) {
      value = 'BOTH';
      reasoning = `「${concept}」は仏教的概念。真と偽の二項対立を超越する矛盾許容の論理`;
    } else if (taoist.some(k => userMessage.includes(k))) {
      value = 'FLOWING';
      reasoning = `「${concept}」は道家的概念。万物流転・変化し続ける流動の論理`;
    } else if (ancient.some(k => userMessage.includes(k))) {
      value = 'ZERO';
      reasoning = `「${concept}」は古代・未記録の概念。未観測・ゼロ状態の論理`;
    } else if (infinite.some(k => userMessage.includes(k))) {
      value = 'INFINITY';
      reasoning = `「${concept}」は無限・再帰的概念。評価が確定しない無限の論理`;
    } else if (negation.some(k => userMessage.includes(k))) {
      value = 'NEITHER';
      reasoning = `「${concept}」は否定的概念。真でも偽でもない未決定の論理`;
    } else if (affirmation.some(k => userMessage.includes(k))) {
      value = 'TRUE';
      reasoning = `「${concept}」は肯定的概念。確定的に真である古典論理`;
    } else {
      // Fallback with D-FUMT theories present
      value = 'FLOWING';
      reasoning = `「${concept}」はD-FUMT理論の文脈で流動的に評価される`;
    }

    return {
      concept,
      value,
      symbol: toSymbol(value),
      reasoning,
    };
  }

  /**
   * 指定された人物として七価論理評価付きで応答する。
   */
  async chatWithSevenLogic(personId: string, userMessage: string): Promise<SevenLogicPersonaResponse> {
    const thought = this.connector.getPersonThought(personId);
    if (!thought) {
      throw new Error(`Person not found: ${personId}`);
    }

    // Collect D-FUMT theories: from person's related theories, or fall back to core D-FUMT theories
    let dfumtTheories = thought.relatedTheories.filter(t => t.id.startsWith('dfumt-'));
    if (dfumtTheories.length === 0) {
      // Search for D-FUMT theories via connector using user message keywords
      const theoryHits = this.connector.searchTheories(userMessage);
      dfumtTheories = theoryHits.filter(h => h.item.id.startsWith('dfumt-')).map(h => h.item);
    }
    if (dfumtTheories.length === 0) {
      // Fallback: use core D-FUMT theories (catuskoti + seven-logic related)
      const coreIds = ['dfumt-catuskoti', 'dfumt-zero-state', 'dfumt-flowing-value', 'dfumt-infinity-value'];
      const theoryHits = this.connector.searchTheories('D-FUMT');
      const fromSearch = theoryHits.filter(h => h.item.id.startsWith('dfumt-')).map(h => h.item);
      if (fromSearch.length > 0) {
        dfumtTheories = fromSearch.slice(0, 4);
      } else {
        // Last resort: search each core ID individually
        for (const cid of coreIds) {
          const all = this.connector.searchTheories(cid);
          for (const h of all) {
            if (h.item.id === cid) dfumtTheories.push(h.item);
          }
        }
      }
    }

    // Always provide eval when chatWithSevenLogic is called — use dfumtTheories as context
    const theoriesForEval = dfumtTheories.length > 0
      ? dfumtTheories
      : [{ id: 'dfumt-catuskoti' } as TheoryRow]; // minimal marker to enable eval
    const sevenLogicEval = this.evaluateConceptSevenLogic(
      thought.person, userMessage, theoriesForEval,
    );

    // Build system prompt with seven-logic section
    let systemPrompt = this.buildSystemPrompt(thought.person, thought.relatedTheories);
    if (sevenLogicEval) {
      systemPrompt += '\n\n【七価論理評価】\n';
      systemPrompt += `概念「${sevenLogicEval.concept}」の七価論理値: ${sevenLogicEval.value}（${sevenLogicEval.symbol}）\n`;
      systemPrompt += `理由: ${sevenLogicEval.reasoning}\n`;
      systemPrompt += 'この七価論理の観点も応答に自然に織り込んでください。';
    }

    const response = await this.llmCall(systemPrompt, userMessage);

    return {
      personId,
      personName: thought.person.name_ja,
      message: response,
      sevenLogicEval,
      relatedTheories: dfumtTheories.map(t => t.id),
    };
  }

  /**
   * クエリに最も関連する人物を自動選択し、七価論理評価付きで応答する。
   */
  async autoChatWithSevenLogic(userMessage: string): Promise<SevenLogicPersonaResponse> {
    const hits = this.connector.searchPersons(userMessage);
    if (hits.length === 0) {
      throw new Error(`No matching person found for query: "${userMessage}"`);
    }
    return this.chatWithSevenLogic(hits[0].item.id, userMessage);
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
