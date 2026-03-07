/**
 * Maya × Aztec 情報科学実装テスト
 * ReiHuffmanCoder, ReiEntropyZero, ReiSpaceGeometry,
 * ReiDistributedBus, ReiCycleScheduler + SEED_KERNEL 80理論
 */

import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';
import { ReiHuffmanCoder, type HybridEncodeResult } from '../src/axiom-os/rei-huffman-coder';
import { ReiEntropyZero } from '../src/axiom-os/rei-entropy-zero';
import { ReiSpaceGeometry, type ConvexPolygon } from '../src/axiom-os/rei-space-geometry';
import { ReiDistributedBus } from '../src/axiom-os/rei-distributed-bus';
import { ReiCycleScheduler } from '../src/axiom-os/rei-cycle-scheduler';
import type { SevenLogicValue } from '../src/axiom-os/seven-logic';

async function runTests() {
  console.log('=== Maya × Aztec Tests ===\n');
  let passed = 0; let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (cond) { console.log(`  \u2713 ${msg}`); passed++; }
    else { console.log(`  \u2717 ${msg}`); failed++; }
  };

  const validValues: SevenLogicValue[] = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'];

  // ══════════════════════════════════════════════════════════════
  // SEED_KERNEL 80理論
  // ══════════════════════════════════════════════════════════════
  console.log('--- 1. SEED_KERNEL: 80理論 ---');
  assert(SEED_KERNEL.length === 95, `SEED_KERNEL.length === 95 (got ${SEED_KERNEL.length})`);
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-maya-code'), 'Theory #68 存在');
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-entropy-zero'), 'Theory #69 存在');
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-aztec-geometry'), 'Theory #70 存在');
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-maya-distributed'), 'Theory #71 存在');
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-aztec-cycle'), 'Theory #72 存在');

  // ID重複チェック
  const ids = new Set(SEED_KERNEL.map(t => t.id));
  assert(ids.size === SEED_KERNEL.length, 'ID重複なし');

  // ══════════════════════════════════════════════════════════════
  // ReiHuffmanCoder
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 2. ReiHuffmanCoder: 基本構築 ---');
  const huffman = new ReiHuffmanCoder();
  assert(huffman !== null, 'インスタンス作成');

  // 未学習でencode → エラー
  let threw = false;
  try { huffman.encode('test'); } catch { threw = true; }
  assert(threw, '未学習でencode → エラー');

  console.log('\n--- 3. ReiHuffmanCoder: train ---');
  huffman.train(['hello world', 'hello hello', 'world test']);
  const table = huffman.getCodeTable();
  assert(table.length > 0, '符号表が生成される');
  assert(table.some(e => e.symbol === 'hello'), 'helloが符号表に存在');

  // helloは最頻出（3回）なので最短符号
  const helloEntry = table.find(e => e.symbol === 'hello');
  assert(helloEntry !== undefined && helloEntry.bitLength <= 2, 'hello は短い符号');

  console.log('\n--- 4. ReiHuffmanCoder: encode ---');
  const r1 = huffman.encode('hello world', 'logic');
  assert(r1.encoded.length > 0, 'ビット列が生成');
  assert(r1.compressionRatio > 0, '圧縮率 > 0');
  assert(r1.layerBreakdown.layer1Bits === 2, 'Layer1: logic=2bit');
  assert(validValues.includes(r1.logicTag), '七価タグが有効');

  console.log('\n--- 5. ReiHuffmanCoder: カテゴリなし ---');
  const r2 = huffman.encode('hello hello');
  assert(r2.layerBreakdown.layer1Bits === 0, 'カテゴリなし → Layer1=0');

  console.log('\n--- 6. ReiHuffmanCoder: 未知トークン ---');
  const r3 = huffman.encode('unknown_xyz');
  assert(r3.layerBreakdown.layer3Bits > 0, '未知トークン → Layer3にフォールバック');

  console.log('\n--- 7. ReiHuffmanCoder: SEED_KERNELから学習 ---');
  const huffman2 = new ReiHuffmanCoder();
  huffman2.trainFromSeedKernel(SEED_KERNEL);
  const table2 = huffman2.getCodeTable();
  assert(table2.length > 10, 'SEED_KERNEL学習で多数の符号');
  const r4 = huffman2.encode('意識=情報統合', 'consciousness');
  assert(r4.encoded.length > 0, 'SEED_KERNELベースでエンコード成功');
  assert(r4.layerBreakdown.layer1Bits === 3, 'consciousness=3bit');

  // 単一トークン学習
  console.log('\n--- 8. ReiHuffmanCoder: 単一トークン ---');
  const huffman3 = new ReiHuffmanCoder();
  huffman3.train(['solo']);
  const table3 = huffman3.getCodeTable();
  assert(table3.length === 1, '単一トークンの符号表');
  assert(table3[0].code === '0', '単一トークン → 符号"0"');

  // ══════════════════════════════════════════════════════════════
  // ReiEntropyZero
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 9. ReiEntropyZero: 理論的エントロピー ---');
  const entropy = new ReiEntropyZero();
  assert(entropy !== null, 'インスタンス作成');

  const eZero = entropy.theoreticalEntropy('ZERO');
  assert(Math.abs(eZero.value - Math.log2(7)) < 0.001, 'H(ZERO) = log2(7)');
  assert(eZero.normalized > 0.99, 'ZERO正規化 ~ 1.0');

  const eTrue = entropy.theoreticalEntropy('TRUE');
  assert(eTrue.value === 0, 'H(TRUE) = 0');
  assert(eTrue.normalized === 0, 'TRUE正規化 = 0');

  const eFalse = entropy.theoreticalEntropy('FALSE');
  assert(eFalse.value === 0, 'H(FALSE) = 0');

  const eBoth = entropy.theoreticalEntropy('BOTH');
  assert(eBoth.value === 1, 'H(BOTH) = 1');

  const eNeither = entropy.theoreticalEntropy('NEITHER');
  assert(isNaN(eNeither.value), 'H(NEITHER) = NaN');
  assert(eNeither.normalized === 1.0, 'NEITHER正規化 = 1.0（NaN→1.0）');

  const eInf = entropy.theoreticalEntropy('INFINITY');
  assert(eInf.value === Infinity, 'H(INFINITY) = Infinity');

  const eFlow = entropy.theoreticalEntropy('FLOWING');
  assert(eFlow.value > 0 && eFlow.value < Math.log2(7), 'H(FLOWING) = log2(7)/2');

  console.log('\n--- 10. ReiEntropyZero: calcEntropy ---');
  // 一様分布 → ZERO
  const uniform = entropy.calcEntropy({ a: 0.25, b: 0.25, c: 0.25, d: 0.25 });
  assert(uniform.normalized > 0.99, '一様分布 → 正規化~1.0');
  assert(uniform.dominantTag === 'ZERO', '一様分布 → ZERO');
  assert(uniform.zeroAlignment > 0.99, 'ZERO整合度 > 0.99');

  // 確定分布 → TRUE
  const certain = entropy.calcEntropy({ a: 1.0 });
  assert(certain.entropy === 0, '確定分布 → H=0');
  assert(certain.dominantTag === 'TRUE', '確定分布 → TRUE');

  // 空分布 → ZERO
  const empty = entropy.calcEntropy({});
  assert(empty.dominantTag === 'ZERO', '空分布 → ZERO');

  // 偏り分布
  const biased = entropy.calcEntropy({ a: 0.9, b: 0.1 });
  assert(biased.normalized < 0.7, '偏り分布 → 正規化 < 0.7');

  console.log('\n--- 11. ReiEntropyZero: calcLogicEntropy ---');
  const tags: SevenLogicValue[] = ['TRUE', 'TRUE', 'TRUE', 'FALSE', 'BOTH', 'ZERO', 'FLOWING'];
  const logicE = entropy.calcLogicEntropy(tags);
  assert(logicE.entropy > 0, 'ロジックエントロピー > 0');
  assert(validValues.includes(logicE.dominantTag), '有効な七価タグ');

  // 全部同じ → 低エントロピー
  const allTrue: SevenLogicValue[] = ['TRUE', 'TRUE', 'TRUE', 'TRUE'];
  const lowE = entropy.calcLogicEntropy(allTrue);
  assert(lowE.entropy === 0, '全TRUE → H=0');
  assert(lowE.dominantTag === 'TRUE', '全TRUE → TRUE');

  // ══════════════════════════════════════════════════════════════
  // ReiSpaceGeometry
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 12. ReiSpaceGeometry: calcArea ---');
  const geo = new ReiSpaceGeometry();
  assert(geo !== null, 'インスタンス作成');

  // 正方形 (0,0)-(10,0)-(10,10)-(0,10) → 面積100
  const sq = geo.calcArea([
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
  ]);
  assert(sq === 100, '正方形面積 = 100');

  // 三角形 (0,0)-(6,0)-(0,4) → 面積12
  const tri = geo.calcArea([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 4 }]);
  assert(tri === 12, '三角形面積 = 12');

  // 点が2つ以下 → 0
  assert(geo.calcArea([{ x: 0, y: 0 }]) === 0, '1点 → 面積0');
  assert(geo.calcArea([]) === 0, '0点 → 面積0');

  console.log('\n--- 13. ReiSpaceGeometry: containsPoint ---');
  const square: ConvexPolygon = {
    id: 'sq', label: 'TRUE',
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  };
  assert(geo.containsPoint(square, { x: 5, y: 5 }), '中心は内部');
  assert(geo.containsPoint(square, { x: 0, y: 0 }), '頂点は内部（境界）');
  assert(!geo.containsPoint(square, { x: 15, y: 5 }), '外部の点');
  assert(!geo.containsPoint(square, { x: -1, y: 5 }), '負の座標は外部');

  console.log('\n--- 14. ReiSpaceGeometry: partition ---');
  const poly1: ConvexPolygon = {
    id: 'zone-a', label: 'TRUE',
    vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }],
  };
  const poly2: ConvexPolygon = {
    id: 'zone-b', label: 'FLOWING',
    vertices: [{ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 5, y: 5 }],
  };
  const part = geo.partition([poly1, poly2]);
  assert(part.totalArea === 50, '合計面積 = 50');
  assert(part.coverageMap.get('zone-a') === 25, 'zone-a = 25');
  assert(part.coverageMap.get('zone-b') === 25, 'zone-b = 25');

  console.log('\n--- 15. ReiSpaceGeometry: evaluate ---');
  const ev1 = geo.evaluate(part, { x: 2, y: 2 });
  assert(ev1.logicTag === 'TRUE', 'zone-a内 → TRUE');
  assert(ev1.containingPolygon?.id === 'zone-a', 'zone-a特定');

  const ev2 = geo.evaluate(part, { x: 7, y: 2 });
  assert(ev2.logicTag === 'FLOWING', 'zone-b内 → FLOWING');

  const ev3 = geo.evaluate(part, { x: 20, y: 20 });
  assert(ev3.logicTag === 'NEITHER', '外部 → NEITHER');
  assert(ev3.distanceToNearest > 0, '外部の最近傍距離 > 0');

  console.log('\n--- 16. ReiSpaceGeometry: evaluatePCState ---');
  const pcNormal = geo.evaluatePCState(30, 40);
  assert(pcNormal.logicTag === 'TRUE', 'CPU30% MEM40% → TRUE（正常）');

  const pcWarning = geo.evaluatePCState(80, 50);
  assert(pcWarning.logicTag === 'FLOWING', 'CPU80% MEM50% → FLOWING（警告）');

  // ══════════════════════════════════════════════════════════════
  // ReiDistributedBus
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 17. ReiDistributedBus: 基本構築 ---');
  const bus = new ReiDistributedBus();
  assert(bus !== null, 'インスタンス作成');

  // 空ノード → ZERO
  const c0 = bus.consensus();
  assert(c0.value === 'ZERO', '空ノード → ZERO');
  assert(c0.confidence === 0, '確信度 = 0');
  assert(c0.method === 'default-zero', 'method = default-zero');

  console.log('\n--- 18. ReiDistributedBus: ノード登録・更新 ---');
  bus.registerNode('rei-pl', 1.0, 60000);
  bus.registerNode('bio-ai', 0.8, 60000);
  bus.registerNode('pc-sensor', 0.5, 60000);

  assert(bus.getNodes().length === 3, '3ノード登録');

  // 未更新 → 全期限切れ → ZERO
  const c1 = bus.consensus();
  assert(c1.value === 'ZERO', '未更新 → ZERO');
  assert(c1.expiredNodes.length === 3, '3ノード期限切れ');

  console.log('\n--- 19. ReiDistributedBus: 全TRUE合意 ---');
  bus.update('rei-pl', 'TRUE');
  bus.update('bio-ai', 'TRUE');
  bus.update('pc-sensor', 'TRUE');
  const c2 = bus.consensus();
  assert(c2.value === 'TRUE', '全TRUE → TRUE');
  assert(c2.confidence === 1.0, '確信度 = 1.0');
  assert(c2.participatingNodes.length === 3, '3ノード参加');
  assert(c2.method === 'weighted-majority', 'method = weighted-majority');

  console.log('\n--- 20. ReiDistributedBus: 矛盾検出 ---');
  bus.update('rei-pl', 'TRUE');
  bus.update('bio-ai', 'FALSE');
  const c3 = bus.consensus();
  assert(c3.value === 'BOTH', 'TRUE+FALSE → BOTH');
  assert(c3.method === 'contradiction-detected', 'method = contradiction-detected');

  console.log('\n--- 21. ReiDistributedBus: 未登録ノード ---');
  let threwBus = false;
  try { bus.update('unknown', 'TRUE'); } catch { threwBus = true; }
  assert(threwBus, '未登録ノード → エラー');

  console.log('\n--- 22. ReiDistributedBus: FLOWING収束 ---');
  const bus2 = new ReiDistributedBus();
  bus2.registerNode('a', 0.3, 60000);
  bus2.registerNode('b', 0.3, 60000);
  bus2.registerNode('c', 0.4, 60000);
  bus2.update('a', 'TRUE');
  bus2.update('b', 'ZERO');
  bus2.update('c', 'FLOWING');
  const c4 = bus2.consensus();
  assert(c4.confidence < 0.5, '過半数なし → confidence < 0.5');
  assert(c4.value === 'FLOWING', '過半数なし → FLOWING');
  assert(c4.method === 'flowing-convergence', 'method = flowing-convergence');

  // ══════════════════════════════════════════════════════════════
  // ReiCycleScheduler
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 23. ReiCycleScheduler: 基本構築 ---');
  const scheduler = new ReiCycleScheduler();
  assert(scheduler !== null, 'インスタンス作成');

  // 空タスク
  const a0 = scheduler.calcAlignment();
  assert(a0.lcmMs === 0, '空タスク → LCM=0');
  assert(a0.logicTag === 'ZERO', '空タスク → ZERO');

  console.log('\n--- 24. ReiCycleScheduler: タスク登録 ---');
  const now = Date.now();
  scheduler.register({ id: 'daily', periodMs: 86400000, lastRunAt: now, description: '毎日' });
  scheduler.register({ id: 'hourly', periodMs: 3600000, lastRunAt: now, description: '毎時' });

  console.log('\n--- 25. ReiCycleScheduler: LCM計算 ---');
  const a1 = scheduler.calcAlignment();
  assert(a1.lcmMs === 86400000, 'LCM(86400000, 3600000) = 86400000');
  assert(a1.lcmMs > 0, 'LCM > 0');
  assert(validValues.includes(a1.logicTag), '七価タグが有効');

  console.log('\n--- 26. ReiCycleScheduler: アステカ暦 ---');
  const aztec = new ReiCycleScheduler();
  // アステカ暦: 365日 × 260日 → LCM = 18980日 = 52年
  aztec.register({ id: 'xiuhpohualli', periodMs: 365, lastRunAt: now, description: '365日暦' });
  aztec.register({ id: 'tonalpohualli', periodMs: 260, lastRunAt: now, description: '260日暦' });
  const aAztec = aztec.calcAlignment();
  assert(aAztec.lcmMs === 18980, 'LCM(365,260) = 18980（52年）');

  console.log('\n--- 27. ReiCycleScheduler: getTaskStatuses ---');
  const statuses = scheduler.getTaskStatuses();
  assert(statuses.length === 2, '2タスクのステータス');
  assert(statuses.every(s => validValues.includes(s.logicTag)), '全ステータスが有効な七価タグ');
  assert(statuses.every(s => s.phase >= 0 && s.phase <= 1), '位相が0〜1');

  console.log('\n--- 28. ReiCycleScheduler: formatAlignmentReport ---');
  const report = scheduler.formatAlignmentReport();
  assert(report.includes('アステカ'), 'レポートに「アステカ」');
  assert(report.includes('LCM'), 'レポートに「LCM」');
  assert(report.includes('合流'), 'レポートに「合流」');

  console.log('\n--- 29. ReiCycleScheduler: 大きなLCM上限 ---');
  const bigScheduler = new ReiCycleScheduler();
  bigScheduler.register({ id: 'a', periodMs: 999999999, lastRunAt: now, description: 'big1' });
  bigScheduler.register({ id: 'b', periodMs: 999999997, lastRunAt: now, description: 'big2' });
  const bigA = bigScheduler.calcAlignment();
  // LCMが1年超 → 上限キャップ
  assert(bigA.lcmMs <= 365 * 24 * 60 * 60 * 1000, 'LCM上限 <= 1年');

  // ══════════════════════════════════════════════════════════════
  // 統合テスト
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 30. 統合: HuffmanCoder × EntropyZero ---');
  const hfm = new ReiHuffmanCoder();
  hfm.trainFromSeedKernel(SEED_KERNEL);
  const encoded = hfm.encode('意識=情報統合 Φ>0', 'consciousness');
  const entropyOfResult = new ReiEntropyZero();
  const eResult = entropyOfResult.theoreticalEntropy(encoded.logicTag);
  assert(eResult.logicTag === encoded.logicTag, 'HuffmanのlogicTagがEntropyZeroで解釈可能');

  console.log('\n--- 31. 統合: SpaceGeometry × DistributedBus ---');
  const geoBus = new ReiDistributedBus();
  geoBus.registerNode('geo-eval', 1.0, 60000);
  const pcEval = geo.evaluatePCState(50, 50);
  geoBus.update('geo-eval', pcEval.logicTag);
  const geoConsensus = geoBus.consensus();
  assert(geoConsensus.value === pcEval.logicTag, 'Geometry評価がBus合意に反映');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
