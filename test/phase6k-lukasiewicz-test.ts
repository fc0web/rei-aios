/**
 * Łukasiewicz 3-Valued Logic Tests — Łukasiewicz3値テスト（5件）
 * Phase 6k: Łukasiewicz（1920年ポーランド）の3値論理を七価論理に統一
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

console.log('\n=== Łukasiewicz 3-Valued Logic Tests (5) ===\n');

const engine = new UniversalLogicEngine();

// ── 基本マッピング ──

test('lukasiewicz basic mapping', () => {
  assert(engine.lukasiewiczToLogic7(0) === 'FALSE',   `luk(0) = ${engine.lukasiewiczToLogic7(0)}`);
  assert(engine.lukasiewiczToLogic7(1) === 'NEITHER', `luk(1) = ${engine.lukasiewiczToLogic7(1)}`);
  assert(engine.lukasiewiczToLogic7(2) === 'TRUE',    `luk(2) = ${engine.lukasiewiczToLogic7(2)}`);
});

test('lukasiewicz normalize via UniversalLogicType', () => {
  assert(engine.normalizeToLogic7({ kind: 'Lukasiewicz', value: 0 }) === 'FALSE',   'luk FALSE');
  assert(engine.normalizeToLogic7({ kind: 'Lukasiewicz', value: 1 }) === 'NEITHER', 'luk NEITHER');
  assert(engine.normalizeToLogic7({ kind: 'Lukasiewicz', value: 2 }) === 'TRUE',    'luk TRUE');
});

test('lukasiewicz is nvalued(3) alias', () => {
  // 糖衣構文と汎用構文が同じ結果を返す
  assert(engine.verifyLukasiewiczIsNValuedAlias() === true,
    'lukasiewicz should be nvalued(3) alias');
});

test('lukasiewicz values match nvalued(3) individually', () => {
  assert(engine.lukasiewiczToLogic7(0) === engine.nvaluedToLogic7(3, 0), 'luk(0) != nvalued(3,0)');
  assert(engine.lukasiewiczToLogic7(1) === engine.nvaluedToLogic7(3, 1), 'luk(1) != nvalued(3,1)');
  assert(engine.lukasiewiczToLogic7(2) === engine.nvaluedToLogic7(3, 2), 'luk(2) != nvalued(3,2)');
});

test('lukasiewicz covers exactly 3 of 7 values', () => {
  const results = new Set<string>();
  for (const v of [0, 1, 2] as const) {
    results.add(engine.lukasiewiczToLogic7(v));
  }
  assert(results.size === 3, `unique values: ${results.size}`);
  assert(results.has('TRUE'), 'missing TRUE');
  assert(results.has('FALSE'), 'missing FALSE');
  assert(results.has('NEITHER'), 'missing NEITHER');
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
