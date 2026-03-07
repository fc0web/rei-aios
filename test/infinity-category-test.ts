/**
 * ∞-Category Theory Tests — ∞圏論テスト（12件）
 * Phase 6k-HoTT: Theory #91 ∞圏論的宇宙論
 */

import { InfinityCategoryEngine } from '../src/axiom-os';

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

console.log('\n=== ∞-Category Theory Tests (12) ===\n');

const engine = new InfinityCategoryEngine();

// ── n-射の生成 ──

test('n-morphism sequence generation (0,1,2)', () => {
  const m0 = engine.generateNMorphism(0);
  const m1 = engine.generateNMorphism(1);
  const m2 = engine.generateNMorphism(2);
  assert(m0.dimension === 0, `m0 dim: ${m0.dimension}`);
  assert(m1.dimension === 1, `m1 dim: ${m1.dimension}`);
  assert(m2.dimension === 2, `m2 dim: ${m2.dimension}`);
  assert(m0.name === 'Object', `m0 name: ${m0.name}`);
  assert(m1.name === 'Morphism', `m1 name: ${m1.name}`);
  assert(m2.name === 'NaturalTransform', `m2 name: ${m2.name}`);
});

test('∞-morphism converges to ZERO', () => {
  const mInf = engine.generateNMorphism(Infinity);
  assert(mInf.dimension === Infinity, `dim: ${mInf.dimension}`);
  assert(mInf.isConvergence === true, 'not convergence');
  assert(mInf.target === 'ZERO', `target: ${mInf.target}`);
});

// ── 極限テスト ──

test('infinity limit converges to ZERO', () => {
  const limit = engine.computeInfinityLimit();
  assert(limit === 'ZERO', `limit: ${limit}`);
});

test('infinity colimit is INFINITY', () => {
  const colimit = engine.computeInfinityColimit();
  assert(colimit === 'INFINITY', `colimit: ${colimit}`);
});

// ── ∞圏の構築 ──

test('buildLogicInfCategory has correct limits', () => {
  const cat = engine.buildLogicInfCategory();
  assert(cat.name === 'LogicInfCategory', `name: ${cat.name}`);
  assert(cat.limitInf === 'ZERO', `limitInf: ${cat.limitInf}`);
  assert(cat.colimitInf === 'INFINITY', `colimitInf: ${cat.colimitInf}`);
  assert(cat.morphisms.length >= 7, `morphisms: ${cat.morphisms.length}`);
});

// ── FLOWING = 高次経路 ──

test('FLOWING is higher path', () => {
  const p = engine.interpretFlowingAsPath('TRUE', 'FALSE');
  assert(p.pathValue === 'FLOWING', `pathValue: ${p.pathValue}`);
  assert(p.source === 'TRUE', `source: ${p.source}`);
  assert(p.target === 'FALSE', `target: ${p.target}`);
});

// ── 整合性条件 ──

test('coherence conditions auto-satisfied', () => {
  const morphisms = engine.generateMorphismSequence(3);
  const result = engine.verifyCoherence(morphisms);
  assert(result.coherent === true, `not coherent: ${result.details}`);
  assert(result.morphisms === 4, `count: ${result.morphisms}`);
});

// ── ∞-Groupoid ──

test('seven valued is inf-groupoid', () => {
  assert(engine.verifySevenValuedIsInfGroupoid() === true,
    'seven-valued is not inf-groupoid');
});

// ── 高次経路 ──

test('higher path between paths exists', () => {
  const p = engine.interpretFlowingAsPath('TRUE', 'FLOWING');
  const q = engine.interpretFlowingAsPath('TRUE', 'FLOWING');
  assert(engine.hasHigherPath(p, q) === true, 'no higher path');
});

test('higher path requires same endpoints', () => {
  const p = engine.interpretFlowingAsPath('TRUE', 'FLOWING');
  const q = engine.interpretFlowingAsPath('FALSE', 'ZERO');
  assert(engine.hasHigherPath(p, q) === false, 'should not have higher path');
});

// ── 逆経路 ──

test('inf-groupoid has all inverses', () => {
  const values = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'] as const;
  for (const v of values) {
    assert(engine.hasInversePath(v) === true, `no inverse for ${v}`);
  }
});

// ── 射列テスト ──

test('morphism sequence is correctly ordered', () => {
  const seq = engine.generateMorphismSequence(5);
  assert(seq.length === 6, `length: ${seq.length}`);
  for (let i = 0; i < seq.length; i++) {
    assert(seq[i].dimension === i, `dim at ${i}: ${seq[i].dimension}`);
  }
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
