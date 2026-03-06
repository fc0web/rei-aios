import { DFUMTCalculator, generateCalculatorPanel } from '../src/logic/dfumt-calculator';
import { ContradictionDetectorEnhanced, generateContradictionPanel } from '../src/logic/contradiction-detector-enhanced';
import type { DFUMTValue } from '../src/memory/aios-memory';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('\n=== STEP 13-C/D テスト ===\n');

const calc = new DFUMTCalculator();

// ─── STEP 13-C: DFUMTCalculator ──────────────────────────────
console.log('【STEP 13-C: D-FUMT七価論理計算機】');

// NOT演算テスト
const notTests: [DFUMTValue, DFUMTValue][] = [
  ['TRUE','FALSE'], ['FALSE','TRUE'],
  ['BOTH','NEITHER'], ['NEITHER','BOTH'],
  ['INFINITY','ZERO'], ['ZERO','INFINITY'],
  ['FLOWING','FLOWING'],
];
for (const [input, expected] of notTests) {
  const r = calc.not(input);
  assert(r.result === expected, `NOT ${input} = ${expected}: ${r.result}`);
  assert(r.confidence === 100, `NOT演算の確信度は常に100%`);
}

// AND演算テスト（主要ケース）
const andTests: [DFUMTValue, DFUMTValue, DFUMTValue][] = [
  ['TRUE', 'TRUE',  'TRUE'],
  ['TRUE', 'FALSE', 'FALSE'],
  ['TRUE', 'BOTH',  'BOTH'],
  ['ZERO', 'TRUE',  'ZERO'],
  ['ZERO', 'INFINITY', 'ZERO'],
];
for (const [a, b, expected] of andTests) {
  const r = calc.calculate(a, 'AND', b);
  assert(r.result === expected, `${a} AND ${b} = ${expected}: ${r.result}`);
  assert(r.formula.includes('∧'), 'AND式に∧が含まれる');
}

// OR演算テスト
const orTests: [DFUMTValue, DFUMTValue, DFUMTValue][] = [
  ['FALSE', 'FALSE', 'FALSE'],
  ['FALSE', 'TRUE',  'TRUE'],
  ['BOTH',  'TRUE',  'BOTH'],
  ['ZERO',  'TRUE',  'TRUE'],
  ['INFINITY', 'FALSE', 'INFINITY'],
];
for (const [a, b, expected] of orTests) {
  const r = calc.calculate(a, 'OR', b);
  assert(r.result === expected, `${a} OR ${b} = ${expected}: ${r.result}`);
}

// IMPLIES演算テスト
const impliesResult = calc.calculate('TRUE', 'IMPLIES', 'FALSE');
assert(impliesResult.result === 'FALSE', `TRUE→FALSE = FALSE`);

const impliesResult2 = calc.calculate('FALSE', 'IMPLIES', 'TRUE');
assert(impliesResult2.result === 'TRUE', `FALSE→TRUE = TRUE`);

// EQUIV演算テスト
const equivSame = calc.calculate('TRUE', 'EQUIV', 'TRUE');
assert(equivSame.result === 'TRUE', `TRUE↔TRUE = TRUE`);

const equivOpp = calc.calculate('TRUE', 'EQUIV', 'FALSE');
assert(equivOpp.result === 'FALSE', `TRUE↔FALSE = FALSE`);

// 全演算テーブル取得テスト
const andTable = calc.getFullTable('AND');
assert(andTable.values.length === 7, `ANDテーブルの値数: ${andTable.values.length}`);
assert(andTable.table.length === 7, `ANDテーブルの行数: ${andTable.table.length}`);
assert(andTable.table[0].length === 7, `ANDテーブルの列数: ${andTable.table[0].length}`);

// 計算機パネル生成テスト
const calcPanel = generateCalculatorPanel();
assert(calcPanel.includes('panel-calculator'), '計算機パネルIDが存在する');
assert(calcPanel.includes('calcNot'), 'NOT計算関数が存在する');
assert(calcPanel.includes('calcBinary'), '二項演算関数が存在する');
assert(calcPanel.includes('renderOpTable'), 'テーブル表示関数が存在する');
assert(calcPanel.includes('op-table'), '演算テーブルCSSが存在する');
console.log(`    計算機パネル: ${calcPanel.length}文字`);

