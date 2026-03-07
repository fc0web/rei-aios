/**
 * STEP 24 — 講師DB + IDバグ修正 テスト
 */

import { HistorianDB } from '../src/aios/historians/historian-db';
import { HISTORIAN_DB } from '../src/aios/historians/historian-personas';
import { HISTORIAN_SEEDS } from '../src/aios/historians/historian-seed';

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.error(`  ❌ ${msg}`); }
}

console.log('\n═══ STEP 24 — 講師DB + IDバグ修正 テスト ═══\n');

// ─── 0: IDバグ修正確認 ──────────────────────────────────
console.log('── 0: IDバグ修正 ──');

const gennaiCore = HISTORIAN_DB.find(h => h.id === 'hiraga_gennai');
assert(gennaiCore !== undefined, '0-1: hiraga_gennai が HISTORIAN_DB に存在する');
assert(gennaiCore?.nameJa === '平賀源内', '0-2: 平賀源内の名前が正しい');

const buggyId = HISTORIAN_DB.find(h => h.id === 'hirata_atsutane');
assert(buggyId === undefined, '0-3: hirata_atsutane は HISTORIAN_DB から消えている');

const atsutaneSeed = HISTORIAN_SEEDS.find(s => s.id === 'hirata_atsutane');
assert(atsutaneSeed !== undefined, '0-4: hirata_atsutane は HISTORIAN_SEEDS に存在する');
assert(atsutaneSeed?.nameJa === '平田篤胤', '0-5: 平田篤胤の名前が正しい');

// ─── 1: DB初期化 ────────────────────────────────────────
console.log('\n── 1: DB初期化 ──');

const db = new HistorianDB(); // :memory:

const expectedCount = HISTORIAN_DB.length + HISTORIAN_SEEDS.length;
assert(db.count === expectedCount, `1-1: 総講師数 = ${db.count}名（コア${HISTORIAN_DB.length} + 拡張${HISTORIAN_SEEDS.length} = ${expectedCount}）`);

// ─── 2: getById ─────────────────────────────────────────
console.log('\n── 2: getById ──');

const gennai = db.getById('hiraga_gennai');
assert(gennai !== null, '2-1: 平賀源内が取得できる（修正済みID）');
assert(gennai?.nameJa === '平賀源内', '2-2: 平賀源内の名前');

const atsutane = db.getById('hirata_atsutane');
assert(atsutane !== null, '2-3: 平田篤胤が取得できる');
assert(atsutane?.nameJa === '平田篤胤', '2-4: 平田篤胤の名前');

const nagarjuna = db.getById('nagarjuna');
assert(nagarjuna !== null, '2-5: 龍樹が取得できる');
assert(nagarjuna?.coreAxiom.includes('空'), '2-6: 龍樹のcoreAxiomに「空」が含まれる');

const socrates = db.getById('socrates');
assert(socrates !== null, '2-7: ソクラテス（コア）が取得できる');

const missing = db.getById('nonexistent');
assert(missing === null, '2-8: 存在しないIDはnull');

// ─── 3: getByRegion ─────────────────────────────────────
console.log('\n── 3: getByRegion ──');

const eastAsia = db.getByRegion('east_asia', 100);
assert(eastAsia.length > 5, `3-1: 東アジア講師: ${eastAsia.length}名`);

const southAsia = db.getByRegion('south_asia', 100);
assert(southAsia.length >= 2, `3-2: 南アジア講師: ${southAsia.length}名`);

const europe = db.getByRegion('europe_modern', 100);
assert(europe.length >= 5, `3-3: 近代ヨーロッパ講師: ${europe.length}名`);

// ─── 4: getByDomain ─────────────────────────────────────
console.log('\n── 4: getByDomain ──');

const mathHistorians = db.getByDomain('mathematics', 100);
assert(mathHistorians.length >= 4, `4-1: 数学者: ${mathHistorians.length}名`);

const philHistorians = db.getByDomain('philosophy', 100);
assert(philHistorians.length >= 8, `4-2: 哲学者: ${philHistorians.length}名`);

// ─── 5: getFree ─────────────────────────────────────────
console.log('\n── 5: getFree ──');

const freeHistorians = db.getFree(100);
assert(freeHistorians.length >= 10, `5-1: 無料講師: ${freeHistorians.length}名`);
assert(freeHistorians.every(h => h.isFree), '5-2: 全てisFree=true');

// ─── 6: search ──────────────────────────────────────────
console.log('\n── 6: search ──');

const searchKu = db.search('空', 10);
assert(searchKu.length >= 1, `6-1: 「空」検索: ${searchKu.length}件`);

const searchKant = db.search('Kant', 10);
assert(searchKant.length >= 1, `6-2: 「Kant」検索: ${searchKant.length}件`);
assert(searchKant[0].nameJa.includes('カント'), '6-3: カントが見つかる');

// ─── 7: getRandom ───────────────────────────────────────
console.log('\n── 7: getRandom ──');

const random3 = db.getRandom(3);
assert(random3.length === 3, '7-1: ランダム3名取得');
assert(random3.every(h => typeof h.nameJa === 'string'), '7-2: 全てnameJaあり');

// ─── 8: add ─────────────────────────────────────────────
console.log('\n── 8: add ──');

db.add({
  id: 'test_user_added',
  nameJa: 'テスト人物',
  nameEn: 'Test Person',
  period: '2000 – present',
  region: 'global',
  domains: ['general'],
  coreAxiom: 'テスト公理',
  style: 'テストスタイル',
  isFree: true,
});
const added = db.getById('test_user_added');
assert(added !== null, '8-1: ユーザー追加人物が取得できる');
assert(added?.nameJa === 'テスト人物', '8-2: 追加人物の名前');
assert(db.count === expectedCount + 1, `8-3: 総数が${expectedCount + 1}に増加`);

// ─── 9: promptTemplate ──────────────────────────────────
console.log('\n── 9: promptTemplate ──');

const dogen = db.getById('dogen');
assert(dogen !== null, '9-1: 道元が取得できる');
if (dogen) {
  const prompt = dogen.promptTemplate('悟りとは何か', 'D-FUMT理論の文脈で');
  assert(prompt.includes('道元'), '9-2: promptに「道元」が含まれる');
  assert(prompt.includes('悟りとは何か'), '9-3: promptに質問が含まれる');
  assert(prompt.includes('D-FUMT理論'), '9-4: promptに文脈が含まれる');
}

// ─── 10: getStats ───────────────────────────────────────
console.log('\n── 10: getStats ──');

const stats = db.getStats();
assert(stats.total === expectedCount + 1, `10-1: total = ${stats.total}`);
assert(typeof stats.byRegion === 'object', '10-2: byRegion is object');
assert(stats.bySource['core'] === HISTORIAN_DB.length, `10-3: core = ${stats.bySource['core']}`);
assert(stats.bySource['seed'] === HISTORIAN_SEEDS.length, `10-4: seed = ${stats.bySource['seed']}`);
assert(stats.bySource['user'] === 1, '10-5: user = 1');

console.log(`  統計: ${JSON.stringify(stats.byRegion)}`);

db.close();

// ─── 結果 ────────────────────────────────────────────────
console.log(`\n═══ 結果: ${pass}/${pass + fail} テスト通過 ═══\n`);
if (fail > 0) process.exit(1);
