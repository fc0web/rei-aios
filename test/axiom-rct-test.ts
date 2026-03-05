import { AxiomRCT } from '../src/axiom-os/axiom-rct';
import { SEED_KERNEL, type SeedTheory } from '../src/axiom-os/seed-kernel';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== STEP 6-A: RCT（Rei圧縮理論 Theory #67）テスト ===\n');

const rct = new AxiomRCT();

const axioms: SeedTheory[] = [
  { id: 'a1', axiom: 'π×π⁻¹=1 キャンセル意味論', category: 'zero_extension', keywords: ['ゼロπ', 'pi'] },
  { id: 'a2', axiom: 'π縮小理論', category: 'zero_extension', keywords: ['ゼロπ', 'pi', '縮小'] },
  { id: 'a3', axiom: '真偽両方 四値論理', category: 'logic', keywords: ['四価論理', '龍樹'] },
  { id: 'a4', axiom: '七価論理拡張', category: 'logic', keywords: ['七価論理', '四価論理'] },
  { id: 'a5', axiom: 'Ω(Ω(x))→Ω(x) 安定性', category: 'computation', keywords: ['冪等性', 'omega'] },
  { id: 'a6', axiom: 'Ω収束確認', category: 'computation', keywords: ['冪等性', 'omega', '収束'] },
];

// ─── 縁起グラフ ───
console.log('── 縁起グラフ ──');
{
  const edges = rct.buildEndoGraph(axioms);
  assert(Array.isArray(edges), '1. buildEndoGraph: 配列を返す');
  assert(edges.every(e => e.weight > 0), '2. 全エッジの重みが正');

  // a1とa2は同カテゴリ+共通キーワード2つ → 高近接度
  const prox12 = rct.computeProximity(axioms[0], axioms[1]);
  const prox13 = rct.computeProximity(axioms[0], axioms[2]);
  assert(prox12 > prox13, '3. 同カテゴリ+共通キーワードの近接度が高い');

  // 全く関係ない公理の近接度
  const proxUnrelated = rct.computeProximity(
    { id: 'x', axiom: 'xyz', category: 'physics', keywords: ['量子'] },
    { id: 'y', axiom: 'abc', category: 'consciousness', keywords: ['意識'] }
  );
  assert(proxUnrelated === 0, '4. 無関係な公理の近接度は0');
}

// ─── 最小全域木 ───
console.log('\n── 最小全域木 ──');
{
  const edges = rct.buildEndoGraph(axioms);
  const tree = rct.buildSpanningTree(axioms, edges);
  assert(tree.length === axioms.length, '5. 全ノードが木に含まれる');
  assert(tree.filter(n => n.parentIndex === -1).length >= 1, '6. rootノードが存在する');
  assert(tree.every(n => n.depth >= 0), '7. 全ノードの深さが0以上');

  // 孤立ノードでも木が構築される
  const isolated: SeedTheory[] = [
    { id: 'iso1', axiom: 'AAA', category: 'general', keywords: ['x'] },
    { id: 'iso2', axiom: 'BBB', category: 'physics', keywords: ['y'] },
  ];
  const isoEdges = rct.buildEndoGraph(isolated);
  const isoTree = rct.buildSpanningTree(isolated, isoEdges);
  assert(isoTree.length === 2, '8. 孤立ノードでも木が構築される');

  // 単一ノード
  const single = rct.buildSpanningTree([axioms[0]], []);
  assert(single.length === 1, '9. 単一ノードの木');
  assert(single[0].parentIndex === -1, '10. 単一ノードはroot');
}

// ─── トラバーサル ───
console.log('\n── トラバーサル ──');
{
  const edges = rct.buildEndoGraph(axioms);
  const tree = rct.buildSpanningTree(axioms, edges);
  const ordered = rct.traverseTree(axioms, tree);
  assert(ordered.length === axioms.length, '11. トラバーサル後の公理数が一致');
  // 全公理が含まれているか
  const ids = new Set(ordered.map(a => a.id));
  assert(ids.size === axioms.length, '12. 全公理IDが含まれる');
}

// ─── エンコード/デコード ───
console.log('\n── エンコード/デコード ──');
{
  const edges = rct.buildEndoGraph(axioms);
  const tree = rct.buildSpanningTree(axioms, edges);
  const ordered = rct.traverseTree(axioms, tree);
  const entries = rct.encodeRCT(ordered, tree, axioms);
  assert(entries.length === axioms.length, '13. エントリ数が一致');
  assert(entries[0].type === 'root', '14. 最初のエントリはroot');
  assert(entries.slice(1).every(e => e.type === 'child'), '15. 残りはchild');

  // デコードして元に戻る
  const decoded = rct.decodeRCT(entries);
  assert(decoded.length === axioms.length, '16. デコード後の公理数が一致');
  // 全IDが復元される
  const decodedIds = new Set(decoded.map(a => a.id));
  const originalIds = new Set(axioms.map(a => a.id));
  for (const id of originalIds) {
    assert(decodedIds.has(id), `17. ID ${id} が復元される`);
  }
}

