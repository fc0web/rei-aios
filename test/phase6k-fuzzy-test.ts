/**
 * Fuzzy Logic Tests — ファジー論理テスト（12件）
 * Phase 6k: Zadeh（1965年）のファジー論理を七価論理に統一
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

console.log('\n=== Fuzzy Logic Tests (12) ===\n');

const engine = new UniversalLogicEngine();

// ── 境界値テスト ──

test('fuzzy boundary values', () => {
  assert(engine.fuzzyToLogic7(0.0) === 'FALSE',   `fuzzy(0.0) = ${engine.fuzzyToLogic7(0.0)}`);
  assert(engine.fuzzyToLogic7(1.0) === 'TRUE',    `fuzzy(1.0) = ${engine.fuzzyToLogic7(1.0)}`);
  assert(engine.fuzzyToLogic7(0.5) === 'NEITHER', `fuzzy(0.5) = ${engine.fuzzyToLogic7(0.5)}`);
});

test('fuzzy strong regions', () => {
  assert(engine.fuzzyToLogic7(0.9)  === 'TRUE',  `fuzzy(0.9) = ${engine.fuzzyToLogic7(0.9)}`);
  assert(engine.fuzzyToLogic7(0.1)  === 'FALSE', `fuzzy(0.1) = ${engine.fuzzyToLogic7(0.1)}`);
  assert(engine.fuzzyToLogic7(0.75) === 'TRUE',  `fuzzy(0.75) = ${engine.fuzzyToLogic7(0.75)}`);
  assert(engine.fuzzyToLogic7(0.25) === 'FALSE', `fuzzy(0.25) = ${engine.fuzzyToLogic7(0.25)}`);
});

test('fuzzy flowing region', () => {
  assert(engine.fuzzyToLogic7(0.6) === 'FLOWING', `fuzzy(0.6) = ${engine.fuzzyToLogic7(0.6)}`);
  assert(engine.fuzzyToLogic7(0.4) === 'FLOWING', `fuzzy(0.4) = ${engine.fuzzyToLogic7(0.4)}`);
});

test('fuzzy out-of-range values', () => {
  assert(engine.fuzzyToLogic7(-0.5) === 'ZERO',     `fuzzy(-0.5) = ${engine.fuzzyToLogic7(-0.5)}`);
  assert(engine.fuzzyToLogic7(1.5)  === 'INFINITY', `fuzzy(1.5) = ${engine.fuzzyToLogic7(1.5)}`);
});

// ── Łukasiewicz t-norm テスト ──

test('Lukasiewicz AND t-norm', () => {
  const r1 = engine.fuzzyAnd(0.8, 0.6);
  assert(Math.abs(r1 - 0.4) < 1e-10, `fuzzy_and(0.8, 0.6) = ${r1}`);

  const r2 = engine.fuzzyAnd(1.0, 1.0);
  assert(Math.abs(r2 - 1.0) < 1e-10, `fuzzy_and(1.0, 1.0) = ${r2}`);

  const r3 = engine.fuzzyAnd(0.3, 0.3);
  assert(Math.abs(r3 - 0.0) < 1e-10, `fuzzy_and(0.3, 0.3) = ${r3}`);
});

test('Lukasiewicz OR t-conorm', () => {
  const r1 = engine.fuzzyOr(0.4, 0.4);
  assert(Math.abs(r1 - 0.8) < 1e-10, `fuzzy_or(0.4, 0.4) = ${r1}`);

  const r2 = engine.fuzzyOr(0.8, 0.6);
  assert(Math.abs(r2 - 1.0) < 1e-10, `fuzzy_or(0.8, 0.6) = ${r2}`);
});

test('fuzzy NOT', () => {
  assert(Math.abs(engine.fuzzyNot(0.0) - 1.0) < 1e-10, 'fuzzyNot(0.0) != 1.0');
  assert(Math.abs(engine.fuzzyNot(1.0) - 0.0) < 1e-10, 'fuzzyNot(1.0) != 0.0');
  assert(Math.abs(engine.fuzzyNot(0.3) - 0.7) < 1e-10, 'fuzzyNot(0.3) != 0.7');
});

test('fuzzy XOR', () => {
  assert(Math.abs(engine.fuzzyXor(0.8, 0.3) - 0.5) < 1e-10, 'fuzzyXor(0.8, 0.3) != 0.5');
  assert(Math.abs(engine.fuzzyXor(0.5, 0.5) - 0.0) < 1e-10, 'fuzzyXor(0.5, 0.5) != 0.0');
});

// ── メンバーシップ関数テスト ──

test('triangular membership peak', () => {
  const m = engine.membership('triangular', [0.0, 0.5, 1.0], 0.5);
  assert(Math.abs(m - 1.0) < 1e-10, `triangular peak = ${m}`);
});

test('triangular membership edges', () => {
  const m0 = engine.membership('triangular', [0.0, 0.5, 1.0], 0.0);
  assert(Math.abs(m0 - 0.0) < 1e-10, `triangular(0.0) = ${m0}`);

  const m1 = engine.membership('triangular', [0.0, 0.5, 1.0], 1.0);
  assert(Math.abs(m1 - 0.0) < 1e-10, `triangular(1.0) = ${m1}`);

  const m25 = engine.membership('triangular', [0.0, 0.5, 1.0], 0.25);
  assert(Math.abs(m25 - 0.5) < 1e-10, `triangular(0.25) = ${m25}`);
});

test('gaussian membership peak', () => {
  const m = engine.membership('gaussian', [0.5, 0.1], 0.5);
  assert(Math.abs(m - 1.0) < 1e-10, `gaussian peak = ${m}`);
});

test('sigmoid membership center', () => {
  const m = engine.membership('sigmoid', [0.5, 10.0], 0.5);
  assert(Math.abs(m - 0.5) < 1e-10, `sigmoid center = ${m}`);
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
