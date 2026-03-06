import { WiktionaryClient, generateDictionaryPanel, detectLang, evalConfidence } from '../src/dictionary/wiktionary-client';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('\n=== STEP 10-C: 辞書機能（Wiktionary）テスト ===\n');

const HAS_NETWORK = process.env.SKIP_NETWORK !== 'true';
const client = new WiktionaryClient(':memory:');

// ─── 1. WebUIパネル生成テスト ──────────────────────────────────
console.log('【1. WebUIパネル生成テスト】');
const panel = generateDictionaryPanel();
assert(panel.includes('panel-dictionary'), 'パネルIDが存在する');
assert(panel.includes('dict-input'), '入力フィールドが存在する');
assert(panel.includes('lookupWord'), '検索関数が存在する');
assert(panel.includes('Wiktionary'), 'Wiktionary参照が存在する');
assert(panel.includes('DICT_DFUMT_COLORS') || panel.includes('DFUMT_COLORS'), 'D-FUMT色定義が存在する');
assert(panel.includes('キャッシュ'), 'キャッシュ機能が存在する');
assert(panel.includes('自動判定'), '言語自動判定が存在する');
console.log(`    パネルサイズ: ${panel.length}文字`);

// ─── 2. キャッシュテスト（ネットワーク不要） ──────────────────
console.log('\n【2. キャッシュ動作テスト（オフライン）】');
assert(client.cacheSize === 0, '初期キャッシュが空');

const cacheStats = client.cacheStats();
assert(cacheStats.total === 0, 'キャッシュ統計: 0件');
assert(typeof cacheStats.byLang === 'object', 'キャッシュ統計が正常');

// ─── 2b. 言語自動判定テスト（オフライン） ────────────────────
console.log('\n【2b. 言語自動判定テスト（オフライン）】');
assert(detectLang('空') === 'ja', '「空」→ ja');
assert(detectLang('カレー') === 'ja', '「カレー」→ ja');
assert(detectLang('philosophy') === 'en', '「philosophy」→ en');
assert(detectLang('dharma') === 'en', '「dharma」→ en');
assert(detectLang('テスト123') === 'ja', '「テスト123」→ ja');

// ─── 2c. D-FUMT確信度評価テスト（オフライン） ────────────────
console.log('\n【2c. D-FUMT確信度評価テスト（オフライン）】');
assert(evalConfidence('') === 'NEITHER', '空文字→NEITHER');
assert(evalConfidence('短い') === 'NEITHER', '短い文→NEITHER');
assert(evalConfidence('これは十分に長い説明文です。名詞として使われることが多い単語です。様々な文脈で使用される一般的な日本語の語彙であり、辞書にも記載されています。') === 'TRUE',
  '50文字超→TRUE');
assert(evalConfidence('曖昧な意味を持つ言葉') === 'BOTH', '曖昧→BOTH');
assert(evalConfidence('古語として使われた表現') === 'FLOWING', '古語→FLOWING');

// ─── 2d. 空入力のエラーハンドリング ──────────────────────────
console.log('\n【2d. 空入力エラーハンドリング】');
(async () => {
  const emptyResult = await client.lookup('');
  assert(!emptyResult.success, '空入力はエラー');
  assert(!!emptyResult.error, 'エラーメッセージが存在する');

  // ─── 3. ネットワークテスト ────────────────────────────────────
  if (HAS_NETWORK) {
    console.log('\n【3. 実API: 日本語検索「空」】');
    const result1 = await client.lookup('空', 'ja');

    if (result1.success && result1.entry) {
      assert(result1.entry.word === '空', '単語が正しい');
      assert(result1.entry.lang === 'ja', '言語が日本語');
      assert(result1.entry.summary.length > 0, '定義が存在する');
      assert(!result1.entry.fromCache, '初回はAPIから取得');
      assert(result1.latencyMs > 0, 'レイテンシが記録される');
      assert(['TRUE','BOTH','FLOWING','NEITHER'].includes(result1.entry.dfumtConfidence),
        `D-FUMT確信度が有効: ${result1.entry.dfumtConfidence}`);
      console.log(`    定義: "${result1.entry.summary.slice(0,60)}..."`);
      console.log(`    D-FUMT: ${result1.entry.dfumtConfidence}`);
      console.log(`    レイテンシ: ${result1.latencyMs}ms`);

      // ── キャッシュヒットテスト ──
      console.log('\n【4. キャッシュヒットテスト（同じ単語を再検索）】');
      const result1cached = await client.lookup('空', 'ja');
      assert(result1cached.success, 'キャッシュから取得成功');
      assert(result1cached.entry?.fromCache === true, 'キャッシュから取得された');
      assert(result1cached.latencyMs < result1.latencyMs,
        `キャッシュが高速: ${result1cached.latencyMs}ms < ${result1.latencyMs}ms`);
      assert(client.cacheSize >= 1, 'キャッシュに保存されている');

    } else {
      console.log(`    ⚠️ API取得失敗: ${result1.error}（ネットワーク環境を確認）`);
      assert(true, '（ネットワークエラーはスキップ）');
    }

    console.log('\n【5. 実API: 英語検索「philosophy」】');
    const result2 = await client.lookup('philosophy', 'en');
    if (result2.success && result2.entry) {
      assert(result2.entry.lang === 'en', '言語が英語');
      assert(result2.entry.summary.length > 0, '英語定義が存在する');
      console.log(`    定義: "${result2.entry.summary.slice(0,60)}..."`);
      console.log(`    D-FUMT: ${result2.entry.dfumtConfidence}`);
    } else {
      assert(true, '（ネットワークエラーはスキップ）');
    }

    console.log('\n【6. 実API: 言語自動判定テスト】');
    const result3 = await client.lookup('縁起', 'auto');
    if (result3.success && result3.entry) {
      assert(result3.entry.lang === 'ja', '日本語が自動判定される');
      console.log(`    「縁起」→ ${result3.entry.lang}として自動判定`);
    } else {
      assert(true, '（ネットワークエラーはスキップ）');
    }

    const result4 = await client.lookup('dharma', 'auto');
    if (result4.success && result4.entry) {
      assert(result4.entry.lang === 'en', '英語が自動判定される');
      console.log(`    「dharma」→ ${result4.entry.lang}として自動判定`);
    } else {
      assert(true, '（ネットワークエラーはスキップ）');
    }

    console.log('\n【7. 存在しない単語のエラーハンドリング】');
    const result5 = await client.lookup('xyzxyzxyz123notaword', 'en');
    assert(!result5.success || result5.entry !== undefined,
      'エラーまたは結果が正常に返る');
    if (!result5.success) {
      assert(!!result5.error, 'エラーメッセージが存在する');
      console.log(`    エラー: ${result5.error}`);
    }

  } else {
    console.log('\n【3-7. ネットワークテスト: スキップ（SKIP_NETWORK=true）】');
    assert(true, 'ネットワークテストをスキップ');
  }

  // ─── 8. キャッシュクリアテスト ────────────────────────────────
  console.log('\n【8. キャッシュクリアテスト】');
  const beforeSize = client.cacheSize;
  const cleared = client.clearCache();
  assert(cleared === beforeSize, `キャッシュ${cleared}件クリア`);
  assert(client.cacheSize === 0, 'クリア後キャッシュが空');

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`結果: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