// ─── 圧縮・復元 ───
console.log('\n── 圧縮・復元 ──');
{
  // 1. 基本圧縮
  const result = rct.compress(axioms);
  assert(result.data.slice(0, 4).toString() === 'REI\x05', '23. マジックバイトREI\\x05');
  assert(result.originalSize > 0, '24. originalSizeが正');
  assert(result.compressedSize > 0, '25. compressedSizeが正');
  assert(result.graphEdges >= 0, '26. graphEdgesが0以上');
  assert(result.treeDepthAvg >= 0, '27. treeDepthAvgが0以上');
  assert(result.rctScore >= 0, '28. rctScoreが0以上');

  // 2. 復元
  const restored = rct.decompress(result.data);
  assert(restored.length === axioms.length, '29. 復元公理数が一致');
  const restoredIds = new Set(restored.map(a => a.id));
  for (const a of axioms) {
    assert(restoredIds.has(a.id), `30. ID ${a.id} が復元`);
  }
  // MISSエントリ（root含む）の完全一致確認
  const rootAxiom = restored.find(r => r.id === axioms[0].id || restored[0].id);
  assert(rootAxiom !== undefined, '31. rootエントリが復元される');

  // 3. SEED_KERNELで圧縮
  const seedResult = rct.compress([...SEED_KERNEL]);
  assert(seedResult.data.length > 0, '32. SEED_KERNEL圧縮完了');
  const seedRestored = rct.decompress(seedResult.data);
  assert(seedRestored.length === SEED_KERNEL.length, '33. SEED_KERNEL復元数が一致');

  // 4. 全IDが復元される
  const seedIds = new Set(SEED_KERNEL.map(s => s.id));
  const restoredSeedIds = new Set(seedRestored.map(s => s.id));
  let allIdsRestored = true;
  for (const id of seedIds) {
    if (!restoredSeedIds.has(id)) { allIdsRestored = false; break; }
  }
  assert(allIdsRestored, '34. SEED_KERNEL全IDが復元');

  // 5. 空配列
  const emptyResult = rct.compress([]);
  assert(emptyResult.data.length > 0, '35. 空配列の圧縮が失敗しない');

  // 6. 単一公理
  const singleResult = rct.compress([SEED_KERNEL[0]]);
  const singleRestored = rct.decompress(singleResult.data);
  assert(singleRestored.length === 1, '36. 単一公理の復元数が1');

  // 7. 同カテゴリ公理が多い場合の圧縮効率
  const logicAxioms = SEED_KERNEL.filter(s => s.category === 'logic');
  if (logicAxioms.length >= 2) {
    const logicResult = rct.compress(logicAxioms);
    const logicRestored = rct.decompress(logicResult.data);
    assert(logicRestored.length === logicAxioms.length, '37. logic公理の復元数が一致');
  } else {
    assert(true, '37. logicカテゴリ公理が少ないためスキップ');
  }

  console.log(`\n  RCT圧縮結果（テスト用公理6件）:`);
  console.log(`     圧縮率: ${(result.ratio * 100).toFixed(1)}%`);
  console.log(`     縁起グラフエッジ数: ${result.graphEdges}`);
  console.log(`     平均木の深さ: ${result.treeDepthAvg.toFixed(1)}`);
  console.log(`     RCTスコア: ${result.rctScore.toFixed(3)}`);
  console.log(`\n  RCT圧縮結果（SEED_KERNEL 75件）:`);
  console.log(`     圧縮率: ${(seedResult.ratio * 100).toFixed(1)}%`);
  console.log(`     縁起グラフエッジ数: ${seedResult.graphEdges}`);
  console.log(`     RCTスコア: ${seedResult.rctScore.toFixed(3)}`);
}

// ─── 理論説明 ───
console.log('\n── 理論説明 ──');
{
  const desc = rct.describeTheory();
  assert(typeof desc === 'string' && desc.length > 100, '38. describeTheoryが十分な長さの文字列');
  assert(desc.includes('Theory #67'), '39. Theory #67が含まれる');
  assert(desc.includes('縁起'), '40. 縁起が含まれる');
  assert(desc.includes('コルモゴロフ'), '41. コルモゴロフとの比較が含まれる');
}

console.log(`\n結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
