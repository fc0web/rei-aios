/**
 * ∞圏論・HoTT 統合テスト — 宇宙階層・統合テスト（8件）
 * Phase 6k-HoTT: Theory #93 切り詰め階層理論 + 統合検証
 */

import {
  UniverseHierarchyEngine,
  InfinityCategoryEngine,
  HomotopyTypeEngine,
  CircularOriginEngine,
} from '../src/axiom-os';

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

console.log('\n=== ∞圏論・HoTT 統合テスト (8) ===\n');

const universe = new UniverseHierarchyEngine();
const infCat = new InfinityCategoryEngine();
const hott = new HomotopyTypeEngine();
const circular = new CircularOriginEngine();

// ── 全階層整合性テスト ──

test('full hierarchy coherence (level 0-6)', () => {
  const result = universe.verifyFullHierarchy();
  assert(result.allCoherent === true, 'hierarchy not coherent');
  assert(result.level6_hott === true, 'level 6 (HoTT) failed');
  assert(result.level5_category === true, 'level 5 (Category) failed');
  assert(result.level4_zero === true, 'level 4 (ZERO) failed');
});

// ── ∞圏論 + 円環根源 ──

test('circular origin with infinity category', () => {
  // ∞圏論の極限 = ZERO = 円環の起点
  const limit = infCat.computeInfinityLimit();
  assert(limit === 'ZERO', `limit: ${limit}`);
  assert(circular.verifySelfIdentity() === true, 'ZERO self-identity failed');
});

// ── 単価性 + D-FUMT ──

test('univalence grounds DFUMT universality', () => {
  assert(hott.univalenceGroundsDFUMT() === true,
    'univalence does not ground DFUMT');
});

// ── 龍樹の経路 ──

test('nagarjuna path: emptiness of emptiness converges to ZERO', () => {
  const np = universe.nagarjunaPath();
  assert(np.exists === true, 'nagarjuna path should exist');
  assert(np.path.includes('ZERO'), `path: ${np.path}`);
});

// ── ゲーデルの壁 ──

test('godel limit as universe hierarchy: no top universe', () => {
  assert(universe.hasNoTopUniverse() === true,
    'should have no top universe (Godel)');
  const hierarchy = universe.buildHierarchy(3);
  assert(hierarchy.hasTopUniverse === false, 'hasTopUniverse should be false');
  assert(hierarchy.godelLimitAcknowledged === true, 'godel limit not acknowledged');
});

// ── ウィトゲンシュタインの沈黙 ──

test('wittgenstein silence as ZERO', () => {
  assert(circular.isIneffable() === true, 'should be ineffable');
  const ws = universe.wittgensteinSilence();
  assert(ws.ineffable === true, 'not ineffable');
  assert(ws.truncatedToZero === true, 'not truncated to ZERO');
});

// ── 宇宙階層テスト ──

test('universe omega is INFINITY, empty is ZERO', () => {
  const uOmega = universe.getUniverse(Infinity);
  assert(uOmega.logic7Value === 'INFINITY', `omega: ${uOmega.logic7Value}`);

  const uEmpty = universe.getUniverse(-Infinity);
  assert(uEmpty.logic7Value === 'ZERO', `empty: ${uEmpty.logic7Value}`);
});

// ── 宇宙多型テスト ──

test('universe polymorphism works at all levels', () => {
  const result = universe.polymorphic(u => u.name);
  assert(result === 'U_omega', `result: ${result}`);
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
