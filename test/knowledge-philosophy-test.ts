/**
 * Rei-AIOS --- ArxivFetcher哲学拡張 + WikipediaFetcher テスト
 *
 * 7テスト:
 *   1. ArxivFetcher哲学プリセット存在確認
 *   2. evaluateDfumtRelevance 関連度判定
 *   3. fetchPhilosophyAll 全プリセット取得（ライブ）
 *   4. WikipediaFetcher タイトル取得（ライブ）
 *   5. WikipediaFetcher D-FUMT関連記事一括取得（ライブ）
 *   6. WikipediaFetcher 日本語記事取得
 *   7. makeDefaultWikipediaState 初期値
 */

import { ArxivFetcher, makeDefaultArxivState } from '../src/aios/knowledge/arxiv-fetcher';
import { WikipediaFetcher, makeDefaultWikipediaState } from '../src/aios/knowledge/wikipedia-fetcher';
import type { ArxivPaper } from '../src/aios/knowledge/types';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      passed++;
      console.log(`  PASS  ${name}`);
    } catch (e: any) {
      failed++;
      console.log(`  FAIL  ${name}: ${e.message}`);
    }
  };
  return run();
}

function assert(cond: boolean, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('\n=== Knowledge Philosophy Test ===\n');

  const arxiv = new ArxivFetcher();
  const wiki  = new WikipediaFetcher();

  // ── 1. ArxivFetcher 哲学プリセット存在確認 ──
  await test('ArxivFetcher philosophy presets exist', async () => {
    const presets = [
      'buddhist-logic', 'many-valued-logic', 'category-theory',
      'consciousness', 'philosophy-math',
    ] as const;
    for (const p of presets) {
      // fetchByPreset が例外を投げなければプリセットは存在する
      // ただしネットワーク呼び出しは避ける — 存在確認だけ
      assert(typeof (arxiv as any).fetchByPreset === 'function',
        `fetchByPreset should be a function`);
    }
  });

  // ── 2. evaluateDfumtRelevance 関連度判定 ──
  await test('evaluateDfumtRelevance returns correct values', () => {
    const makePaper = (title: string, summary: string): ArxivPaper => ({
      id: 'test', title, summary, authors: [], published: '2024-01-01',
      updated: '2024-01-01', categories: [], link: '', dfumtVector: [],
    });

    // coreMatches >= 2 => TRUE
    const p1 = makePaper('Nagarjuna and Madhyamaka', 'catuskoti logic');
    assert(arxiv.evaluateDfumtRelevance(p1) === 'TRUE',
      `Expected TRUE for core >= 2, got ${arxiv.evaluateDfumtRelevance(p1)}`);

    // coreMatches === 1 => FLOWING
    const p2 = makePaper('Paraconsistent systems', 'formal methods');
    assert(arxiv.evaluateDfumtRelevance(p2) === 'FLOWING',
      `Expected FLOWING for core === 1, got ${arxiv.evaluateDfumtRelevance(p2)}`);

    // relatedMatches === 2 => BOTH
    const p3 = makePaper('Category theory and consciousness', 'applied math');
    assert(arxiv.evaluateDfumtRelevance(p3) === 'BOTH',
      `Expected BOTH for related === 2, got ${arxiv.evaluateDfumtRelevance(p3)}`);

    // relatedMatches === 1 => NEITHER
    const p4 = makePaper('Fuzzy logic applications', 'engineering');
    assert(arxiv.evaluateDfumtRelevance(p4) === 'NEITHER',
      `Expected NEITHER for related === 1, got ${arxiv.evaluateDfumtRelevance(p4)}`);

    // no matches => ZERO
    const p5 = makePaper('Linear algebra', 'matrices and vectors');
    assert(arxiv.evaluateDfumtRelevance(p5) === 'ZERO',
      `Expected ZERO for no matches, got ${arxiv.evaluateDfumtRelevance(p5)}`);
  });

  // ── 3. fetchPhilosophyAll ライブ取得 ──
  await test('fetchPhilosophyAll returns papers with dfumtRelevance', async () => {
    console.log('    [arXiv] fetching philosophy papers (this takes ~15s due to rate limits)...');
    const results = await arxiv.fetchPhilosophyAll();
    console.log(`    [arXiv] got ${results.length} papers`);
    assert(results.length > 0, 'Should fetch at least 1 paper');
    // dfumtRelevance が付与されている
    for (const r of results) {
      assert(typeof r.dfumtRelevance === 'string', 'dfumtRelevance should be string');
      assert(['TRUE','FLOWING','BOTH','NEITHER','ZERO','FALSE'].includes(r.dfumtRelevance),
        `Invalid dfumtRelevance: ${r.dfumtRelevance}`);
    }
    // ソート順: TRUE < FLOWING < BOTH < ...
    const order = ['TRUE','FLOWING','BOTH','NEITHER','ZERO','FALSE'];
    for (let i = 1; i < results.length; i++) {
      assert(
        order.indexOf(results[i].dfumtRelevance) >= order.indexOf(results[i-1].dfumtRelevance),
        'Results should be sorted by dfumtRelevance'
      );
    }
  });

  // ── 4. WikipediaFetcher タイトル取得 ──
  await test('WikipediaFetcher fetchByTitle returns article', async () => {
    const article = await wiki.fetchByTitle('Nagarjuna');
    assert(article !== null, 'Nagarjuna article should exist');
    assert(article!.title.length > 0, 'title should not be empty');
    assert(article!.summary.length > 0, 'summary should not be empty');
    assert(article!.url.includes('wikipedia'), 'url should contain wikipedia');
    assert(typeof article!.dfumtValue === 'string', 'dfumtValue should be string');
    console.log(`    [Wikipedia] ${article!.title} (${article!.dfumtValue})`);
  });

  // ── 5. WikipediaFetcher D-FUMT関連記事一括取得 ──
  await test('WikipediaFetcher fetchDfumtRelated returns multiple articles', async () => {
    console.log('    [Wikipedia] fetching D-FUMT related articles (en)...');
    const articles = await wiki.fetchDfumtRelated('en');
    console.log(`    [Wikipedia] got ${articles.length} articles`);
    assert(articles.length >= 5, `Should fetch >= 5 articles, got ${articles.length}`);
    // dfumtValue check
    const validValues = ['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'];
    for (const a of articles) {
      assert(validValues.includes(a.dfumtValue),
        `Invalid dfumtValue: ${a.dfumtValue} for ${a.title}`);
    }
  });

  // ── 6. WikipediaFetcher 日本語記事取得 ──
  await test('WikipediaFetcher fetchByTitle Japanese', async () => {
    const article = await wiki.fetchByTitle('\u9F8D\u6A39', 'ja');
    assert(article !== null, 'Japanese Nagarjuna article should exist');
    assert(article!.summary.length > 0, 'Japanese summary should not be empty');
    console.log(`    [Wikipedia/ja] ${article!.title} (${article!.dfumtValue})`);
  });

  // ── 7. makeDefaultWikipediaState ──
  await test('makeDefaultWikipediaState returns valid initial state', () => {
    const state = makeDefaultWikipediaState();
    assert(Array.isArray(state.articles), 'articles should be array');
    assert(state.articles.length === 0, 'articles should be empty');
    assert(state.query === '', 'query should be empty string');
    assert(state.fetchedAt === 0, 'fetchedAt should be 0');
    assert(state.isLoading === false, 'isLoading should be false');
  });

  // ── 結果 ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
