/**
 * Rei-AIOS — NostrPhilosophyFetcher
 *
 * Nostr上の哲学・仏教・数学・東洋思想コンテンツを自動取得し、
 * D-FUMT理論との関連度を七価論理で評価してキャッシュする。
 *
 * 取得対象: kind:1（テキストノート）
 * 絞り込み: タグ（#t）による哲学・理論系キーワード
 */

import { AIOSMemory } from '../memory/aios-memory';

// ─── 型定義 ──────────────────────────────────────────────────

export type DFUMTRelevance =
  | 'TRUE'      // D-FUMTと高度に関連（空・縁起・四句分別など）
  | 'FLOWING'   // 関連あり（一般哲学・論理学）
  | 'BOTH'      // 関連・非関連が混在
  | 'NEITHER'   // 判断保留
  | 'FALSE'     // 非関連
  | 'ZERO'      // 未評価
  | 'INFINITY'; // 超越的・分類不能

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface PhilosophyNote {
  id: string;
  pubkey: string;
  createdAt: Date;
  content: string;
  tags: string[];
  category: PhilosophyCategory;
  relevance: DFUMTRelevance;
  keywords: string[];
  source: string;
}

export type PhilosophyCategory =
  | 'buddhism'
  | 'eastern'
  | 'logic'
  | 'mathematics'
  | 'consciousness'
  | 'philosophy'
  | 'language'
  | 'general';

export interface FetchPhilosophyOptions {
  categories?: PhilosophyCategory[];
  limit?: number;
  since?: number;
  relays?: string[];
  deduplicate?: boolean;
}

export interface FetchPhilosophyResult {
  notes: PhilosophyNote[];
  totalReceived: number;
  newNotes: number;
  cachedNotes: number;
  byCategory: Record<string, number>;
  fetchedAt: Date;
  relaysUsed: string[];
}

// ─── タグ定義（Nostr上で実際に使われているタグ） ─────────────

export const PHILOSOPHY_TAG_MAP: Record<PhilosophyCategory, string[]> = {
  buddhism: [
    'buddhism', 'buddha', 'zen', 'dharma', 'nagarjuna',
    'sunyata', 'emptiness', 'dependent-origination',
    '仏教', '禅', '龍樹', '空', '縁起',
  ],
  eastern: [
    'taoism', 'confucianism', 'hinduism', 'vedanta',
    'upanishad', 'advaita', 'yoga',
    '道教', '老子', '儒教', 'インド哲学',
  ],
  logic: [
    'logic', 'modal-logic', 'many-valued-logic', 'fuzzy-logic',
    'paraconsistent', 'intuitionistic-logic',
    '論理学', '多値論理', 'ファジー論理',
  ],
  mathematics: [
    'mathematics', 'category-theory', 'homotopy', 'type-theory',
    'topology', 'set-theory', 'godel',
    '圏論', 'ホモトピー', '型理論', 'ゲーデル',
  ],
  consciousness: [
    'consciousness', 'qualia', 'mind', 'phenomenology',
    'integrated-information', 'panpsychism',
    '意識', 'クオリア', '現象学',
  ],
  philosophy: [
    'philosophy', 'metaphysics', 'ontology', 'epistemology',
    'wittgenstein', 'kant', 'hegel', 'spinoza',
    '哲学', '形而上学', '存在論', 'ウィトゲンシュタイン',
  ],
  language: [
    'language', 'linguistics', 'semiotics', 'hermeneutics',
    'language-games', 'silence',
    '言語', '記号論', '沈黙', '言語ゲーム',
  ],
  general: [
    'theory', 'axiom', 'wisdom', 'enlightenment',
    '理論', '公理', '知恵', '悟り',
  ],
};

