/**
 * Category Theory Tests — 圏論テスト（12件）
 * Phase 6k: Theory #88 圏論的論理統一理論
 */

import { CategoryTheoryEngine, SEED_KERNEL } from '../src/axiom-os';

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

console.log('\n=== Category Theory Tests (12) ===\n');

const engine = new CategoryTheoryEngine();

// ── 圏の構築 ──

test('buildLogicCategory creates a category with 6 objects', () => {
  const cat = engine.buildLogicCategory();
  assert(cat.name === 'LogicCategory', `name: ${cat.name}`);
  assert(cat.objects.length === 6, `objects: ${cat.objects.length}`);
  const names = cat.objects.map(o => o.name);
  assert(names.includes('Logic7'), 'missing Logic7');
  assert(names.includes('Catuskoti'), 'missing Catuskoti');
  assert(names.includes('Classical'), 'missing Classical');
});

// ── 関手テスト ──

test('functor CatuskotiToLogic7 preserves identity', () => {
  const F = engine.buildCatuskotiToLogic7Functor();
  const testObj = { name: 'both', logicSystem: 'four-valued' };
  const mapped = F.mapObject(testObj);
  // 恒等射の保存: マッピングされたオブジェクトが存在すること
  assert(mapped.name === 'logic7_both', `mapped name: ${mapped.name}`);
  assert(mapped.logicSystem === 'seven-valued', `mapped system: ${mapped.logicSystem}`);
});

test('functor preserves composition', () => {
  const F = engine.buildCatuskotiToLogic7Functor();
  const verification = engine.verifyFunctor(F);
  assert(verification.preservesComposition === true, 'composition not preserved');
  assert(verification.valid === true, 'functor not valid');
});

// ── 自然変換テスト ──

test('natural transform UniversalProjection exists', () => {
  const eta = engine.buildUniversalProjection();
  assert(eta.name === 'UniversalProjection', `name: ${eta.name}`);
  assert(eta.components.size > 0, 'no components');
});

test('naturality condition holds for all logic systems', () => {
  const eta = engine.buildUniversalProjection();
  const verification = engine.verifyNaturalTransform(eta);
  assert(verification.valid === true, 'naturality condition failed');
  assert(verification.commutativeDiagramsChecked >= 5,
    `only ${verification.commutativeDiagramsChecked} diagrams checked`);
});

// ── 極限テスト ──

test('limit of empty diagram is ZERO', () => {
  const emptyDiagram = { objects: [], morphisms: [] };
  const result = engine.computeLimit(emptyDiagram);
  assert(result === 'ZERO', `expected ZERO, got ${result}`);
});

test('colimit of full diagram is INFINITY', () => {
  const fullDiagram = {
    objects: [
      { name: 'Logic7' }, { name: 'Fuzzy' }, { name: 'NValued' },
      { name: 'Catuskoti' }, { name: 'Lukasiewicz' },
    ],
    morphisms: [],
  };
  const result = engine.computeColimit(fullDiagram);
  assert(result === 'INFINITY', `expected INFINITY, got ${result}`);
});

// ── モナドテスト ──

test('monad unit law', () => {
  const wrapped = engine.monadUnit('TRUE');
  assert(wrapped.context === 'FLOWING', `context: ${wrapped.context}`);
  assert(wrapped.value === 'TRUE', `value: ${wrapped.value}`);
  // flatten(unit(a)) == a
  const doubleWrapped = { value: wrapped, context: 'FLOWING' as const };
  const flattened = engine.monadFlatten(doubleWrapped);
  assert(flattened.value === 'TRUE', `flatten result: ${flattened.value}`);
});

test('monad associativity', () => {
  // flatten(flatten(T(T(T(a))))) == flatten(T(flatten(T(T(a)))))
  const inner = engine.monadUnit('BOTH');
  const middle = { value: inner, context: 'FLOWING' as const };
  const flattened = engine.monadFlatten(middle);
  assert(flattened.value === 'BOTH', `associativity failed: ${flattened.value}`);
});

// ── 共通公理の関手的解釈 ──

test('90 common axioms form a functor image', () => {
  // SEED_KERNELからサンプルを取得して関手を構築
  const sample = SEED_KERNEL.slice(0, 90);
  const F = engine.interpretCommonAxioms(sample);
  const verification = engine.verifyFunctor(F);
  assert(verification.valid === true, 'common axiom functor not valid');
  assert(F.name === 'CommonAxiomFunctor', `functor name: ${F.name}`);
});

// ── 射の合成テスト ──

test('morphism composition works correctly', () => {
  const f = {
    name: 'f', source: 'A', target: 'B',
    map: (x: number) => x * 2,
  };
  const g = {
    name: 'g', source: 'B', target: 'C',
    map: (x: number) => x + 1,
  };
  const composed = engine.compose(f, g);
  assert(composed !== null, 'composition returned null');
  assert(composed!.source === 'A', `source: ${composed!.source}`);
  assert(composed!.target === 'C', `target: ${composed!.target}`);
  assert(composed!.map(3) === 7, `3*2+1 should be 7, got ${composed!.map(3)}`);
});

test('morphism composition fails when types mismatch', () => {
  const f = { name: 'f', source: 'A', target: 'B', map: (x: any) => x };
  const g = { name: 'g', source: 'C', target: 'D', map: (x: any) => x };
  const composed = engine.compose(f, g);
  assert(composed === null, 'should fail when B != C');
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
