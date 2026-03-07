/**
 * Rei-AIOS — WikipediaFetcher
 * Wikipedia REST APIを使って哲学・仏教記事を取得する。
 *
 * API: https://en.wikipedia.org/api/rest_v1/page/summary/{title}
 * 登録不要・無料
 */

import * as https from 'https';
import type { WikipediaArticle } from './types';

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'ReiAIOS/1.0 (https://github.com/fc0web/rei-aios)',
        'Accept': 'application/json',
      }
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (res.headers.location) { resolve(httpGet(res.headers.location)); return; }
      }
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Wikipedia APIタイムアウト')); });
  });
}

// D-FUMT関連度評価
function evalDfumtValue(title: string, summary: string): string {
  const text = (title + ' ' + summary).toLowerCase();
  const core = [
    'nagarjuna', 'madhyamaka', 'sunyata', 'catuskoti',
    'many-valued logic', 'lukasiewicz', 'paraconsistent',
    'homotopy type theory', 'infinity-groupoid',
  ];
  const related = [
    'buddhist logic', 'dependent origination', 'emptiness',
    'category theory', 'consciousness', 'qualia', 'fuzzy logic',
    'modal logic', 'formal ontology', 'philosophy of mathematics',
  ];
  const coreHits    = core.filter(k => text.includes(k)).length;
  const relatedHits = related.filter(k => text.includes(k)).length;

  if (coreHits >= 2)                          return 'TRUE';
  if (coreHits === 1 || relatedHits >= 2)     return 'FLOWING';
  if (relatedHits === 1)                      return 'BOTH';
  return 'NEITHER';
}

export class WikipediaFetcher {
  private lastFetchTime = 0;
  private readonly MIN_INTERVAL_MS = 1000; // Wikipedia推奨: 1秒間隔

  // ── 記事タイトル直接取得 ─────────────────────────────────────
  async fetchByTitle(title: string, language: 'en' | 'ja' = 'en'): Promise<WikipediaArticle | null> {
    await this._rateLimit();
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const url = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

    try {
      const raw = await httpGet(url);
      const data = JSON.parse(raw);
      if (data.type === 'disambiguation' || !data.extract) return null;

      return {
        title: data.title,
        summary: (data.extract ?? '').slice(0, 400),
        url: data.content_urls?.desktop?.page ?? `https://${language}.wikipedia.org/wiki/${encoded}`,
        categories: [],
        dfumtValue: evalDfumtValue(data.title, data.extract ?? ''),
      };
    } catch {
      return null;
    }
  }

  // ── D-FUMT関連記事を一括取得 ─────────────────────────────────
  async fetchDfumtRelated(language: 'en' | 'ja' = 'en'): Promise<WikipediaArticle[]> {
    const titles = language === 'ja'
      ? [
          '龍樹', '中論', '空 (仏教)', '縁起', '四句分別',
          '意識', '圏論', 'ホモトピー型理論', '多値論理',
          'ゲーデルの不完全性定理', 'ウィトゲンシュタイン',
          'ファジー論理', '依存型理論',
        ]
      : [
          'Nagarjuna', 'Madhyamaka', 'Catuskoti', 'Dependent_origination',
          'Many-valued_logic', 'Łukasiewicz_logic', 'Paraconsistent_logic',
          'Category_theory', 'Homotopy_type_theory', 'Consciousness',
          'Integrated_information_theory', 'Philosophy_of_mathematics',
          'Gödel\'s_incompleteness_theorems', 'Ludwig_Wittgenstein',
        ];

    const articles: WikipediaArticle[] = [];
    for (const title of titles) {
      const article = await this.fetchByTitle(title, language);
      if (article) {
        articles.push(article);
        console.log(`[Wikipedia] ✓ ${article.title} (${article.dfumtValue})`);
      }
    }
    return articles;
  }

  private async _rateLimit() {
    const now = Date.now();
    const wait = this.MIN_INTERVAL_MS - (now - this.lastFetchTime);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this.lastFetchTime = Date.now();
  }
}

export function makeDefaultWikipediaState() {
  return { articles: [], query: '', fetchedAt: 0, isLoading: false };
}
