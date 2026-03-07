/**
 * D-FUMT 七価論理 — Rei-PLコンパイラE2Eテスト
 *
 * 七価論理リテラル（∞, 〇, ～）がRei-PLで正しくコンパイル・実行されることを検証。
 * f64エンコーディング: ⊤=1.0, ⊥=0.0, both=2.0, neither=-1.0, ∞=3.0, 〇=4.0, ～=5.0
 *
 * Usage: npx tsx test/seven-logic-compiler-test.ts
 */

import {
  compile as reiPLCompile,
  compileAndRun as reiPLCompileAndRun,
  ReiPLBridgeError,
} from '../src/rei-pl-bridge';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => Promise<void>) {
  return fn().then(() => {
    passed++;
    console.log(`  ✓ ${name}`);
  }).catch((e: any) => {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  });
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  D-FUMT Seven-Logic Compiler — Test Suite    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();

  // ── 七価論理リテラル — コンパイル ──
  console.log('── 七価論理リテラル — コンパイル ──');

  await test('compile: ∞ literal', async () => {
    const result = await reiPLCompile('let x = ∞');
    assert(result instanceof Uint8Array, 'should return Uint8Array');
    assert(result.length > 0, 'wasm should not be empty');
  });

  await test('compile: 〇 literal', async () => {
    const result = await reiPLCompile('let x = 〇');
    assert(result instanceof Uint8Array, 'should return Uint8Array');
  });

  await test('compile: ～ literal', async () => {
    const result = await reiPLCompile('let x = ～');
    assert(result instanceof Uint8Array, 'should return Uint8Array');
  });

  await test('compile: all seven values together', async () => {
    const source = `
      let a = ⊤
      let b = ⊥
      let c = both
      let d = neither
      let e = ∞
      let f = 〇
      let g = ～
    `;
    const result = await reiPLCompile(source);
    assert(result instanceof Uint8Array, 'should return Uint8Array');
    assert(result.length > 0, 'wasm should not be empty');
  });

  // ── 七価論理リテラル — 実行 (print_f64) ──
  console.log();
  console.log('── 七価論理リテラル — 実行 (f64エンコーディング) ──');

  await test('run: ∞ → 3.0', async () => {
    const result = await reiPLCompileAndRun('∞ |> print');
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 3, `Expected 3, got ${result.numericOutputs[0]}`);
  });

  await test('run: 〇 → 4.0', async () => {
    const result = await reiPLCompileAndRun('〇 |> print');
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 4, `Expected 4, got ${result.numericOutputs[0]}`);
  });

  await test('run: ～ → 5.0', async () => {
    const result = await reiPLCompileAndRun('～ |> print');
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 5, `Expected 5, got ${result.numericOutputs[0]}`);
  });

  // ── 既存四価論理との共存 ──
  console.log();
  console.log('── 既存四価論理との共存 ──');

  await test('run: ⊤ → 1.0 (unchanged)', async () => {
    const result = await reiPLCompileAndRun('⊤ |> print');
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 1, `Expected 1, got ${result.numericOutputs[0]}`);
  });

  await test('run: ⊥ → 0.0 (unchanged)', async () => {
    const result = await reiPLCompileAndRun('⊥ |> print');
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 0, `Expected 0, got ${result.numericOutputs[0]}`);
  });

  await test('run: both → 2.0 (unchanged)', async () => {
    const result = await reiPLCompileAndRun('both |> print');
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 2, `Expected 2, got ${result.numericOutputs[0]}`);
  });

  await test('run: neither → -1.0 (unchanged)', async () => {
    const result = await reiPLCompileAndRun('neither |> print');
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === -1, `Expected -1, got ${result.numericOutputs[0]}`);
  });

  // ── 七価論理の演算 ──
  console.log();
  console.log('── 七価論理の演算 ──');

  await test('arithmetic: ∞ + 〇 = 7.0', async () => {
    const result = await reiPLCompileAndRun('(∞ + 〇) |> print');
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 7, `Expected 7, got ${result.numericOutputs[0]}`);
  });

  await test('arithmetic: ～ - ∞ = 2.0', async () => {
    const result = await reiPLCompileAndRun('(～ - ∞) |> print');
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 2, `Expected 2, got ${result.numericOutputs[0]}`);
  });

  await test('comparison: ∞ == ∞ → true (1.0)', async () => {
    const result = await reiPLCompileAndRun('(∞ == ∞) |> print');
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 1, `Expected 1, got ${result.numericOutputs[0]}`);
  });

  await test('comparison: 〇 != ～ → true (1.0)', async () => {
    const result = await reiPLCompileAndRun('(〇 != ～) |> print');
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 1, `Expected 1, got ${result.numericOutputs[0]}`);
  });

  // ── compress関数内での七価論理 ──
  console.log();
  console.log('── compress関数内での七価論理 ──');

  await test('compress: return ∞', async () => {
    const result = await reiPLCompileAndRun(`
      compress infinity_val() = ∞
      infinity_val() |> print
    `);
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 3, `Expected 3, got ${result.numericOutputs[0]}`);
  });

  await test('compress: seven-valued conditional', async () => {
    const result = await reiPLCompileAndRun(`
      compress classify(x) = if x == 3 then ∞ else if x == 4 then 〇 else ～
      classify(3) |> print
      classify(4) |> print
      classify(99) |> print
    `);
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 3, `classify(3) = ∞ = 3`);
    assert(result.numericOutputs[1] === 4, `classify(4) = 〇 = 4`);
    assert(result.numericOutputs[2] === 5, `classify(99) = ～ = 5`);
  });

  // ── 全七値の連続出力 ──
  console.log();
  console.log('── 全七値の連続出力 ──');

  await test('print all seven values via direct pipe', async () => {
    const result = await reiPLCompileAndRun(`
      ⊤ |> print
      ⊥ |> print
      both |> print
      neither |> print
      ∞ |> print
      〇 |> print
      ～ |> print
    `);
    assert(result.success, `execution failed: ${result.error}`);
    const expected = [1, 0, 2, -1, 3, 4, 5];
    for (let i = 0; i < 7; i++) {
      assert(result.numericOutputs[i] === expected[i],
        `value[${i}]: expected ${expected[i]}, got ${result.numericOutputs[i]}`);
    }
  });

  // ── compress∞ との共存 ──
  console.log();
  console.log('── compress∞ との共存 ──');

  await test('compress∞ still works (not confused with ∞ literal)', async () => {
    const result = await reiPLCompileAndRun(`
      compress∞ identity(x) = x
      identity(42) |> print
    `);
    assert(result.success, `execution failed: ${result.error}`);
    assert(result.numericOutputs[0] === 42, `Expected 42, got ${result.numericOutputs[0]}`);
  });

  // ── Summary ──
  console.log();
  console.log('═'.repeat(46));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(46));

  process.exit(failed > 0 ? 1 : 0);
}

main();
