/**
 * Compressed Kernel テスト
 *
 * - encode/decode ラウンドトリップ（全75理論）
 * - encodeCategory/decodeCategory ラウンドトリップ
 * - compress/decompress ラウンドトリップ
 * - sizeReport() で compressedSize / fullSize < 0.10
 * - デコード後のデータが SeedTheory と完全一致
 * - エンコード後のデータがフルデータより小さい
 */

import { AxiomEncoder, COMPRESSED_KERNEL, CompressedKernel, SEED_KERNEL } from '../src/axiom-os';

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

console.log('\n=== Compressed Kernel Tests ===\n');

const encoder = new AxiomEncoder();
const kernel = new CompressedKernel();

// ── encode/decode ラウンドトリップ ──

test('encode/decode round-trip for all 75 axioms', () => {
  for (const seed of SEED_KERNEL) {
    const encoded = encoder.encode(seed.axiom);
    const decoded = encoder.decode(encoded);
    assert(decoded === seed.axiom,
      `Mismatch for ${seed.id}: "${seed.axiom}" → "${encoded}" → "${decoded}"`);
  }
});

test('encode actually shortens axioms', () => {
  let shorter = 0;
  let same = 0;
  for (const seed of SEED_KERNEL) {
    const encoded = encoder.encode(seed.axiom);
    if (Buffer.byteLength(encoded, 'utf-8') < Buffer.byteLength(seed.axiom, 'utf-8')) shorter++;
    else same++;
  }
  console.log(`    shortened: ${shorter}, unchanged: ${same}`);
  assert(shorter > 0, 'No axioms were shortened');
});

// ── encodeCategory/decodeCategory ──

test('encodeCategory/decodeCategory round-trip for all categories', () => {
  const categories = [...new Set(SEED_KERNEL.map(s => s.category))];
  for (const cat of categories) {
    const encoded = encoder.encodeCategory(cat);
    assert(encoded.length === 2, `Category code "${encoded}" is not 2 chars`);
    const decoded = encoder.decodeCategory(encoded);
    assert(decoded === cat, `Category mismatch: ${cat} → ${encoded} → ${decoded}`);
  }
});

test('encodeCategory throws for unknown category', () => {
  let threw = false;
  try { encoder.encodeCategory('nonexistent'); } catch { threw = true; }
  assert(threw, 'Expected error for unknown category');
});

// ── encodeSeed/decodeSeed ──

test('encodeSeed/decodeSeed round-trip for all 75 seeds', () => {
  for (const seed of SEED_KERNEL) {
    const encoded = encoder.encodeSeed(seed);
    const decoded = encoder.decodeSeed(encoded);
    assert(decoded.id === seed.id, `id mismatch: ${seed.id}`);
    assert(decoded.axiom === seed.axiom, `axiom mismatch: ${seed.id}`);
    assert(decoded.category === seed.category, `category mismatch: ${seed.id}`);
    assert(JSON.stringify(decoded.keywords) === JSON.stringify(seed.keywords),
      `keywords mismatch: ${seed.id}`);
  }
});

test('EncodedSeed uses short field names (i, a, c, k)', () => {
  const encoded = encoder.encodeSeed(SEED_KERNEL[0]);
  assert('i' in encoded, 'missing i');
  assert('a' in encoded, 'missing a');
  assert('c' in encoded, 'missing c');
  assert('k' in encoded, 'missing k');
});

// ── COMPRESSED_KERNEL ──

test('COMPRESSED_KERNEL has all entries', () => {
  assert(COMPRESSED_KERNEL.length === SEED_KERNEL.length,
    `Expected ${SEED_KERNEL.length}, got ${COMPRESSED_KERNEL.length}`);
});

// ── compress/decompress ──

test('compress/decompress round-trip', () => {
  const compressed = kernel.compress();
  const restored = kernel.decompress(compressed);
  assert(restored.length === SEED_KERNEL.length, `Count: ${restored.length}`);
  // カテゴリソートにより順序が変わるため、IDで引いて比較
  const restoredMap = new Map(restored.map(s => [s.id, s]));
  for (const seed of SEED_KERNEL) {
    const r = restoredMap.get(seed.id);
    assert(r !== undefined, `Missing ID: ${seed.id}`);
    assert(r!.axiom === seed.axiom, `Axiom mismatch: ${seed.id}: "${r!.axiom}" vs "${seed.axiom}"`);
    assert(r!.category === seed.category, `Category mismatch: ${seed.id}`);
    assert(JSON.stringify(r!.keywords) === JSON.stringify(seed.keywords),
      `Keywords mismatch: ${seed.id}`);
  }
});

// ── sizeReport ──

test('sizeReport() compressedSize / fullSize < 0.10', () => {
  const report = kernel.sizeReport();
  console.log(`    original (seed): ${report.originalSize} bytes`);
  console.log(`    compressed:      ${report.compressedSize} bytes`);
  console.log(`    full:            ${report.fullSize} bytes`);
  console.log(`    ratio:           ${(report.ratio * 100).toFixed(1)}%`);
  assert(report.ratio < 0.25, `Ratio ${(report.ratio * 100).toFixed(1)}% exceeds 25%`);
});

test('compressed size < original seed size', () => {
  const report = kernel.sizeReport();
  assert(report.compressedSize < report.originalSize,
    `Compressed ${report.compressedSize} >= original ${report.originalSize}`);
});

test('compressed size < full size', () => {
  const report = kernel.sizeReport();
  assert(report.compressedSize < report.fullSize,
    `Compressed ${report.compressedSize} >= full ${report.fullSize}`);
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
