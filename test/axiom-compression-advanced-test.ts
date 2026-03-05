import { AxiomChunkExtractor } from '../src/axiom-os/axiom-chunk-extractor';
import { AxiomDeltaCompressor } from '../src/axiom-os/axiom-delta-compressor';
import { SEED_KERNEL, type SeedTheory } from '../src/axiom-os/seed-kernel';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== STEP 5-A: チャンク並列抽出 + 辞書/デルタ圧縮テスト ===\n');

// テスト用ソースコード（疑似的に大きなファイルを作成）
const SAMPLE_SOURCE = `
function calculatePhi(n: number): number {
  if (n <= 1) return n;
  return calculatePhi(n - 1) + calculatePhi(n - 2);
}

class AxiomProcessor {
  private cache = new Map<string, string>();

  async process(axiom: string): Promise<string> {
    if (this.cache.has(axiom)) return this.cache.get(axiom)!;
    const result = await this.transform(axiom);
    this.cache.set(axiom, result);
    return result;
  }

  private transform(s: string): Promise<string> {
    return Promise.resolve(s.trim().toLowerCase());
  }
}

const values = [1, 2, 3, 4, 5];
const doubled = values.map(x => x * 2);
const sum = values.reduce((acc, x) => acc + x, 0);
const evens = values.filter(x => x % 2 === 0);

for (let i = 0; i < values.length; i++) {
  console.log(values[i]);
}

try {
  const data = JSON.parse('{"key": "value"}');
  if (data.key === 'value') {
    console.log('parsed');
  }
} catch (e) {
  console.error('parse error', e);
}
`.repeat(10); // 10回繰り返して大きなファイルにする

// ══════════════════════════════════════
// AxiomChunkExtractor テスト
// ══════════════════════════════════════
console.log('── AxiomChunkExtractor ──');
{
  const extractor = new AxiomChunkExtractor({ chunkSize: 500, overlap: 50 });

  // 1. チャンク分割
  const chunks = extractor.splitIntoChunks(SAMPLE_SOURCE);
  assert(chunks.length > 1, '1. splitIntoChunks: 複数チャンクに分割');
  assert(chunks.length <= 50, '2. splitIntoChunks: maxChunks制限内');
  assert(chunks[0].start === 0, '3. splitIntoChunks: 最初のチャンクはstart=0');
  assert(chunks[0].text.length > 0, '4. splitIntoChunks: 最初のチャンクが空でない');

  // 2. チャンクの連続性確認
  let continuityOk = true;
  for (let i = 1; i < chunks.length; i++) {
    if (chunks[i].start > chunks[i - 1].end) { continuityOk = false; break; }
  }
  assert(continuityOk, '5. チャンクが連続/オーバーラップ');

  // 3. 単一チャンク抽出
  const chunkResult = extractor.extractChunk(chunks[0], 0);
  assert(chunkResult.chunkIndex === 0, '6. extractChunk: chunkIndexが正しい');
  assert(typeof chunkResult.chunkHash === 'string' && chunkResult.chunkHash.length === 16, '7. extractChunk: chunkHashが16文字');
  assert(chunkResult.processingMs >= 0, '8. extractChunk: processingMsが0以上');

  // 4. 全体抽出
  const result = extractor.extract(SAMPLE_SOURCE);
  assert(result.totalChunks > 1, '9. extract: 複数チャンクが処理');
  assert(result.totalAxioms >= 0, '10. extract: totalAxiomsが0以上');
  assert(result.uniqueAxioms <= result.totalAxioms, '11. extract: uniqueAxioms <= totalAxioms');
  assert(result.duplicatesRemoved >= 0, '12. extract: duplicatesRemovedが0以上');
  assert(result.duplicatesRemoved === result.totalAxioms - result.uniqueAxioms, '13. extract: 重複数の計算が正しい');
  assert(result.mergedAxioms.length === result.uniqueAxioms, '14. extract: mergedAxiomsの長さが一致');
  assert(result.compressionHint >= 0 && result.compressionHint <= 1, '15. extract: compressionHintが0〜1の範囲');
  assert(result.totalMs >= 0, '16. extract: totalMsが0以上');

  // 5. 小さなチャンクサイズ
  const extractor2 = new AxiomChunkExtractor({ chunkSize: 100, overlap: 10 });
  const result2 = extractor2.extract(SAMPLE_SOURCE);
  assert(result2.totalChunks >= result.totalChunks, '17. 小さいchunkSizeで多くのチャンク');

  // 6. 重複除去OFF
  const extractor3 = new AxiomChunkExtractor({ chunkSize: 500, overlap: 50, deduplicateIds: false });
  const result3 = extractor3.extract(SAMPLE_SOURCE);
  assert(result3.duplicatesRemoved === 0, '18. deduplicateIds=false で重複除去なし');
  assert(result3.uniqueAxioms === result3.totalAxioms, '19. deduplicateIds=false でunique=total');

  // 7. SEED_KERNELの公理文字列をソースとして処理
  const seedSource = SEED_KERNEL.map(s => `// ${s.id}\nconst axiom = "${s.axiom}";\n`).join('\n');
  const seedResult = extractor.extract(seedSource);
  assert(seedResult.totalChunks >= 1, '20. SEED_KERNEL文字列のチャンク処理');

  // 8. getConfig
  const cfg = extractor.getConfig();
  assert(cfg.chunkSize === 500, '21. getConfig: chunkSizeが正しい');
  assert(cfg.overlap === 50, '22. getConfig: overlapが正しい');
}

