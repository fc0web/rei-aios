// NarcissusDetector — 自己参照ループの検出
import { NarcissusDetector } from '../../src/axiom-os/narcissus-detector';

const n = new NarcissusDetector();

console.log('=== テスト1: 正常な推論（ループなし）===');
n.observe('dfumt-catuskoti', 'TRUE',    ['dfumt-zero-pi']);
n.observe('dfumt-zero-pi',   'FLOWING', ['dfumt-spiral']);
n.observe('dfumt-spiral',    'TRUE',    []);
let report = n.analyze();
console.log('盲点検出:', report.detected);
console.log('リスクレベル:', report.riskLevel);
console.log('推奨:', report.recommendation);

console.log('\n=== テスト2: 循環参照（A→B→A）===');
n.reset();
n.observe('axiom-A', 'BOTH',    ['axiom-B']);
n.observe('axiom-B', 'FLOWING', ['axiom-A']);
n.observe('axiom-A', 'BOTH',    ['axiom-B']);
report = n.analyze();
console.log('盲点検出:', report.detected);
console.log('リスクレベル:', report.riskLevel);
console.log('検出ループ数:', report.loops.length);
for (const loop of report.loops) {
  console.log(`  [${loop.kind}] ${loop.description}`);
}
console.log('推奨:', report.recommendation);
