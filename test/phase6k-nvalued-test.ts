/**
 * N-Valued Logic Tests — n値論理テスト（10件）
 * Phase 6k: 一般化n値論理を七価論理に統一
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

console.log('\n=== N-Valued Logic Tests (10) ===\n');

const engine = new UniversalLogicEngine();

// ── 3値論理 ──

test('3-valued Lukasiewicz via nvalued', () => {
  assert(engine.nvaluedToLogic7(3, 0) === 'FALSE',   `nvalued(3,0) = ${engine.nvaluedToLogic7(3, 0)}`);
  assert(engine.nvaluedToLogic7(3, 1) === 'NEITHER', `nvalued(3,1) = ${engine.nvaluedToLogic7(3, 1)}`);
  assert(engine.nvaluedToLogic7(3, 2) === 'TRUE',    `nvalued(3,2) = ${engine.nvaluedToLogic7(3, 2)}`);
});

// ── 4値論理 ──

test('4-valued catuskoti via nvalued', () => {
  assert(engine.nvaluedToLogic7(4, 0) === 'FALSE', `nvalued(4,0) = ${engine.nvaluedToLogic7(4, 0)}`);
  assert(engine.nvaluedToLogic7(4, 3) === 'TRUE',  `nvalued(4,3) = ${engine.nvaluedToLogic7(4, 3)}`);
});

test('4-valued middle values are FLOWING', () => {
  // 偶数n値の中間はFLOWING
  assert(engine.nvaluedToLogic7(4, 1) === 'FLOWING', `nvalued(4,1) = ${engine.nvaluedToLogic7(4, 1)}`);
  assert(engine.nvaluedToLogic7(4, 2) === 'FLOWING', `nvalued(4,2) = ${engine.nvaluedToLogic7(4, 2)}`);
});

// ── 5値論理 ──

test('5-valued logic', () => {
  assert(engine.nvaluedToLogic7(5, 0) === 'FALSE',   `nvalued(5,0) = ${engine.nvaluedToLogic7(5, 0)}`);
  assert(engine.nvaluedToLogic7(5, 4) === 'TRUE',    `nvalued(5,4) = ${engine.nvaluedToLogic7(5, 4)}`);
  assert(engine.nvaluedToLogic7(5, 2) === 'NEITHER', `nvalued(5,2) = ${engine.nvaluedToLogic7(5, 2)}`);
});

test('5-valued non-center values are FLOWING', () => {
  assert(engine.nvaluedToLogic7(5, 1) === 'FLOWING', `nvalued(5,1) = ${engine.nvaluedToLogic7(5, 1)}`);
  assert(engine.nvaluedToLogic7(5, 3) === 'FLOWING', `nvalued(5,3) = ${engine.nvaluedToLogic7(5, 3)}`);
});

// ── 9値論理 ──

test('9-valued logic normalization', () => {
  assert(engine.nvaluedToLogic7(9, 0) === 'FALSE',   `nvalued(9,0) = ${engine.nvaluedToLogic7(9, 0)}`);
  assert(engine.nvaluedToLogic7(9, 8) === 'TRUE',    `nvalued(9,8) = ${engine.nvaluedToLogic7(9, 8)}`);
  assert(engine.nvaluedToLogic7(9, 4) === 'NEITHER', `nvalued(9,4) = ${engine.nvaluedToLogic7(9, 4)}`);
});

// ── normalize経由テスト ──

test('nvalued normalize via UniversalLogicType', () => {
  assert(engine.normalizeToLogic7({ kind: 'NValued', n: 3, index: 0 }) === 'FALSE',   'nvalued(3,0)');
  assert(engine.normalizeToLogic7({ kind: 'NValued', n: 5, index: 2 }) === 'NEITHER', 'nvalued(5,2)');
  assert(engine.normalizeToLogic7({ kind: 'NValued', n: 9, index: 8 }) === 'TRUE',    'nvalued(9,8)');
});

// ── 端点の一般則 ──

test('nvalued endpoints are always FALSE/TRUE', () => {
  for (const n of [2, 3, 4, 5, 7, 9, 16, 100]) {
    assert(engine.nvaluedToLogic7(n, 0)     === 'FALSE', `nvalued(${n},0) != FALSE`);
    assert(engine.nvaluedToLogic7(n, n - 1) === 'TRUE',  `nvalued(${n},${n-1}) != TRUE`);
  }
});

// ── 奇数n値の中間はNEITHER ──

test('odd n: center is NEITHER', () => {
  for (const n of [3, 5, 7, 9]) {
    const mid = (n - 1) / 2;
    assert(engine.nvaluedToLogic7(n, mid) === 'NEITHER',
      `nvalued(${n},${mid}) = ${engine.nvaluedToLogic7(n, mid)}`);
  }
});

// ── 偶数n値の中間はFLOWING ──

test('even n: center is FLOWING', () => {
  for (const n of [4, 6, 8, 10]) {
    const mid = (n - 1) / 2;
    const midIdx = Math.floor(mid);
    // 偶数nでは完全な中間が存在しないため、中間付近はFLOWING
    assert(engine.nvaluedToLogic7(n, midIdx) === 'FLOWING',
      `nvalued(${n},${midIdx}) = ${engine.nvaluedToLogic7(n, midIdx)}`);
  }
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
