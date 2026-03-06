/**
 * ReiDigitalTwin テスト — space/layer セマンティクス
 */

import {
  ReiSpace,
  ReiLayer,
  ReiDigitalTwinFactory,
  mergeSpaceLogic,
  toSymbol,
  type SevenLogicValue,
  type SpaceSnapshot,
} from '../rei-pl/src/runtime/rei-digital-twin';

async function runTests() {
  console.log('=== ReiDigitalTwin Tests ===\n');
  let passed = 0; let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (cond) { console.log(`  \u2713 ${msg}`); passed++; }
    else { console.log(`  \u2717 ${msg}`); failed++; }
  };

  const validValues = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'];

  // --- 1. ReiSpace 基本 ---
  console.log('--- 1. ReiSpace 基本操作 ---');

  const room = new ReiSpace('room_env', [
    { name: 'temperature', unit: '\u00b0C', minNormal: 18, maxNormal: 26 },
    { name: 'humidity', unit: '%', minNormal: 40, maxNormal: 70 },
    { name: 'co2', unit: 'ppm', minNormal: 400, maxNormal: 1000 },
  ]);

  assert(room.name === 'room_env', 'space名が正しい');
  assert(room.dimensionNames.length === 3, '3次元が定義されている');
  assert(room.dimensionNames.includes('temperature'), 'temperature次元あり');

  // --- 2. 初期状態（未観測） ---
  console.log('\n--- 2. 初期状態（未観測 = ZERO） ---');

  const initSnap = room.snap();
  assert(initSnap.overallTag === 'ZERO', '未観測でZERO');
  assert(initSnap.phi === 0, '未観測でφ=0');
  assert(initSnap.dimensions.every(d => d.logicTag === 'ZERO'), '全次元がZERO');

  // --- 3. 正常値の観測 ---
  console.log('\n--- 3. 正常値の観測 ---');

  room.observe({ temperature: 22, humidity: 55, co2: 600 });
  const normalSnap = room.snap();
  assert(normalSnap.overallTag === 'TRUE', '正常値でTRUE');
  assert(normalSnap.phi > 0, '正常値でφ>0');
  assert(normalSnap.dimensions.find(d => d.name === 'temperature')!.value === 22, '温度が22');

  // --- 4. 異常値（範囲外） ---
  console.log('\n--- 4. 異常値 ---');

  room.observe({ co2: 1800 });
  const abnormalSnap = room.snap();
  const co2dim = abnormalSnap.dimensions.find(d => d.name === 'co2')!;
  assert(co2dim.logicTag === 'INFINITY' || co2dim.logicTag === 'FALSE', 'CO2異常でFALSEまたはINFINITY');

  // --- 5. diff() ---
  console.log('\n--- 5. diff（差分検出） ---');

  const diffResult = room.diff();
  assert(validValues.includes(diffResult), 'diffが有効な七価論理値');

  // --- 6. mirror() ---
  console.log('\n--- 6. mirror（デジタルツイン投影） ---');

  const twin = room.mirror();
  assert(twin.physicalName === 'room_env', '物理名が正しい');
  assert(twin.virtualName === 'room_env::twin', '仮想名が::twin付き');
  assert(validValues.includes(twin.mirrorQuality), '鏡像品質が有効な七価論理値');
  assert(twin.mirrorNote.length > 0, '鏡像ノートが存在');

  // --- 7. mergeSpaceLogic ---
  console.log('\n--- 7. mergeSpaceLogic ---');

  assert(mergeSpaceLogic(['TRUE', 'TRUE', 'TRUE']) === 'TRUE', '全TRUE→TRUE');
  assert(mergeSpaceLogic(['ZERO', 'ZERO', 'ZERO']) === 'ZERO', '全ZERO→ZERO');
  assert(mergeSpaceLogic(['TRUE', 'INFINITY', 'TRUE']) === 'INFINITY', 'INFINITY含む→INFINITY');
  assert(mergeSpaceLogic(['TRUE', 'FLOWING', 'TRUE']) === 'FLOWING', 'FLOWING含む→FLOWING');
  assert(mergeSpaceLogic(['FALSE', 'FALSE', 'TRUE']) === 'FALSE', '過半数FALSE→FALSE');

  // --- 8. ReiLayer 基本 ---
  console.log('\n--- 8. ReiLayer パイプライン ---');

  const layer = new ReiLayer('pipeline', [
    { name: 'normalize', transform: (s) => ({ ...s }) },
    { name: 'analyze',   transform: (s) => ({ ...s, overallTag: s.phi > 0.5 ? 'TRUE' as SevenLogicValue : 'FLOWING' as SevenLogicValue }) },
    { name: 'respond',   transform: (s) => s },
  ]);

  assert(layer.name === 'pipeline', 'layer名が正しい');
  assert(layer.stageNames.length === 3, '3ステージが定義されている');

  room.observe({ temperature: 22, humidity: 55, co2: 600 });
  const input = room.snap();
  const result = await layer.execute(input);

  assert(result.layerName === 'pipeline', '実行結果のlayer名');
  assert(result.stages.length === 3, '3ステージが実行された');
  assert(result.totalDurationMs >= 0, '実行時間が非負');
  assert(validValues.includes(result.overallStatus), '全体状態が有効な七価論理値');

  // --- 9. ReiLayer status() ---
  console.log('\n--- 9. ReiLayer status ---');

  const layerStatus = layer.status();
  assert(Object.keys(layerStatus).length === 3, 'status()が3エントリ');
  assert(layerStatus['normalize'] !== undefined, 'normalizeステージのstatus');

  // --- 10. ReiLayer INFINITY早期終了 ---
  console.log('\n--- 10. INFINITY早期終了 ---');

  const dangerLayer = new ReiLayer('danger', [
    { name: 'detect', transform: (s) => ({ ...s, overallTag: 'INFINITY' as SevenLogicValue }) },
    { name: 'should_skip', transform: (s) => s },
  ]);
  const dangerResult = await dangerLayer.execute(input);
  assert(dangerResult.stages.length === 1, 'INFINITYで早期終了（1ステージのみ実行）');

  // --- 11. ReiDigitalTwinFactory ---
  console.log('\n--- 11. ReiDigitalTwinFactory ---');

  const factorySpace = ReiDigitalTwinFactory.createSpace({
    name: 'factory_floor',
    dimensions: ['robot_x', 'robot_y', 'speed'],
  });
  assert(factorySpace.name === 'factory_floor', 'Factory作成のspace名');
  assert(factorySpace.dimensionNames.length === 3, 'Factory作成の次元数');

  const factoryLayer = ReiDigitalTwinFactory.createLayer(
    { name: 'control' },
    [(s) => s, (s) => s],
    ['sense', 'act'],
  );
  assert(factoryLayer.name === 'control', 'Factory作成のlayer名');
  assert(factoryLayer.stageNames.length === 2, 'Factory作成のステージ数');

  // --- 12. toSymbol ---
  console.log('\n--- 12. toSymbol ---');

  assert(toSymbol('TRUE') === '\u22a4', 'TRUE→\u22a4');
  assert(toSymbol('INFINITY') === '\u221e', 'INFINITY→\u221e');
  assert(toSymbol('FLOWING') === '\uff5e', 'FLOWING→\uff5e');

  // --- 13. 部分観測 ---
  console.log('\n--- 13. 部分観測 ---');

  const partial = new ReiSpace('partial', [
    { name: 'a', minNormal: 0, maxNormal: 10 },
    { name: 'b', minNormal: 0, maxNormal: 10 },
    { name: 'c', minNormal: 0, maxNormal: 10 },
  ]);
  partial.observe({ a: 5 });
  const partialSnap = partial.snap();
  const aDim = partialSnap.dimensions.find(d => d.name === 'a')!;
  const bDim = partialSnap.dimensions.find(d => d.name === 'b')!;
  assert(aDim.logicTag === 'TRUE', '観測済み次元がTRUE');
  assert(bDim.logicTag === 'ZERO', '未観測次元がZERO');

  // --- 14. 境界値テスト ---
  console.log('\n--- 14. 境界値テスト ---');

  const boundary = new ReiSpace('boundary', [
    { name: 'sensor', minNormal: 10, maxNormal: 20 },
  ]);
  boundary.observe({ sensor: 10.3 });
  const bndSnap = boundary.snap();
  const sensorDim = bndSnap.dimensions.find(d => d.name === 'sensor')!;
  assert(sensorDim.logicTag === 'FLOWING' || sensorDim.logicTag === 'TRUE', '境界値でFLOWINGまたはTRUE');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
