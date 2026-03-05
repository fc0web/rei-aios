import { AxiomCompressionSelector } from '../src/axiom-os/axiom-compression-selector';
import { AxiomLLMZipEnhanced } from '../src/axiom-os/axiom-llm-zip-enhanced';
import { AxiomStreamCompressor } from '../src/axiom-os/axiom-stream-compressor';
import { SEED_KERNEL, type SeedTheory } from '../src/axiom-os/seed-kernel';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== STEP 6-B/C/D: 圧縮スイートテスト ===\n');

const axioms: SeedTheory[] = [
  { id: 'a1', axiom: 'π×π⁻¹=1 キャンセル意味論', category: 'zero_extension', keywords: ['ゼロπ', 'pi'] },
  { id: 'a2', axiom: 'π縮小理論', category: 'zero_extension', keywords: ['ゼロπ', 'pi', '縮小'] },
  { id: 'a3', axiom: '真偽両方 四値論理', category: 'logic', keywords: ['四価論理', '龍樹'] },
  { id: 'a4', axiom: '七価論理拡張', category: 'logic', keywords: ['七価論理', '四価論理'] },
  { id: 'a5', axiom: 'Ω(Ω(x))→Ω(x) 安定性', category: 'computation', keywords: ['冪等性', 'omega'] },
  { id: 'a6', axiom: 'Ω収束確認', category: 'computation', keywords: ['冪等性', 'omega', '収束'] },
  { id: 'a7', axiom: 'AI(t+1)=f(AI(t))', category: 'ai-integration', keywords: ['自己進化', '適応'] },
  { id: 'a8', axiom: 'UMTE=⋃全D-FUMT理論', category: 'unified', keywords: ['UMTE', '統合'] },
];

// ══════════════════════════════════════
// 6-B: AxiomCompressionSelector テスト
// ══════════════════════════════════════
console.log('── 6-B: AxiomCompressionSelector ──');
{
  const selector = new AxiomCompressionSelector();

  // 1. プロファイル分析
  const profile = selector.analyzeProfile(axioms);
  assert(profile.axiomCount === 8, '1. axiomCountが正しい');
  assert(profile.categoryDiversity > 0 && profile.categoryDiversity <= 1, '2. categoryDiversityが0〜1');
  assert(profile.keywordOverlapRate >= 0 && profile.keywordOverlapRate <= 1, '3. keywordOverlapRateが0〜1');
  assert(profile.repetitionScore >= 0 && profile.repetitionScore <= 1, '4. repetitionScoreが0〜1');

  // 2. カテゴリ集中データのプロファイル
  const concentrated: SeedTheory[] = SEED_KERNEL.filter(s => s.category === 'logic');
  if (concentrated.length >= 2) {
    const conProfile = selector.analyzeProfile(concentrated);
    assert(conProfile.categoryDiversity <= 0.3, '5. カテゴリ集中時の多様性が低い');
  } else { assert(true, '5. スキップ'); }

  // 3. 方式選択
  const sel = selector.selectMethod(profile);
  assert(typeof sel.method === 'string', '6. selectMethodが方式を返す');
  assert(sel.reason.length > 0, '7. 選択理由が空でない');

  // 4. 自動圧縮
  const result = selector.compress(axioms, 'auto');
  assert(result.data.length > 0, '8. 自動圧縮のdataが空でない');
  assert(result.ratio > 0, '9. 自動圧縮のratioが正');
  assert(result.profile.axiomCount === 8, '10. プロファイルが結果に含まれる');

  // 5. 各方式を手動指定
  for (const method of ['hybrid', 'delta', 'llmzip', 'rct'] as const) {
    const r = selector.compress(axioms, method);
    assert(r.data.length > 0, `11. ${method}圧縮のdataが空でない`);
    const restored = selector.decompress(r.data);
    assert(restored.length === axioms.length, `12. ${method}の復元数が一致`);
  }

  // 6. SEED_KERNELで全方式ベンチマーク
  const bench = selector.benchmark([...SEED_KERNEL]);
  assert(bench.length === 4, '13. ベンチマーク結果が4方式分');
  assert(bench.every(b => b.ratio > 0), '14. 全方式のratioが正');

  const formatted = selector.formatBenchmark(bench);
  assert(formatted.length > 0, '15. フォーマット結果が空でない');
  console.log('\n  SEED_KERNEL ベンチマーク:');
  formatted.split('\n').forEach(l => console.log(`     ${l}`));

  // 7. 空配列
  const emptyResult = selector.compress([], 'auto');
  assert(emptyResult.data.length >= 0, '16. 空配列の自動圧縮が失敗しない');

  // 8. 不明なマジックバイトはエラー
  try {
    selector.decompress(Buffer.from('UNKNOWN_MAGIC_BYTES'));
    assert(false, '17. 不明フォーマットでエラーが発生すべき');
  } catch {
    assert(true, '17. 不明フォーマットで正しくエラー');
  }
}

