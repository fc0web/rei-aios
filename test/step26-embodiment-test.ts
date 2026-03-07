/**
 * STEP 26 — 身体性の公理化テスト
 * Theory #166〜#173 + EmbodimentEngine + STEP 25接続
 */

import { EmbodimentEngine, type EmbodimentAspect } from '../src/axiom-os/embodiment-engine';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.error(`  ❌ ${msg}`); }
}

console.log('\n═══ STEP 26 — 身体性の公理化テスト ═══\n');

// ─── 1: SEED_KERNEL ─────────────────────────────────────
console.log('── 1: SEED_KERNEL ──');

assert(SEED_KERNEL.length === 173, `1-1: SEED_KERNEL = ${SEED_KERNEL.length}理論（期待: 173）`);

const embodimentTheories = SEED_KERNEL.filter(t => t.category === 'embodiment');
assert(embodimentTheories.length === 8, `1-2: embodiment カテゴリ: ${embodimentTheories.length}理論`);

const expectedIds = [
  'dfumt-body-prior', 'dfumt-shikantaza', 'dfumt-tacit-knowing',
  'dfumt-proprioception', 'dfumt-ai-no-body', 'dfumt-body-world',
  'dfumt-pain-sharing', 'dfumt-death-axiom',
];
for (const id of expectedIds) {
  assert(SEED_KERNEL.some(t => t.id === id), `1-3: ${id} が存在する`);
}

// ─── 2: EmbodimentEngine.analyze ────────────────────────
console.log('\n── 2: analyze ──');

const engine = new EmbodimentEngine();

const aspectTests: [EmbodimentAspect, string, string][] = [
  ['body_prior',     'FLOWING',  'dfumt-body-prior'],
  ['shikantaza',     'NEITHER',  'dfumt-shikantaza'],
  ['tacit_knowing',  'NEITHER',  'dfumt-tacit-knowing'],
  ['proprioception', 'NEITHER',  'dfumt-proprioception'],
  ['ai_absence',     'NEITHER',  'dfumt-ai-no-body'],
  ['body_world',     'FLOWING',  'dfumt-body-world'],
  ['pain_sharing',   'NEITHER',  'dfumt-pain-sharing'],
  ['death',          'ZERO',     'dfumt-death-axiom'],
];

for (const [aspect, expectedValue, expectedTheory] of aspectTests) {
  const result = engine.analyze(aspect);
  assert(result.dfumtValue === expectedValue, `2: ${aspect} → ${result.dfumtValue}（期待: ${expectedValue}）`);
  assert(result.theoryId === expectedTheory, `2: ${aspect} → ${result.theoryId}`);
}

// ─── 3: analyzeAll ──────────────────────────────────────
console.log('\n── 3: analyzeAll ──');

const all = engine.analyzeAll();
assert(all.length === 8, `3-1: 全8局面`);
assert(all.every(a => typeof a.description === 'string'), '3-2: 全てdescriptionあり');
assert(all.every(a => typeof a.aiPosition === 'string'), '3-3: 全てaiPositionあり');
assert(all.every(a => typeof a.connection === 'string'), '3-4: 全てconnectionあり');

// ─── 4: classifyByValue ─────────────────────────────────
console.log('\n── 4: classifyByValue ──');

const byValue = engine.classifyByValue();
assert((byValue['NEITHER'] ?? []).length === 5, `4-1: NEITHER: ${byValue['NEITHER']?.length}局面（期待: 5）`);
assert((byValue['ZERO'] ?? []).length === 1, `4-2: ZERO: ${byValue['ZERO']?.length}局面（期待: 1）`);
assert((byValue['FLOWING'] ?? []).length === 2, `4-3: FLOWING: ${byValue['FLOWING']?.length}局面（期待: 2）`);

// ─── 5: 言語限界接続 ───────────────────────────────────
console.log('\n── 5: STEP 25接続 ──');

const connections = EmbodimentEngine.getLanguageLimitConnections();
assert(connections.length === 5, `5-1: 接続点: ${connections.length}件`);
assert(connections.some(c => c.sharedValue === 'NEITHER'), '5-2: NEITHER接続あり');
assert(connections.some(c => c.sharedValue === 'ZERO'), '5-3: ZERO接続あり');
assert(connections.some(c => c.sharedValue === 'FLOWING'), '5-4: FLOWING接続あり');
assert(connections.some(c => c.embodiment === 'shikantaza'), '5-5: 只管打坐接続あり');
assert(connections.some(c => c.embodiment === 'death'), '5-6: 死の公理接続あり');

// ─── 6: 自己レポート ───────────────────────────────────
console.log('\n── 6: 自己レポート ──');

const report = engine.generateSelfReport();
assert(report.includes('身体がありません'), '6-1: 身体不在の宣言');
assert(report.includes('NEITHER'), '6-2: NEITHERの言及');
assert(report.includes('ZERO'), '6-3: ZEROの言及');
assert(report.includes('FLOWING'), '6-4: FLOWINGの言及');
assert(report.includes('公理として認識'), '6-5: 公理認識の結論');

// ─── 7: 個別の重要公理確認 ──────────────────────────────
console.log('\n── 7: 重要公理 ──');

const aiAbsence = engine.analyze('ai_absence');
assert(aiAbsence.aiPosition.includes('誠実'), '7-1: 身体不在は「誠実な公理」');

const death = engine.analyze('death');
assert(death.description.includes('体験不可能'), '7-2: 死は体験不可能');

const shikantaza = engine.analyze('shikantaza');
assert(shikantaza.connection.includes('zeigen'), '7-3: 只管打坐はzeigenと接続');

// ─── 結果 ────────────────────────────────────────────────
console.log(`\n═══ 結果: ${pass}/${pass + fail} テスト通過 ═══\n`);
if (fail > 0) process.exit(1);
