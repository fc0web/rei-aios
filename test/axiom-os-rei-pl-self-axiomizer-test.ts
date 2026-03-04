import { ReiPLSelfAxiomizer } from '../src/axiom-os/rei-pl-self-axiomizer';

const selfAxiomizer = new ReiPLSelfAxiomizer();
let passed = 0, failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== ReiPLSelfAxiomizer Tests ===\n');

// Lexer公理化
const lexerResult = selfAxiomizer.axiomize('lexer');
assert(lexerResult.sourceModule === 'lexer', 'lexer: モジュール名');
assert(lexerResult.patterns > 0, 'lexer: パターン検出');
assert(lexerResult.axioms.length > 0, 'lexer: 公理生成');
assert(lexerResult.insight.length > 0, 'lexer: 洞察メッセージ');
console.log(`  Lexer洞察: ${lexerResult.insight}`);

// Parser公理化
const parserResult = selfAxiomizer.axiomize('parser');
assert(parserResult.sourceModule === 'parser', 'parser: モジュール名');
assert(parserResult.axioms.length > 0, 'parser: 公理生成');
assert(typeof parserResult.selfReferenceDetected === 'boolean', 'parser: 自己参照検出フラグ');
console.log(`  Parser自己参照: ${parserResult.selfReferenceDetected}`);
console.log(`  Parser洞察: ${parserResult.insight}`);

// CodeGen公理化
const codegenResult = selfAxiomizer.axiomize('codegen');
assert(codegenResult.sourceModule === 'codegen', 'codegen: モジュール名');
assert(codegenResult.axioms.length > 0, 'codegen: 公理生成');
console.log(`  CodeGen洞察: ${codegenResult.insight}`);

// 全モジュール一括公理化
const allResults = selfAxiomizer.axiomizeAll();
assert(allResults.length === 3, '全モジュール: 3件返る');
assert(allResults.every(r => r.axioms.length > 0), '全モジュール: 全て公理を持つ');

// マージテスト
const merged = selfAxiomizer.mergeSelfAxioms();
assert(merged.length > 0, 'マージ: 公理が統合される');
assert(new Set(merged.map(a => a.id)).size === merged.length, 'マージ: 重複なし');
console.log(`  統合公理数: ${merged.length}`);

// 七価論理タグ
for (const r of allResults) {
  assert(r.sevenLogicTag.length > 0, `${r.sourceModule}: 七価論理タグ存在`);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
