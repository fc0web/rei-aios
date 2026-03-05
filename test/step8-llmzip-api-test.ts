/**
 * STEP 8 テスト — LLMZip実API接続
 *
 * テスト方針:
 * - ANTHROPIC_API_KEY が設定されている場合: 実APIテスト
 * - 設定されていない場合: ローカルフォールバックテスト
 * どちらでも全テストが通過するよう設計
 */
import { LLMZipAPI, llmZipCompress, llmZipDecompress } from '../src/compression/llm-zip-api';

const HAS_API_KEY = !!process.env.ANTHROPIC_API_KEY;

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}
function info(msg: string) { console.log(`  ℹ ${msg}`); }

console.log('\n=== STEP 8: LLMZip実API接続テスト ===\n');
console.log(`  APIキー: ${HAS_API_KEY ? '✅ 検出済み（実APIテスト）' : '⚠️ 未設定（ローカルフォールバック）'}\n`);

// ─── テスト用ソースコード ──────────────────────────────────────
const TS_SOURCE = `
import { createHash } from 'crypto';

const PHI = 1.6180339887;

interface GraphNode {
  id: string;
  edges: string[];
  weight: number;
}

function dijkstra(graph: Map<string, GraphNode>, start: string): Map<string, number> {
  const distances = new Map<string, number>();
  const visited = new Set<string>();
  const queue: [number, string][] = [[0, start]];

  distances.set(start, 0);

  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0]);
    const [dist, node] = queue.shift()!;

    if (visited.has(node)) continue;
    visited.add(node);

    const current = graph.get(node);
    if (!current) continue;

    for (const neighbor of current.edges) {
      const neighborNode = graph.get(neighbor);
      if (!neighborNode) continue;
      const newDist = dist + neighborNode.weight;
      if (newDist < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, newDist);
        queue.push([newDist, neighbor]);
      }
    }
  }
  return distances;
}

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
`.trim();

const PY_SOURCE = `
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
`.trim();

