/**
 * Homotopy Type Theory Tests — HoTTテスト（15件）
 * Phase 6k-HoTT: Theory #92 ホモトピー型理論的論理
 */

import { HomotopyTypeEngine } from '../src/axiom-os';
import type { SevenLogicValue } from '../src/axiom-os';

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

console.log('\n=== Homotopy Type Theory Tests (15) ===\n');

const engine = new HomotopyTypeEngine();

// ── 恒等型テスト ──

test('identity type of TRUE is refl', () => {
  const idType = engine.buildIdentityType('TRUE', 'TRUE');
  assert(idType.kind === 'refl', `kind: ${idType.kind}`);
  assert(idType.exists === true, 'should exist');
  assert(idType.normalized === 'TRUE', `normalized: ${idType.normalized}`);
});

test('BOTH corresponds to identity type with path (TRUE=FALSE)', () => {
  const idType = engine.buildIdentityType('TRUE', 'FALSE');
  assert(idType.exists === true, 'path should exist');
  assert(idType.normalized === 'BOTH', `normalized: ${idType.normalized}`);
  assert(idType.kind === 'both', `kind: ${idType.kind}`);
});

test('NEITHER self-identity has refl path', () => {
  const idType = engine.buildIdentityType('NEITHER', 'NEITHER');
  // NEITHER は自己反射律により refl(NEITHER) が存在
  assert(idType.kind === 'refl', `kind: ${idType.kind}`);
  assert(idType.exists === true, 'refl should exist');
});

// ── FLOWING = ホモトピー ──

test('FLOWING is homotopy between paths', () => {
  const p = engine.buildPath('TRUE', 'FALSE');
  const q = engine.buildPath('TRUE', 'FALSE');
  const h = engine.flowingAsHomotopy(p, q);
  assert(h.value === 'FLOWING', `value: ${h.value}`);
  assert(h.homotopic === true, 'should be homotopic');
});

test('non-homotopic paths yield NEITHER', () => {
  const p = engine.buildPath('TRUE', 'FALSE');
  const q = engine.buildPath('ZERO', 'INFINITY');
  const h = engine.flowingAsHomotopy(p, q);
  assert(h.value === 'NEITHER', `value: ${h.value}`);
  assert(h.homotopic === false, 'should not be homotopic');
});

// ── 単価性テスト ──

test('univalence: isomorphic logics are equal', () => {
  const result = engine.verifyUnivalence('Lukasiewicz', 'CatuskotiNeither');
  assert(result.isomorphic === true, 'should be isomorphic');
  assert(result.equal === true, 'should be equal');
  assert(result.univalent === true, 'should be univalent');
});

test('univalence: same system is trivially equal', () => {
  const result = engine.verifyUnivalence('Logic7', 'Logic7');
  assert(result.isomorphic === true, 'same system should be isomorphic');
  assert(result.equal === true, 'same system should be equal');
});

// ── 切り詰めテスト ──

test('truncation(0) is classical logic', () => {
  const t0 = engine.truncate(0);
  assert(t0.values.length === 2, `values: ${t0.values.length}`);
  assert(t0.values.includes('TRUE'), 'missing TRUE');
  assert(t0.values.includes('FALSE'), 'missing FALSE');
  assert(t0.name === 'PropositionalLogic', `name: ${t0.name}`);
});

test('truncation(1) is catuskoti', () => {
  const t1 = engine.truncate(1);
  assert(t1.values.length === 4, `values: ${t1.values.length}`);
  assert(t1.values.includes('BOTH'), 'missing BOTH');
  assert(t1.values.includes('NEITHER'), 'missing NEITHER');
});

test('truncation(inf) is seven valued (no truncation)', () => {
  const tInf = engine.truncate(Infinity);
  assert(tInf.values.length === 7, `values: ${tInf.values.length}`);
  assert(tInf.values.includes('INFINITY'), 'missing INFINITY');
  assert(tInf.values.includes('ZERO'), 'missing ZERO');
  assert(tInf.values.includes('FLOWING'), 'missing FLOWING');
});

// ── 最小完全性テスト ──

test('seven valued is minimal complete (HoTT proof)', () => {
  assert(engine.isMinimalComplete() === true, 'not minimal complete');
});

// ── 経路帰納法テスト ──

test('path induction base case', () => {
  const values: SevenLogicValue[] = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'];
  for (const v of values) {
    const path = engine.buildPath(v, v);
    const result = engine.pathInduction(
      (a) => `base(${a})`,
      v, v, path,
    );
    assert(result.value === `base(${v})`, `value: ${result.value}`);
    assert(result.baseCaseApplied === true, `base not applied for ${v}`);
  }
});

// ── 単価性がD-FUMTを基礎づけるテスト ──

test('univalence grounds DFUMT universality', () => {
  assert(engine.univalenceGroundsDFUMT() === true,
    'univalence does not ground DFUMT');
});

// ── FLOWING経路テスト ──

test('FLOWING path exists between TRUE and FLOWING', () => {
  const idType = engine.buildIdentityType('TRUE', 'FLOWING');
  assert(idType.exists === true, 'path should exist');
  assert(idType.kind === 'flowing', `kind: ${idType.kind}`);
  assert(idType.normalized === 'FLOWING', `normalized: ${idType.normalized}`);
});

test('empty path between unrelated values yields NEITHER', () => {
  const idType = engine.buildIdentityType('INFINITY', 'NEITHER');
  assert(idType.exists === false, 'should not exist');
  assert(idType.kind === 'empty', `kind: ${idType.kind}`);
  assert(idType.normalized === 'NEITHER', `normalized: ${idType.normalized}`);
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
