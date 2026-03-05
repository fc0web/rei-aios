import * as path from 'path';
import * as fs from 'fs';
import {
  collectSourceFiles,
  countAxioms,
  axiomCompress,
  gzipCompress,
  runExperiment,
  printReport,
} from '../src/experiment/step7c-integration';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('\n=== STEP 7-C: 統合実験テスト ===\n');

const ROOT = path.resolve(__dirname, '..');

// ─── 1. ファイル収集テスト ────────────────────────────────────
console.log('【1. ソースファイル収集】');
const files = collectSourceFiles(path.join(ROOT, 'src'));
assert(files.length > 0, `ファイルが収集される: ${files.length}件`);
assert(files.every(f => f.endsWith('.ts')), '全て.tsファイル');
assert(!files.some(f => f.includes('node_modules')), 'node_modulesは除外');
assert(!files.some(f => f.includes('\\dist\\') || f.includes('/dist/')), 'distディレクトリは除外');
console.log(`    収集数: ${files.length}件`);

// ─── 2. 公理カウントテスト ────────────────────────────────────
console.log('\n【2. 公理カウント】');
const sampleSource = `
import { foo } from './foo';
export const BAR = 42;
export function baz(x: number): number {
  return x * 2;
}
export interface MyInterface {
  id: string;
}
export class MyClass {
  constructor() {}
}
// axiom: D-FUMT七価論理
`.trim();

const count = countAxioms(sampleSource);
assert(count >= 6, `公理が6件以上カウントされる: ${count}件`);

// ─── 3. 圧縮テスト ───────────────────────────────────────────
console.log('\n【3. axiomCompressテスト】');
const compressed = axiomCompress(sampleSource, '/test/sample.ts');
assert(compressed.length > 0, '圧縮バッファが生成される');
assert(compressed.slice(0,4).toString('utf8') === 'REI\x06', 'マジックバイトがREI\\x06');

const ratio = compressed.length / Buffer.byteLength(sampleSource, 'utf8');
console.log(`    圧縮率: ${(ratio*100).toFixed(1)}%`);

// ─── 4. gzip比較テスト ────────────────────────────────────────
console.log('\n【4. gzip比較】');
const gzipped = gzipCompress(sampleSource);
assert(gzipped.length > 0, 'gzip圧縮バッファが生成される');
const gzipRatio = gzipped.length / Buffer.byteLength(sampleSource, 'utf8');
console.log(`    gzip圧縮率:  ${(gzipRatio*100).toFixed(1)}%`);
console.log(`    axiom圧縮率: ${(ratio*100).toFixed(1)}%`);

// ─── 5. 実ファイル単体テスト ─────────────────────────────────
console.log('\n【5. 実ファイル圧縮（単体）】');
if (files.length > 0) {
  const firstFile = files[0];
  const source = require('fs').readFileSync(firstFile, 'utf8');
  const c = axiomCompress(source, firstFile);
  const r = c.length / Buffer.byteLength(source, 'utf8');
  assert(c.length > 0, `実ファイル圧縮成功: ${path.basename(firstFile)}`);
  console.log(`    ${path.basename(firstFile)}: ${Buffer.byteLength(source,'utf8')}B → ${c.length}B (${(r*100).toFixed(1)}%)`);
}

// ─── 6. 統合実験実行 ─────────────────────────────────────────
console.log('\n【6. 統合実験（全ソース）】');
runExperiment(path.join(ROOT, 'src')).then(report => {
  printReport(report);

  assert(report.totalFiles > 0, `全ファイル処理: ${report.totalFiles}件`);
  assert(report.totalOriginalBytes > 0, '元サイズが正');
  assert(report.totalCompressedBytes > 0, '圧縮後サイズが正');
  assert(report.overallRatio > 0 && report.overallRatio <= 2.0, `総合圧縮率が有効: ${(report.overallRatio*100).toFixed(1)}%`);
  assert(report.topCompressed.length > 0, 'トップ5が存在する');

  // レポートをJSONで保存
  const outDir = path.join(ROOT, 'dist');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, 'step7c-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  assert(fs.existsSync(reportPath), 'step7c-report.jsonが保存される');
  console.log(`\n    レポート保存: dist/step7c-report.json`);

  console.log(`\n結果: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}).catch(e => {
  console.error('実験エラー:', e);
  process.exit(1);
});
