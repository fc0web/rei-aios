/**
 * Axiom OS SQLite Layer — CRUD テスト
 *
 * Usage: npx tsx test/axiom-os-test.ts
 */

import { AxiomOSStore } from '../src/axiom-os';

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

function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Axiom OS SQLite — Test Suite            ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log();

  const store = new AxiomOSStore(':memory:', { seed: true });

  // ── persons CRUD ──
  console.log('── persons CRUD ──');

  test('seed: 19 persons loaded (東洋10 + 西洋9)', () => {
    const all = store.getAllPersons();
    assert(all.length === 19, `Expected 19, got ${all.length}`);
  });

  test('getPersonById: buddha', () => {
    const p = store.getPersonById('buddha');
    assert(p !== undefined, 'buddha not found');
    assert(p!.name_en === 'Siddhartha Gautama (Buddha)', `Unexpected name_en: ${p!.name_en}`);
    assert(Array.isArray(p!.domains), 'domains should be array');
    assert(p!.is_free === true, 'is_free should be true');
  });

  test('getPersonById: himiko (卑弥呼)', () => {
    const p = store.getPersonById('himiko');
    assert(p !== undefined, 'himiko not found');
    assert(p!.name_ja === '卑弥呼', `name_ja mismatch: ${p!.name_ja}`);
    assert(p!.thought_keywords.includes('鬼道'), 'thought_keywords should contain 鬼道');
  });

  test('getPersonById: wittgenstein', () => {
    const p = store.getPersonById('wittgenstein');
    assert(p !== undefined, 'wittgenstein not found');
    assert(p!.name_ja === 'ヴィトゲンシュタイン', `name_ja mismatch: ${p!.name_ja}`);
  });

  test('createPerson: new person', () => {
    const p = store.createPerson({
      id: 'test-person',
      name_ja: 'テスト人物',
      name_en: 'Test Person',
      period: '2000 – 2100',
      region: 'global',
      domains: ['philosophy', 'computation'],
      core_axiom: 'Test axiom',
      thought_keywords: ['test', 'keyword'],
      is_free: false,
    });
    assert(p.id === 'test-person', 'id mismatch');
    assert(p.domains.length === 2, 'domains length mismatch');
    assert(p.is_free === false, 'is_free should be false');
  });

  test('updatePerson: update name_en', () => {
    const p = store.updatePerson('test-person', { name_en: 'Updated Name' });
    assert(p !== undefined, 'update returned undefined');
    assert(p!.name_en === 'Updated Name', 'name_en not updated');
    assert(p!.name_ja === 'テスト人物', 'name_ja should not change');
  });

  test('deletePerson: remove test-person', () => {
    assert(store.deletePerson('test-person') === true, 'delete returned false');
    assert(store.getPersonById('test-person') === undefined, 'person still exists');
  });

  test('getPersonsByRegion: east_asia', () => {
    const persons = store.getPersonsByRegion('east_asia');
    assert(persons.length >= 8, `Expected >= 8 east_asia, got ${persons.length}`);
    console.log(`    → ${persons.length} persons in east_asia`);
  });

  test('getPersonsByRegion: europe_modern', () => {
    const persons = store.getPersonsByRegion('europe_modern');
    assert(persons.length >= 6, `Expected >= 6 europe_modern, got ${persons.length}`);
    console.log(`    → ${persons.length} persons in europe_modern`);
  });

  // ── theories CRUD ──
  console.log();
  console.log('── theories CRUD ──');

  test('seed: 3 theories loaded', () => {
    const all = store.getAllTheories();
    assert(all.length === 3, `Expected 3, got ${all.length}`);
  });

  test('createTheory + getTheoryById', () => {
    const t = store.createTheory({
      id: 'test-theory',
      name: 'Test Theory',
      axiom: 'Test axiom statement',
      description: 'A test theory',
      category: 'general',
      constant_ref: 'pi',
    });
    assert(t.id === 'test-theory', 'id mismatch');
    assert(t.constant_ref === 'pi', 'constant_ref mismatch');
    const fetched = store.getTheoryById('test-theory');
    assert(fetched !== undefined, 'theory not found');
  });

  test('updateTheory', () => {
    const t = store.updateTheory('test-theory', { name: 'Updated Theory' });
    assert(t !== undefined, 'update returned undefined');
    assert(t!.name === 'Updated Theory', 'name not updated');
  });

  test('deleteTheory', () => {
    assert(store.deleteTheory('test-theory') === true, 'delete failed');
    assert(store.getTheoryById('test-theory') === undefined, 'theory still exists');
  });

  test('getTheoriesByCategory: general', () => {
    const theories = store.getTheoriesByCategory('general');
    assert(theories.length >= 2, `Expected >= 2, got ${theories.length}`);
  });

  // ── axioms CRUD ──
  console.log();
  console.log('── axioms CRUD ──');

  test('seed: 2 axioms loaded', () => {
    const all = store.getAllAxioms();
    assert(all.length === 2, `Expected 2, got ${all.length}`);
  });

  test('createAxiom with related_concepts array', () => {
    const a = store.createAxiom({
      id: 'AX-TEST',
      concept: 'test',
      name_ja: 'テスト',
      name_en: 'Test',
      tier: 'applied',
      category: 'computation',
      definition: 'A test axiom',
      detailed_explanation: 'Details here',
      related_concepts: ['AX-001', 'AX-005'],
      tags: ['test', 'crud'],
      is_free: true,
    });
    assert(a.related_concepts.length === 2, 'related_concepts length wrong');
    assert(a.tags.includes('crud'), 'tags missing crud');
  });

  test('searchAxiomsByTag: test', () => {
    const results = store.searchAxiomsByTag('test');
    assert(results.length >= 1, 'no results for tag "test"');
  });

  test('getAxiomsByCategory: mathematics', () => {
    const results = store.getAxiomsByCategory('mathematics');
    assert(results.length >= 1, 'no results for category mathematics');
  });

  test('updateAxiom', () => {
    const a = store.updateAxiom('AX-TEST', { definition: 'Updated definition' });
    assert(a !== undefined, 'update returned undefined');
    assert(a!.definition === 'Updated definition', 'definition not updated');
    assert(a!.tags.includes('crud'), 'tags should persist');
  });

  test('deleteAxiom', () => {
    assert(store.deleteAxiom('AX-TEST') === true, 'delete failed');
    assert(store.getAxiomById('AX-TEST') === undefined, 'axiom still exists');
  });

  // ── memories CRUD ──
  console.log();
  console.log('── memories CRUD ──');

  test('createMemory + getMemoryById', () => {
    const m = store.createMemory({
      id: 'mem_test_001',
      kind: 'task_execution',
      timestamp: Date.now(),
      context: 'test context',
      content: 'Memory content for testing',
      tags: ['test', 'memory'],
      outcome: 'success',
    });
    assert(m.id === 'mem_test_001', 'id mismatch');
    const fetched = store.getMemoryById('mem_test_001');
    assert(fetched !== undefined, 'memory not found');
    assert(fetched!.tags.length === 2, 'tags wrong');
  });

  test('getRecentMemories: ordered by timestamp desc', () => {
    store.createMemory({
      id: 'mem_test_002',
      kind: 'insight',
      timestamp: Date.now() + 1000,
      context: '',
      content: 'Newer memory',
      tags: ['test'],
      outcome: 'success',
    });
    const recent = store.getRecentMemories(2);
    assert(recent.length === 2, `Expected 2, got ${recent.length}`);
    assert(recent[0].timestamp >= recent[1].timestamp, 'not sorted by timestamp desc');
  });

  test('getMemoriesByKind: insight', () => {
    const results = store.getMemoriesByKind('insight');
    assert(results.length >= 1, 'no insight memories');
  });

  test('updateMemory', () => {
    const m = store.updateMemory('mem_test_001', { content: 'Updated content' });
    assert(m !== undefined, 'update returned undefined');
    assert(m!.content === 'Updated content', 'content not updated');
  });

  test('deleteMemory', () => {
    assert(store.deleteMemory('mem_test_001') === true, 'delete failed');
    assert(store.deleteMemory('mem_test_002') === true, 'delete 002 failed');
    assert(store.getAllMemories().length === 0, 'memories not empty');
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
