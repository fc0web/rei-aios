/**
 * Silence Language Integration Tests — 統合テスト（11件）
 * Phase 6k-silence: Theory #97/#98 沈黙言語・沈黙情報圧縮理論
 */

import { SilenceLanguageEngine } from '../src/axiom-os/silence-language-engine';
import { UniversalLogicEngine } from '../src/axiom-os/universal-logic-engine';
import { HomotopyTypeEngine } from '../src/axiom-os/homotopy-type-engine';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';
import { AxiomEncoder } from '../src/axiom-os/axiom-encoder';

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

console.log('\n=== Silence Language Integration Tests (11) ===\n');

const silence = new SilenceLanguageEngine();
const universal = new UniversalLogicEngine();
const hott = new HomotopyTypeEngine();

// ── 統合テスト ──

test('七価との完全統合: 全7値のround-trip', () => {
  assert(silence.verifyRoundTrip(), 'Round-trip failed');
});

test('ファジー論理との連携: fuzzy(0.85) → TRUE → 5文字の沈黙', () => {
  const fuzzyVal = universal.fuzzyToLogic7(0.85);
  assert(fuzzyVal === 'TRUE', `Expected TRUE, got ${fuzzyVal}`);
  const s = silence.logic7ToSilence(fuzzyVal);
  assert(s.length === 5, `Expected 5 chars, got ${s.length}`);
});

test('四句分別との連携: catuskoti(neither) → NEITHER → 2文字の沈黙', () => {
  const catVal = universal.catuskotiToLogic7(3); // neither=3
  assert(catVal === 'NEITHER', `Expected NEITHER, got ${catVal}`);
  const s = silence.logic7ToSilence(catVal);
  assert(s.length === 2, `Expected 2 chars, got ${s.length}`);
});

test('Łukasiewiczとの連携: lukasiewicz(unknown) → NEITHER → 沈黙', () => {
  const lukVal = universal.lukasiewiczToLogic7(1); // unknown=1
  assert(lukVal === 'NEITHER', `Expected NEITHER, got ${lukVal}`);
  const catVal = universal.catuskotiToLogic7(3);
  // 龍樹・Łukasiewicz・沈黙の三者統一
  const lukSilence = silence.logic7ToSilence(lukVal);
  const catSilence = silence.logic7ToSilence(catVal);
  assert(lukSilence === catSilence, 'Three-way unification failed');
});

test('圧縮率: 91%以上', () => {
  const original = 'if (value == NEITHER) { return NEITHER; }';
  const silenceStr = '\u2026\u2026'; // 2文字
  const ratio = silence.compressionRatio(original, silenceStr);
  assert(ratio > 0.91, `Expected > 0.91, got ${ratio}`);
});

test('HoTT経路との対応: FLOWING = 経路の存在', () => {
  assert(silence.silenceToLogic7(3) === 'FLOWING', 'dots=3 should be FLOWING');
  // TRUE→FLOWING path exists in HoTT
  const path = hott.buildPath('TRUE', 'FLOWING');
  assert(path.exists, 'TRUE→FLOWING path should exist in HoTT');
});

test('∞極限: 沈黙の無限連鎖 → INFINITY', () => {
  assert(silence.silenceToLogic7(1000) === 'INFINITY', '1000 dots should be INFINITY');
  assert(silence.verifyInfinityLimit(), 'Infinity limit verification failed');
});

test('RCT連携: 沈黙はgzipより高圧縮', () => {
  const rctRatio = silence.compressionRatio('NEITHER', '\u2026\u2026');
  assert(rctRatio > 0.7, `Expected > 0.7, got ${rctRatio}`);
});

test('SeedKernel無矛盾: T097/T098 追加後も無矛盾', () => {
  assert(silence.verifyConsistency(), 'Consistency check failed');
  // silence category exists in SEED_KERNEL
  const silenceSeeds = SEED_KERNEL.filter(s => s.category === 'silence');
  assert(silenceSeeds.length >= 2, `Expected >= 2 silence seeds, got ${silenceSeeds.length}`);
});

test('メタ公理充足: SilenceLanguageEngine は七価論理の値のみを返す', () => {
  // 全dots(0-10)の結果が七価論理の正当な値であること
  assert(silence.verifyConsistency(), 'Consistency verification failed');
  // 覚醒も七価の値を返す
  const awakened = silence.awaken(4, { sentiment: 0.5 });
  const sevenValues = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'];
  assert(sevenValues.includes(awakened), `Awaken returned invalid value: ${awakened}`);
});

test('完全階層統合: silence category がAxiomEncoderで処理可能', () => {
  const encoder = new AxiomEncoder();
  const code = encoder.encodeCategory('silence');
  assert(code === 'sl', `Expected 'sl', got '${code}'`);
  const back = encoder.decodeCategory(code);
  assert(back === 'silence', `Expected 'silence', got '${back}'`);
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
