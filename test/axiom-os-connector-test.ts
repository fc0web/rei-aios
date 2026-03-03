/**
 * Axiom OS Connector — 連携テスト
 *
 * Usage: npx tsx test/axiom-os-connector-test.ts
 */

import { AxiomOSStore } from '../src/axiom-os';
import { AxiomOSConnector } from '../src/axiom-os-connector';

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

function assertIncludes(ids: string[], expected: string, label: string) {
  assert(ids.includes(expected), `${label}: expected "${expected}" in [${ids.join(', ')}]`);
}

function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Axiom OS Connector — Test Suite         ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log();

  const store = new AxiomOSStore(':memory:', { seed: true });
  const connector = new AxiomOSConnector(store);

  // ── 人物検索 ──
  console.log('── searchPersons ──');

  test('「縁起について教えて」→ 仏陀・龍樹が返る', () => {
    const hits = connector.searchPersons('縁起について教えて');
    const ids = hits.map(h => h.item.id);
    console.log(`    → ${hits.map(h => `${h.item.name_ja}(${h.score})`).join(', ')}`);
    assertIncludes(ids, 'buddha', '仏陀');
    assertIncludes(ids, 'nagarjuna', '龍樹');
  });

  test('「無為自然について」→ 老子・荘子が返る', () => {
    const hits = connector.searchPersons('無為自然について');
    const ids = hits.map(h => h.item.id);
    console.log(`    → ${hits.map(h => `${h.item.name_ja}(${h.score})`).join(', ')}`);
    assertIncludes(ids, 'laozi', '老子');
    // 荘子は「道」キーワード経由でヒットする可能性
  });

  test('「弁証法」→ ヘーゲルが返る', () => {
    const hits = connector.searchPersons('弁証法');
    const ids = hits.map(h => h.item.id);
    console.log(`    → ${hits.map(h => `${h.item.name_ja}(${h.score})`).join(', ')}`);
    assertIncludes(ids, 'hegel', 'ヘーゲル');
  });

  test('「定言命法」→ カントが返る', () => {
    const hits = connector.searchPersons('定言命法');
    const ids = hits.map(h => h.item.id);
    console.log(`    → ${hits.map(h => `${h.item.name_ja}(${h.score})`).join(', ')}`);
    assertIncludes(ids, 'kant', 'カント');
  });

  test('「言語ゲームとは」→ ヴィトゲンシュタインが返る', () => {
    const hits = connector.searchPersons('言語ゲームとは');
    const ids = hits.map(h => h.item.id);
    console.log(`    → ${hits.map(h => `${h.item.name_ja}(${h.score})`).join(', ')}`);
    assertIncludes(ids, 'wittgenstein', 'ヴィトゲンシュタイン');
  });

  test('「戒律 渡海」→ 鑑真が返る', () => {
    const hits = connector.searchPersons('戒律 渡海');
    const ids = hits.map(h => h.item.id);
    console.log(`    → ${hits.map(h => `${h.item.name_ja}(${h.score})`).join(', ')}`);
    assertIncludes(ids, 'ganjin', '鑑真');
  });

  test('スコア順: thought_keywords完全一致 > 部分一致', () => {
    const hits = connector.searchPersons('仁');
    assert(hits.length > 0, 'no hits');
    assert(hits[0].item.id === 'confucius', `Expected confucius first, got ${hits[0].item.id}`);
  });

  // ── 理論検索 ──
  console.log();
  console.log('── searchTheories ──');

  test('「四価論理とは」→ dfumt-catuskoti が返る', () => {
    const hits = connector.searchTheories('四価論理とは');
    const ids = hits.map(h => h.item.id);
    console.log(`    → ${hits.map(h => `${h.item.name}(${h.score})`).join(', ')}`);
    assertIncludes(ids, 'dfumt-catuskoti', '四価論理');
  });

  test('「冪等性」→ dfumt-idempotency が返る', () => {
    const hits = connector.searchTheories('冪等性');
    const ids = hits.map(h => h.item.id);
    console.log(`    → ${hits.map(h => `${h.item.name}(${h.score})`).join(', ')}`);
    assertIncludes(ids, 'dfumt-idempotency', '冪等性');
  });

  test('「意識 C1」→ dfumt-consciousness-math が返る', () => {
    const hits = connector.searchTheories('意識 C1');
    const ids = hits.map(h => h.item.id);
    console.log(`    → ${hits.map(h => `${h.item.name}(${h.score})`).join(', ')}`);
    assertIncludes(ids, 'dfumt-consciousness-math', '意識数学');
  });

  test('「螺旋」→ dfumt-spiral-number が返る', () => {
    const hits = connector.searchTheories('螺旋');
    const ids = hits.map(h => h.item.id);
    console.log(`    → ${hits.map(h => `${h.item.name}(${h.score})`).join(', ')}`);
    assertIncludes(ids, 'dfumt-spiral-number', '螺旋数');
  });

  test('「layer 空間」→ dfumt-space-layer が返る', () => {
    const hits = connector.searchTheories('layer 空間');
    const ids = hits.map(h => h.item.id);
    console.log(`    → ${hits.map(h => `${h.item.name}(${h.score})`).join(', ')}`);
    assertIncludes(ids, 'dfumt-space-layer', '空間層');
  });

  // ── 横断検索 ──
  console.log();
  console.log('── search (横断検索) ──');

  test('「縁起」→ persons + axioms 両方ヒット', () => {
    const result = connector.search('縁起');
    assert(result.persons.length > 0, 'no person hits');
    assert(result.axioms.length > 0, 'no axiom hits');
    console.log(`    → persons: ${result.persons.map(h => h.item.name_ja).join(', ')}`);
    console.log(`    → axioms: ${result.axioms.map(h => h.item.name_ja).join(', ')}`);
  });

  // ── getPersonThought ──
  console.log();
  console.log('── getPersonThought ──');

  test('buddha の思想取得', () => {
    const thought = connector.getPersonThought('buddha');
    assert(thought !== undefined, 'undefined');
    assert(thought!.core_axiom.includes('四諦'), 'core_axiom should mention 四諦');
    assert(thought!.thought_keywords.includes('縁起'), 'keywords should include 縁起');
    console.log(`    → 公理: ${thought!.core_axiom.slice(0, 30)}...`);
    console.log(`    → 関連理論: ${thought!.relatedTheories.map(t => t.name).join(', ') || '(none)'}`);
  });

  test('kant の思想取得', () => {
    const thought = connector.getPersonThought('kant');
    assert(thought !== undefined, 'undefined');
    assert(thought!.core_axiom.includes('純粋理性批判'), 'core_axiom should mention 純粋理性批判');
    assert(thought!.thought_keywords.length >= 5, 'should have 5+ keywords');
  });

  test('存在しないID → undefined', () => {
    const thought = connector.getPersonThought('nonexistent');
    assert(thought === undefined, 'should be undefined');
  });

  // ── AI記憶 ──
  console.log();
  console.log('── Memory (保存・取得) ──');

  test('saveMemory: 記憶を保存', () => {
    const m = connector.saveMemory(
      '仏陀の縁起について調査した',
      'ユーザーが縁起について質問',
      { kind: 'task_execution', tags: ['仏教', '縁起'], outcome: 'success' },
    );
    assert(m.id.startsWith('mem_'), `id should start with mem_: ${m.id}`);
    assert(m.content === '仏陀の縁起について調査した', 'content mismatch');
    assert(m.tags.includes('縁起'), 'tags should include 縁起');
  });

  test('saveMemory: 2つ目の記憶を保存', () => {
    const m = connector.saveMemory(
      '四価論理理論をユーザーに説明した',
      '四価論理クエリ',
      { kind: 'insight', tags: ['D-FUMT', '四価論理'] },
    );
    assert(m.kind === 'insight', 'kind should be insight');
  });

  test('getRecentMemories: 最新順で取得', () => {
    const memories = connector.getRecentMemories(10);
    assert(memories.length === 2, `Expected 2, got ${memories.length}`);
    assert(memories[0].timestamp >= memories[1].timestamp, 'should be sorted desc');
  });

  test('searchMemoriesByTag: タグ検索', () => {
    const results = connector.searchMemoriesByTag('縁起');
    assert(results.length === 1, `Expected 1, got ${results.length}`);
    assert(results[0].content.includes('仏陀'), 'content should mention 仏陀');
  });

  // ── Cleanup ──
  store.close();

  // ── Summary ──
  console.log();
  console.log('═'.repeat(42));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(42));

  process.exit(failed > 0 ? 1 : 0);
}

main();
