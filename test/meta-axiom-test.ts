/**
 * Meta-Axiom Tests — メタ公理テスト（10件）
 * Phase 6k: Theory #89 メタ公理体系理論
 */

import { MetaAxiomValidator, SEED_KERNEL } from '../src/axiom-os';

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

console.log('\n=== Meta-Axiom Tests (10) ===\n');

const validator = new MetaAxiomValidator();

// ── 無矛盾性テスト ──

test('consistency: all pairs verified without contradiction', () => {
  const result = validator.validateConsistency();
  assert(result.passed === true, `consistency failed: ${result.details}`);
  assert(result.pairsChecked! > 0, `no pairs checked`);
  console.log(`    ${result.pairsChecked} pairs checked`);
});

test('consistency: pairs count matches C(n,2)', () => {
  const result = validator.validateConsistency();
  const n = SEED_KERNEL.length;
  const expected = (n * (n - 1)) / 2;
  assert(result.pairsChecked === expected,
    `expected ${expected} pairs, got ${result.pairsChecked}`);
});

// ── ゲーデル限界テスト ──

test('godel limit acknowledged', () => {
  validator.validateCompletenessRelative();
  assert(validator.hasLimit('godel_incompleteness') === true,
    'godel_incompleteness not recorded');
});

test('godel limit returns correct statement', () => {
  const limit = validator.acknowledgeGodelLimit();
  assert(limit.acknowledged === true, 'not acknowledged');
  assert(limit.statement.includes('Consistent'), `statement: ${limit.statement}`);
});

// ── 七価閉包テスト ──

test('seven valued closure meta-axiom verified', () => {
  const result = validator.validateSevenValuedClosure();
  assert(result.passed === true, `seven-valued closure failed: ${result.details}`);
});

test('SevenValued_Closure is registered as meta-axiom', () => {
  const metaAxioms = validator.getMetaAxioms();
  const names = metaAxioms.map(m => m.name);
  assert(names.includes('SevenValued_Closure'), 'SevenValued_Closure not found');
});

// ── 最小性テスト ──

test('minimality: no redundant axioms', () => {
  const result = validator.validateMinimality();
  assert(result.passed === true, `redundant axioms found: ${result.details}`);
  assert(result.redundant === 0, `${result.redundant} redundant axioms`);
});

// ── 独立性テスト ──

test('independence: no axiom derivable from others', () => {
  const result = validator.validateIndependence();
  assert(result.passed === true, `derivable axioms found: ${result.details}`);
});

// ── 全検証テスト ──

test('validateAll returns 5 results', () => {
  const results = validator.validateAll();
  assert(results.length === 5, `expected 5, got ${results.length}`);
  const names = results.map(r => r.metaAxiom);
  assert(names.includes('Consistency'), 'missing Consistency');
  assert(names.includes('Independence'), 'missing Independence');
  assert(names.includes('Minimality'), 'missing Minimality');
  assert(names.includes('Completeness_Relative'), 'missing Completeness_Relative');
  assert(names.includes('SevenValued_Closure'), 'missing SevenValued_Closure');
});

test('all meta-axioms pass validation', () => {
  const results = validator.validateAll();
  for (const r of results) {
    assert(r.passed === true, `${r.metaAxiom} failed: ${r.details}`);
  }
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
