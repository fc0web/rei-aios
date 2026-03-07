/**
 * Universal Logic Integration Tests — 統合テスト（8件）
 * Phase 6k: 全論理体系の七価への統一を検証
 */

import { UniversalLogicEngine } from '../src/axiom-os/universal-logic-engine';
import type { UniversalLogicType } from '../src/axiom-os/universal-logic-engine';

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

console.log('\n=== Universal Logic Integration Tests (8) ===\n');

const engine = new UniversalLogicEngine();

// ── 全体系統合テスト ──

test('all logic systems project to logic7', () => {
  assert(engine.normalizeToLogic7({ kind: 'Continuous', value: 1.0 })    === 'TRUE',    'fuzzy TRUE');
  assert(engine.normalizeToLogic7({ kind: 'Catuskoti', value: 2 })       === 'BOTH',    'catuskoti BOTH');
  assert(engine.normalizeToLogic7({ kind: 'Lukasiewicz', value: 1 })     === 'NEITHER', 'luk NEITHER');
  assert(engine.normalizeToLogic7({ kind: 'NValued', n: 5, index: 0 })   === 'FALSE',   'nvalued FALSE');
});

test('historical unification: nagarjuna == lukasiewicz at NEITHER', () => {
  assert(
    engine.normalizeToLogic7({ kind: 'Catuskoti', value: 3 }) ===
    engine.normalizeToLogic7({ kind: 'Lukasiewicz', value: 1 }),
    'nagarjuna != lukasiewicz at NEITHER',
  );
});

test('mixed operation: fuzzy normalize AND logic7', () => {
  // normalize(fuzzy(0.8)) → TRUE
  const fuzzyResult = engine.normalizeToLogic7({ kind: 'Continuous', value: 0.8 });
  assert(fuzzyResult === 'TRUE', `fuzzy(0.8) normalized = ${fuzzyResult}`);
});

test('membership function triangular peak', () => {
  const m = engine.membership('triangular', [0.0, 0.5, 1.0], 0.5);
  assert(Math.abs(m - 1.0) < 1e-10, `triangular peak = ${m}`);
});

test('membership function gaussian peak', () => {
  const m = engine.membership('gaussian', [0.5, 0.1], 0.5);
  assert(Math.abs(m - 1.0) < 1e-10, `gaussian peak = ${m}`);
});

test('projection theorem: all systems map to valid logic7', () => {
  assert(engine.verifyProjectionTheorem() === true, 'projection theorem failed');
});

test('quantum logic normalizes via probability', () => {
  // |ψ⟩ = 0.6|0⟩ + 0.8|1⟩ → prob = 0.36 + 0.64 = 1.0
  const result = engine.normalizeToLogic7({ kind: 'Quantum', re: 0.6, im: 0.8 });
  assert(result === 'TRUE', `quantum(0.6,0.8) = ${result}`);

  // |ψ⟩ = 0|0⟩ + 0|1⟩ → prob = 0.0
  const zero = engine.normalizeToLogic7({ kind: 'Quantum', re: 0, im: 0 });
  assert(zero === 'FALSE', `quantum(0,0) = ${zero}`);
});

test('discrete values pass through unchanged', () => {
  const values = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'] as const;
  for (const v of values) {
    const result = engine.normalizeToLogic7({ kind: 'Discrete', value: v });
    assert(result === v, `discrete ${v} = ${result}`);
  }
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
