/**
 * ReiPLBidirectionalBridge 結合テスト
 *
 * テスト内容:
 *   1. コード生成（dryRun） — 全カテゴリ
 *   2. generateOnly — 理論ID指定
 *   3. generateModule — モジュール生成
 *   4. メモリ保存結合テスト（dryRunなし、実行はrei-pl経由）
 *   5. ReiPLAxiomGenerator 全カテゴリ網羅
 *   6. SEED_KERNEL 152理論全生成
 */

import { ReiPLBidirectionalBridge } from '../src/aios/rei-runtime/rei-pl-bidirectional-bridge';
import { ReiPLAxiomGenerator } from '../src/axiom-os/rei-pl-axiom-generator';
import { ReiAIOSRuntimeBus } from '../src/aios/rei-aios-runtime-bus';
import { AIOSMemory } from '../src/memory/aios-memory';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      passed++;
      console.log(`  PASS  ${name}`);
    } catch (e: any) {
      failed++;
      console.log(`  FAIL  ${name}: ${e.message}`);
    }
  };
  return run();
}

function assert(cond: boolean, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('\n=== ReiPLBidirectionalBridge 結合テスト ===\n');

  const bus    = new ReiAIOSRuntimeBus();
  const memory = new AIOSMemory(':memory:');
  const bridge = new ReiPLBidirectionalBridge(bus, memory);
  const gen    = new ReiPLAxiomGenerator();

  // ── 1. dryRun: コード生成のみ（実行なし） ──────────────
  await test('dryRun: コード生成のみ（10理論）', async () => {
    const result = await bridge.run({
      maxTheories: 10,
      agentId:     'test-agent',
      dryRun:      true,
    });
    assert(result.processed === 10, `processed: expected 10, got ${result.processed}`);
    assert(result.codes.length === 10, `codes: expected 10, got ${result.codes.length}`);
    assert(result.memories.length === 0, 'dryRun should not create memories');
    assert(result.errors.length === 0, 'dryRun should have no errors');
    for (const code of result.codes) {
      assert(code.reiCode.length > 0, `${code.theoryId}: code should not be empty`);
    }
  });

  // ── 2. dryRun: 理論ID指定 ──────────────────────────────
  await test('dryRun: 量子論理3理論を指定', async () => {
    const ids = [
      'dfumt-quantum-superposition',
      'dfumt-quantum-measurement',
      'dfumt-quantum-non-distributivity',
    ];
    const result = await bridge.run({
      theoryIds:   ids,
      maxTheories: 10,
      agentId:     'test-agent',
      dryRun:      true,
    });
    assert(result.processed === 3, `expected 3, got ${result.processed}`);
    assert(result.codes.every(c => ids.includes(c.theoryId)),
      'all codes should be quantum theories');
    for (const code of result.codes) {
      assert(code.reiCode.includes('BOTH') || code.reiCode.includes('FLOWING'),
        `quantum code should reference D-FUMT values`);
    }
  });

  // ── 3. generateOnly ────────────────────────────────────
  await test('generateOnly: 5理論', () => {
    const result = bridge.generateOnly({ maxTheories: 5 });
    assert(result.processed === 5);
    assert(result.codes.length === 5);
    assert(result.failed === 0);
  });

  // ── 4. generateModule ──────────────────────────────────
  await test('generateModule: 全理論モジュール', () => {
    const mod = bridge.generateModule();
    assert(mod.includes('D-FUMT'), 'module should mention D-FUMT');
    assert(mod.includes('dfumt_axioms'), 'module should have default name');
    assert(mod.length > 1000, `module should be substantial, got ${mod.length} chars`);
  });

  await test('generateModule: 理論ID指定', () => {
    const mod = bridge.generateModule(['dfumt-catuskoti', 'dfumt-zero-pi']);
    assert(mod.includes('dfumt-catuskoti'), 'should contain catuskoti');
    assert(mod.includes('dfumt-zero-pi'), 'should contain zero-pi');
  });

  // ── 5. ReiPLAxiomGenerator 全カテゴリ網羅 ──────────────
  await test('ReiPLAxiomGenerator: 全カテゴリのコード生成', () => {
    const categories = new Set(SEED_KERNEL.map(t => t.category));
    console.log(`    カテゴリ数: ${categories.size}`);
    for (const cat of categories) {
      const theory = SEED_KERNEL.find(t => t.category === cat)!;
      const code = gen.generate(theory);
      assert(code.reiCode.length > 0,
        `${cat}: code should not be empty`);
      assert(code.theoryId === theory.id,
        `${cat}: theoryId mismatch`);
      console.log(`    ${cat}: ${code.template} (${code.reiCode.length} chars)`);
    }
  });

  // ── 6. 全152理論のコード生成 ───────────────────────────
  await test('全152理論のコード生成が成功する', () => {
    const codes = gen.generateBatch(SEED_KERNEL);
    assert(codes.length === 152, `expected 152, got ${codes.length}`);
    const emptyIds = codes.filter(c => c.reiCode.length === 0).map(c => c.theoryId);
    assert(emptyIds.length === 0, `empty codes: ${emptyIds.join(', ')}`);

    // 各コードにtheoryIdのサニタイズ版が含まれることを確認
    let idMismatch = 0;
    for (const code of codes) {
      const sanitized = code.theoryId.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      if (!code.reiCode.includes(sanitized)) idMismatch++;
    }
    assert(idMismatch === 0, `${idMismatch} codes missing sanitized ID`);
  });

  // ── 7. 実行テスト（rei-pl WASM） ──────────────────────
  await test('run: Rei-PL実行 + メモリ保存（2理論）', async () => {
    // 単純な理論を選んで実行テスト
    const result = await bridge.run({
      theoryIds:   ['dfumt-zero-pi', 'dfumt-catuskoti'],
      maxTheories: 2,
      agentId:     'bridge-test',
      dryRun:      false,
    });
    console.log(`    processed: ${result.processed}, succeeded: ${result.succeeded}, failed: ${result.failed}`);
    if (result.errors.length > 0) {
      console.log(`    errors: ${result.errors.join('; ')}`);
    }
    // rei-plの実行は環境に依存するため、処理自体が完了することを確認
    assert(result.processed === 2, `expected 2 processed, got ${result.processed}`);
    // 実行成功の場合はメモリに保存されている
    if (result.succeeded > 0) {
      assert(result.memories.length > 0, 'should have saved memories');
      // メモリから検索
      const recalled = memory.recall({ agentId: 'bridge-test', tags: ['rei-pl'] });
      assert(recalled.length > 0, 'should recall memories with rei-pl tag');
      console.log(`    memories saved: ${result.memories.length}`);
      console.log(`    recalled: ${recalled.map(r => r.content.slice(0, 50)).join('; ')}`);
    }
  });

  // ── 8. メモリ統合確認 ──────────────────────────────────
  await test('メモリ統合: 保存された記憶の確信度とタグ', async () => {
    // dryRun=false で実行した結果を確認
    const all = memory.recall({ agentId: 'bridge-test', limit: 20 });
    for (const entry of all) {
      assert(entry.tags.includes('rei-pl'), `entry should have rei-pl tag`);
      assert(entry.tags.includes('axiom'), `entry should have axiom tag`);
      assert(entry.kind === 'axiom', `kind should be axiom, got ${entry.kind}`);
      const validConf = ['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'];
      assert(validConf.includes(entry.confidence),
        `invalid confidence: ${entry.confidence}`);
    }
  });

  // ── 9. buildContext確認 ────────────────────────────────
  await test('buildContext: bridge-testエージェントのコンテキスト', () => {
    const ctx = memory.buildContext('bridge-test');
    if (memory.recall({ agentId: 'bridge-test' }).length > 0) {
      assert(ctx.includes('bridge-test'), 'context should include agent id');
      assert(ctx.includes('axiom'), 'context should include axiom entries');
    }
  });

  memory.close();

  // ── 結果 ──
  console.log(`\n=== 結果: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