// D-FUMTとの関連度が高いキーワード
const HIGH_RELEVANCE_KEYWORDS = [
  'nagarjuna', 'sunyata', 'emptiness', 'catuskoti', 'tetralemma',
  'dependent-origination', 'many-valued-logic', 'paraconsistent',
  'category-theory', 'homotopy', 'wittgenstein', 'silence',
  '龍樹', '空', '四句分別', '縁起', '多値論理', '圏論', '沈黙',
];

// ─── デフォルトリレー ─────────────────────────────────────────

export const PHILOSOPHY_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
];

// ─── メインクラス ─────────────────────────────────────────────

export class NostrPhilosophyFetcher {
  private memory: AIOSMemory;
  private relays: string[];

  constructor(
    relays: string[] = PHILOSOPHY_RELAYS,
    cacheDbPath = './dist/philosophy-cache.json'
  ) {
    this.relays = relays;
    this.memory = new AIOSMemory(cacheDbPath);
  }

  // ── 哲学ノートを取得 ─────────────────────────────────────────
  async fetch(opts: FetchPhilosophyOptions = {}): Promise<FetchPhilosophyResult> {
    const categories = opts.categories ?? Object.keys(PHILOSOPHY_TAG_MAP) as PhilosophyCategory[];
    const limit = opts.limit ?? 30;
    const since = opts.since ?? Math.floor(Date.now() / 1000) - 86400 * 7;
    const relays = opts.relays ?? this.relays;
    const deduplicate = opts.deduplicate ?? true;

    const allNotes: PhilosophyNote[] = [];
    const seenIds = new Set<string>();
    const byCategory: Record<string, number> = {};
    let totalReceived = 0;
    let cachedNotes = 0;

    for (const category of categories) {
      const tags = PHILOSOPHY_TAG_MAP[category];
      byCategory[category] = 0;

      const filter = {
        kinds: [1],
        '#t': tags,
        since,
        limit,
      };

      for (const relay of relays.slice(0, 3)) {
        try {
          const events = await this._fetchFromRelay(relay, filter);
          totalReceived += events.length;

          for (const event of events) {
            if (deduplicate && seenIds.has(event.id)) continue;
            seenIds.add(event.id);

            const cached = this.memory.recall({
              agentId: 'philosophy-cache',
              keyword: event.id,
              limit: 1,
            });
            if (cached.length > 0) {
              cachedNotes++;
              continue;
            }

            const note = this._convertToNote(event, category, relay);
            allNotes.push(note);
            byCategory[category]++;

            this.memory.remember(
              'philosophy-cache',
              'note',
              JSON.stringify(note),
              {
                confidence: note.relevance,
                tags: [category, note.relevance, ...note.keywords.slice(0, 3)],
              }
            );
          }

          if (events.length > 0) break;
        } catch (e: any) {
          console.warn(`[Philosophy] ${relay}/${category} 失敗: ${e.message}`);
        }
      }
    }

    allNotes.sort((a, b) => this._relevanceScore(b.relevance) - this._relevanceScore(a.relevance));

    return {
      notes: allNotes,
      totalReceived,
      newNotes: allNotes.length,
      cachedNotes,
      byCategory,
      fetchedAt: new Date(),
      relaysUsed: relays.slice(0, 3),
    };
  }

  // ── キャッシュから取得 ────────────────────────────────────────
  getCached(category?: PhilosophyCategory, limit = 50): PhilosophyNote[] {
    const entries = this.memory.recall({
      agentId: 'philosophy-cache',
      tags: category ? [category] : undefined,
      limit,
    });
    return entries.map(e => {
      try { return JSON.parse(e.content) as PhilosophyNote; }
      catch { return null; }
    }).filter(Boolean) as PhilosophyNote[];
  }

  // ── D-FUMT関連度でフィルタリング ─────────────────────────────
  getHighRelevance(limit = 20): PhilosophyNote[] {
    return this.getCached(undefined, 200)
      .filter(n => n.relevance === 'TRUE' || n.relevance === 'FLOWING')
      .slice(0, limit);
  }

