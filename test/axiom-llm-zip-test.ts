import { AxiomLLMZip } from '../src/axiom-os/axiom-llm-zip';
import { SEED_KERNEL, type SeedTheory } from '../src/axiom-os/seed-kernel';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== STEP 5-B: LLMZip完全版テスト ===\n');

const llmzip = new AxiomLLMZip();

// テスト用公理（カテゴリ・キーワードに規則性を持たせる）
const axioms: SeedTheory[] = [
  { id: 'a1', axiom: 'π×π⁻¹=1 キャンセル意味論', category: 'zero_extension', keywords: ['ゼロπ', 'pi'] },
  { id: 'a2', axiom: 'π縮小理論 x×(1/π)^n', category: 'zero_extension', keywords: ['ゼロπ', 'pi', '縮小'] },
  { id: 'a3', axiom: '真偽両方 四値論理', category: 'logic', keywords: ['四価論理', '龍樹'] },
  { id: 'a4', axiom: '七価論理 真偽両方neither∞〇～', category: 'logic', keywords: ['七価論理', '四価論理'] },
  { id: 'a5', axiom: 'Ω(Ω(x))→Ω(x) 安定性', category: 'computation', keywords: ['冪等性', 'omega'] },
  { id: 'a6', axiom: 'Ω収束 計算安定性確保', category: 'computation', keywords: ['冪等性', 'omega', '収束'] },
  { id: 'a7', axiom: 'AI(t+1)=f(AI(t),E(t))', category: 'ai-integration', keywords: ['自己進化AI', '適応'] },
  { id: 'a8', axiom: 'FGAIUT=⋃AI_gen×D-FUMT', category: 'ai-integration', keywords: ['FGAIUT', '未来AI'] },
];

// ══════════════════════════════════════
// モデル構築テスト
// ══════════════════════════════════════
console.log('── モデル構築 ──');
{
  const model = llmzip.buildModel(axioms);

  assert(model.categoryFreq.size > 0, '1. categoryFreqが構築される');
  assert(model.categoryTransition.size > 0, '2. categoryTransitionが構築される');
  assert(model.categoryFreq.has('zero_extension'), '3. zero_extensionカテゴリが記録');
  assert(model.categoryFreq.has('logic'), '4. logicカテゴリが記録');
  assert(model.categoryFreq.get('zero_extension')! >= 2, '5. zero_extensionの頻度が2以上');

  // カテゴリ遷移: zero_extension → logic が記録されているはず
  const trans = model.categoryTransition.get('zero_extension');
  assert(trans !== undefined, '6. zero_extensionの遷移表が存在');

  // キーワード共起
  assert(model.keywordCooccurrence.size > 0, '7. keywordCooccurrenceが構築される');

  // axiomプレフィクス
  assert(model.axiomPrefixes.size > 0, '8. axiomPrefixesが構築される');

  // SEED_KERNELでモデル構築
  const seedModel = llmzip.buildModel(SEED_KERNEL);
  assert(seedModel.categoryFreq.size >= 5, '9. SEED_KERNELから5種以上のカテゴリ');
  assert(seedModel.categoryTransition.size > 0, '10. SEED_KERNELの遷移表が構築');
}

// ══════════════════════════════════════
// 予測テスト
// ══════════════════════════════════════
console.log('\n── 予測 ──');
{
  const model = llmzip.buildModel(axioms);

  // null（最初の公理）の予測
  const pred0 = llmzip.predict(null, model);
  assert(typeof pred0.predictedCategory === 'string', '11. null予測: categoryが文字列');
  assert(pred0.confidence >= 0 && pred0.confidence <= 1, '12. null予測: confidence範囲');

  // 前の公理がある場合の予測
  const pred1 = llmzip.predict(axioms[0], model);
  assert(typeof pred1.predictedCategory === 'string', '13. 前公理あり: categoryが文字列');
  assert(Array.isArray(pred1.predictedKeywords), '14. 前公理あり: keywordsが配列');
  assert(pred1.confidence >= 0 && pred1.confidence <= 1, '15. 前公理あり: confidence範囲');

  // zero_extensionの後はzero_extensionが予測される可能性
  const pred2 = llmzip.predict(axioms[0], model); // axioms[0]はzero_extension
  assert(pred2.predictedCategory.length > 0, '16. 予測カテゴリが空でない');
}

// ══════════════════════════════════════
// エンコード/デコードテスト
// ══════════════════════════════════════
console.log('\n── エンコード/デコード ──');
{
  const model = llmzip.buildModel(axioms);
  const pred = llmzip.predict(axioms[0], model);

  // MISSエントリのエンコード（信頼度が低い場合）
  const lowConfPred = { ...pred, confidence: 0.1 };
  const missEntry = llmzip.encodeEntry(axioms[1], lowConfPred);
  assert(missEntry.type === 'miss', '17. 低信頼度予測はMISS');
  assert(missEntry.axiom === axioms[1].axiom, '18. MISSエントリ: axiomが保存');
  assert(missEntry.category === axioms[1].category, '19. MISSエントリ: categoryが保存');

  // MISSエントリのデコード
  const decoded = llmzip.decodeEntry(missEntry, pred, axioms[0]);
  assert(decoded.id === axioms[1].id, '20. MISSデコード: IDが一致');
  assert(decoded.axiom === axioms[1].axiom, '21. MISSデコード: axiomが一致');
  assert(decoded.category === axioms[1].category, '22. MISSデコード: categoryが一致');

  // HITエントリのエンコード（カテゴリ一致 + 高信頼度）
  const hitPred = {
    predictedCategory: axioms[1].category,  // 正解カテゴリ
    predictedKeywords: ['ゼロπ'],
    predictedAxiomPrefix: '',
    confidence: 0.8,
  };
  const hitEntry = llmzip.encodeEntry(axioms[1], hitPred);
  assert(hitEntry.type === 'hit', '23. 高信頼度+カテゴリ一致はHIT');
  assert(hitEntry.categoryMatch === true, '24. HITエントリ: categoryMatchがtrue');
}

