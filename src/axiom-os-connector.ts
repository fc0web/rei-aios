/**
 * Axiom OS Connector — Rei-AIOS ↔ 公理OS 連携層
 *
 * 自然言語クエリからSQLiteの人物・理論・公理を検索し、
 * AI記憶の保存・取得を行うコネクタ。
 */

import { AxiomOSStore } from './axiom-os';
import type {
  PersonRow,
  TheoryRow,
  AxiomRow,
  MemoryRow,
  MemoryInsert,
} from './axiom-os';

// ─── 検索結果型 ───

export interface SearchHit<T> {
  item: T;
  score: number;
  matchedFields: string[];
}

export interface QueryResult {
  persons: SearchHit<PersonRow>[];
  theories: SearchHit<TheoryRow>[];
  axioms: SearchHit<AxiomRow>[];
}

// ─── Connector ───

export class AxiomOSConnector {
  private store: AxiomOSStore;

  constructor(store: AxiomOSStore) {
    this.store = store;
  }

  /**
   * 自然言語クエリから関連人物を検索する。
   * name_ja, name_en, core_axiom, thought_keywords, domains を対象にキーワードマッチ。
   */
  searchPersons(query: string): SearchHit<PersonRow>[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const all = this.store.getAllPersons();
    const hits: SearchHit<PersonRow>[] = [];

    for (const person of all) {
      const fields: [string, string][] = [
        ['name_ja', person.name_ja],
        ['name_en', person.name_en.toLowerCase()],
        ['core_axiom', person.core_axiom],
        ['thought_keywords', person.thought_keywords.join(' ')],
        ['domains', person.domains.join(' ')],
      ];

      let score = 0;
      const matchedFields: string[] = [];

      for (const token of tokens) {
        for (const [fieldName, fieldValue] of fields) {
          if (fieldValue.includes(token)) {
            // thought_keywords の完全一致は高スコア
            if (fieldName === 'thought_keywords' && person.thought_keywords.includes(token)) {
              score += 3;
            } else if (fieldName === 'name_ja' || fieldName === 'name_en') {
              score += 2;
            } else {
              score += 1;
            }
            if (!matchedFields.includes(fieldName)) {
              matchedFields.push(fieldName);
            }
          }
        }
      }

      if (score > 0) {
        hits.push({ item: person, score, matchedFields });
      }
    }

    return hits.sort((a, b) => b.score - a.score);
  }

  /**
   * 自然言語クエリから関連理論を検索する。
   * name, axiom, description, category を対象にキーワードマッチ。
   */
  searchTheories(query: string): SearchHit<TheoryRow>[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const all = this.store.getAllTheories();
    const hits: SearchHit<TheoryRow>[] = [];

    for (const theory of all) {
      const fields: [string, string][] = [
        ['name', theory.name],
        ['axiom', theory.axiom],
        ['description', theory.description],
        ['category', theory.category],
      ];

      let score = 0;
      const matchedFields: string[] = [];

      for (const token of tokens) {
        for (const [fieldName, fieldValue] of fields) {
          if (fieldValue.includes(token)) {
            score += fieldName === 'name' ? 3 : fieldName === 'axiom' ? 2 : 1;
            if (!matchedFields.includes(fieldName)) {
              matchedFields.push(fieldName);
            }
          }
        }
      }

      if (score > 0) {
        hits.push({ item: theory, score, matchedFields });
      }
    }

    return hits.sort((a, b) => b.score - a.score);
  }

