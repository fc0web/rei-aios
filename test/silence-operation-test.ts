/**
 * Silence Operation Tests — 沈黙演算テスト（10件）
 * Phase 6k-silence: Theory #97 沈黙言語理論
 */

import { SilenceLanguageEngine } from '../src/axiom-os/silence-language-engine';

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

console.log('\n=== Silence Operation Tests (10) ===\n');

const engine = new SilenceLanguageEngine();

// ── 沈黙演算テスト ──

test('沈黙AND: ……(NEITHER) ∧ ………(FLOWING) = FLOWING', () => {
  const result = engine.silenceAnd(2, 3);
  assert(result === 'FLOWING', `Expected FLOWING, got ${result}`);
});

test('沈黙OR: ………(FLOWING) ∨ …………(BOTH) = FLOWING', () => {
  const result = engine.silenceOr(3, 4);
  assert(result === 'FLOWING', `Expected FLOWING, got ${result}`);
});

test('沈黙NOT: ¬……(NEITHER) = NEITHER', () => {
  const result = engine.silenceNot(2);
  assert(result === 'NEITHER', `Expected NEITHER, got ${result}`);
});

test('パターン．(AND): …(FALSE)．……(NEITHER) = FALSE', () => {
  const result = engine.evaluatePattern([1, 2], 'dot');
  assert(result.combined === 'FALSE', `Expected FALSE, got ${result.combined}`);
});

test('パターン空白(OR): ……(NEITHER) ………(FLOWING) = FLOWING', () => {
  const result = engine.evaluatePattern([2, 3], 'space');
  assert(result.combined === 'FLOWING', `Expected FLOWING, got ${result.combined}`);
});

test('パターン！(確定): ………(FLOWING)！ = TRUE', () => {
  const result = engine.silenceConfirm(3);
  assert(result === 'TRUE', `Expected TRUE, got ${result}`);
});

test('覚醒(肯定文脈): awaken(…………, sentiment=0.9) = TRUE', () => {
  const result = engine.awaken(4, { sentiment: 0.9 });
  assert(result === 'TRUE', `Expected TRUE, got ${result}`);
});

test('覚醒(否定文脈): awaken(…………, sentiment=0.1) = FALSE', () => {
  const result = engine.awaken(4, { sentiment: 0.1 });
  assert(result === 'FALSE', `Expected FALSE, got ${result}`);
});

test('覚醒(中立文脈): awaken(…………, sentiment=0.5) = FLOWING', () => {
  const result = engine.awaken(4, { sentiment: 0.5 });
  assert(result === 'FLOWING', `Expected FLOWING, got ${result}`);
});

test('エントロピー最大: 文脈なし = log₂(7) ≈ 2.807', () => {
  const result = engine.calculateEntropy(4);
  assert(Math.abs(result.entropy - Math.log2(7)) < 0.001,
    `Expected ~2.807, got ${result.entropy}`);
  assert(!result.resolved, 'Should not be resolved without context');
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
