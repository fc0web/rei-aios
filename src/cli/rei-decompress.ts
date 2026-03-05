#!/usr/bin/env node
/**
 * rei-decompress -- .reiバイナリから公理JSONを復元
 * 使い方:
 *   npx tsx src/cli/rei-decompress.ts axiom-seed-self.rei
 *   npx tsx src/cli/rei-decompress.ts axiom-seed-self.rei --output restored.json
 */

import * as fs from 'fs';
import { HybridCompressor } from '../axiom-os/hybrid-compressor';

const args = process.argv.slice(2);
const inputFile = args.find(a => !a.startsWith('--'));
const outputFile = (() => {
  const idx = args.indexOf('--output');
  return idx >= 0 ? args[idx + 1] : null;
})();

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function main() {
  if (!inputFile || !fs.existsSync(inputFile)) {
    console.log('使い方: rei-decompress.ts <file.rei> [--output <restored.json>]');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  rei-decompress -- ハイブリッド圧縮展開                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const compressor = new HybridCompressor();
  const buf = fs.readFileSync(inputFile);
  const axioms = compressor.deserialize(buf);

  console.log(`入力ファイル : ${inputFile} (${formatBytes(buf.length)})`);
  console.log(`復元公理数   : ${axioms.length}`);

  const withSource = axioms.filter(a => a.source && a.source.length > 0);
  console.log(`source付き   : ${withSource.length}`);

  if (outputFile) {
    const output = {
      version: '2.0.0',
      decompressedAt: new Date().toISOString(),
      axiomCount: axioms.length,
      axioms,
    };
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n復元データを保存: ${outputFile} (${formatBytes(fs.statSync(outputFile).size)})`);
  } else {
    // 標準出力にJSONを出力
    console.log(JSON.stringify(axioms, null, 2));
  }
}

main();