// ─── STEP 13-D: ContradictionDetectorEnhanced ────────────────
console.log('\n【STEP 13-D: 矛盾検出エンジン（強化版）】');

const detector = new ContradictionDetectorEnhanced();

// 直接矛盾テスト（TRUE vs FALSE）
const axiomTrue = {
  id: '#1', content: '真は真である', dfumtValue: 'TRUE' as DFUMTValue,
  category: 'logic', keywords: ['真', '論理'],
};
const axiomFalse = {
  id: '#X', content: '真は偽である', dfumtValue: 'FALSE' as DFUMTValue,
  category: 'logic', keywords: ['真', '論理'],
};
const directContra = detector.detectPair(axiomTrue, axiomFalse);
assert(directContra.score >= 60, `TRUE vs FALSE: 高矛盾スコア ${directContra.score}`);
assert(directContra.level === 'CRITICAL' || directContra.level === 'STRONG',
  `TRUE vs FALSE: 強い矛盾レベル: ${directContra.level}`);
assert(!directContra.canCoexist, 'TRUE vs FALSEは共存不可');
assert(directContra.suggestions.length > 0, '修正提案が存在する');

// 共存可能な組み合わせテスト（BOTH vs FLOWING）
const axiomBoth = {
  id: '#2', content: '空は両面ある', dfumtValue: 'BOTH' as DFUMTValue,
  category: 'philosophy', keywords: ['空'],
};
const axiomFlowing = {
  id: '#5', content: '縁起は流動的', dfumtValue: 'FLOWING' as DFUMTValue,
  category: 'philosophy', keywords: ['縁起'],
};
const compatible = detector.detectPair(axiomBoth, axiomFlowing);
assert(compatible.score < 40, `BOTH vs FLOWING: 低矛盾スコア ${compatible.score}`);
assert(compatible.canCoexist, 'BOTH vs FLOWINGは共存可能');

// INFINITY vs ZERO テスト
const axiomInf = {
  id: '#23', content: '螺旋は無限', dfumtValue: 'INFINITY' as DFUMTValue,
  category: 'mathematics', keywords: ['螺旋', '数'],
};
const axiomZero = {
  id: '#10', content: 'ゼロが起点', dfumtValue: 'ZERO' as DFUMTValue,
  category: 'mathematics', keywords: ['ゼロ', '数'],
};
const infZero = detector.detectPair(axiomInf, axiomZero);
assert(infZero.score >= 50, `INFINITY vs ZERO: 高矛盾スコア ${infZero.score}`);

// 一括検出テスト
const axioms = [axiomTrue, axiomFalse, axiomBoth, axiomFlowing, axiomInf, axiomZero];
const report = detector.detectAll(axioms);
assert(report.totalPairs === 15, `全ペア数: ${report.totalPairs}`);
assert(report.contradictions.length >= 1, '矛盾が検出される');
assert(report.healthScore >= 0 && report.healthScore <= 100,
  `健全性スコアが有効範囲: ${report.healthScore}%`);
assert((['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'] as string[])
  .includes(report.overallHealth), `全体D-FUMT健全性が有効: ${report.overallHealth}`);
console.log(`    検出された矛盾: ${report.contradictions.length}件`);
console.log(`    全体健全性: ${report.overallHealth} (${report.healthScore}%)`);
console.log(`    サマリー: 致命的:${report.summary.critical} 強:${report.summary.strong}`);

// 矛盾パネル生成テスト
const contraPanel = generateContradictionPanel();
assert(contraPanel.includes('panel-contradiction'), '矛盾検出パネルIDが存在する');
assert(contraPanel.includes('checkContradiction'), '矛盾チェック関数が存在する');
assert(contraPanel.includes('runFullDetection'), '一括検出関数が存在する');
assert(contraPanel.includes('health-bar'), '健全性バーが存在する');
console.log(`    矛盾検出パネル: ${contraPanel.length}文字`);

console.log(`\n${'═'.repeat(50)}`);
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