  /**
   * 自然言語クエリから関連公理を検索する。
   */
  searchAxioms(query: string): SearchHit<AxiomRow>[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const all = this.store.getAllAxioms();
    const hits: SearchHit<AxiomRow>[] = [];

    for (const axiom of all) {
      const fields: [string, string][] = [
        ['name_ja', axiom.name_ja],
        ['name_en', axiom.name_en.toLowerCase()],
        ['concept', axiom.concept],
        ['definition', axiom.definition],
        ['detailed_explanation', axiom.detailed_explanation],
        ['tags', axiom.tags.join(' ')],
      ];

      let score = 0;
      const matchedFields: string[] = [];

      for (const token of tokens) {
        for (const [fieldName, fieldValue] of fields) {
          if (fieldValue.includes(token)) {
            score += fieldName === 'name_ja' || fieldName === 'name_en' ? 3
              : fieldName === 'tags' && axiom.tags.includes(token) ? 3
              : 1;
            if (!matchedFields.includes(fieldName)) {
              matchedFields.push(fieldName);
            }
          }
        }
      }

      if (score > 0) {
        hits.push({ item: axiom, score, matchedFields });
      }
    }

    return hits.sort((a, b) => b.score - a.score);
  }

  /**
   * 自然言語クエリで人物・理論・公理を横断検索する。
   */
  search(query: string): QueryResult {
    return {
      persons: this.searchPersons(query),
      theories: this.searchTheories(query),
      axioms: this.searchAxioms(query),
    };
  }

  /**
   * 人物IDから思想・公理情報を取得する。
   */
  getPersonThought(personId: string): {
    person: PersonRow;
    core_axiom: string;
    thought_keywords: string[];
    relatedTheories: TheoryRow[];
  } | undefined {
    const person = this.store.getPersonById(personId);
    if (!person) return undefined;

    // 人物のキーワードに関連する理論を検索
    const relatedTheories: TheoryRow[] = [];
    const allTheories = this.store.getAllTheories();

    for (const theory of allTheories) {
      const theoryText = `${theory.name} ${theory.axiom} ${theory.description}`;
      for (const kw of person.thought_keywords) {
        if (theoryText.includes(kw)) {
          relatedTheories.push(theory);
          break;
        }
      }
    }

    return {
      person,
      core_axiom: person.core_axiom,
      thought_keywords: person.thought_keywords,
      relatedTheories,
    };
  }

  /**
   * AI記憶を保存する。IDは自動生成。
   */
  saveMemory(content: string, context: string, options?: {
    kind?: string;
    tags?: string[];
    outcome?: string;
  }): MemoryRow {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return this.store.createMemory({
      id,
      kind: options?.kind ?? 'task_execution',
      timestamp: Date.now(),
      context,
      content,
      tags: options?.tags ?? [],
      outcome: options?.outcome ?? 'success',
    });
  }

  /**
   * 直近のAI記憶を取得する。
   */
  getRecentMemories(limit: number = 10): MemoryRow[] {
    return this.store.getRecentMemories(limit);
  }

  /**
   * タグでAI記憶を検索する。
   */
  searchMemoriesByTag(tag: string): MemoryRow[] {
    return this.store.getAllMemories().filter(m => m.tags.includes(tag));
  }
}

// ─── Tokenizer ───

/**
 * 自然言語クエリをトークンに分割する。
 * 日本語: 助詞・記号を除去し、意味のある単語を抽出。
 * 英語: スペース区切り + 小文字化。
 */
function tokenize(query: string): string[] {
  // 「について」「とは」「を教えて」等の接尾辞を除去
  let cleaned = query
    .replace(/について(教えて)?/g, '')
    .replace(/とは(何(ですか)?)?/g, '')
    .replace(/を教えて(ください)?/g, '')
    .replace(/って何/g, '')
    .replace(/[？?！!。、,.]/g, '')
    .trim();

  // スペース・全角スペースで分割
  const parts = cleaned.split(/[\s　]+/).filter(Boolean);

  // 短すぎるトークン (1文字の助詞等) を除去、ただし漢字1文字は残す
  const tokens: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    // 1文字のひらがな・カタカナ助詞を除外
    if (lower.length === 1 && /^[ぁ-ゖァ-ヺa-z]$/.test(lower)) continue;
    tokens.push(lower);
  }

  return tokens;
}
