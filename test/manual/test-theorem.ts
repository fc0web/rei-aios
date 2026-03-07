// TheoremDeriver — 公理から定理を演繹する
import { TheoremDeriver } from '../../src/axiom-os/theorem-deriver';

const d = new TheoremDeriver();

console.log('=== logic カテゴリの定理 ===');
const logicSystem = d.deriveSystem('logic', 2);
console.log(`基底公理数: ${logicSystem.baseAxioms.length}`);
console.log(`導かれた定理数: ${logicSystem.totalDerived}`);
console.log('');
for (const t of logicSystem.theorems.slice(0, 5)) {
  console.log(`[${t.logicValue}] ${t.proof}`);
  console.log(`  信頼度: ${(t.confidence * 100).toFixed(0)}%  深さ: ${t.depth}`);
}

console.log('\n=== mathematics カテゴリの定理 ===');
const mathSystem = d.deriveSystem('mathematics', 1);
console.log(`導かれた定理数: ${mathSystem.totalDerived}`);
for (const t of mathSystem.theorems.slice(0, 3)) {
  console.log(`[${t.logicValue}] ${t.proof}`);
}