// ══════════════════════════════════════
// 6-C: AxiomLLMZipEnhanced テスト (async)
// ══════════════════════════════════════
async function runAsyncTests() {
  console.log('\n── 6-C: AxiomLLMZipEnhanced ──');
  {
    // mockモードで初期化
    const enhanced = new AxiomLLMZipEnhanced({ provider: 'mock' });

    // 1. LLM確認（mockは常にavailable）
    const llmOk = await enhanced.checkLLM();
    assert(typeof llmOk === 'boolean', '18. checkLLMがbooleanを返す');

    // 2. mockLLM圧縮（低hitThresholdでヒット率向上）
    const result = enhanced.compressWithMockLLM(axioms, 0.3);
    assert(result.data.length > 0, '19. mockLLM圧縮のdataが空でない');
    assert(result.hitRate >= 0, '20. hitRateが0以上');

    // 3. 非同期圧縮
    const asyncResult = await enhanced.compressAsync(axioms, 0.3);
    assert(asyncResult.data.length > 0, '21. 非同期圧縮のdataが空でない');
    assert(typeof asyncResult.usedLLM === 'boolean', '22. usedLLMがboolean');
    assert(asyncResult.llmPredictions + asyncResult.statPredictions === axioms.length, '23. 予測数の合計が公理数と一致');

    // 4. 復元
    const restored = enhanced.decompress(asyncResult.data);
    assert(restored.length === axioms.length, '24. 非同期圧縮からの復元数が一致');

    // 5. LLMなし（nullconfig）でもフォールバック動作
    const noLLM = new AxiomLLMZipEnhanced();
    const noLLMResult = noLLM.compress(axioms);
    assert(noLLMResult.data.length > 0, '25. LLMなしでも圧縮が動作');

    // 6. SEED_KERNELで非同期圧縮
    const seedAsync = await enhanced.compressAsync(SEED_KERNEL.slice(0, 20), 0.4);
    assert(seedAsync.hitCount + seedAsync.missCount === 20, '26. SEED_KERNEL非同期: hit+miss=20');
    console.log(`\n  LLMZip Enhanced（mock）:`);
    console.log(`     ヒット率: ${(asyncResult.hitRate * 100).toFixed(1)}%`);
    console.log(`     LLM予測: ${asyncResult.llmPredictions}件 / 統計予測: ${asyncResult.statPredictions}件`);
  }

  // ══════════════════════════════════════
  // 6-D: AxiomStreamCompressor テスト
  // ══════════════════════════════════════
  console.log('\n── 6-D: AxiomStreamCompressor ──');
  {
    const stream = new AxiomStreamCompressor({ windowSize: 3, method: 'auto' });

    // 1. 初期状態
    assert(stream.getBufferSize() === 0, '27. 初期バッファが空');
    assert(stream.getChunks().length === 0, '28. 初期チャンクが空');

    // 2. 公理を1つずつ追加
    let chunkEmitted = 0;
    for (let i = 0; i < 7; i++) {
      const chunk = stream.push(axioms[i % axioms.length]);
      if (chunk) {
        chunkEmitted++;
        assert(chunk.axiomCount > 0, `29-${i}. 出力チャンクのaxiomCountが正`);
        assert(chunk.compressedSize > 0, `30-${i}. 出力チャンクのcompressedSizeが正`);
      }
    }
    assert(chunkEmitted >= 2, '31. ウィンドウサイズ3で7件追加すると2チャンク以上出力');

    // 3. 残りをフラッシュ
    const lastChunk = stream.flush();
    assert(stream.getBufferSize() === 0, '32. フラッシュ後バッファが空');

    // 4. 統計情報
    const stats = stream.getStats();
    assert(stats.totalAxioms === 7, '33. totalAxiomsが7');
    assert(stats.totalChunks >= 2, '34. totalChunksが2以上');
    assert(stats.overallRatio > 0, '35. overallRatioが正');

    // 5. 復元
    const allRestored = stream.decompressAll();
    assert(allRestored.length > 0, '36. decompressAllで公理が復元');

    // 6. pushAll
    const stream2 = new AxiomStreamCompressor({ windowSize: 5 });
    const chunks = stream2.pushAll([...SEED_KERNEL.slice(0, 15)]);
    assert(chunks.length >= 3, '37. 15件をwindow=5で3チャンク出力');

    // 7. reset
    stream2.reset();
    assert(stream2.getBufferSize() === 0, '38. reset後バッファが空');
    assert(stream2.getChunks().length === 0, '39. reset後チャンクが空');
    assert(stream2.getStats().totalAxioms === 0, '40. reset後統計がリセット');

    // 8. 単一チャンク復元
    const stream3 = new AxiomStreamCompressor({ windowSize: 10 });
    stream3.pushAll([...axioms]);
    stream3.flush();
    const chunks3 = stream3.getChunks();
    if (chunks3.length > 0) {
      const chunkRestored = stream3.decompressChunk(chunks3[0]);
      assert(chunkRestored.length > 0, '41. 単一チャンクの復元が成功');
    } else { assert(true, '41. スキップ'); }

    // 9. 小さなwindowSizeでのストリーミング
    const stream4 = new AxiomStreamCompressor({ windowSize: 2, method: 'rct' });
    stream4.pushAll([...axioms]);
    stream4.flush();
    const s4stats = stream4.getStats();
    assert(s4stats.totalChunks >= 4, '42. windowSize=2で8件→4チャンク以上');

    // 10. getConfig
    const cfg = stream4.getConfig();
    assert(cfg.windowSize === 2, '43. getConfig: windowSizeが正しい');
    assert(cfg.method === 'rct', '44. getConfig: methodが正しい');

    console.log(`\n  ストリーム圧縮統計:`);
    console.log(`     合計公理数: ${stats.totalAxioms}`);
    console.log(`     チャンク数: ${stats.totalChunks}`);
    console.log(`     総合圧縮率: ${(stats.overallRatio * 100).toFixed(1)}%`);
  }

  // ══════════════════════════════════════
  // 統合テスト: 全5方式の比較
  // ══════════════════════════════════════
  console.log('\n── 統合テスト: 全4方式（REI\\x02〜REI\\x05）──');
  {
    const selector = new AxiomCompressionSelector();
    const bench = selector.benchmark([...SEED_KERNEL]);
    const validMethods = bench.filter(b => b.valid);
    assert(validMethods.length === 4, '45. 全4方式がラウンドトリップ成功');

    const bestMethod = bench[0]; // ratioが最も小さい = 最高圧縮率
    assert(bestMethod.ratio < 1.0, '46. 最良方式の圧縮率が100%以下');
    console.log(`\n  最良方式: ${bestMethod.method} (${(bestMethod.ratio * 100).toFixed(1)}%)`);
  }

  console.log(`\n結果: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runAsyncTests().catch(e => { console.error(e); process.exit(1); });
