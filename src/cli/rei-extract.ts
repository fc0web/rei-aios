#!/usr/bin/env node
/**
 * rei-extract — 実ファイル公理抽出CLI
 * 使い方:
 *   npx tsx src/cli/rei-extract.ts ./src
 *   npx tsx src/cli/rei-extract.ts ./src --verify
 *   npx tsx src/cli/rei-extract.ts ./src --output seed.json
 */

import * as fs   from 'fs';
import * as path from 'path';
import { CodeAxiomExtractor } from '../axiom-os/code-axiom-extractor';
import { AxiomDistributionHub } from '../axiom-os/axiom-distribution-hub';

// ─── 引数パース ───────────────────────────────────────────────
const args = process.argv.slice(2);
const targetDir  = args.find(a => !a.startsWith('--')) ?? '.';
const doVerify   = args.includes('--verify');
const outputFile = (() => {
  const idx = args.indexOf('--output');
  return idx >= 0 ? args[idx + 1] : null;
})();
const ext = args.find(a => a.startsWith('--ext='))?.split('=')[1] ?? 'ts';
const verbose = args.includes('--verbose');

// ─── ファイル収集 ─────────────────────────────────────────────
function collectFiles(dir: string, extension: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    console.error(`ディレクトリが見つかりません: ${dir}`);
    process.exit(1);
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
      results.push(...collectFiles(fullPath, extension));
    } else if (entry.isFile() && entry.name.endsWith(`.${extension}`)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── メイン処理 ───────────────────────────────────────────────
function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  rei-extract — 実ファイル公理抽出エンジン                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n対象ディレクトリ: ${path.resolve(targetDir)}`);
  console.log(`拡張子: .${ext}\n`);

  // Step1: ファイル収集
  const files = collectFiles(targetDir, ext);
  if (files.length === 0) {
    console.error(`.${ext} ファイルが見つかりませんでした`);
    process.exit(1);
  }
  console.log(`${files.length} ファイルを検出\n`);

  // Step2: 各ファイルのサイズ計測
  let totalOriginalBytes = 0;
  const fileSizes: Record<string, number> = {};
  for (const f of files) {
    const size = fs.statSync(f).size;
    fileSizes[f] = size;
    totalOriginalBytes += size;
  }
  console.log(`元ファイル合計サイズ: ${formatBytes(totalOriginalBytes)}\n`);

  // Step3: 公理抽出
  const extractor = new CodeAxiomExtractor();
  const hub = new AxiomDistributionHub();

  console.log('公理抽出中...');
  const extractResults: Array<{
    file: string;
    patterns: number;
    axioms: number;
    sevenLogicTag: string;
    originalBytes: number;
  }> = [];

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');
    const result = extractor.extract(code, ext);
    hub.publishSingle(code, path.basename(file), '1.0.0');

    if (verbose) {
      console.log(`  ${path.relative(targetDir, file)}: ${result.patterns.length}パターン ${result.sevenLogicTag}`);
    }

    extractResults.push({
      file: path.relative(targetDir, file),
      patterns: result.patterns.length,
      axioms: result.seedTheories.length,
      sevenLogicTag: result.sevenLogicTag,
      originalBytes: fileSizes[file],
    });
  }

  // Step4: 公理セットを圧縮
  const globalAxioms = hub.getGlobalAxioms();
  const status = hub.getStatus();

  console.log(`抽出完了: ${globalAxioms.length} 公理\n`);

  // globalAxiomsをJSON化してサイズ計測
  const seedJson = JSON.stringify(globalAxioms);
  const seedBytes = Buffer.byteLength(seedJson, 'utf8');
  const axiomRatio = (seedBytes / totalOriginalBytes) * 100;

  // ─── 結果表示 ─────────────────────────────────────────────

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  実ファイル公理抽出 — 結果レポート                         ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  処理ファイル数    : ${String(files.length).padStart(4)} 件                              ║`);
  console.log(`║  元データ合計      : ${formatBytes(totalOriginalBytes).padStart(12)}                   ║`);
  console.log(`║  抽出公理数        : ${String(globalAxioms.length).padStart(4)} 公理                            ║`);
  console.log(`║  公理JSON サイズ   : ${formatBytes(seedBytes).padStart(12)}                   ║`);
  console.log(`║  公理/元データ比   : ${axiomRatio.toFixed(2).padStart(8)} %                         ║`);
  console.log(`║  七価論理状態      : ${status.sevenLogicState.padEnd(20)}               ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  // ファイル別トップ5
  console.log('\nパターン検出数 上位5ファイル:');
  const sorted = [...extractResults].sort((a, b) => b.patterns - a.patterns).slice(0, 5);
  for (const r of sorted) {
    const bar = '█'.repeat(Math.min(20, r.patterns));
    console.log(`  ${r.file.padEnd(40).slice(0, 40)} ${String(r.patterns).padStart(3)}パターン ${r.sevenLogicTag} ${bar}`);
  }

  // Step5: 再生成検証
  if (doVerify) {
    console.log('\n再生成検証中...');
    let verifyPassed = 0;
    let verifyFailed = 0;

    for (const file of files.slice(0, 5)) { // 最初の5ファイルで検証
      const original = fs.readFileSync(file, 'utf-8');
      const result = extractor.extract(original, ext);
      // 公理から元の構造的特徴が保持されているか確認
      const hasPatterns = result.patterns.length > 0;
      const hasSeeds = result.seedTheories.length > 0;
      if (hasPatterns && hasSeeds) {
        verifyPassed++;
        if (verbose) console.log(`  OK ${path.relative(targetDir, file)}`);
      } else {
        verifyFailed++;
        if (verbose) console.log(`  NG ${path.relative(targetDir, file)}`);
      }
    }
    console.log(`  再生成検証: ${verifyPassed} 成功 / ${verifyFailed} 失敗`);
  }

  // Step6: 出力ファイル保存
  if (outputFile) {
    const output = {
      version: '1.0.0',
      extractedAt: new Date().toISOString(),
      sourceDir: path.resolve(targetDir),
      stats: {
        files: files.length,
        originalBytes: totalOriginalBytes,
        axioms: globalAxioms.length,
        axiomJsonBytes: seedBytes,
        compressionRatio: axiomRatio,
      },
      axioms: globalAxioms,
    };
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n公理データを保存: ${outputFile} (${formatBytes(fs.statSync(outputFile).size)})`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

main();
