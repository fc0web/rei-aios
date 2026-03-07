/**
 * ギリシャ神話実装テスト（STEP 16）
 * MoiraTerminator, PrometheusProtocol, NarcissusDetector,
 * AriadneTracer + SEED_KERNEL 84理論
 */

import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';
import { MoiraTerminator } from '../src/axiom-os/moira-terminator';
import { PrometheusProtocol } from '../src/axiom-os/prometheus-protocol';
import { NarcissusDetector } from '../src/axiom-os/narcissus-detector';
import { AriadneTracer } from '../src/axiom-os/ariadne-tracer';
import type { SevenLogicValue } from '../src/axiom-os/seven-logic';
import type { AxiomChain } from '../src/axiom-os/explainability-engine';

async function runTests() {
  console.log('=== Greek Mythology Tests (STEP 16) ===\n');
  let passed = 0; let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (cond) { console.log(`  \u2713 ${msg}`); passed++; }
    else { console.log(`  \u2717 ${msg}`); failed++; }
  };

  const validValues: SevenLogicValue[] = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'];

  // ══════════════════════════════════════════════════════════════
  // SEED_KERNEL 84理論
  // ══════════════════════════════════════════════════════════════
  console.log('--- 1. SEED_KERNEL: 84理論 ---');
  assert(SEED_KERNEL.length === 87, `SEED_KERNEL.length === 87 (got ${SEED_KERNEL.length})`);
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-moira'), 'Theory #73 存在');
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-prometheus'), 'Theory #74 存在');
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-narcissus'), 'Theory #75 存在');
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-ariadne'), 'Theory #76 存在');
  const ids = new Set(SEED_KERNEL.map(t => t.id));
  assert(ids.size === SEED_KERNEL.length, 'ID重複なし');

  // ══════════════════════════════════════════════════════════════
  // MoiraTerminator
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 2. MoiraTerminator: クロト（生成） ---');
  const moira = new MoiraTerminator();
  assert(moira !== null, 'インスタンス作成');

  const proc = moira.clotho('テスト推論');
  assert(proc.phase === 'CLOTHO', 'phase = CLOTHO');
  assert(proc.finalValue === 'FLOWING', '初期値 = FLOWING');
  assert(proc.iterationCount === 0, '反復 = 0');
  assert(proc.maxIterations === 100, 'デフォルト上限 = 100');
  assert(proc.timeoutMs === 30000, 'デフォルトタイムアウト = 30秒');

  const proc2 = moira.clotho('カスタム推論', { maxIterations: 5, timeoutMs: 1000 });
  assert(proc2.maxIterations === 5, 'カスタム上限 = 5');
  assert(proc2.timeoutMs === 1000, 'カスタムタイムアウト = 1秒');

  console.log('\n--- 3. MoiraTerminator: ラケシス（収束判定） ---');
  const j1 = moira.lachesis(proc.id, 'TRUE');
  assert(j1.shouldTerminate === true, 'TRUE → 終了');
  assert(j1.reason === 'convergence', 'reason = convergence');
  assert(j1.finalValue === 'TRUE', 'finalValue = TRUE');

  console.log('\n--- 4. MoiraTerminator: ラケシス（FALSE収束） ---');
  const proc3 = moira.clotho('FALSE推論');
  const j2 = moira.lachesis(proc3.id, 'FALSE');
  assert(j2.shouldTerminate === true, 'FALSE → 終了');
  assert(j2.reason === 'convergence', 'reason = convergence');

  console.log('\n--- 5. MoiraTerminator: ラケシス（進行中） ---');
  const proc4 = moira.clotho('進行中推論');
  const j3 = moira.lachesis(proc4.id, 'FLOWING');
  assert(j3.shouldTerminate === false, 'FLOWING → 継続');
  assert(j3.phase === 'LACHESIS', 'phase = LACHESIS');

  console.log('\n--- 6. MoiraTerminator: ラケシス（INFINITY警告） ---');
  const j4 = moira.lachesis(proc4.id, 'INFINITY');
  assert(j4.shouldTerminate === false, 'INFINITY → 継続（警告）');
  assert(j4.message.includes('INFINITY'), 'メッセージにINFINITY');

  console.log('\n--- 7. MoiraTerminator: ラケシス（反復上限） ---');
  const proc5 = moira.clotho('上限推論', { maxIterations: 3 });
  moira.lachesis(proc5.id, 'FLOWING');
  moira.lachesis(proc5.id, 'FLOWING');
  const j5 = moira.lachesis(proc5.id, 'FLOWING');
  assert(j5.shouldTerminate === true, '3回反復 → 終了');
  assert(j5.reason === 'resource_limit', 'reason = resource_limit');

  console.log('\n--- 8. MoiraTerminator: ラケシス（存在しないプロセス） ---');
  const j6 = moira.lachesis('non-existent', 'TRUE');
  assert(j6.shouldTerminate === true, '存在しないID → 終了');
  assert(j6.finalValue === 'NEITHER', 'finalValue = NEITHER');

  console.log('\n--- 9. MoiraTerminator: アトロポス（強制終了） ---');
  const proc6 = moira.clotho('終了推論');
  const terminated = moira.atropos(proc6.id, 'contradiction');
  assert(terminated !== null, 'プロセスが返される');
  assert(terminated!.phase === 'ATROPOS', 'phase = ATROPOS');
  assert(terminated!.finalValue === 'BOTH', 'contradiction → BOTH');
  assert(terminated!.terminationReason === 'contradiction', 'reason保存');

  // 終了後は取得不可
  const t2 = moira.atropos(proc6.id, 'timeout');
  assert(t2 === null, '2度目のatropos → null');

  console.log('\n--- 10. MoiraTerminator: 各終了理由の最終値 ---');
  const reasons: Array<[string, SevenLogicValue]> = [
    ['timeout', 'NEITHER'], ['unused', 'ZERO'],
    ['superseded', 'FLOWING'], ['loop_detected', 'NEITHER'],
    ['resource_limit', 'NEITHER'],
  ];
  for (const [reason, expected] of reasons) {
    const p = moira.clotho(`${reason}推論`);
    const t = moira.atropos(p.id, reason as any);
    assert(t!.finalValue === expected, `${reason} → ${expected}`);
  }

  console.log('\n--- 11. MoiraTerminator: disposeTheory ---');
  const theory = SEED_KERNEL[0];
  const disposal = moira.disposeTheory(theory, 'unused', 'テスト廃棄');
  assert(disposal.theoryId === theory.id, 'theoryId一致');
  assert(disposal.reason === 'unused', 'reason = unused');
  assert(disposal.finalValue === 'ZERO', 'unused → ZERO');
  assert(moira.getDisposals().length >= 1, 'disposals記録');

  const disposal2 = moira.disposeTheory(SEED_KERNEL[1], 'contradiction', '矛盾廃棄');
  assert(disposal2.finalValue === 'BOTH', 'contradiction → BOTH');

  console.log('\n--- 12. MoiraTerminator: getActiveProcesses ---');
  const moira2 = new MoiraTerminator();
  moira2.clotho('p1');
  moira2.clotho('p2');
  assert(moira2.getActiveProcesses().length === 2, '2プロセス');

  console.log('\n--- 13. MoiraTerminator: pruneStale ---');
  const moira3 = new MoiraTerminator();
  const old = moira3.clotho('old process');
  // startedAt を手動で古くする
  (old as any).startedAt = Date.now() - 2 * 60 * 60 * 1000; // 2時間前
  const pruned = moira3.pruneStale(60 * 60 * 1000); // 1時間TTL
  assert(pruned.length === 1, '1プロセスがpruned');
  assert(pruned[0].terminationReason === 'unused', 'reason = unused');

  // ══════════════════════════════════════════════════════════════
  // PrometheusProtocol
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 14. PrometheusProtocol: descend Level 0 ---');
  const prometheus = new PrometheusProtocol();
  assert(prometheus !== null, 'インスタンス作成');

  const p0 = prometheus.descend(SEED_KERNEL[0], 0);
  assert(p0.content === SEED_KERNEL[0].axiom, 'Level 0: 生の公理');
  assert(p0.level === 0, 'level = 0');
  assert(p0.fireMetaphor.includes('原型'), '火の比喩に「原型」');
  assert(validValues.includes(p0.logicTag), '有効な七価タグ');

  console.log('\n--- 15. PrometheusProtocol: descend Level 1 ---');
  const p1 = prometheus.descend(SEED_KERNEL[0], 1);
  assert(p1.content.includes('['), 'Level 1: 記号を含む');
  assert(p1.content.includes(SEED_KERNEL[0].id), 'Level 1: IDを含む');

  console.log('\n--- 16. PrometheusProtocol: descend Level 2 ---');
  const p2x = prometheus.descend(SEED_KERNEL[0], 2);
  assert(p2x.content.includes('キーワード'), 'Level 2: キーワードを含む');
  assert(p2x.content.includes('公理'), 'Level 2: 公理を含む');

  console.log('\n--- 17. PrometheusProtocol: descend Level 3 ---');
  const p3 = prometheus.descend(SEED_KERNEL[0], 3);
  assert(p3.content.includes('```rei'), 'Level 3: コード例');
  assert(p3.content.includes('axiom'), 'Level 3: axiomキーワード');

  console.log('\n--- 18. PrometheusProtocol: descend Level 4 ---');
  const p4 = prometheus.descend(SEED_KERNEL[0], 4);
  assert(p4.content.includes('——'), 'Level 4: ストーリー形式');
  assert(p4.fireMetaphor.includes('子供'), 'Level 4: 子供の炎');

  console.log('\n--- 19. PrometheusProtocol: descendAll ---');
  const report = prometheus.descendAll(1);
  assert(report.totalTheories === 87, 'totalTheories = 87');
  assert(report.packets.length === 87, '87パケット');
  assert(report.averageLevel === 1, 'averageLevel = 1');
  assert(report.summary.includes('87'), 'summaryに87');

  console.log('\n--- 20. PrometheusProtocol: autoDescend ---');
  const autoRei = prometheus.autoDescend(SEED_KERNEL[0], 'rei-pl');
  assert(autoRei.level === 0, 'rei-pl → Level 0');
  const autoHuman = prometheus.autoDescend(SEED_KERNEL[0], 'human');
  assert(autoHuman.level === 3, 'human → Level 3');
  const autoLLM = prometheus.autoDescend(SEED_KERNEL[0], 'llm');
  assert(autoLLM.level === 2, 'llm → Level 2');
  const autoChild = prometheus.autoDescend(SEED_KERNEL[0], 'child');
  assert(autoChild.level === 4, 'child → Level 4');
  const autoUnknown = prometheus.autoDescend(SEED_KERNEL[0], 'unknown');
  assert(autoUnknown.level === 2, 'unknown → Level 2（デフォルト）');

  console.log('\n--- 21. PrometheusProtocol: exportForNote ---');
  const noteExport = prometheus.exportForNote();
  assert(noteExport.includes('D-FUMT'), 'note出力にD-FUMT');
  assert(noteExport.includes('プロメテウス'), 'note出力にプロメテウス');

  const filtered = prometheus.exportForNote(['dfumt-catuskoti']);
  assert(filtered.includes('dfumt-catuskoti'), '指定理論のみ');

  // カテゴリ別七価マッピングテスト
  console.log('\n--- 22. PrometheusProtocol: カテゴリ七価マッピング ---');
  const logicTheory = SEED_KERNEL.find(t => t.category === 'logic')!;
  const cosmicTheory = SEED_KERNEL.find(t => t.category === 'cosmic')!;
  const pLogic = prometheus.descend(logicTheory, 0);
  assert(pLogic.logicTag === 'TRUE', 'logic → TRUE');
  const pCosmic = prometheus.descend(cosmicTheory, 0);
  assert(pCosmic.logicTag === 'INFINITY', 'cosmic → INFINITY');

  // ══════════════════════════════════════════════════════════════
  // NarcissusDetector
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 23. NarcissusDetector: 健全な推論 ---');
  const narcissus = new NarcissusDetector();
  assert(narcissus !== null, 'インスタンス作成');

  narcissus.observe('axiom-1', 'TRUE');
  narcissus.observe('axiom-2', 'TRUE');
  narcissus.observe('axiom-3', 'FALSE');
  const report1 = narcissus.analyze();
  assert(report1.detected === false, '健全 → detected=false');
  assert(report1.riskLevel === 'ZERO', 'riskLevel = ZERO');
  assert(report1.recommendation.includes('健全'), '推奨に「健全」');

  console.log('\n--- 24. NarcissusDetector: 循環参照検出 ---');
  narcissus.reset();
  narcissus.observe('A', 'TRUE', ['B']);
  narcissus.observe('B', 'TRUE', ['C']);
  narcissus.observe('C', 'TRUE', ['A']); // A → B → C → A
  const report2 = narcissus.analyze();
  assert(report2.detected === true, '循環参照 → detected=true');
  assert(report2.riskLevel === 'INFINITY', 'riskLevel = INFINITY');
  assert(report2.loops.some(l => l.kind === 'circular_reference'), 'circular_reference検出');
  assert(report2.recommendation.includes('循環参照'), '推奨に「循環参照」');

  console.log('\n--- 25. NarcissusDetector: 公理過剰使用 ---');
  narcissus.reset();
  for (let i = 0; i < 15; i++) {
    narcissus.observe('overused-axiom', 'TRUE');
  }
  const report3 = narcissus.analyze();
  assert(report3.overusedAxioms.includes('overused-axiom'), '過剰使用検出');
  assert(report3.loops.some(l => l.kind === 'axiom_overuse'), 'axiom_overuse検出');

  console.log('\n--- 26. NarcissusDetector: 七価値振動検出 ---');
  narcissus.reset();
  // TRUE-FALSE-TRUE-FALSE の振動パターン
  narcissus.observe('oscillator', 'TRUE');
  narcissus.observe('oscillator', 'FALSE');
  narcissus.observe('oscillator', 'TRUE');
  narcissus.observe('oscillator', 'FALSE');
  const report4 = narcissus.analyze();
  assert(report4.oscillationPatterns.some(o => o.isOscillating), '振動検出');
  assert(report4.oscillationPatterns.some(o => o.period === 2), '周期2の振動');

  console.log('\n--- 27. NarcissusDetector: 複合検出 ---');
  narcissus.reset();
  // 循環参照 + 振動
  narcissus.observe('X', 'TRUE', ['Y']);
  narcissus.observe('Y', 'TRUE', ['X']); // X ↔ Y 循環
  narcissus.observe('Z', 'TRUE');
  narcissus.observe('Z', 'FALSE');
  narcissus.observe('Z', 'TRUE');
  narcissus.observe('Z', 'FALSE'); // Z振動
  const report5 = narcissus.analyze();
  assert(report5.detected === true, '複合 → detected=true');
  // 循環参照があるのでINFINITY
  assert(report5.riskLevel === 'INFINITY', '循環参照あり → INFINITY');

  console.log('\n--- 28. NarcissusDetector: reset ---');
  narcissus.reset();
  const reportEmpty = narcissus.analyze();
  assert(reportEmpty.detected === false, 'reset後 → detected=false');

  // ══════════════════════════════════════════════════════════════
  // AriadneTracer
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 29. AriadneTracer: beginThread ---');
  const ariadne = new AriadneTracer();
  assert(ariadne !== null, 'インスタンス作成');

  const rootId = ariadne.beginThread('start-axiom', 'TRUE', '初期の問い');
  assert(rootId.startsWith('ariadne-'), 'IDプレフィックス');

  console.log('\n--- 30. AriadneTracer: extend ---');
  const n1 = ariadne.extend(rootId, 'axiom-2', 'FLOWING', 'ステップ1');
  const n2 = ariadne.extend(n1, 'axiom-3', 'BOTH', 'ステップ2（問題）');
  assert(n1.startsWith('ariadne-'), 'extend ID');

  // 存在しない親 → エラー
  let threwExtend = false;
  try { ariadne.extend('non-existent', 'x', 'TRUE', 'fail'); } catch { threwExtend = true; }
  assert(threwExtend, '存在しない親 → エラー');

  console.log('\n--- 31. AriadneTracer: backtrace ---');
  const bt = ariadne.backtrace(n2);
  assert(bt.found === true, 'found = true');
  assert(bt.path.length === 3, '経路長 = 3（root + 2ステップ）');
  assert(bt.reversePath.length === 3, '逆経路長 = 3');
  assert(bt.originNode!.axiomId === 'start-axiom', '起点 = start-axiom');
  assert(bt.problemNode!.axiomId === 'axiom-3', '問題ノード = axiom-3');
  assert(bt.thread.includes('->'), '糸の可視化に->');
  assert(bt.explanation.includes('BOTH'), '説明にBOTH');

  console.log('\n--- 32. AriadneTracer: backtrace（存在しないID） ---');
  const btMissing = ariadne.backtrace('non-existent');
  assert(btMissing.found === false, 'found = false');

  console.log('\n--- 33. AriadneTracer: findRootCause ---');
  const rootCause = ariadne.findRootCause();
  assert(rootCause !== null, '根本原因あり');
  assert(rootCause!.problemNode!.value === 'BOTH', '問題値 = BOTH');

  console.log('\n--- 34. AriadneTracer: findRootCause（正常時） ---');
  const ariadne2 = new AriadneTracer();
  const r2 = ariadne2.beginThread('ok', 'TRUE', 'OK');
  ariadne2.extend(r2, 'ok2', 'TRUE', 'OK2');
  assert(ariadne2.findRootCause() === null, '正常時 → null');

  console.log('\n--- 35. AriadneTracer: labyrinthStats ---');
  const stats = ariadne.labyrinthStats();
  assert(stats.totalNodes === 3, 'totalNodes = 3');
  assert(stats.maxDepth === 2, 'maxDepth = 2');
  assert(stats.deadEnds >= 1, 'deadEnds >= 1');
  assert(stats.criticalPath.length > 0, 'criticalPath非空');

  console.log('\n--- 36. AriadneTracer: 分岐テスト ---');
  const ariadne3 = new AriadneTracer();
  const br = ariadne3.beginThread('root', 'TRUE', '分岐テスト');
  const b1 = ariadne3.extend(br, 'branch-a', 'TRUE', 'A');
  const b2 = ariadne3.extend(br, 'branch-b', 'FLOWING', 'B');
  ariadne3.extend(b1, 'leaf-a1', 'TRUE', 'A1');
  ariadne3.extend(b2, 'leaf-b1', 'NEITHER', 'B1');
  const stats3 = ariadne3.labyrinthStats();
  assert(stats3.totalNodes === 5, '5ノード');
  assert(stats3.branchPoints === 1, '分岐点 = 1');
  assert(stats3.deadEnds === 2, '行き止まり = 2');

  console.log('\n--- 37. AriadneTracer: fromChain ---');
  const chain: AxiomChain = {
    chainId: 'test-chain',
    question: 'テスト問い',
    conclusion: 'TRUE',
    steps: [
      { stepId: 's1', axiomId: 'ax1', axiomText: 'test', inputValue: 'ZERO', outputValue: 'FLOWING', operation: 'apply', confidence: 'TRUE' },
      { stepId: 's2', axiomId: 'ax2', axiomText: 'test2', inputValue: 'FLOWING', outputValue: 'TRUE', operation: 'resolve', confidence: 'TRUE' },
    ],
    overallConfidence: 'TRUE',
    createdAt: Date.now(),
  };
  const ariadne4 = new AriadneTracer();
  const lastId = ariadne4.fromChain(chain);
  assert(lastId.startsWith('ariadne-'), 'fromChain → 有効なID');
  const chainStats = ariadne4.labyrinthStats();
  assert(chainStats.totalNodes === 3, 'root + 2 steps = 3');

  // 空チェーン
  const ariadne5 = new AriadneTracer();
  const emptyChainId = ariadne5.fromChain({ ...chain, steps: [] });
  assert(emptyChainId === '', '空チェーン → 空文字列');

  console.log('\n--- 38. AriadneTracer: reset ---');
  ariadne.reset();
  const statsAfterReset = ariadne.labyrinthStats();
  assert(statsAfterReset.totalNodes === 0, 'reset後 → 0ノード');

  // ══════════════════════════════════════════════════════════════
  // 統合テスト: 4モジュール連携フロー
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 39. 統合: Moira → Ariadne → Narcissus → Prometheus ---');

  // 1. クロトが推論を開始
  const m = new MoiraTerminator();
  const proc0 = m.clotho('統合テスト推論', { maxIterations: 10 });

  // 2. AriadneTracerでトレース開始
  const a = new AriadneTracer();
  const traceRoot = a.beginThread('start', 'FLOWING', proc0.question);

  // 3. NarcissusDetectorで監視開始
  const n = new NarcissusDetector();
  n.observe('start', 'FLOWING');

  // 4. 推論ステップ
  const step1 = a.extend(traceRoot, 'step1', 'TRUE', 'ステップ1');
  n.observe('step1', 'TRUE');
  const j1x = m.lachesis(proc0.id, 'TRUE');
  assert(j1x.shouldTerminate === true, '統合: TRUE → 収束');

  // 5. アトロポスが終了
  const finalProc = m.atropos(proc0.id, 'convergence');
  assert(finalProc !== null, '統合: 正常終了');

  // 6. NarcissusDetectorで確認
  const blindSpot = n.analyze();
  assert(blindSpot.riskLevel === 'ZERO', '統合: 盲点なし');

  // 7. PrometheusProtocolで結果を降下
  const prom = new PrometheusProtocol();
  const packet = prom.autoDescend(SEED_KERNEL[0], 'human');
  assert(packet.level === 3, '統合: human → Level 3');

  // 8. AriadneTracerで逆引き
  const bt2 = a.backtrace(step1);
  assert(bt2.found === true, '統合: 逆引き成功');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
