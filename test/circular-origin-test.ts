/**
 * Circular Origin Tests — 円環根源テスト（8件）
 * Phase 6k: Theory #90 円環根源論
 */

import { CircularOriginEngine } from '../src/axiom-os';

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

console.log('\n=== Circular Origin Tests (8) ===\n');

const engine = new CircularOriginEngine();

// ── ZERO生成テスト ──

test('ZERO generates axioms', () => {
  const axioms = engine.generateFromZero();
  assert(axioms.length > 0, `no axioms generated, got ${axioms.length}`);
  console.log(`    generated ${axioms.length} axioms from ZERO`);
});

// ── ZERO還元テスト ──

test('all seven values reduce to ZERO', () => {
  const values = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'FLOWING'];
  for (const v of values) {
    const reduced = engine.reduceToZero(v);
    assert(reduced === 'ZERO', `${v} reduced to ${reduced}, expected ZERO`);
  }
});

// ── 自己同一性テスト ──

test('ZERO is self-identical', () => {
  const result = engine.reduceToZero('ZERO');
  assert(result === 'ZERO', `ZERO reduced to ${result}`);
  assert(engine.verifySelfIdentity() === true, 'self-identity failed');
});

// ── 円環性テスト ──

test('circularity verified: generate -> reduce -> ZERO', () => {
  const cycle = engine.verifyCircularity();
  assert(cycle.circular === true, 'circularity not verified');
  assert(cycle.reduced.every(v => v === 'ZERO'), 'not all reduced to ZERO');
});

// ── 縁起テスト ──

test('pratityasamutpada: all values depend on ZERO', () => {
  const cycle = engine.verifyCircularity();
  assert(cycle.pratityasamutpada === true, 'dependent origination not verified');
});

test('dependent origin chain traces back to ZERO', () => {
  const result = engine.dependentOrigin('TRUE');
  assert(result.origin === 'ZERO', `origin: ${result.origin}`);
  assert(result.dependent === true, 'not dependent');
  assert(result.chain.length >= 2, `chain too short: ${result.chain.length}`);
});

// ── 根源原理テスト ──

test('root principle is ineffable (Wittgenstein)', () => {
  assert(engine.isIneffable() === true, 'not ineffable');
  const root = engine.getRootPrinciple();
  assert(root.logic7Value === 'ZERO', `logic7: ${root.logic7Value}`);
  assert(root.ontology.length >= 5, `ontology count: ${root.ontology.length}`);
});

test('seven values all originate from ZERO', () => {
  assert(engine.verifySevenValuesFromZero() === true,
    'not all seven values originate from ZERO');
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
