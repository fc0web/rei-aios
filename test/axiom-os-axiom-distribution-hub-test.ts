import { AxiomDistributionHub } from '../src/axiom-os/axiom-distribution-hub';
import { type AxiomNode } from '../src/axiom-os/distributed-axiom-pipeline';

const hub = new AxiomDistributionHub();
let passed = 0, failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== AxiomDistributionHub Tests ===\n');

const codeA = `function f(n) { if (n<=1) return 1; return n*f(n-1); } const X=42;`;
const codeB = `[1,2,3].map(x=>x*2).reduce((a,b)=>a+b,0); async function g() { await fetch('/'); }`;

// シングルノード公開テスト
const pkg1 = hub.publishSingle(codeA, 'node-01', '1.0.0');
assert(pkg1 !== null, 'シングルノード: パッケージ生成');
assert(pkg1.version === '1.0.0', 'シングルノード: バージョン確認');

// 2回目の公開（追加）
const pkg2 = hub.publishSingle(codeB, 'node-02', '1.1.0');
assert(pkg2 !== null, '2回目パッケージ生成');

// グローバル公理確認
const axioms = hub.getGlobalAxioms();
assert(axioms.length > 0, 'グローバル公理が蓄積される');

// 受信テスト
const receiveResult = hub.receive(pkg1);
assert(typeof receiveResult.merged === 'number', 'receive: mergedが数値');
assert(typeof receiveResult.skipped === 'number', 'receive: skippedが数値');

// 差分エクスポート
const delta = hub.exportDelta('1.0.0', '1.1.0');
assert(delta !== null, '差分パッケージ生成');

// ステータス確認
const status = hub.getStatus();
assert(status.totalAxioms > 0, 'ステータス: totalAxioms>0');
assert(status.sevenLogicState.length > 0, 'ステータス: 七価論理状態が存在');
console.log(`  七価論理状態: ${status.sevenLogicState}`);
console.log(`  総公理数: ${status.totalAxioms}`);

// マルチノードテスト
const nodes: AxiomNode[] = [
  { id: 'n1', name: 'A', weight: 1.0, sources: [{ name: 'a.ts', code: codeA }] },
  { id: 'n2', name: 'B', weight: 0.9, sources: [{ name: 'b.ts', code: codeB }] },
];
const pkg3 = hub.publish(nodes, '2.0.0');
assert(pkg3 !== null, 'マルチノード: パッケージ生成');
assert(pkg3.version === '2.0.0', 'マルチノード: バージョン確認');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
