/**
 * Catuṣkoṭi Logic Tests — 四句分別テスト（6件）
 * Phase 6k: 龍樹（2世紀インド）の四句分別を七価論理に統一
 */

import { UniversalLogicEngine } from '../src/axiom-os/universal-logic-engine';

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

console.log('\n=== Catuṣkoṭi Logic Tests (6) ===\n');

const engine = new UniversalLogicEngine();

// ── 四句分別 → 七価マッピング ──

test('catuskoti maps to logic7 core', () => {
  assert(engine.catuskotiToLogic7(0) === 'TRUE',    `catuskoti(0) = ${engine.catuskotiToLogic7(0)}`);
  assert(engine.catuskotiToLogic7(1) === 'FALSE',   `catuskoti(1) = ${engine.catuskotiToLogic7(1)}`);
  assert(engine.catuskotiToLogic7(2) === 'BOTH',    `catuskoti(2) = ${engine.catuskotiToLogic7(2)}`);
  assert(engine.catuskotiToLogic7(3) === 'NEITHER', `catuskoti(3) = ${engine.catuskotiToLogic7(3)}`);
});

test('catuskoti normalize produces correct logic7', () => {
  assert(engine.normalizeToLogic7({ kind: 'Catuskoti', value: 0 }) === 'TRUE',    'catuskoti TRUE');
  assert(engine.normalizeToLogic7({ kind: 'Catuskoti', value: 1 }) === 'FALSE',   'catuskoti FALSE');
  assert(engine.normalizeToLogic7({ kind: 'Catuskoti', value: 2 }) === 'BOTH',    'catuskoti BOTH');
  assert(engine.normalizeToLogic7({ kind: 'Catuskoti', value: 3 }) === 'NEITHER', 'catuskoti NEITHER');
});

test('catuskoti is subset of logic7', () => {
  // INFINITY / ZERO / FLOWING には射影されない（七価の拡張部分）
  assert(engine.verifyCatuskotiIsSubset() === true, 'catuskoti should be subset of logic7');
});

test('catuskoti values do not map to extended values', () => {
  const extendedValues = ['INFINITY', 'ZERO', 'FLOWING'];
  for (const v of [0, 1, 2, 3] as const) {
    const mapped = engine.catuskotiToLogic7(v);
    assert(!extendedValues.includes(mapped),
      `catuskoti(${v}) = ${mapped} is an extended value`);
  }
});

test('catuskoti covers exactly 4 of 7 values', () => {
  const results = new Set<string>();
  for (const v of [0, 1, 2, 3] as const) {
    results.add(engine.catuskotiToLogic7(v));
  }
  assert(results.size === 4, `unique values: ${results.size}`);
  assert(results.has('TRUE'), 'missing TRUE');
  assert(results.has('FALSE'), 'missing FALSE');
  assert(results.has('BOTH'), 'missing BOTH');
  assert(results.has('NEITHER'), 'missing NEITHER');
});

test('nagarjuna lukasiewicz unification (core theorem)', () => {
  // 龍樹とŁukasiewiczの「不定」概念が七価で統一される
  assert(engine.verifyNagarjunaLukasiewiczUnification() === true,
    'nagarjuna-lukasiewicz unification failed');
  assert(
    engine.catuskotiToLogic7(3) === engine.lukasiewiczToLogic7(1),
    'catuskoti(neither) != lukasiewicz(unknown)',
  );
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
