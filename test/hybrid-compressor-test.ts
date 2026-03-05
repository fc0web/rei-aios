#!/usr/bin/env node
/**
 * HybridCompressor テスト
 * 3段階ハイブリッド圧縮の動作検証
 */

import * as fs from 'fs';
import * as path from 'path';
import { HybridCompressor } from '../src/axiom-os/hybrid-compressor';
import { SEED_KERNEL, type SeedTheory } from '../src/axiom-os/seed-kernel';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  OK  ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  NG  ${name}: ${e.message}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log('=== HybridCompressor テスト ===\n');

const compressor = new HybridCompressor();

// ─── Step A: SEED_KERNEL圧縮 ──────────────────────────────

test('SEED_KERNEL圧縮→展開ラウンドトリップ', () => {
  const result = compressor.compress(SEED_KERNEL);
  const restored = compressor.decompress(result.compressed);

  assert(restored.length === SEED_KERNEL.length,
    `公理数不一致: ${restored.length} !== ${SEED_KERNEL.length}`);

  for (let i = 0; i < SEED_KERNEL.length; i++) {
    assert(restored[i].id === SEED_KERNEL[i].id,
      `ID不一致 [${i}]: ${restored[i].id} !== ${SEED_KERNEL[i].id}`);
    assert(restored[i].axiom === SEED_KERNEL[i].axiom,
      `axiom不一致 [${i}]: "${restored[i].axiom}" !== "${SEED_KERNEL[i].axiom}"`);
    assert(restored[i].category === SEED_KERNEL[i].category,
      `category不一致 [${i}]`);
    assert(JSON.stringify(restored[i].keywords) === JSON.stringify(SEED_KERNEL[i].keywords),
      `keywords不一致 [${i}]`);
  }
});

test('SEED_KERNEL圧縮率 < 50%', () => {
  const result = compressor.compress(SEED_KERNEL);
  console.log(`    original=${result.steps.original} dict=${result.steps.afterDict} predict=${result.steps.afterPredict} gzip=${result.steps.afterGzip}`);
  console.log(`    ratio=${(result.ratio * 100).toFixed(1)}%`);
  assert(result.ratio < 0.5, `圧縮率 ${(result.ratio * 100).toFixed(1)}% >= 50%`);
});

// ─── Step B: 実ファイル公理圧縮 ────────────────────────────

const seedFile = path.join(__dirname, '..', 'axiom-seed-self.json');

if (fs.existsSync(seedFile)) {
  const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  const axioms: Array<SeedTheory & { source?: string }> = seedData.axioms ?? [];

  test('実ファイル公理圧縮→展開ラウンドトリップ', () => {
    const result = compressor.compress(axioms);
    const restored = compressor.decompress(result.compressed);

    assert(restored.length === axioms.length,
      `公理数不一致: ${restored.length} !== ${axioms.length}`);

    // ID・axiom・categoryが完全一致
    for (let i = 0; i < axioms.length; i++) {
      assert(restored[i].id === axioms[i].id, `ID不一致 [${i}]`);
      assert(restored[i].axiom === axioms[i].axiom, `axiom不一致 [${i}]`);
      assert(restored[i].category === axioms[i].category, `category不一致 [${i}]`);
    }
  });

  test('実ファイル公理: 各ステップでサイズ削減', () => {
    const result = compressor.compress(axioms);
    console.log(`    original=${result.steps.original} dict=${result.steps.afterDict} predict=${result.steps.afterPredict} gzip=${result.steps.afterGzip}`);
    assert(result.steps.afterDict < result.steps.original, 'Step A で削減されていない');
    assert(result.steps.afterGzip < result.steps.afterPredict, 'Step C で削減されていない');
  });

  test('実ファイル公理: 圧縮率 < 20%', () => {
    const result = compressor.compress(axioms);
    const ratio = result.ratio * 100;
    console.log(`    ratio=${ratio.toFixed(1)}%`);
    assert(ratio < 20, `圧縮率 ${ratio.toFixed(1)}% >= 20%`);
  });

  test('実ファイル公理: gzip後サイズ < 7KB（source含む）', () => {
    const result = compressor.compress(axioms);
    console.log(`    gzip size=${result.steps.afterGzip} bytes (source含む30件 ~6KB)`);
    assert(result.steps.afterGzip < 7168, `gzipサイズ ${result.steps.afterGzip} >= 7KB`);
  });

  test('実ファイル公理: source除外で < 4KB', () => {
    const noSource = axioms.map(a => ({ id: a.id, axiom: a.axiom, category: a.category, keywords: a.keywords }));
    const result = compressor.compress(noSource);
    console.log(`    gzip size=${result.steps.afterGzip} bytes (source除外)`);
    assert(result.steps.afterGzip < 4096, `gzipサイズ ${result.steps.afterGzip} >= 4KB`);
  });

  test('source付き公理のラウンドトリップ', () => {
    const withSource = axioms.filter(a => a.source && a.source.length >= 20);
    if (withSource.length === 0) {
      console.log('    (sourceが20文字以上の公理なし — スキップ)');
      return;
    }
    const result = compressor.compress(withSource);
    const restored = compressor.decompress(result.compressed);
    for (let i = 0; i < withSource.length; i++) {
      assert(restored[i].source === withSource[i].source,
        `source不一致 [${i}]`);
    }
  });
} else {
  console.log('  (axiom-seed-self.json が見つかりません — 実ファイルテストスキップ)');
}

// ─── Step C: シリアライズ ──────────────────────────────────

test('serialize/deserialize ラウンドトリップ', () => {
  const result = compressor.compress(SEED_KERNEL);
  const serialized = compressor.serialize(result);
  const restored = compressor.deserialize(serialized);

  assert(restored.length === SEED_KERNEL.length, `公理数不一致`);
  assert(restored[0].id === SEED_KERNEL[0].id, `先頭ID不一致`);
});

test('serialize ヘッダー "REI\\x02"', () => {
  const result = compressor.compress(SEED_KERNEL);
  const serialized = compressor.serialize(result);
  assert(serialized[0] === 0x52, 'R');
  assert(serialized[1] === 0x45, 'E');
  assert(serialized[2] === 0x49, 'I');
  assert(serialized[3] === 0x02, '\\x02');
});

test('Base64 ラウンドトリップ', () => {
  const result = compressor.compress(SEED_KERNEL);
  const b64 = compressor.toBase64(result);
  const buf = compressor.fromBase64(b64);
  const restored = compressor.decompress(buf);
  assert(restored.length === SEED_KERNEL.length, '公理数不一致');
});

test('不正フォーマットでエラー', () => {
  try {
    compressor.deserialize(Buffer.from('INVALID'));
    throw new Error('エラーが発生しなかった');
  } catch (e: any) {
    assert(e.message.includes('Invalid format'), `想定外エラー: ${e.message}`);
  }
});

// ─── 空配列 ────────────────────────────────────────────────

test('空配列の圧縮→展開', () => {
  const result = compressor.compress([]);
  const restored = compressor.decompress(result.compressed);
  assert(restored.length === 0, '空でない');
});

// ─── 結果 ──────────────────────────────────────────────────

console.log(`\n=== 結果: ${passed} passed / ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