  // ── 統計 ─────────────────────────────────────────────────────
  stats(): { total: number; byRelevance: Record<string, number> } {
    const all = this.getCached(undefined, 1000);
    const byRelevance: Record<string, number> = {};
    for (const note of all) {
      byRelevance[note.relevance] = (byRelevance[note.relevance] ?? 0) + 1;
    }
    return { total: all.length, byRelevance };
  }

  // ── イベント → PhilosophyNote 変換 ──────────────────────────
  private _convertToNote(
    event: NostrEvent,
    category: PhilosophyCategory,
    relay: string
  ): PhilosophyNote {
    const contentLower = event.content.toLowerCase();
    const eventTags = event.tags
      .filter(t => t[0] === 't')
      .map(t => t[1]);

    const keywords = HIGH_RELEVANCE_KEYWORDS.filter(kw =>
      contentLower.includes(kw.toLowerCase()) || eventTags.includes(kw)
    );

    const relevance = this._evalRelevance(contentLower, eventTags, keywords);

    return {
      id: event.id,
      pubkey: event.pubkey,
      createdAt: new Date(event.created_at * 1000),
      content: event.content.slice(0, 500),
      tags: eventTags,
      category,
      relevance,
      keywords,
      source: relay,
    };
  }

  // ── D-FUMT関連度評価（七価論理） ────────────────────────────
  private _evalRelevance(
    content: string,
    tags: string[],
    matchedKeywords: string[]
  ): DFUMTRelevance {
    const score = matchedKeywords.length;

    const coreMatches = [
      'nagarjuna', 'sunyata', 'catuskoti', 'tetralemma',
      '龍樹', '空', '四句分別',
    ].filter(k => content.includes(k.toLowerCase()) || tags.includes(k));

    if (coreMatches.length >= 2) return 'TRUE';
    if (coreMatches.length === 1 || score >= 3) return 'FLOWING';
    if (score === 2) return 'BOTH';
    if (score === 1) return 'NEITHER';
    if (score === 0 && tags.length > 0) return 'FALSE';
    return 'ZERO';
  }

  // ── 関連度スコア（ソート用） ─────────────────────────────────
  private _relevanceScore(r: DFUMTRelevance): number {
    const scores: Record<DFUMTRelevance, number> = {
      TRUE: 6, FLOWING: 5, BOTH: 4,
      INFINITY: 3, NEITHER: 2, FALSE: 1, ZERO: 0,
    };
    return scores[r] ?? 0;
  }

  // ── WebSocket取得（ws対応） ──────────────────────────────────
  private async _fetchFromRelay(
    relay: string,
    filter: object
  ): Promise<NostrEvent[]> {
    const WS = await this._getWS();
    return new Promise((resolve) => {
      const events: NostrEvent[] = [];
      const subId = `phi-${Date.now()}`;
      let ws: any;

      try { ws = new WS(relay); }
      catch { resolve([]); return; }

      const timeout = setTimeout(() => {
        ws.close();
        resolve(events);
      }, 8000);

      ws.onopen = () => {
        ws.send(JSON.stringify(['REQ', subId, filter]));
        console.log(`[Philosophy] 📡 ${relay} 接続（${JSON.stringify((filter as any)['#t']?.slice(0, 2))}...）`);
      };

      ws.onmessage = (msg: any) => {
        try {
          const raw = typeof msg.data === 'string' ? msg.data : msg.data.toString();
          const data = JSON.parse(raw);
          if (data[0] === 'EVENT' && data[1] === subId) {
            events.push(data[2] as NostrEvent);
          } else if (data[0] === 'EOSE') {
            clearTimeout(timeout);
            ws.close();
            resolve(events);
          }
        } catch {}
      };

      ws.onerror = () => { clearTimeout(timeout); resolve(events); };
    });
  }

  private async _getWS(): Promise<typeof WebSocket> {
    if (typeof WebSocket !== 'undefined') return WebSocket;
    const { default: WS } = await import('ws');
    return WS as unknown as typeof WebSocket;
  }
}
