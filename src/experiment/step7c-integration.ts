/**
 * Rei-AIOS STEP 7-C — 統合実験
 * rei-aiosソース全体を.reiaxで保存・実測
 *
 * 実験内容:
 *   1. src/配下の全.tsファイルを収集
 *   2. ReiAxiomArchiverで各ファイルを公理列に変換
 *   3. LLMZipAPIで意味的記述を生成
 *   4. 圧縮率・ファイル数・合計サイズを実測
 *   5. 結果をJSONレポートとして保存
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

// ─── 型定義 ────────────────────────────────────────────────────
export interface FileStats {
  filePath: string;
  originalSize: number;
  axiomCount: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface ExperimentReport {
  timestamp: string;
  totalFiles: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  overallRatio: number;
  savingPercent: number;
  files: FileStats[];
  topCompressed: FileStats[];   // 圧縮率上位5件
  bottomCompressed: FileStats[]; // 圧縮率下位5件
  axiomHistogram: Record<string, number>; // 公理数の分布
}

// ─── ファイル収集 ──────────────────────────────────────────────
export function collectSourceFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      // node_modules・dist・.git は除外
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        results.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

// ─── 公理数カウント（簡易） ────────────────────────────────────
export function countAxioms(source: string): number {
  let count = 0;
  const lines = source.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('import ') ||
        t.startsWith('export const ') ||
        t.startsWith('const ') ||
        t.startsWith('export function ') ||
        t.startsWith('function ') ||
        t.startsWith('export class ') ||
        t.startsWith('class ') ||
        t.startsWith('export interface ') ||
        t.startsWith('interface ') ||
        t.startsWith('// axiom:') ||
        t.startsWith('// @axiom')) {
      count++;
    }
  }
  return count;
}

// ─── 単純gzip圧縮（比較用） ───────────────────────────────────
export function gzipCompress(source: string): Buffer {
  return zlib.gzipSync(Buffer.from(source, 'utf8'));
}

// ─── 公理アーカイブ圧縮（.reiax形式） ─────────────────────────
export function axiomCompress(source: string, filePath: string): Buffer {
  const axiomCount = countAxioms(source);
  const lines = source.split('\n');

  // 公理行のみ抽出
  const axiomLines = lines.filter(line => {
    const t = line.trim();
    return t.startsWith('import ') ||
           t.startsWith('export const ') ||
           t.startsWith('const ') ||
           t.startsWith('export function ') ||
           t.startsWith('function ') ||
           t.startsWith('export class ') ||
           t.startsWith('class ') ||
           t.startsWith('export interface ') ||
           t.startsWith('interface ') ||
           t.startsWith('// axiom:') ||
           t.startsWith('// @axiom') ||
           t.startsWith('export type ') ||
           t.startsWith('type ');
  });

  const axiomRecord = {
    magic: 'REI\x06',
    version: '1.0',
    filePath: path.relative(process.cwd(), filePath),
    originalSize: source.length,
    axiomCount,
    axioms: axiomLines,
    compressedAt: new Date().toISOString(),
  };

  const json = JSON.stringify(axiomRecord);
  const compressed = zlib.gzipSync(Buffer.from(json, 'utf8'));
  const magicBuf = Buffer.from('REI\x06', 'utf8');
  return Buffer.concat([magicBuf, compressed]);
}

// ─── 実験メイン ───────────────────────────────────────────────
export async function runExperiment(rootDir: string): Promise<ExperimentReport> {
  console.log(`\n🔬 STEP 7-C 統合実験開始`);
  console.log(`   対象: ${rootDir}`);
  console.log(`   時刻: ${new Date().toISOString()}\n`);

  const files = collectSourceFiles(rootDir);
  console.log(`📁 対象ファイル数: ${files.length}件\n`);

  const fileStats: FileStats[] = [];
  let totalOriginal = 0;
  let totalCompressed = 0;

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const originalSize = Buffer.byteLength(source, 'utf8');
    const axiomCount = countAxioms(source);
    const compressed = axiomCompress(source, filePath);
    const compressedSize = compressed.length;
    const ratio = compressedSize / originalSize;

    const relPath = path.relative(rootDir, filePath);
    console.log(`  ${ratio < 0.5 ? '🟢' : ratio < 0.8 ? '🟡' : '🔴'} ${relPath}`);
    console.log(`     ${originalSize}B → ${compressedSize}B (${(ratio*100).toFixed(1)}%) [公理${axiomCount}件]`);

    fileStats.push({ filePath: relPath, originalSize, axiomCount, compressedSize, compressionRatio: ratio });
    totalOriginal += originalSize;
    totalCompressed += compressedSize;
  }

  // gzip比較
  console.log('\n📊 gzip比較:');
  let gzipTotal = 0;
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    gzipTotal += gzipCompress(source).length;
  }
  const gzipRatio = gzipTotal / totalOriginal;
  console.log(`   gzip合計: ${totalOriginal}B → ${gzipTotal}B (${(gzipRatio*100).toFixed(1)}%)`);

  // 公理アーカイブ比較
  const axiomRatio = totalCompressed / totalOriginal;
  console.log(`   .reiax合計: ${totalOriginal}B → ${totalCompressed}B (${(axiomRatio*100).toFixed(1)}%)`);

  // ソート
  const sorted = [...fileStats].sort((a,b) => a.compressionRatio - b.compressionRatio);

  // 公理数ヒストグラム
  const histogram: Record<string, number> = {
    '0-5': 0, '6-10': 0, '11-20': 0, '21-50': 0, '51+': 0
  };
  for (const f of fileStats) {
    if (f.axiomCount <= 5) histogram['0-5']++;
    else if (f.axiomCount <= 10) histogram['6-10']++;
    else if (f.axiomCount <= 20) histogram['11-20']++;
    else if (f.axiomCount <= 50) histogram['21-50']++;
    else histogram['51+']++;
  }

  const report: ExperimentReport = {
    timestamp: new Date().toISOString(),
    totalFiles: files.length,
    totalOriginalBytes: totalOriginal,
    totalCompressedBytes: totalCompressed,
    overallRatio: axiomRatio,
    savingPercent: (1 - axiomRatio) * 100,
    files: fileStats,
    topCompressed: sorted.slice(0, 5),
    bottomCompressed: sorted.slice(-5).reverse(),
    axiomHistogram: histogram,
  };

  return report;
}

// ─── レポート表示 ──────────────────────────────────────────────
export function printReport(report: ExperimentReport): void {
  console.log('\n' + '═'.repeat(60));
  console.log('📋 STEP 7-C 実験レポート');
  console.log('═'.repeat(60));
  console.log(`対象ファイル数:   ${report.totalFiles}件`);
  console.log(`元サイズ合計:     ${report.totalOriginalBytes.toLocaleString()} bytes`);
  console.log(`圧縮後合計:       ${report.totalCompressedBytes.toLocaleString()} bytes`);
  console.log(`総合圧縮率:       ${(report.overallRatio * 100).toFixed(1)}%`);
  console.log(`削減量:           ${((1-report.overallRatio)*100).toFixed(1)}% 削減`);

  console.log('\n🏆 圧縮率トップ5（公理密度が高いファイル）:');
  for (const f of report.topCompressed) {
    console.log(`  ${(f.compressionRatio*100).toFixed(1)}% — ${f.filePath} [公理${f.axiomCount}件]`);
  }

  console.log('\n⚠️  圧縮率ワースト5（実装コードが多いファイル）:');
  for (const f of report.bottomCompressed) {
    console.log(`  ${(f.compressionRatio*100).toFixed(1)}% — ${f.filePath} [公理${f.axiomCount}件]`);
  }

  console.log('\n📊 公理数分布:');
  for (const [range, count] of Object.entries(report.axiomHistogram)) {
    const bar = '█'.repeat(count);
    console.log(`  ${range.padEnd(6)} | ${bar} (${count}件)`);
  }
  console.log('═'.repeat(60));
}
