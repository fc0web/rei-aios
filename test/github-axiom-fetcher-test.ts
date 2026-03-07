/**
 * GitHubAxiomFetcher テスト
 * 実行: npm run test:github-fetcher
 */

import { GitHubAxiomFetcher } from '../src/p2p/github-axiom-fetcher';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function asyncTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

async function runTests() {
  console.log('\n=== GitHubAxiomFetcher Tests (6) ===\n');

  const fetcher = new GitHubAxiomFetcher();

  // ── テスト1: URL生成 ──
  test('Raw URL生成: デフォルト設定', () => {
    const url = fetcher.rawUrl;
    const expected = 'https://raw.githubusercontent.com/fc0web/rei-aios/main/theories.json';
    assert(url === expected, `Expected ${expected}, got ${url}`);
  });

  // ── テスト2: カスタムリポジトリ設定 ──
  test('Raw URL生成: カスタムリポジトリ', () => {
    const custom = new GitHubAxiomFetcher({ owner: 'test-org', repo: 'test-repo', branch: 'dev' });
    const url = custom.rawUrl;
    const expected = 'https://raw.githubusercontent.com/test-org/test-repo/dev/theories.json';
    assert(url === expected, `Expected ${expected}, got ${url}`);
  });

  // ── テスト3: 実際のフェッチ ──
  await asyncTest('フェッチ: GitHub Raw URLへの接続', async () => {
    const result = await fetcher.fetchAll();
    if (result.success) {
      assert(result.theories.length > 0, 'No theories returned');
      assert(result.manifest != null, 'No manifest returned');
      console.log(`    → ${result.theories.length} theories fetched`);
    } else {
      // theories.jsonがまだ存在しない場合はスキップ（正常）
      console.log(`    → skipped (theories.json not yet pushed: ${result.error})`);
    }
  });

  // ── テスト4: キャッシュ動作 ──
  await asyncTest('キャッシュ: 2回目はキャッシュから取得', async () => {
    fetcher.clearCache();
    const r1 = await fetcher.fetchAll();
    const r2 = await fetcher.fetchAll();
    if (r1.success) {
      assert(r2.fromCache, '2nd call should be from cache');
    } else {
      console.log('    → skipped (not connected)');
    }
  });

  // ── テスト5: カテゴリ絞り込み ──
  await asyncTest('カテゴリ絞り込み: nagarjuna', async () => {
    const result = await fetcher.fetchByCategory('nagarjuna');
    if (result.totalFound > 0) {
      assert(result.theories.every(t => t.category === 'nagarjuna'),
        'All results should be nagarjuna category');
      console.log(`    → ${result.totalFound} theories found`);
    } else {
      console.log('    → skipped (not connected or no data)');
    }
  });

  // ── テスト6: キーワード検索 ──
  await asyncTest('キーワード検索: 龍樹', async () => {
    const result = await fetcher.search('龍樹');
    if (result.totalFound > 0) {
      console.log(`    → ${result.totalFound} theories found`);
    } else {
      console.log('    → skipped (not connected or no data)');
    }
  });

  // ── 結果 ──
  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
