/**
 * Rei-PL Bridge — 動作確認テスト
 *
 * Usage: npx tsx test/rei-pl-bridge-test.ts
 */

import { compile, compileWithDetails, compileAndRun, ReiPLBridgeError } from '../src/rei-pl-bridge';

// ─── Simple Test Runner ───

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
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

// ─── Tests ───

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Rei-PL Bridge — Test Suite              ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log();

  // ── 1. Error handling: empty input ──
  console.log('── Error Handling ──');

  await test('rejects empty string', async () => {
    try {
      await compile('');
      throw new Error('Should have thrown');
    } catch (e: any) {
      assert(e instanceof ReiPLBridgeError, 'Expected ReiPLBridgeError');
      assert(e.message.includes('non-empty string'), `Unexpected message: ${e.message}`);
    }
  });

  await test('rejects non-string input', async () => {
    try {
      await compile(null as any);
      throw new Error('Should have thrown');
    } catch (e: any) {
      assert(e instanceof ReiPLBridgeError, 'Expected ReiPLBridgeError');
    }
  });

  // ── 2. Compilation ──
  console.log();
  console.log('── Compilation ──');

  await test('compile: Hello World → WASM binary', async () => {
    const source = 'compress main() = "Hello, World!" |> print';
    const wasm = await compile(source);

    assert(wasm instanceof Uint8Array, 'Expected Uint8Array');
    assert(wasm.length > 0, 'Expected non-empty WASM');

    // WASM magic number: \0asm
    assert(
      wasm[0] === 0x00 && wasm[1] === 0x61 && wasm[2] === 0x73 && wasm[3] === 0x6d,
      `Invalid WASM magic number: got [${wasm[0]}, ${wasm[1]}, ${wasm[2]}, ${wasm[3]}]`,
    );

    console.log(`    → ${wasm.length} bytes WASM generated`);
  });

  await test('compile: arithmetic expression', async () => {
    const source = 'compress main() = 1 + 2 |> print';
    const wasm = await compile(source);

    assert(wasm instanceof Uint8Array, 'Expected Uint8Array');
    assert(wasm.length > 0, 'Expected non-empty WASM');
    console.log(`    → ${wasm.length} bytes WASM generated`);
  });

  await test('compileWithDetails: returns stats', async () => {
    const source = 'compress main() = "Hello, World!" |> print';
    const result = await compileWithDetails(source);

    assert(result.wasm instanceof Uint8Array, 'Expected wasm Uint8Array');
    assert(typeof result.stats.sourceChars === 'number', 'Expected stats.sourceChars');
    assert(typeof result.stats.wasmBytes === 'number', 'Expected stats.wasmBytes');
    assert(result.stats.wasmBytes === result.wasm.length, 'wasmBytes should match wasm.length');

    console.log(`    → source: ${result.stats.sourceChars} chars → WASM: ${result.stats.wasmBytes} bytes`);
    console.log(`    → compression ratio: ${result.stats.compressionRatio.toFixed(1)}:1`);
  });

  // ── 3. Compile & Run ──
  console.log();
  console.log('── Compile & Run ──');

  await test('compileAndRun: Hello World', async () => {
    const source = 'compress main() = "Hello, World!" |> print';
    const result = await compileAndRun(source);

    assert(result.success === true, `Expected success, got error: ${result.error}`);
    assert(result.output.includes('Hello, World!'), `Unexpected output: "${result.output}"`);

    console.log(`    → output: "${result.output.trimEnd()}"`);
  });

  // ── Summary ──
  console.log();
  console.log('═'.repeat(42));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(42));

  process.exit(failed > 0 ? 1 : 0);
}

main();
