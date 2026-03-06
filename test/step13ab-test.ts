import { DFUMTViewpoints, DFUMT_VIEWPOINTS, generateViewpointSelectorScript } from '../src/chat/dfumt-viewpoints';
import { AxiomGraphEngine, DFUMT_GRAPH_STYLE } from '../src/visualization/axiom-graph';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

async function main() {
  console.log('\n=== STEP 13-A/B テスト ===\n');

  // ─── STEP 13-A: DFUMTViewpoints ──────────────────────────────
  console.log('【STEP 13-A: D-FUMT七価論理7視点】');

  const viewpoints = new DFUMTViewpoints();

  // 7視点の定義確認
  assert(DFUMT_VIEWPOINTS.length === 7, `7視点が定義されている: ${DFUMT_VIEWPOINTS.length}`);
  const values = DFUMT_VIEWPOINTS.map(v => v.value);
  assert(values.includes('TRUE'),     'TRUE視点が存在する');
  assert(values.includes('FALSE'),    'FALSE視点が存在する');
  assert(values.includes('BOTH'),     'BOTH視点が存在する');
  assert(values.includes('NEITHER'),  'NEITHER視点が存在する');
  assert(values.includes('INFINITY'), 'INFINITY視点が存在する');
  assert(values.includes('ZERO'),     'ZERO視点が存在する');
  assert(values.includes('FLOWING'),  'FLOWING視点が存在する');

  // 各視点の完全性確認
  for (const vp of DFUMT_VIEWPOINTS) {
    assert(vp.symbol.length > 0, `${vp.value}: シンボルが存在する`);
    assert(vp.nameJa.length > 0, `${vp.value}: 日本語名が存在する`);
    assert(vp.systemPromptAddition.length > 50, `${vp.value}: システムプロンプトが充実`);
    assert(vp.color.startsWith('#'), `${vp.value}: 色コードが存在する`);
  }

  // フォールバック回答テスト
  const result = await viewpoints.generateMultiViewpoint(
    'ご飯食べたいですね',
    ['TRUE', 'ZERO', 'FLOWING']
  );
  assert(result.responses.length === 3, `3視点の回答: ${result.responses.length}件`);
  assert(result.question === 'ご飯食べたいですね', '質問が保持される');
  assert(result.totalLatencyMs >= 0, 'レイテンシが記録される');

  for (const r of result.responses) {
    assert(r.content.length > 0, `${r.viewpoint.value}: 回答が生成される`);
    assert(r.confidence >= 0 && r.confidence <= 100, `${r.viewpoint.value}: 確信度が0-100`);
  }

  console.log(`  回答例 [TRUE]: "${result.responses[0].content.slice(0,40)}..."`);
  console.log(`  回答例 [ZERO]: "${result.responses[1].content.slice(0,40)}..."`);

  // 視点取得
  const trueVp = viewpoints.getViewpoint('TRUE');
  assert(trueVp?.nameJa === '論理的視点', 'TRUE視点の名前が正しい');
  assert(viewpoints.getViewpoint('TRUE') !== null, 'TRUE視点が取得できる');

  // スクリプト生成
  const script = generateViewpointSelectorScript();
  assert(script.includes('DFUMT_VIEWPOINTS_CONFIG'), '視点設定が含まれる');
  assert(script.includes('toggleViewpoint'), '視点切替関数が含まれる');
  assert(script.includes('renderMultiViewpointResponse'), 'レンダリング関数が含まれる');
  assert(script.includes('confidence-bar'), '確信度バーが含まれる');

  // ─── STEP 13-B: AxiomGraph ───────────────────────────────────
  console.log('\n【STEP 13-B: 公理依存グラフ可視化】');

  const graphEngine = new AxiomGraphEngine();

  // グラフデータ構築
  const graph = graphEngine.buildFromSeedKernel();
  assert(graph.nodes.length >= 10, `ノード数10以上: ${graph.nodes.length}`);
  assert(graph.edges.length >= 10, `エッジ数10以上: ${graph.edges.length}`);

  // エッジタイプの確認
  const edgeTypes = new Set(graph.edges.map(e => e.type));
  assert(edgeTypes.has('depends'),     'dependsエッジが存在する');
  assert(edgeTypes.has('derives'),     'derivesエッジが存在する');
  assert(edgeTypes.has('contradicts'), 'contradictsエッジが存在する');
  assert(edgeTypes.has('extends'),     'extendsエッジが存在する');

  // D-FUMT値の色スタイル確認
  const dfumtValues = ['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'] as const;
  for (const val of dfumtValues) {
    assert(!!DFUMT_GRAPH_STYLE[val], `${val}: グラフスタイルが定義されている`);
    assert(DFUMT_GRAPH_STYLE[val].color.startsWith('#'), `${val}: 背景色が定義されている`);
    assert(DFUMT_GRAPH_STYLE[val].border.startsWith('#'), `${val}: 枠色が定義されている`);
  }

  // レイアウト計算
  const laidOut = graphEngine.calcLayout(graph, 800, 500);
  const nodesWithCoords = laidOut.nodes.filter(n => n.x !== undefined && n.y !== undefined);
  assert(nodesWithCoords.length === laidOut.nodes.length,
    `全ノードに座標が割り当てられる: ${nodesWithCoords.length}件`);

  // 座標が有効範囲内か確認
  for (const node of nodesWithCoords) {
    assert(node.x! >= 0 && node.x! <= 800, `${node.id}: X座標が有効範囲`);
    assert(node.y! >= 0 && node.y! <= 500, `${node.id}: Y座標が有効範囲`);
  }

  // Canvasスクリプト生成
  const canvasScript = graphEngine.generateCanvasScript();
  assert(canvasScript.includes('initAxiomGraph'), 'グラフ初期化関数が存在する');
  assert(canvasScript.includes('drawAxiomGraph'), 'グラフ描画関数が存在する');
  assert(canvasScript.includes('onGraphClick'),   'クリック処理が存在する');
  assert(canvasScript.includes('onGraphWheel'),   'ズーム処理が存在する');
  assert(canvasScript.includes('showAxiomDetail'), '詳細表示が存在する');
  assert(canvasScript.includes('resetGraphView'), 'リセット機能が存在する');
  console.log(`    Canvasスクリプト: ${canvasScript.length}文字`);

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`結果: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
