/**
 * STEP 29 — UnsolvedProblemEngine テスト
 * 数学未解決問題の七価論理分析 + SEED_KERNEL 183理論確認
 */

import {
  UnsolvedProblemEngine,
  UNSOLVED_PROBLEMS,
} from '../src/axiom-os/unsolved-problem-engine';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';
import { AxiomEncoder } from '../src/axiom-os/axiom-encoder';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) {
    console.log(`  \u2705 ${name}`);
    passed++;
  } else {
    console.log(`  \u274c ${name}`);
    failed++;
  }
}

const engine = new UnsolvedProblemEngine(':memory:');

// ─── A. 問題読み込み ──────────────────────────────────────

console.log('\n=== A. 問題読み込み ===');

const all = engine.getAll();
assert(all.length === 11, `A-1: 全問題数=${all.length}（期待: 11）`);

const millennium = all.filter(p =>
  ['riemann', 'bsd', 'p_vs_np', 'navier_stokes', 'hodge', 'yang_mills', 'poincare'].includes(p.id)
);
assert(millennium.length === 7, `A-2: ミレニアム問題=${millennium.length}件`);

const others = all.filter(p =>
  ['goldbach', 'twin_prime', 'collatz', 'abc'].includes(p.id)
);
assert(others.length === 4, `A-3: その他問題=${others.length}件`);

// ─── B. ドメイン別取得 ──────────────────────────────────

console.log('\n=== B. ドメイン別取得 ===');

const numTheory = engine.getByDomain('number_theory');
assert(numTheory.length >= 3, `B-1: 数論問題=${numTheory.length}件`);

const analysis = engine.getByDomain('analysis');
assert(analysis.length >= 2, `B-2: 解析問題=${analysis.length}件`);

const algGeom = engine.getByDomain('algebraic_geometry');
assert(algGeom.length >= 2, `B-3: 代数幾何問題=${algGeom.length}件`);

// ─── C. D-FUMTパターン別取得 ──────────────────────────────

console.log('\n=== C. D-FUMTパターン別 ===');

const flowing = engine.getByDfumtPattern('FLOWING');
assert(flowing.length >= 3, `C-1: FLOWING問題=${flowing.length}件`);

const neither = engine.getByDfumtPattern('NEITHER');
assert(neither.length >= 3, `C-2: NEITHER問題=${neither.length}件`);

const both = engine.getByDfumtPattern('BOTH');
assert(both.length >= 2, `C-3: BOTH問題=${both.length}件`);

const trueProblems = engine.getByDfumtPattern('TRUE');
assert(trueProblems.length === 1, `C-4: TRUE問題=${trueProblems.length}件（ポアンカレ）`);

// ─── D. リーマン予想分析 ──────────────────────────────────

console.log('\n=== D. リーマン予想分析 ===');

const riemannAnalysis = engine.analyzeProblem('riemann');
assert(riemannAnalysis.questions.length === 5, `D-1: 問い=${riemannAnalysis.questions.length}件`);
assert(riemannAnalysis.hypotheses.length >= 3, `D-2: 仮説=${riemannAnalysis.hypotheses.length}件`);
assert(riemannAnalysis.conceptCandidates.length >= 3, `D-3: 新概念候補=${riemannAnalysis.conceptCandidates.length}件`);
assert(riemannAnalysis.contradictionRisk === 'NEITHER', `D-4: 矛盾リスク=${riemannAnalysis.contradictionRisk}`);

// ─── E. BSD予想分析 ──────────────────────────────────────

console.log('\n=== E. BSD予想分析 ===');

const bsdAnalysis = engine.analyzeProblem('bsd');
assert(bsdAnalysis.contradictionRisk === 'NEITHER', `E-1: BSD矛盾リスク=${bsdAnalysis.contradictionRisk}`);

// ─── F. P≠NP（BOTH状態）──────────────────────────────────

console.log('\n=== F. P≠NP分析 ===');

const pnpAnalysis = engine.analyzeProblem('p_vs_np');
assert(pnpAnalysis.contradictionRisk === 'NEITHER', `F-1: P≠NP矛盾リスク=${pnpAnalysis.contradictionRisk}（statusがFLOWING）`);

// ─── G. ABC予想（数学界でBOTH状態）──────────────────────

console.log('\n=== G. ABC予想 ===');

const abcProb = all.find(p => p.id === 'abc');
assert(abcProb?.status === 'BOTH', `G-1: ABC status=${abcProb?.status}`);
assert(abcProb?.bridgeStructure.relation === 'BOTH', `G-2: ABC橋渡し=BOTH`);

