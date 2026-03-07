/**
 * Rei-AIOS テーマI — ArxivFetcher
 * arXiv.org の無料APIを使って数学論文を取得する。
 *
 * API仕様: https://export.arxiv.org/api/query
 * 登録不要・無料・レート制限: 3秒/リクエスト推奨
 */

import * as https from 'https';
import { ArxivPaper, ArxivFetchOptions, ArxivState } from './types';

// XML解析（依存なし・軽量実装）
function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].trim().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
}
function extractAllTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  }
  return results;
}
function extractAttr(xml: string, tag: string, attr: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ReiAIOS/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (res.headers.location) { resolve(httpGet(res.headers.location)); return; }
      }
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('arXiv API タイムアウト')); });
  });
}

/** タイトル・著者数・カテゴリ数からD-FUMTエンジン入力ベクトルを生成 */
function makeDfumtVector(paper: {
  title: string; authors: string[]; categories: string[]; published: string;
}): number[] {
  const titleLen  = paper.title.length / 100;          // 正規化
  const authorCnt = paper.authors.length / 10;
  const catCnt    = paper.categories.length / 5;
  const year      = new Date(paper.published).getFullYear();
  const ageNorm   = Math.max(0, (year - 2000) / 30);   // 2000-2030正規化
  const phi       = 1.6180339887;
  return [titleLen, authorCnt, catCnt, ageNorm, phi * titleLen];
}

export class ArxivFetcher {
  private lastFetchTime = 0;
  private readonly MIN_INTERVAL_MS = 3100; // arXivレート制限対策

  /** arXiv APIから論文を取得 */
  async fetch(opts: ArxivFetchOptions): Promise<ArxivPaper[]> {
    // レート制限
    const now = Date.now();
    const wait = this.MIN_INTERVAL_MS - (now - this.lastFetchTime);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this.lastFetchTime = Date.now();

    const { query, maxResults = 10, category, sortBy = 'submittedDate' } = opts;

    // クエリ構築
    let searchQuery = query;
    if (category) searchQuery = `cat:${category}+AND+(${encodeURIComponent(query)})`;
    else searchQuery = encodeURIComponent(query);

    const url = `https://export.arxiv.org/api/query?search_query=${searchQuery}&max_results=${maxResults}&sortBy=${sortBy}&sortOrder=descending`;

    const xml = await httpGet(url);

    // <entry>ブロックを分割
    const entries: ArxivPaper[] = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
    let m;
    while ((m = entryRe.exec(xml)) !== null) {
      const block = m[1];

      const rawId    = extractTag(block, 'id');
      const id       = rawId.replace('http://arxiv.org/abs/', '').replace('https://arxiv.org/abs/', '');
      const title    = extractTag(block, 'title');
      const summary  = extractTag(block, 'summary').slice(0, 300) + '…';
      const published= extractTag(block, 'published');
      const updated  = extractTag(block, 'updated');

      // 著者名リスト
      const authorBlocks = [...block.matchAll(/<author>([\s\S]*?)<\/author>/gi)];
      const authors = authorBlocks.map(ab => extractTag(ab[1], 'name')).filter(Boolean);

      // カテゴリ
      const categories = [...block.matchAll(/<category[^>]*term="([^"]+)"/gi)].map(c => c[1]);

      // リンク
      const link = `https://arxiv.org/abs/${id}`;

      if (!id || !title) continue;

      const paper: ArxivPaper = {
        id, title, summary, authors, published, updated, categories, link,
        dfumtVector: makeDfumtVector({ title, authors, categories, published }),
      };
      entries.push(paper);
    }
    return entries;
  }

  /** デフォルトクエリ: D-FUMT関連数学論文 */
  async fetchDefault(): Promise<ArxivPaper[]> {
    return this.fetch({ query: 'mathematics consciousness dimension', maxResults: 8, category: 'math.GM' });
  }

