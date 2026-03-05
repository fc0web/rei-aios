import {
  EXTENDED_THEORIES, getTheoriesByCategory, getTheoryById, buildDependencyGraph
} from '../src/axiom-os/seed-kernel-extended';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('\n=== STEP 7-B: SEED_KERNEL Extended テスト ===\n');

// ─── 1. 理論数テスト ───────────────────────────────────────
console.log('【1. 理論数確認】');
assert(EXTENDED_THEORIES.length === 25, `拡張理論が25件: ${EXTENDED_THEORIES.length}件`);
assert(EXTENDED_THEORIES.every(t => t.id >= 76 && t.id <= 100), '全理論がID 76〜100');
assert(EXTENDED_THEORIES.every(t => t.name.length > 0), '全理論が名前を持つ');
assert(EXTENDED_THEORIES.every(t => t.description.length > 0), '全理論が説明を持つ');

// ─── 2. カテゴリ別テスト ──────────────────────────────────
console.log('\n【2. カテゴリ別取得】');
const sacTheories = getTheoriesByCategory('consciousness_math');
assert(sacTheories.length === 6, `SAC C1-C6: 6件: ${sacTheories.length}`);

const umteTheories = getTheoriesByCategory('umte');
assert(umteTheories.length === 5, `UMTE U1-U5: 5件: ${umteTheories.length}`);

const nnmTheories = getTheoriesByCategory('non_numerical');
assert(nnmTheories.length === 5, `非数値数学: 5件: ${nnmTheories.length}`);

const mmrtTheories = getTheoriesByCategory('mmrt_amrt');
assert(mmrtTheories.length === 5, `MMRT/AMRT: 5件: ${mmrtTheories.length}`);

// ─── 3. 七価論理値テスト ──────────────────────────────────
console.log('\n【3. 七価論理値確認】');
const validValues = new Set(['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING']);
assert(EXTENDED_THEORIES.every(t => validValues.has(t.dfumtValue)),
  '全理論が有効な七価値を持つ');

// 特定理論のlogic確認
const c1 = getTheoryById(76);
assert(c1?.dfumtValue === 'BOTH', 'SAC-C1: BOTH（量子的重ね合わせ）');
const u3 = getTheoryById(84);
assert(u3?.dfumtValue === 'INFINITY', 'UMTE-U3: INFINITY（無限の七価分類）');

// ─── 4. 依存グラフテスト ──────────────────────────────────
console.log('\n【4. 依存グラフ】');
const graph = buildDependencyGraph();
assert(graph.size === 25, `グラフノード数: 25: ${graph.size}`);

// Theory #100は最も多くのIDを参照
const t100deps = graph.get(100) ?? [];
assert(t100deps.length >= 3, `Theory #100の依存数: ${t100deps.length}`);

// SAC-C6はSAC理論を参照
const c6deps = graph.get(81) ?? [];
assert(c6deps.includes(23), 'SAC-C6はTheory #23（七価論理）を参照');

// ─── 5. ID検索テスト ──────────────────────────────────────
console.log('\n【5. ID検索】');
assert(getTheoryById(76) !== undefined, 'Theory #76 が取得できる');
assert(getTheoryById(100) !== undefined, 'Theory #100 が取得できる');
assert(getTheoryById(999) === undefined, '存在しないIDは undefined');

// ─── 6. 第100理論確認 ─────────────────────────────────────
console.log('\n【6. 第100理論（完全性定理）確認】');
const t100 = getTheoryById(100);
assert(t100?.category === 'axiom_network', 'Theory #100: axiom_network カテゴリ');
assert(t100?.dfumtValue === 'TRUE', 'Theory #100: TRUE（完全性）');
assert(t100?.name.includes('完全性'), 'Theory #100: 完全性定理の名前');

console.log(`\n結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
