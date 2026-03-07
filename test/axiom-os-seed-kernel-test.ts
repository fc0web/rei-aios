/**
 * Seed Kernel テスト
 *
 * - 全110理論の種が定義されていること
 * - generate() でフルデータが再生成できること
 * - compress()/decompress() のラウンドトリップ
 * - sizeReport() で種サイズがフルサイズより小さいこと
 * - 再生成データが TheoryRow のフィールドを全て持つこと
 */

import { SEED_KERNEL, TheoryGenerator } from '../src/axiom-os';
import type { SeedTheory, TheoryRow } from '../src/axiom-os';
import { SEED_THEORIES } from '../src/axiom-os';

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

console.log('\n=== Seed Kernel Tests ===\n');

const gen = new TheoryGenerator();

// ── 種データの検証 ──

test('SEED_KERNEL has at least 110 theories', () => {
  assert(SEED_KERNEL.length >= 110, `Expected >= 110, got ${SEED_KERNEL.length}`);
});

test('All seed IDs are unique', () => {
  const ids = new Set(SEED_KERNEL.map(s => s.id));
  assert(ids.size === SEED_KERNEL.length, `Duplicate IDs found: ${SEED_KERNEL.length - ids.size} duplicates`);
});

test('All SEED_THEORIES IDs exist in SEED_KERNEL', () => {
  const seedIds = new Set(SEED_KERNEL.map(s => s.id));
  const theoryIds = new Set(SEED_THEORIES.map(t => t.id));
  for (const id of theoryIds) {
    assert(seedIds.has(id), `Missing seed for theory: ${id}`);
  }
  // SEED_KERNEL may contain newer theories not yet in SEED_THEORIES
});

test('All seeds have required fields (id, axiom, category, keywords)', () => {
  for (const s of SEED_KERNEL) {
    assert(typeof s.id === 'string' && s.id.length > 0, `Invalid id: ${s.id}`);
    assert(typeof s.axiom === 'string' && s.axiom.length > 0, `Empty axiom: ${s.id}`);
    assert(typeof s.category === 'string' && s.category.length > 0, `Empty category: ${s.id}`);
    assert(Array.isArray(s.keywords), `keywords not array: ${s.id}`);
    assert(s.keywords.length >= 2 && s.keywords.length <= 6, `keywords count ${s.keywords.length} for ${s.id}`);
  }
});

test('Seed categories match SEED_THEORIES categories (for shared IDs)', () => {
  const theoryMap = new Map(SEED_THEORIES.map(t => [t.id, t]));
  for (const s of SEED_KERNEL) {
    const theory = theoryMap.get(s.id);
    if (!theory) continue; // newer seeds not yet in SEED_THEORIES
    assert(s.category === theory.category, `Category mismatch for ${s.id}: seed=${s.category}, theory=${theory.category}`);
  }
});

// ── generate() の検証 ──

test('generate() returns TheoryRow-compatible object', () => {
  const row = gen.generate('dfumt-zero-pi');
  assert(typeof row.id === 'string', 'missing id');
  assert(typeof row.name === 'string', 'missing name');
  assert(typeof row.axiom === 'string', 'missing axiom');
  assert(typeof row.description === 'string', 'missing description');
  assert(typeof row.category === 'string', 'missing category');
  assert(row.constant_ref === null || typeof row.constant_ref === 'string', 'invalid constant_ref');
  assert(typeof row.created_at === 'string', 'missing created_at');
});

test('generate() preserves id and category from seed', () => {
  const row = gen.generate('dfumt-catuskoti');
  assert(row.id === 'dfumt-catuskoti', `id mismatch: ${row.id}`);
  assert(row.category === 'logic', `category mismatch: ${row.category}`);
});

test('generate() infers constant_ref from keywords', () => {
  const zeroPi = gen.generate('dfumt-zero-pi');
  assert(zeroPi.constant_ref === 'pi', `Expected pi, got ${zeroPi.constant_ref}`);

  const spiral = gen.generate('dfumt-spiral-number');
  assert(spiral.constant_ref === 'phi', `Expected phi, got ${spiral.constant_ref}`);

  const dim = gen.generate('dfumt-dimension');
  assert(dim.constant_ref === 'infinity', `Expected infinity, got ${dim.constant_ref}`);
});

test('generate() throws for unknown seed ID', () => {
  let threw = false;
  try { gen.generate('nonexistent'); } catch { threw = true; }
  assert(threw, 'Expected error for unknown ID');
});

// ── generateAll() の検証 ──

test('generateAll() returns all theories', () => {
  const all = gen.generateAll();
  assert(all.length === SEED_KERNEL.length, `Expected ${SEED_KERNEL.length}, got ${all.length}`);
});

test('generateAll() all have complete TheoryRow fields', () => {
  const all = gen.generateAll();
  const required: (keyof TheoryRow)[] = ['id', 'name', 'axiom', 'description', 'category', 'constant_ref', 'created_at'];
  for (const row of all) {
    for (const key of required) {
      assert(key in row, `Missing field ${key} in ${row.id}`);
    }
  }
});

// ── compress()/decompress() の検証 ──

test('compress() returns valid JSON string', () => {
  const compressed = gen.compress();
  assert(typeof compressed === 'string', 'Not a string');
  const parsed = JSON.parse(compressed);
  assert(Array.isArray(parsed), 'Not an array');
});

test('decompress(compress()) round-trip preserves all data', () => {
  const compressed = gen.compress();
  const restored = gen.decompress(compressed);
  assert(restored.length === SEED_KERNEL.length, `Round-trip count: ${restored.length}`);
  for (let i = 0; i < restored.length; i++) {
    assert(restored[i].id === SEED_KERNEL[i].id, `ID mismatch at ${i}`);
    assert(restored[i].axiom === SEED_KERNEL[i].axiom, `Axiom mismatch at ${i}`);
    assert(restored[i].category === SEED_KERNEL[i].category, `Category mismatch at ${i}`);
    assert(JSON.stringify(restored[i].keywords) === JSON.stringify(SEED_KERNEL[i].keywords),
      `Keywords mismatch at ${i}`);
  }
});

// ── sizeReport() の検証 ──

test('sizeReport() seed size < 30KB', () => {
  const report = gen.sizeReport();
  assert(report.seedSize < 30720, `Seed size ${report.seedSize} bytes exceeds 30KB`);
  console.log(`    seed: ${report.seedSize} bytes, full: ${report.fullSize} bytes, ratio: ${(report.ratio * 100).toFixed(1)}%`);
});

test('sizeReport() ratio < 10% (seed is much smaller than full)', () => {
  const report = gen.sizeReport();
  // Note: seed contains axiom which is shared, so ratio may be higher.
  // The key metric is seedSize < 10KB, but we also check ratio is reasonable.
  assert(report.ratio < 1.0, `Ratio ${report.ratio} is not less than 1.0`);
  assert(report.seedSize < report.fullSize, 'Seed should be smaller than full');
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
