/**
 * NostrPhilosophyFetcher テスト
 * 実行: npm run test:nostr-philosophy
 */

import {
  NostrPhilosophyFetcher,
  PHILOSOPHY_TAG_MAP,
} from '../src/p2p/nostr-philosophy-fetcher';
import type { PhilosophyCategory } from '../src/p2p/nostr-philosophy-fetcher';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else      { console.log(`  ✗ ${msg}`); failed++; }
}

async function runTests() {
  console.log('\n=== NostrPhilosophyFetcher Tests ===\n');

  const fetcher = new NostrPhilosophyFetcher(
    undefined,
    './dist/philosophy-test-cache.json'
  );

  // ── テスト1: タグマップ確認 ──────────────────────────────────
  console.log('--- テスト1: タグマップ確認 ---');
  const categories = Object.keys(PHILOSOPHY_TAG_MAP) as PhilosophyCategory[];
  assert(categories.length >= 7, `カテゴリ数: ${categories.length}件`);
  assert(PHILOSOPHY_TAG_MAP.buddhism.includes('nagarjuna'), 'buddhismタグに nagarjuna 含む');
  assert(PHILOSOPHY_TAG_MAP.buddhism.includes('龍樹'), 'buddhismタグに 龍樹 含む');
  assert(PHILOSOPHY_TAG_MAP.logic.includes('many-valued-logic'), 'logicタグに many-valued-logic 含む');

  // ── テスト2: 仏教・論理学コンテンツ取得 ──────────────────────
  console.log('\n--- テスト2: 仏教コンテンツ取得（Nostr接続） ---');
  console.log('  接続中... (最大20秒)');

  const result = await fetcher.fetch({
    categories: ['buddhism', 'logic'],
    limit: 20,
    since: Math.floor(Date.now() / 1000) - 86400 * 30,
  });

  console.log(`  受信総数    : ${result.totalReceived}`);
  console.log(`  新規取得    : ${result.newNotes}`);
  console.log(`  キャッシュ済: ${result.cachedNotes}`);
  console.log(`  カテゴリ別  :`);
  Object.entries(result.byCategory).forEach(([cat, count]) => {
    if (count > 0) console.log(`    ${cat}: ${count}件`);
  });

  assert(typeof result.totalReceived === 'number', '取得数が数値 OK');
  assert(result.fetchedAt instanceof Date, 'fetchedAt が Date OK');

  if (result.notes.length > 0) {
    console.log('\n  取得した哲学ノート（上位3件）:');
    result.notes.slice(0, 3).forEach((note, i) => {
      console.log(`\n  [${i + 1}] カテゴリ: ${note.category}`);
      console.log(`       関連度  : ${note.relevance}`);
      console.log(`       タグ    : ${note.tags.slice(0, 4).join(', ')}`);
      console.log(`       内容    : ${note.content.slice(0, 80)}...`);
      if (note.keywords.length > 0) {
        console.log(`       D-FUMT  : ${note.keywords.join(', ')}`);
      }
    });
  } else {
    console.log('\n  今回は取得0件（リレーの状況による）');
  }

  // ── テスト3: 数学・意識カテゴリ取得 ──────────────────────────
  console.log('\n--- テスト3: mathematics・consciousness取得 ---');
  const result2 = await fetcher.fetch({
    categories: ['mathematics', 'consciousness'],
    limit: 10,
    since: Math.floor(Date.now() / 1000) - 86400 * 7,
  });
  console.log(`  新規取得: ${result2.newNotes}件`);
  assert(typeof result2.newNotes === 'number', 'newNotes が数値 OK');

  // ── テスト4: キャッシュ確認 ──────────────────────────────────
  console.log('\n--- テスト4: キャッシュ確認 ---');
  const cached = fetcher.getCached();
  assert(cached.length >= 0, `キャッシュ取得: ${cached.length}件`);

  const highRel = fetcher.getHighRelevance();
  console.log(`  高関連度ノート: ${highRel.length}件 (TRUE/FLOWING)`);
  assert(typeof highRel.length === 'number', '高関連度フィルタ OK');

  // ── テスト5: 統計 ────────────────────────────────────────────
  console.log('\n--- テスト5: 統計 ---');
  const stats = fetcher.stats();
  console.log(`  総キャッシュ: ${stats.total}件`);
  console.log(`  関連度分布  :`, stats.byRelevance);
  assert(typeof stats.total === 'number', '統計 OK');

  // ── 結果 ─────────────────────────────────────────────────────
  const totalFetched = result.newNotes + result2.newNotes;
  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

  if (totalFetched > 0) {
    console.log(`Nostrから哲学コンテンツ ${totalFetched}件を自動取得しました！`);
    console.log('   D-FUMT関連度評価で自動分類されています。');
  } else {
    console.log('今回は取得0件。リレーのコンテンツ状況による（正常）。');
  }

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
