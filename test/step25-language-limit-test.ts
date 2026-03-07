/**
 * STEP 25 — 言語限界の公理化テスト
 * Theory #158〜#173 + LanguageLimitEngine + 龍樹接続
 */

import { LanguageLimitEngine, type SayabilityResult } from '../src/axiom-os/language-limit-engine';
import { connectToWittgenstein } from '../src/axiom-os/nagarjuna-proof';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';
import type { DFUMTValue } from '../src/memory/aios-memory';

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.error(`  ❌ ${msg}`); }
}

console.log('\n═══ STEP 25 — 言語限界の公理化テスト ═══\n');

// ─── 1: SEED_KERNEL確認 ─────────────────────────────────
console.log('── 1: SEED_KERNEL ──');

assert(SEED_KERNEL.length === 174, `1-1: SEED_KERNEL = ${SEED_KERNEL.length}理論（期待: 174）`);

const langLimitTheories = SEED_KERNEL.filter(t => t.category === 'language_limit');
assert(langLimitTheories.length === 8, `1-2: language_limit カテゴリ: ${langLimitTheories.length}理論`);

const expectedIds = [
  'dfumt-tractatus-picture', 'dfumt-silence-command', 'dfumt-language-game',
  'dfumt-family-resemblance', 'dfumt-private-language', 'dfumt-showing-saying',
  'dfumt-language-limit-infinity', 'dfumt-rule-following',
];
for (const id of expectedIds) {
  assert(SEED_KERNEL.some(t => t.id === id), `1-3: ${id} が存在する`);
}

// ─── 2: LanguageLimitEngine.analyze ─────────────────────
console.log('\n── 2: LanguageLimitEngine.analyze ──');

const engine = new LanguageLimitEngine();

const testCases: [string, SayabilityResult, DFUMTValue][] = [
  ['なぜ生きるか',                'UNSPEAKABLE',    'ZERO'],
  ['赤い色の感じ',                'SHOWABLE',       'NEITHER'],
  ['文脈によって意味が変わる',    'GAME_DEPENDENT', 'FLOWING'],
  ['ゲームの本質とは何か',        'FAMILY',         'BOTH'],
  ['規則に従うとはどういうことか','PARADOXICAL',    'BOTH'],
  ['人生の意味について',          'UNSPEAKABLE',    'ZERO'],
  ['痛みとはどのような体験か',    'SHOWABLE',       'NEITHER'],
  ['正しい解釈は存在するか',      'PARADOXICAL',    'BOTH'],
];

for (const [prop, expectedSay, expectedDfumt] of testCases) {
  const result = engine.analyze(prop);
  assert(result.sayability === expectedSay, `2: 「${prop}」→ ${result.sayability}（期待: ${expectedSay}）`);
  assert(result.dfumtValue === expectedDfumt, `2: 「${prop}」→ ${result.dfumtValue}（期待: ${expectedDfumt}）`);
}

// ─── 3: 沈黙判定 ───────────────────────────────────────
console.log('\n── 3: 沈黙判定 ──');

const silenceResult = engine.analyze('神は存在するか');
assert(silenceResult.silenceNeeded === true, '3-1: 「神は存在するか」は沈黙推奨');

const sayableResult = engine.analyze('水は100度で沸騰する');
assert(sayableResult.silenceNeeded === false, '3-2: 「水は100度で沸騰する」は沈黙不要');
assert(sayableResult.sayability === 'SAYABLE', '3-3: 事実命題はSAYABLE');

// ─── 4: バッチ分析 ──────────────────────────────────────
console.log('\n── 4: バッチ分析 ──');

const batch = engine.analyzeBatch(['なぜ生きるか', '2+2=4', '赤い色の感じ']);
assert(batch.length === 3, '4-1: バッチ結果3件');
assert(batch[0].sayability === 'UNSPEAKABLE', '4-2: バッチ1件目はUNSPEAKABLE');

// ─── 5: 静的メソッド ───────────────────────────────────
console.log('\n── 5: 静的メソッド ──');

const boundary = LanguageLimitEngine.explainBoundary();
assert(boundary.includes('ZERO'), '5-1: explainBoundaryにZEROが含まれる');
assert(boundary.includes('NEITHER'), '5-2: explainBoundaryにNEITHERが含まれる');
assert(boundary.includes('FLOWING'), '5-3: explainBoundaryにFLOWINGが含まれる');

const points = LanguageLimitEngine.getIntegrationPoints();
assert(points.length === 5, `5-4: 統合ポイント: ${points.length}件`);
assert(points.some(p => p.value === 'ZERO'), '5-5: ZEROの統合ポイントあり');
assert(points.some(p => p.value === 'INFINITY'), '5-6: INFINITYの統合ポイントあり');

// ─── 6: 龍樹接続（connectToWittgenstein） ──────────────
console.log('\n── 6: 龍樹接続 ──');

const neitherConn = connectToWittgenstein('NEITHER');
assert(neitherConn.includes('龍樹の空性'), '6-1: NEITHERは龍樹の空性と接続');
assert(neitherConn.includes('zeigen'), '6-2: NEITHERはzeigeに接続');

const zeroConn = connectToWittgenstein('ZERO');
assert(zeroConn.includes('Unsinn'), '6-3: ZEROはUnsinnと接続');

const trueConn = connectToWittgenstein('TRUE');
assert(trueConn.includes('語りえる'), '6-4: TRUEは語りえる領域');

// ─── 7: Theory構造の確認 ────────────────────────────────
console.log('\n── 7: Theory構造 ──');

const pictureTheory = SEED_KERNEL.find(t => t.id === 'dfumt-tractatus-picture')!;
assert(pictureTheory.axiom.includes('写像'), '7-1: 写像理論の公理にキーワードあり');
assert(pictureTheory.keywords.includes('Tractatus'), '7-2: Tractatusキーワードあり');

const silenceTheory = SEED_KERNEL.find(t => t.id === 'dfumt-silence-command')!;
assert(silenceTheory.axiom.includes('ZERO'), '7-3: 沈黙の命令にZEROあり');

const gameTheory = SEED_KERNEL.find(t => t.id === 'dfumt-language-game')!;
assert(gameTheory.axiom.includes('FLOWING'), '7-4: 言語ゲームにFLOWINGあり');

const infinityTheory = SEED_KERNEL.find(t => t.id === 'dfumt-language-limit-infinity')!;
assert(infinityTheory.axiom.includes('INFINITY'), '7-5: 世界の限界にINFINITYあり');

// ─── 結果 ────────────────────────────────────────────────
console.log(`\n═══ 結果: ${pass}/${pass + fail} テスト通過 ═══\n`);
if (fail > 0) process.exit(1);