  /** カテゴリ別プリセット */
  async fetchByPreset(preset:
    | 'general'
    | 'number-theory'
    | 'ai-math'
    | 'topology'
    | 'buddhist-logic'
    | 'many-valued-logic'
    | 'category-theory'
    | 'consciousness'
    | 'philosophy-math'
  ): Promise<ArxivPaper[]> {
    const presets: Record<string, { query: string; category: string; maxResults: number }> = {
      // ── 既存 ──────────────────────────────────────────────
      'general':       { query: 'mathematical theory framework',          category: 'math.GM', maxResults: 8 },
      'number-theory': { query: 'prime fibonacci golden ratio',           category: 'math.NT', maxResults: 8 },
      'ai-math':       { query: 'neural network mathematics topology',    category: 'cs.LG',   maxResults: 8 },
      'topology':      { query: 'topology manifold dimension',            category: 'math.GT', maxResults: 8 },

      // ── 追加: 哲学・仏教・論理学 ─────────────────────────
      'buddhist-logic': {
        query: 'Buddhist logic Nagarjuna Madhyamaka paraconsistent tetralemma catuskoti emptiness',
        category: 'math.LO',
        maxResults: 10,
      },
      'many-valued-logic': {
        query: 'many-valued logic Lukasiewicz fuzzy paraconsistent non-classical',
        category: 'math.LO',
        maxResults: 10,
      },
      'category-theory': {
        query: 'category theory homotopy type theory infinity groupoid topos',
        category: 'math.CT',
        maxResults: 10,
      },
      'consciousness': {
        query: 'consciousness integrated information theory qualia panpsychism phenomenology',
        category: 'q-bio.NC',
        maxResults: 10,
      },
      'philosophy-math': {
        query: 'philosophy mathematics formal ontology axiomatic incompleteness Godel',
        category: 'math.LO',
        maxResults: 10,
      },
    };

    const opts = presets[preset];
    if (!opts) throw new Error(`未知のプリセット: ${preset}`);
    return this.fetch(opts);
  }

  /** 論文タイトル・サマリーからD-FUMT七価論理値を評価 */
  evaluateDfumtRelevance(paper: ArxivPaper): string {
    const text = (paper.title + ' ' + paper.summary).toLowerCase();

    const coreKeywords = [
      'nagarjuna', 'madhyamaka', 'catuskoti', 'tetralemma',
      'sunyata', 'emptiness', 'dependent origination',
      'many-valued', 'lukasiewicz', 'paraconsistent',
      'homotopy type', 'infinity groupoid', '∞-groupoid',
    ];

    const relatedKeywords = [
      'non-classical logic', 'fuzzy logic', 'modal logic',
      'category theory', 'topos', 'consciousness', 'qualia',
      'buddhist', 'eastern philosophy', 'formal ontology',
    ];

    const coreMatches = coreKeywords.filter(k => text.includes(k)).length;
    const relatedMatches = relatedKeywords.filter(k => text.includes(k)).length;

    if (coreMatches >= 2) return 'TRUE';
    if (coreMatches === 1 || relatedMatches >= 3) return 'FLOWING';
    if (relatedMatches === 2) return 'BOTH';
    if (relatedMatches === 1) return 'NEITHER';
    return 'ZERO';
  }

  /** D-FUMT関連度付きで哲学論文を全プリセット取得 */
  async fetchPhilosophyAll(): Promise<(ArxivPaper & { dfumtRelevance: string })[]> {
    const philosophyPresets = [
      'buddhist-logic',
      'many-valued-logic',
      'category-theory',
      'consciousness',
      'philosophy-math',
    ] as const;

    const results: (ArxivPaper & { dfumtRelevance: string })[] = [];

    for (const preset of philosophyPresets) {
      try {
        console.log(`[ArxivFetcher] 📚 ${preset} を取得中...`);
        const papers = await this.fetchByPreset(preset);
        for (const paper of papers) {
          results.push({
            ...paper,
            dfumtRelevance: this.evaluateDfumtRelevance(paper),
          });
        }
      } catch (e: any) {
        console.warn(`[ArxivFetcher] ${preset} 取得失敗: ${e.message}`);
      }
    }

    const order = ['TRUE', 'FLOWING', 'BOTH', 'NEITHER', 'ZERO', 'FALSE'];
    results.sort((a, b) => order.indexOf(a.dfumtRelevance) - order.indexOf(b.dfumtRelevance));

    return results;
  }
}

export function makeDefaultArxivState(): ArxivState {
  return { papers: [], query: '', fetchedAt: 0, isLoading: false };
}
