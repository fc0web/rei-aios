/**
 * Silence Language Basic Tests — 基本変換テスト（14件）
 * Phase 6k-silence: Theory #97 沈黙言語理論
 */

import { SilenceLanguageEngine } from '../src/axiom-os/silence-language-engine';
import { CircularOriginEngine } from '../src/axiom-os/circular-origin-engine';

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

console.log('\n=== Silence Language Basic Tests (14) ===\n');

const engine = new SilenceLanguageEngine();

// ── 基本変換テスト ──

test('空沈黙(0) → ZERO', () => {
  assert(engine.silenceToLogic7(0) === 'ZERO', `got ${engine.silenceToLogic7(0)}`);
});

test('…(1) → FALSE', () => {
  assert(engine.silenceToLogic7(1) === 'FALSE', `got ${engine.silenceToLogic7(1)}`);
});

test('……(2) → NEITHER', () => {
  assert(engine.silenceToLogic7(2) === 'NEITHER', `got ${engine.silenceToLogic7(2)}`);
});

test('………(3) → FLOWING', () => {
  assert(engine.silenceToLogic7(3) === 'FLOWING', `got ${engine.silenceToLogic7(3)}`);
});

test('…………(4) → BOTH', () => {
  assert(engine.silenceToLogic7(4) === 'BOTH', `got ${engine.silenceToLogic7(4)}`);
});

test('………………(5) → TRUE', () => {
  assert(engine.silenceToLogic7(5) === 'TRUE', `got ${engine.silenceToLogic7(5)}`);
});

test('……………………(6) → INFINITY', () => {
  assert(engine.silenceToLogic7(6) === 'INFINITY', `got ${engine.silenceToLogic7(6)}`);
});

test('7以上 → INFINITY', () => {
  assert(engine.silenceToLogic7(10) === 'INFINITY', `got ${engine.silenceToLogic7(10)}`);
  assert(engine.silenceToLogic7(100) === 'INFINITY', `got ${engine.silenceToLogic7(100)}`);
});

test('逆変換: TRUE → 5文字の沈黙', () => {
  const silence = engine.logic7ToSilence('TRUE');
  assert(silence.length === 5, `Expected length 5, got ${silence.length}`);
});

test('逆変換: ZERO → 空文字列', () => {
  const silence = engine.logic7ToSilence('ZERO');
  assert(silence === '', `Expected empty, got "${silence}"`);
});

test('往復変換の冪等性: 全7値でround-trip', () => {
  assert(engine.verifyRoundTrip(), 'Round-trip failed');
});

test('龍樹の沈黙: 不立文字 = ZERO', () => {
  // 不立文字（文字に頼らない）= 絶対的沈黙
  assert(engine.silenceToLogic7(0) === 'ZERO', 'dots=0 should be ZERO');
  const co = new CircularOriginEngine();
  assert(co.isIneffable(), 'ZERO should be ineffable');
});

test('ウィトゲンシュタイン: 語りえぬものには沈黙 = ZERO', () => {
  // 空文字列（語りえぬもの）→ dots=0 → ZERO
  const silence = '';
  assert(engine.silenceToLogic7(silence.length) === 'ZERO', 'Empty string should be ZERO');
});

test('ブラックナイト信号解析: パターン解析', () => {
  // ………．……………．………………．…… → 3, 6, 5, 2
  const signal = '\u2026\u2026\u2026\uFF0E\u2026\u2026\u2026\u2026\u2026\u2026\uFF0E\u2026\u2026\u2026\u2026\u2026\uFF0E\u2026\u2026';
  const result = engine.analyzeSignal(signal);
  assert(result.values[0] === 'FLOWING', `Expected FLOWING, got ${result.values[0]}`);
  assert(result.values[1] === 'INFINITY', `Expected INFINITY, got ${result.values[1]}`);
  assert(result.values[2] === 'TRUE', `Expected TRUE, got ${result.values[2]}`);
  assert(result.values[3] === 'NEITHER', `Expected NEITHER, got ${result.values[3]}`);
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