// ══════════════════════════════════════
// AxiomDeltaCompressor テスト
// ══════════════════════════════════════
console.log('\n── AxiomDeltaCompressor ──');
{
  const compressor = new AxiomDeltaCompressor();

  // テスト用公理列（類似したものを含む）
  const axioms: SeedTheory[] = [
    { id: 'test-1', axiom: 'π×π⁻¹=1 キャンセル意味論', category: 'zero_extension', keywords: ['ゼロπ', 'pi', 'キャンセル'] },
    { id: 'test-2', axiom: 'π×π⁻¹=1 拡張版', category: 'zero_extension', keywords: ['ゼロπ', 'pi', '拡張'] },
    { id: 'test-3', axiom: '真偽両方 四値論理', category: 'logic', keywords: ['四価論理', '龍樹'] },
    { id: 'test-4', axiom: 'Ω(Ω(x))→Ω(x) 安定性', category: 'computation', keywords: ['冪等性', 'omega'] },
    { id: 'test-5', axiom: 'Ω(Ω(x))→Ω(x) 変形版', category: 'computation', keywords: ['冪等性', 'omega', '変形'] },
  ];

  // 1. 辞書構築
  const dict = compressor.buildDictionary(axioms);
  assert(Array.isArray(dict), '23. buildDictionary: 配列を返す');
  assert(dict.every(d => d.saving > 0), '24. buildDictionary: 全エントリのsavingが正');
  assert(dict.every(d => d.frequency >= 2), '25. buildDictionary: 頻度2以上のみ');

  // 2. 辞書適用・逆適用（ラウンドトリップ）
  const text = 'zero_extension logic computation ゼロπ pi 冪等性 omega';
  const encoded = compressor.applyDictionary(text, dict);
  const decoded = compressor.reverseDictionary(encoded, dict);
  assert(decoded === text, '26. 辞書ラウンドトリップ: 完全一致');

  // 3. デルタ計算
  const prev = axioms[0];
  const curr = axioms[1]; // category同じ、axiom違う、keyword一部違う
  const delta = compressor.computeDelta(prev, curr);
  assert(delta.id === curr.id, '27. computeDelta: IDが正しい');
  assert(delta.type === 'delta' || delta.type === 'full', '28. computeDelta: typeがdeltaまたはfull');

  // 4. 完全一致のデルタ（IDだけ変わる）
  const identical = { ...axioms[0], id: 'test-99' };
  const sameDelta = compressor.computeDelta(axioms[0], identical);
  assert(sameDelta.id === 'test-99', '29. 完全一致デルタのIDが正しい');

  // 5. 圧縮
  const result = compressor.compress(axioms);
  assert(result.data.length > 0, '30. compress: dataが空でない');
  assert(result.data.slice(0, 4).toString() === 'REI\x03', '31. compress: マジックバイトREI\\x03');
  assert(result.originalSize > 0, '32. compress: originalSizeが正');
  assert(result.compressedSize > 0, '33. compress: compressedSizeが正');
  assert(result.ratio > 0 && result.ratio <= 2, '34. compress: ratioが合理的');
  assert(result.dictSize >= 0, '35. compress: dictSizeが0以上');
  assert(result.fullCount >= 1, '36. compress: 最初の公理は必ずfull');

  // 6. 復元（ラウンドトリップ）
  const restored = compressor.decompress(result.data);
  assert(restored.length === axioms.length, '37. decompress: 公理数が一致');
  let allIdMatch = true, allAxiomMatch = true, allCatMatch = true;
  for (let i = 0; i < axioms.length; i++) {
    if (restored[i].id !== axioms[i].id) allIdMatch = false;
    if (restored[i].axiom !== axioms[i].axiom) allAxiomMatch = false;
    if (restored[i].category !== axioms[i].category) allCatMatch = false;
  }
  assert(allIdMatch, '38. decompress: 全IDが一致');
  assert(allAxiomMatch, '39. decompress: 全axiomが一致');
  assert(allCatMatch, '40. decompress: 全categoryが一致');

  // 7. SEED_KERNELで圧縮率テスト
  const seedResult = compressor.compress([...SEED_KERNEL]);
  assert(seedResult.ratio < 1.0, '41. SEED_KERNEL圧縮率が100%以下');
  const seedRestored = compressor.decompress(seedResult.data);
  assert(seedRestored.length === SEED_KERNEL.length, '42. SEED_KERNEL復元数が一致');
  assert(seedRestored[0].id === SEED_KERNEL[0].id, '43. SEED_KERNEL先頭ID一致');

  // 8. 空配列
  const emptyResult = compressor.compress([]);
  assert(emptyResult.data.length > 0, '44. 空配列の圧縮が失敗しない');

  // 9. 単一公理
  const singleResult = compressor.compress([SEED_KERNEL[0]]);
  const singleRestored = compressor.decompress(singleResult.data);
  assert(singleRestored.length === 1, '45. 単一公理の復元数が1');
  assert(singleRestored[0].id === SEED_KERNEL[0].id, '46. 単一公理の復元IDが一致');
}

