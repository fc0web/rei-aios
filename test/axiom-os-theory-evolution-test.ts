import { TheoryEvolution } from '../src/axiom-os/theory-evolution';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';
import { ContradictionDetector } from '../src/axiom-os/contradiction-detector';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function assertEq<T>(a: T, b: T, m?: string) {
  if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`);
}

console.log('\n=== TheoryEvolution Tests ===\n');

const te = new TheoryEvolution();

test('全理論数=75（進化前）', () => {
  assertEq(te.getAllTheories().length, 75, 'Should start with 75');
});

test('使用履歴の記録', () => {
  te.recordUsage('dfumt-catuskoti', 'test');
  te.recordUsage('dfumt-catuskoti', 'test2');
  const s = te.summarize();
  assert(s.totalUsage >= 2, 'Usage should be recorded');
  assertEq(s.mostUsed, 'dfumt-catuskoti', 'Most used should be catuskoti');
});

test('手動登録で理論数が増える', () => {
  te.register({
    id: 'dfumt-test-theory',
    axiom: 'test axiom',
    category: 'general',
    keywords: ['test'],
  });
  assert(te.getAllTheories().length > 75, 'Should have more than 75');
  assert(te.getEvolved().length === 1, 'Should have 1 evolved');
});

test('手動登録理論のconfidence=ZERO（未観測）', () => {
  const e = te.getEvolved().find(t => t.id === 'dfumt-test-theory');
  assertEq(e!.confidence, 'ZERO', 'New theory starts as ZERO');
});

test('validate で confidence=TRUE に昇格', () => {
  te.validate('dfumt-test-theory');
  const e = te.getEvolved().find(t => t.id === 'dfumt-test-theory');
  assertEq(e!.confidence, 'TRUE', 'Validated theory should be TRUE');
  assertEq(te.getValidated().length, 1, 'Should have 1 validated');
});

test('2理論の合成', () => {
  const a = SEED_KERNEL[0];
  const b = SEED_KERNEL[1];
  const composed = te.compose(a, b);
  assert(composed.id.includes('composed'), `id=${composed.id}`);
  assert(composed.axiom.includes('⊗'), 'axiom should contain ⊗');
  assert(composed.parentIds.includes(a.id), 'Should have parent A');
  assert(composed.parentIds.includes(b.id), 'Should have parent B');
  assertEq(composed.generation, 1, 'generation should be 1');
});

test('矛盾解決から理論生成', () => {
  const cd = new ContradictionDetector();
  const entry = cd.detect('TRUE', 'FALSE');
  assert(entry !== null, 'Need contradiction');
  cd.resolve(entry!.id, 'omega_convergence');
  const resolved = cd.get(entry!.id)!;
  const evolved = te.evolveFromContradiction(resolved);
  assert(evolved !== null, 'Should generate theory from contradiction');
  assertEq(evolved!.source, 'contradiction_resolved', 'source should be contradiction_resolved');
  assert(evolved!.axiom.includes('Ω'), 'axiom should contain Ω');
});

test('未解決矛盾からは理論生成されない', () => {
  const cd = new ContradictionDetector();
  const entry = cd.detect('TRUE', 'FALSE');
  const evolved = te.evolveFromContradiction(entry!);
  assert(evolved === null, 'Unresolved contradiction should not generate theory');
});

test('使用頻度による帰納（2理論以上必要）', () => {
  const te2 = new TheoryEvolution();
  te2.recordUsage('dfumt-zero-pi');
  const r1 = te2.induceFromUsage();
  assert(r1 === null, 'Need 2+ theories for induction');
  te2.recordUsage('dfumt-catuskoti');
  te2.recordUsage('dfumt-catuskoti');
  const r2 = te2.induceFromUsage();
  assert(r2 !== null, 'Should induce from 2 theories');
  assertEq(r2!.source, 'usage_pattern', 'source should be usage_pattern');
});

test('10回使用でconfidence=TRUE昇格', () => {
  const te3 = new TheoryEvolution();
  const t = te3.register({ id: 'dfumt-test2', axiom: 'x', category: 'general', keywords: [] });
  for (let i = 0; i < 10; i++) te3.recordUsage('dfumt-test2');
  const e = te3.getEvolved()[0];
  assertEq(e.confidence, 'TRUE', 'Should be TRUE after 10 uses');
});

test('nextGeneration で世代が進む', () => {
  const gen = te.nextGeneration();
  assert(gen >= 2, `generation should be >= 2, got ${gen}`);
});

test('summarize の構造確認', () => {
  const s = te.summarize();
  assertEq(s.baseCount, 75, 'base should be 75');
  assert(s.evolvedCount > 0, 'evolved should be > 0');
  assert(s.generation >= 1, 'generation >= 1');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
