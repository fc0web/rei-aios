import { DistributedAxiomPipeline, type AxiomNode } from '../src/axiom-os/distributed-axiom-pipeline';

const pipeline = new DistributedAxiomPipeline();
let passed = 0, failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== DistributedAxiomPipeline Tests ===\n');

// テスト用コード
const codeA = `
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
const PI = 3.14159;
`;

const codeB = `
const results = [1,2,3].map(x => x * 2).reduce((a, b) => a + b, 0);
async function fetch(url: string) {
  const res = await getData(url);
  if (!res) throw new Error('failed');
  return res;
}
`;

const codeC = `
for (let i = 0; i < 100; i++) {
  if (i % 2 === 0) {
    transform(i);
  }
}
const LIMIT = 100;
`;

// シングルノードテスト
const single = pipeline.runSingle(codeA);
assert(single.nodes === 1, 'シングルノード: nodes=1');
assert(single.totalLines > 0, 'シングルノード: totalLines>0');
assert(single.consensusAxioms.length + single.pendingAxioms.length + single.rejectedAxioms.length > 0, 'シングルノード: 公理が分類される');
assert(typeof single.compressionEstimate === 'number', 'シングルノード: 圧縮率が数値');
assert(single.sevenLogicSummary.length > 0, 'シングルノード: 七価論理サマリーが存在');

// マルチノードテスト
const nodes: AxiomNode[] = [
  { id: 'node-01', name: 'Module A', weight: 1.0, sources: [{ name: 'a.ts', code: codeA }] },
  { id: 'node-02', name: 'Module B', weight: 0.9, sources: [{ name: 'b.ts', code: codeB }] },
  { id: 'node-03', name: 'Module C', weight: 0.8, sources: [{ name: 'c.ts', code: codeC }] },
];

const multiResult = pipeline.run(nodes);

assert(multiResult.nodes === 3, 'マルチノード: nodes=3');
assert(multiResult.totalLines > 0, 'マルチノード: totalLines>0');
assert(
  multiResult.consensusAxioms.length + multiResult.pendingAxioms.length + multiResult.rejectedAxioms.length > 0,
  'マルチノード: 公理が分類される'
);
assert(multiResult.compressionEstimate > 0, 'マルチノード: 圧縮率>0');
assert(multiResult.sevenLogicSummary.length > 0, 'マルチノード: 七価論理サマリーが存在');
assert(multiResult.rounds === 2, 'マルチノード: デフォルト2ラウンド');

// 各公理がSeedTheory形式か
for (const axiom of multiResult.consensusAxioms.slice(0, 3)) {
  assert(axiom.id.startsWith('cae-'), `合意公理のidがcae-で始まる: ${axiom.id}`);
  assert(axiom.axiom.length > 0, `合意公理のaxiomが存在: ${axiom.id}`);
  assert(axiom.keywords.length > 0, `合意公理のkeywordsが存在: ${axiom.id}`);
}

// レポート生成テスト
const report = pipeline.report(multiResult);
assert(report.includes('分散公理抽出パイプライン'), 'レポートにタイトルが含まれる');
assert(report.includes('合意公理数'), 'レポートに合意公理数が含まれる');
assert(report.includes('七価論理状態'), 'レポートに七価論理状態が含まれる');

console.log('\n' + pipeline.report(multiResult));
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