// ─── H. ポアンカレ予想（解決済み）────────────────────────

console.log('\n=== H. ポアンカレ予想 ===');

const poincare = all.find(p => p.id === 'poincare');
assert(poincare?.status === 'TRUE', `H-1: ポアンカレ status=TRUE`);
assert(poincare?.bridgeStructure.relation === 'TRUE', `H-2: ポアンカレ橋渡し=TRUE`);

const poincareAnalysis = engine.analyzeProblem('poincare');
assert(poincareAnalysis.contradictionRisk === 'FALSE', `H-3: ポアンカレ矛盾リスク=FALSE（リスクなし）`);

// ─── I. レポート生成 ──────────────────────────────────────

console.log('\n=== I. レポート生成 ===');

const report = engine.generateReport('riemann');
assert(report.includes('リーマン予想'), 'I-1: レポートに問題名');
assert(report.includes('NEITHER'), 'I-2: レポートにNEITHER');
assert(report.includes('橋渡し構造'), 'I-3: レポートに橋渡し構造');
assert(report.includes('prime_distribution'), 'I-4: レポートにdomainA');
assert(report.includes('仮説候補'), 'I-5: レポートに仮説候補');

// ─── J. ゴールドバッハ予想分析 ──────────────────────────

console.log('\n=== J. ゴールドバッハ分析 ===');

const goldbachAnalysis = engine.analyzeProblem('goldbach');
assert(goldbachAnalysis.conceptCandidates.length >= 3, `J-1: 新概念候補=${goldbachAnalysis.conceptCandidates.length}件`);
assert(goldbachAnalysis.contradictionRisk === 'NEITHER', `J-2: 矛盾リスク=${goldbachAnalysis.contradictionRisk}`);

// ─── K. 双子素数（INFINITYパターン）──────────────────────

console.log('\n=== K. 双子素数予想 ===');

const twinPrime = all.find(p => p.id === 'twin_prime');
assert(twinPrime?.dfumtPattern === 'INFINITY', `K-1: 双子素数パターン=INFINITY`);

const twinAnalysis = engine.analyzeProblem('twin_prime');
assert(twinAnalysis.hypotheses.length >= 3, `K-2: INFINITY仮説=${twinAnalysis.hypotheses.length}件`);

// ─── L. コラッツ予想 ──────────────────────────────────────

console.log('\n=== L. コラッツ予想 ===');

const collatz = all.find(p => p.id === 'collatz');
assert(collatz?.dfumtPattern === 'BOTH', `L-1: コラッツパターン=BOTH`);

// ─── M. 橋渡し構造の整合性 ──────────────────────────────

console.log('\n=== M. 橋渡し構造 ===');

for (const prob of all) {
  assert(
    prob.bridgeStructure.domainA.length > 0 && prob.bridgeStructure.domainB.length > 0,
    `M: ${prob.id} 橋渡し構造が存在`
  );
}

// ─── N. SEED_KERNEL 183理論 ──────────────────────────────

console.log('\n=== N. SEED_KERNEL 183理論 ===');

assert(SEED_KERNEL.length === 183, `N-1: SEED_KERNEL=${SEED_KERNEL.length}理論（期待: 183）`);

// Theory #175-#180 の存在確認
const newTheories = [
  'dfumt-riemann-bridge',
  'dfumt-flowing-conjecture',
  'dfumt-concept-genesis-necessity',
  'dfumt-bridge-structure',
  'dfumt-goedel-both',
  'dfumt-empirical-flowing',
];
for (const id of newTheories) {
  const t = SEED_KERNEL.find(s => s.id === id);
  assert(t !== undefined, `N: ${id} が存在`);
}

// ─── O. AxiomEncoder ────────────────────────────────────

console.log('\n=== O. AxiomEncoder ===');

const encoder = new AxiomEncoder();
assert(encoder.encodeCategory('unsolved_problems') === 'up', 'O-1: unsolved_problems → up');
assert(encoder.decodeCategory('up') === 'unsolved_problems', 'O-2: up → unsolved_problems');

// ─── P. 全問題D-FUMTパターン一覧 ────────────────────────

console.log('\n=== P. 全問題D-FUMTパターン一覧 ===');
for (const p of all) {
  console.log(`   ${p.dfumtPattern.padEnd(8)} | ${p.nameJa}`);
}
passed++;

// ─── 結果 ──────────────────────────────────────────────────

engine.close();

console.log(`\n${'='.repeat(50)}`);
console.log(`STEP 29 テスト結果: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`\u274c ${failed} tests failed`);
  process.exit(1);
} else {
  console.log('\u2705 All tests passed!');
}
