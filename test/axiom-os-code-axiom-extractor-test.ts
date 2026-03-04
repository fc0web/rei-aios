import { CodeAxiomExtractor } from '../src/axiom-os/code-axiom-extractor';

const extractor = new CodeAxiomExtractor();
let passed = 0, failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== CodeAxiomExtractor Tests ===\n');

// サンプルコード（TypeScript）
const sampleTS = `
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

const result = [1,2,3,4,5]
  .filter(x => x % 2 === 0)
  .map(x => x * 2)
  .reduce((acc, x) => acc + x, 0);

async function fetchData(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('fetch failed');
  return res.json();
}

const PI = 3.14159;
`;

const result = extractor.extract(sampleTS);

// 基本テスト
assert(result.patterns.length > 0, 'パターンが抽出される');
assert(result.seedTheories.length === result.patterns.length, 'seedTheoriesがpatternsと同数');
assert(result.totalLines > 0, '行数が計測される');
assert(typeof result.compressionHint === 'number', '圧縮ヒントが数値');
assert(result.compressionHint > 0 && result.compressionHint <= 1, '圧縮ヒントが0〜1の範囲');
assert(result.sourceHash.length > 0, 'ソースハッシュが生成される');

// パターン種別テスト
const kinds = result.patterns.map(p => p.kind);
assert(kinds.includes('recursion') || kinds.includes('branch'), '再帰または分岐が検出される');
assert(kinds.includes('loop') || kinds.includes('transform'), 'ループまたは変換が検出される');
assert(kinds.includes('reduce'), 'reduce収束が検出される');
assert(kinds.includes('guard'), 'guardパターンが検出される');
assert(kinds.includes('constant'), '定数パターンが検出される');

// 七価論理タグテスト
assert(typeof result.sevenLogicTag === 'string', '七価論理タグが生成される');
assert(result.sevenLogicTag.length > 0, '七価論理タグが空でない');
console.log(`  七価論理タグ: ${result.sevenLogicTag}`);

// seedTheory形式テスト
const seed = result.seedTheories[0];
assert(seed.id.startsWith('cae-'), 'seed.idがcae-で始まる');
assert(seed.axiom.length > 0, 'seed.axiomが存在する');
assert(seed.keywords.length > 0, 'seed.keywordsが存在する');
assert(seed.category.length > 0, 'seed.categoryが存在する');

// バッチ処理テスト
const batchResult = extractor.extractBatch([
  { name: 'main.ts', code: sampleTS },
  { name: 'util.ts', code: 'function add(a: number, b: number) { return a + b; }' },
]);
assert(batchResult.length === 2, 'バッチ処理が2件返す');

// マージテスト
const merged = extractor.mergeResults(batchResult);
assert(merged.patterns.length > 0, 'マージ結果にパターンが含まれる');
assert(merged.totalLines > 0, 'マージ結果に行数が含まれる');
assert(merged.seedTheories.length === merged.patterns.length, 'マージのseedとpatternが一致');

// dominantCategory
assert(typeof result.dominantCategory === 'string', 'dominantCategoryが文字列');
console.log(`  支配的カテゴリ: ${result.dominantCategory}`);
console.log(`  抽出パターン数: ${result.patterns.length}`);
console.log(`  推定圧縮率: ${(result.compressionHint * 100).toFixed(1)}%`);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
