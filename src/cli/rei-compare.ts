#!/usr/bin/env node
/**
 * rei-compare — 複数リポジトリを横断して公理を比較
 * 使い方:
 *   npx tsx src/cli/rei-compare.ts C:\Users\user\rei-aios\src C:\Users\user\rei-pl\src
 */

import * as fs   from 'fs';
import * as path from 'path';
import { CodeAxiomExtractor } from '../axiom-os/code-axiom-extractor';
import { type SeedTheory } from '../axiom-os/seed-kernel';

function collectFiles(dir: string, ext = 'ts'): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules','dist','.git'].includes(entry.name)) {
      results.push(...collectFiles(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(`.${ext}`)) {
      results.push(full);
    }
  }
  return results;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024*1024) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1024/1024).toFixed(2)} MB`;
}

function analyzeRepo(dir: string, label: string) {
  const extractor = new CodeAxiomExtractor();
  const files = collectFiles(dir);
  let totalBytes = 0;
  const allAxioms: SeedTheory[] = [];
  const seen = new Set<string>();

  for (const f of files) {
    const code = fs.readFileSync(f, 'utf-8');
    totalBytes += Buffer.byteLength(code, 'utf8');
    const result = extractor.extract(code, 'typescript');
    for (const axiom of result.seedTheories) {
      if (!seen.has(axiom.id)) {
        seen.add(axiom.id);
        allAxioms.push(axiom);
      }
    }
  }

  const axiomJson = JSON.stringify(allAxioms);
  const axiomBytes = Buffer.byteLength(axiomJson, 'utf8');
  const ratio = (axiomBytes / totalBytes) * 100;

  return { label, dir, files: files.length, totalBytes, axioms: allAxioms, axiomBytes, ratio };
}

function main() {
  const dirs = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (dirs.length < 2) {
    console.log('使い方: rei-compare.ts <dir1> <dir2> [dir3...]');
    console.log('例: rei-compare.ts C:\\Users\\user\\rei-aios\\src C:\\Users\\user\\rei-pl\\src');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  rei-compare — クロスリポジトリ公理比較                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = dirs.map((d, i) => analyzeRepo(d, `Repo${i+1}: ${path.basename(path.dirname(d))}`));

  // 各リポジトリの結果
  console.log('┌──────────────────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ リポジトリ            │ ファイル │ 元サイズ │ 公理数  │ 圧縮率  │');
  console.log('├──────────────────────┼──────────┼──────────┼──────────┼──────────┤');
  for (const r of results) {
    const label = r.label.padEnd(20).slice(0,20);
    const files = String(r.files).padStart(7);
    const size  = formatBytes(r.totalBytes).padStart(8);
    const axs   = String(r.axioms.length).padStart(7);
    const ratio = r.ratio.toFixed(2).padStart(7) + '%';
    console.log(`│ ${label} │ ${files} │ ${size} │ ${axs} │ ${ratio} │`);
  }
  console.log('└──────────────────────┴──────────┴──────────┴──────────┴──────────┘');

  // 共通公理の発見
  console.log('\n共通公理の発見（全リポジトリに共通するパターン）:');
  const axiomSets = results.map(r => new Set(r.axioms.map(a => a.id)));
  const commonIds = [...axiomSets[0]].filter(id => axiomSets.slice(1).every(s => s.has(id)));

  if (commonIds.length > 0) {
    console.log(`  共通公理数: ${commonIds.length}`);
    const firstRepoAxioms = results[0].axioms;
    for (const id of commonIds.slice(0, 10)) {
      const axiom = firstRepoAxioms.find(a => a.id === id);
      if (axiom) console.log(`  [${axiom.category}] ${axiom.axiom}`);
    }
    if (commonIds.length > 10) console.log(`  ...他 ${commonIds.length - 10} 件`);
  } else {
    console.log('  共通公理は検出されませんでした（パターンが異なる）');
  }

  // 合計
  const totalFiles = results.reduce((s, r) => s + r.files, 0);
  const totalBytes = results.reduce((s, r) => s + r.totalBytes, 0);
  const totalAxiomBytes = results.reduce((s, r) => s + r.axiomBytes, 0);
  const overallRatio = (totalAxiomBytes / totalBytes) * 100;
  console.log(`\n全体合計:`);
  console.log(`  ファイル数: ${totalFiles}`);
  console.log(`  元サイズ合計: ${formatBytes(totalBytes)}`);
  console.log(`  全体圧縮率: ${overallRatio.toFixed(2)}%`);
}

main();