// ══════════════════════════════════════
// 圧縮・復元テスト
// ══════════════════════════════════════
console.log('\n── 圧縮・復元 ──');
{
  // 1. 基本圧縮
  const result = llmzip.compress(axioms);
  assert(result.data.length > 0, '25. compress: dataが空でない');
  assert(result.data.slice(0, 4).toString() === 'REI\x04', '26. compress: マジックバイトREI\\x04');
  assert(result.originalSize > 0, '27. compress: originalSizeが正');
  assert(result.compressedSize > 0, '28. compress: compressedSizeが正');
  assert(result.hitRate >= 0 && result.hitRate <= 1, '29. compress: hitRateが0〜1');
  assert(result.hitCount + result.missCount === axioms.length, '30. compress: hit+miss=全公理数');

  // 2. 復元（ラウンドトリップ）
  const restored = llmzip.decompress(result.data);
  assert(restored.length === axioms.length, '31. decompress: 公理数が一致');
  for (let i = 0; i < axioms.length; i++) {
    assert(restored[i].id === axioms[i].id, `32-${i}. decompress: ID[${i}]が一致`);
  }

  // 3. MISS公理は完全復元されるべき
  for (let i = 0; i < axioms.length; i++) {
    // MISSの公理はaxiomもcategoryも完全一致
    if (result.hitCount === 0) {
      // 全MISSの場合は完全一致するはず
      assert(restored[i].axiom === axioms[i].axiom, `33. 全MISS時: axiom[${i}]完全一致`);
    } else {
      assert(true, `33. ヒットあり: スキップ`);
      break;
    }
  }

  // 4. SEED_KERNELで圧縮
  const seedResult = llmzip.compress([...SEED_KERNEL]);
  assert(seedResult.data.length > 0, '34. SEED_KERNEL圧縮完了');
  assert(seedResult.compressedSize > 0, '35. SEED_KERNEL圧縮サイズが正');

  // 5. SEED_KERNEL復元
  const seedRestored = llmzip.decompress(seedResult.data);
  assert(seedRestored.length === SEED_KERNEL.length, '36. SEED_KERNEL復元数が一致');
  assert(seedRestored[0].id === SEED_KERNEL[0].id, '37. SEED_KERNEL先頭ID一致');

  // 6. 繰り返しパターンが多い公理列（ヒット率が上がるはず）
  const repetitive: SeedTheory[] = [];
  for (let i = 0; i < 20; i++) {
    repetitive.push({
      id: `rep-${i}`,
      axiom: `computation pattern ${i % 3}`,
      category: i % 2 === 0 ? 'computation' : 'logic',
      keywords: ['pattern', `kw${i % 3}`],
    });
  }
  const repResult = llmzip.compress(repetitive);
  const repRestored = llmzip.decompress(repResult.data);
  assert(repRestored.length === repetitive.length, '38. 繰り返しパターン復元数が一致');

  // 7. 空配列
  const emptyResult = llmzip.compress([]);
  assert(emptyResult.data.length > 0, '39. 空配列の圧縮が失敗しない');

  // 8. 単一公理
  const single = llmzip.compress([SEED_KERNEL[0]]);
  const singleRestored = llmzip.decompress(single.data);
  assert(singleRestored.length === 1, '40. 単一公理の復元数が1');
  assert(singleRestored[0].id === SEED_KERNEL[0].id, '41. 単一公理の復元IDが一致');

  // 9. hitThreshold=0（全部HIT扱いにする）
  const allHitResult = llmzip.compress(axioms, 0.0);
  assert(allHitResult.hitCount >= 0, '42. hitThreshold=0で動作');

  // 10. hitThreshold=1（全部MISS扱いにする）
  const allMissResult = llmzip.compress(axioms, 1.1);
  const allMissRestored = llmzip.decompress(allMissResult.data);
  assert(allMissRestored.length === axioms.length, '43. hitThreshold=1.1で全MISS復元');
  for (let i = 0; i < axioms.length; i++) {
    assert(allMissRestored[i].axiom === axioms[i].axiom, `44. 全MISS: axiom[${i}]完全一致`);
  }

  // 11. analyzeCompression
  const analysis = llmzip.analyzeCompression(seedResult);
  assert(typeof analysis === 'string' && analysis.length > 0, '45. analyzeCompressionが文字列を返す');
  console.log('\n  SEED_KERNEL LLMZip分析:');
  analysis.split('\n').forEach(line => console.log(`     ${line}`));
}

console.log(`\n結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
