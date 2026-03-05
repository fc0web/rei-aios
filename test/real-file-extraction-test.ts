/**
 * 実ファイル公理抽出テスト
 * rei-aios の src/axiom-os/ ディレクトリを実際に解析する
 */
import * as fs   from 'fs';
import * as path from 'path';
import { CodeAxiomExtractor } from '../src/axiom-os/code-axiom-extractor';
import { AxiomDistributionHub } from '../src/axiom-os/axiom-distribution-hub';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== 実ファイル公理抽出テスト ===\n');

const AXIOM_OS_DIR = path.join(__dirname, '..', 'src', 'axiom-os');
const extractor = new CodeAxiomExtractor();
const hub = new AxiomDistributionHub();

// 実ファイル収集
const files = fs.readdirSync(AXIOM_OS_DIR)
  .filter(f => f.endsWith('.ts'))
  .map(f => path.join(AXIOM_OS_DIR, f));

console.log(`対象ファイル数: ${files.length}`);
assert(files.length > 0, '実ファイルが存在する');

// 各ファイルの公理抽出
let totalOriginalBytes = 0;
let totalPatterns = 0;

for (const file of files) {
  const code = fs.readFileSync(file, 'utf-8');
  const size = Buffer.byteLength(code, 'utf8');
  totalOriginalBytes += size;

  const result = extractor.extract(code, 'typescript');
  totalPatterns += result.patterns.length;

  assert(result.patterns.length >= 0, `${path.basename(file)}: パターン抽出成功`);
  assert(result.seedTheories.length === result.patterns.length, `${path.basename(file)}: seed数一致`);

  hub.publishSingle(code, path.basename(file), '1.0.0');
}

// グローバル公理確認
const globalAxioms = hub.getGlobalAxioms();
assert(globalAxioms.length > 0, 'グローバル公理が蓄積された');

// サイズ比較
const axiomJsonSize = Buffer.byteLength(JSON.stringify(globalAxioms), 'utf8');
const compressionRatio = (axiomJsonSize / totalOriginalBytes) * 100;

console.log(`\n実ファイル計測結果:`);
console.log(`  元ファイル合計  : ${totalOriginalBytes.toLocaleString()} bytes`);
console.log(`  総パターン数    : ${totalPatterns}`);
console.log(`  抽出公理数      : ${globalAxioms.length}`);
console.log(`  公理JSONサイズ  : ${axiomJsonSize.toLocaleString()} bytes`);
console.log(`  公理/元データ比 : ${compressionRatio.toFixed(2)}%`);

assert(totalOriginalBytes > 0,    '元ファイルサイズが計測された');
assert(totalPatterns > 0,          '総パターンが検出された');
assert(globalAxioms.length > 0,   '公理が抽出された');
assert(compressionRatio < 100,     '公理は元データより小さい');

const status = hub.getStatus();
assert(status.sevenLogicState.length > 0, '七価論理状態が評価された');
console.log(`  七価論理状態    : ${status.sevenLogicState}`);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