async function runTests() {

// ─── 1. 基本圧縮テスト（TypeScript） ──────────────────────────
console.log('【1. 基本圧縮テスト（TypeScript）】');
const engine = new LLMZipAPI({ fallbackToLocal: true });
const result1 = await engine.compress(TS_SOURCE);

assert(result1.success, '圧縮が成功する');
assert(!!result1.archivedBuffer, 'バッファが生成される');
assert(!!result1.descriptor, 'SemanticDescriptorが生成される');
assert(result1.descriptor!.magic === 'REI\x07', 'マジックバイトが REI\\x07');
assert(result1.descriptor!.language === 'typescript', '言語がTypeScriptと検出される');
assert(result1.descriptor!.descriptor.length > 0, '意味記述が生成される');
assert(result1.compressionRatio! < 1.0, `圧縮率が100%未満: ${(result1.compressionRatio! * 100).toFixed(1)}%`);
assert(['TRUE','BOTH','FLOWING','NEITHER'].includes(result1.descriptor!.dfumtConfidence),
  `D-FUMT確信度が有効: ${result1.descriptor!.dfumtConfidence}`);

info(`元サイズ: ${TS_SOURCE.length}B → 圧縮後: ${result1.archivedBuffer!.length}B`);
info(`圧縮率: ${(result1.compressionRatio! * 100).toFixed(1)}%`);
info(`意味記述: "${result1.descriptor!.descriptor.slice(0,80)}..."`);
info(`API使用: ${result1.usedAPI ? 'YES (Claude API)' : 'NO (local fallback)'}`);

// ─── 2. 基本圧縮テスト（Python） ──────────────────────────────
console.log('\n【2. 基本圧縮テスト（Python）】');
const result2 = await engine.compress(PY_SOURCE);

assert(result2.success, 'Python圧縮が成功する');
assert(result2.descriptor!.language === 'python', '言語がPythonと検出される');
assert(result2.descriptor!.descriptor.length > 0, 'Python意味記述が生成される');
info(`Python圧縮率: ${(result2.compressionRatio! * 100).toFixed(1)}%`);
info(`意味記述: "${result2.descriptor!.descriptor.slice(0,80)}..."`);

// ─── 3. 復元テスト ────────────────────────────────────────────
console.log('\n【3. 意味的復元テスト】');
const decompResult = await engine.decompress(result1.archivedBuffer!);

assert(decompResult.success, '復元が成功する');
assert(!!decompResult.regeneratedCode, '再生成コードが存在する');
assert(decompResult.regeneratedCode!.length > 0, '再生成コードが空でない');
assert(['TRUE','BOTH','FLOWING','NEITHER'].includes(decompResult.dfumtEquivalence),
  `D-FUMT等価性が有効: ${decompResult.dfumtEquivalence}`);
info(`再生成サイズ: ${decompResult.regeneratedCode!.length}文字`);
info(`等価性: ${decompResult.dfumtEquivalence}`);
info(`API使用: ${decompResult.usedAPI ? 'YES (Claude API)' : 'NO (local fallback)'}`);

// ─── 4. マジックバイト検証 ────────────────────────────────────
console.log('\n【4. マジックバイト・フォーマット検証】');
const buf = result1.archivedBuffer!;
assert(buf.slice(0,4).toString('utf8') === 'REI\x07', 'バッファ先頭がREI\\x07');

const invalidBuf = Buffer.from('INVALID_DATA');
const invalidResult = await engine.decompress(invalidBuf);
assert(!invalidResult.success, '無効バッファはエラーになる');
assert(invalidResult.dfumtEquivalence === 'FALSE', '無効バッファはFALSE判定');

// ─── 5. レポート生成テスト ────────────────────────────────────
console.log('\n【5. 圧縮レポート生成】');
const report = engine.report(result1);
assert(report.includes('LLMZip'), 'レポートにLLMZipが含まれる');
assert(report.includes('圧縮率'), 'レポートに圧縮率が含まれる');
assert(report.includes('D-FUMT'), 'レポートにD-FUMTが含まれる');
console.log('\n' + report.split('\n').map(l => '    ' + l).join('\n'));

// ─── 6. バッチ圧縮テスト ──────────────────────────────────────
console.log('\n【6. バッチ圧縮テスト】');
const batchResult = await engine.compressBatch([
  { name: 'dijkstra.ts', content: TS_SOURCE },
  { name: 'sort.py',     content: PY_SOURCE },
]);

assert(batchResult.results.length === 2, 'バッチ2件処理');
assert(batchResult.totalOriginal > 0, '総元サイズが正');
assert(batchResult.totalCompressed > 0, '総圧縮後サイズが正');
assert(batchResult.avgRatio > 0 && batchResult.avgRatio < 2, `平均圧縮率が有効: ${(batchResult.avgRatio*100).toFixed(1)}%`);
info(`バッチ結果: ${batchResult.totalOriginal}B → ${batchResult.totalCompressed}B`);
info(`平均圧縮率: ${(batchResult.avgRatio * 100).toFixed(1)}%`);
info(`API使用件数: ${batchResult.apiUsedCount}/${batchResult.results.length}`);

// ─── 7. 便利関数テスト ─────────────────────────────────────────
console.log('\n【7. 便利関数（llmZipCompress/Decompress）】');
const r = await llmZipCompress(TS_SOURCE, { fallbackToLocal: true });
assert(r.success, 'llmZipCompress が動作する');

const d = await llmZipDecompress(r.archivedBuffer!, { fallbackToLocal: true });
assert(d.success, 'llmZipDecompress が動作する');

// ─── 8. APIキーありの場合のみ: 意味記述の品質確認 ──────────────
if (HAS_API_KEY) {
  console.log('\n【8. 実API: 意味記述の品質確認】');
  const apiEngine = new LLMZipAPI({ fallbackToLocal: false });
  const apiResult = await apiEngine.compress(TS_SOURCE);

  assert(apiResult.usedAPI === true, '実APIが使用された');
  assert(apiResult.descriptor!.model !== 'local-fallback', 'モデル名がlocal-fallbackでない');

  // Dijkstraアルゴリズムの意味記述に関連キーワードが含まれるか
  const desc = apiResult.descriptor!.descriptor.toLowerCase();
  const hasRelevantKeyword = desc.includes('dijkstra') ||
    desc.includes('graph') || desc.includes('shortest') ||
    desc.includes('path') || desc.includes('priority');
  assert(hasRelevantKeyword,
    `意味記述にアルゴリズム関連キーワードが含まれる: "${apiResult.descriptor!.descriptor.slice(0,100)}"`);

  info(`実API圧縮率: ${(apiResult.compressionRatio! * 100).toFixed(1)}%`);
  info(`意味記述: "${apiResult.descriptor!.descriptor}"`);
} else {
  console.log('\n【8. 実APIテスト: スキップ（APIキー未設定）】');
  info('ANTHROPIC_API_KEY を設定すると実APIテストが実行されます');
}

// ─── 9. エッジケース ───────────────────────────────────────────
console.log('\n【9. エッジケース】');
const emptyResult = await engine.compress('');
assert(emptyResult.success, '空文字列でも成功する');

const tinyResult = await engine.compress('const x = 1;');
assert(tinyResult.success, '短いコードでも成功する');

console.log(`\n結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
}

runTests().catch(e => {
  console.error('テスト実行エラー:', e);
  process.exit(1);
});