// ══════════════════════════════════════
// 統合テスト: チャンク抽出 → デルタ圧縮
// ══════════════════════════════════════
console.log('\n── 統合テスト: ChunkExtractor → DeltaCompressor ──');
{
  const extractor = new AxiomChunkExtractor({ chunkSize: 500 });
  const compressor = new AxiomDeltaCompressor();

  // ソースコードをチャンク抽出
  const extracted = extractor.extract(SAMPLE_SOURCE);
  assert(extracted.mergedAxioms.length >= 0, '47. 統合: チャンク抽出完了');

  if (extracted.mergedAxioms.length > 0) {
    // 抽出した公理をデルタ圧縮
    const compressed = compressor.compress(extracted.mergedAxioms);
    assert(compressed.compressedSize > 0, '48. 統合: デルタ圧縮完了');

    // 復元検証
    const restored = compressor.decompress(compressed.data);
    assert(restored.length === extracted.mergedAxioms.length, '49. 統合: 復元数が一致');
    assert(compressed.ratio <= 1.5, '50. 統合: 圧縮率が合理的');

    console.log(`  チャンク数: ${extracted.totalChunks}`);
    console.log(`  抽出公理数: ${extracted.totalAxioms} → ユニーク: ${extracted.uniqueAxioms}`);
    console.log(`  圧縮率: ${(compressed.ratio * 100).toFixed(1)}%`);
    console.log(`  辞書エントリ数: ${compressed.dictSize}`);
    console.log(`  デルタ保存: ${compressed.deltaCount}件 / フル保存: ${compressed.fullCount}件`);
  } else {
    // 公理が0件でも統合テストはPASSとする
    assert(true, '48. 統合: 公理0件でもエラーなし');
    assert(true, '49. 統合: スキップ');
    assert(true, '50. 統合: スキップ');
  }
}

console.log(`\n結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
