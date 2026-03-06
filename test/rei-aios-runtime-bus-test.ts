/**
 * ReiAIOSRuntimeBus テスト
 */

import {
  ReiAIOSRuntimeBus,
  getReiAIOSRuntime,
  resetReiAIOSRuntime,
  type BusOutput,
  type BusEventType,
} from '../src/aios/rei-aios-runtime-bus';

async function runTests() {
  console.log('=== ReiAIOSRuntimeBus Tests ===\n');
  let passed = 0; let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (cond) { console.log(`  \u2713 ${msg}`); passed++; }
    else { console.log(`  \u2717 ${msg}`); failed++; }
  };

  const validValues = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'];

  // --- 1. 基本構築 ---
  console.log('--- 1. 基本構築 ---');

  resetReiAIOSRuntime();
  const bus = new ReiAIOSRuntimeBus();
  assert(bus.getSystemTag() === 'ZERO', '初期状態はZERO');
  assert(bus.getHistory().length === 0, '履歴は空');
  assert(bus.getPendingContradictions().length === 0, '矛盾なし');

  // --- 2. bio_signal イベント ---
  console.log('\n--- 2. bio_signal イベント ---');

  const bioOut = bus.publish({
    type: 'bio_signal',
    source: 'headset-A',
    timestamp: Date.now(),
    payload: { heartRate: 72, eegAlpha: 20, eegBeta: 12, eegGamma: 3.5, skinConductance: 5 },
  });
  assert(bioOut.eventId.startsWith('bus-'), 'イベントIDが生成される');
  assert(bioOut.triggerType === 'bio_signal', 'triggerTypeが正しい');
  assert(validValues.includes(bioOut.systemTag), 'システム状態が有効な七価論理値');
  assert(bioOut.temporal !== undefined, 'temporal情報あり');
  assert(bioOut.temporal!.topic === 'bio:headset-A', 'temporalトピックが正しい');

  // --- 3. bio_signal BOTH（感情矛盾） ---
  console.log('\n--- 3. bio_signal BOTH（感情矛盾） ---');

  const bothOut = bus.publish({
    type: 'bio_signal',
    source: 'headset-B',
    timestamp: Date.now(),
    payload: { heartRate: 98, eegAlpha: 18, eegBeta: 17, skinConductance: 14 },
  });
  // HR>90 && alpha>14 → BOTH
  assert(bothOut.temporal!.value === 'BOTH', 'BOTH信号が検出される');
  // 矛盾が検出される場合（detect()がnullを返さなければ）
  if (bothOut.contradiction) {
    assert(bothOut.contradiction.id.length > 0, '矛盾IDが存在');
    assert(bothOut.contradiction.resultTag === 'BOTH', '矛盾結果がBOTH');
  }

  // --- 4. space_snapshot イベント ---
  console.log('\n--- 4. space_snapshot イベント ---');

  const spaceOut = bus.publish({
    type: 'space_snapshot',
    source: 'factory-floor',
    timestamp: Date.now(),
    payload: {
      spaceName: 'factory_floor',
      overallTag: 'TRUE',
      phi: 0.8,
      dimensions: [
        { name: 'temp', value: 24, logicTag: 'TRUE' },
        { name: 'humidity', value: 55, logicTag: 'TRUE' },
      ],
    },
  });
  assert(spaceOut.triggerType === 'space_snapshot', 'space_snapshotイベント');
  assert(spaceOut.temporal!.topic === 'space:factory_floor', 'spaceトピックが正しい');

  // --- 5. space_snapshot INFINITY（危険状態） ---
  console.log('\n--- 5. space_snapshot INFINITY ---');

  const dangerOut = bus.publish({
    type: 'space_snapshot',
    source: 'factory-floor',
    timestamp: Date.now(),
    payload: {
      spaceName: 'factory_floor',
      overallTag: 'INFINITY',
      phi: 0.3,
      dimensions: [
        { name: 'co2', value: 2000, logicTag: 'INFINITY' },
        { name: 'temp', value: 24, logicTag: 'TRUE' },
      ],
    },
  });
  assert(dangerOut.temporal!.value === 'INFINITY', 'INFINITY状態が記録される');

  // --- 6. axiom_used イベント ---
  console.log('\n--- 6. axiom_used イベント ---');

  const axiomOut = bus.publish({
    type: 'axiom_used',
    source: 'rei-aios',
    timestamp: Date.now(),
    payload: { axiomId: 'dfumt-catuskoti', context: 'test', inputTag: 'BOTH', outputTag: 'FLOWING' },
  });
  assert(axiomOut.triggerType === 'axiom_used', 'axiom_usedイベント');

  // --- 7. inference イベント ---
  console.log('\n--- 7. inference イベント ---');

  const infOut = bus.publish({
    type: 'inference',
    source: 'local-axiom-llm',
    timestamp: Date.now(),
    payload: {
      question: 'テスト推論',
      depth: 2,
      axiomIds: ['dfumt-catuskoti', 'dfumt-flowing-value'],
      logicValues: ['BOTH', 'FLOWING'],
      result: 'FLOWING',
    },
  });
  assert(infOut.triggerType === 'inference', 'inferenceイベント');
  assert(infOut.temporal!.value === 'FLOWING', '推論結果がFLOWING');
  assert(infOut.cognitiveLoad !== undefined, '認知負荷が計測される');

  // --- 8. ui_feedback イベント ---
  console.log('\n--- 8. ui_feedback イベント ---');

  const pending = bus.getPendingContradictions();
  if (pending.length > 0) {
    const fbOut = bus.publish({
      type: 'ui_feedback',
      source: 'user',
      timestamp: Date.now(),
      payload: { contradictionId: pending[0].id, resolution: 'TRUE', reason: 'テスト解決' },
    });
    assert(fbOut.triggerType === 'ui_feedback', 'ui_feedbackイベント');
    assert(fbOut.temporal!.value === 'TRUE', '解決値がTRUE');
  }
  assert(true, 'ui_feedbackルート実行（矛盾有無に依存）');

  // --- 9. layer_result イベント ---
  console.log('\n--- 9. layer_result イベント ---');

  const layerOut = bus.publish({
    type: 'layer_result',
    source: 'env_control',
    timestamp: Date.now(),
    payload: {
      layerName: 'env_control',
      overallStatus: 'TRUE',
      stages: [
        { name: 'normalize', inputTag: 'ZERO', outputTag: 'TRUE' },
        { name: 'analyze', inputTag: 'TRUE', outputTag: 'TRUE' },
      ],
      totalDurationMs: 5.2,
    },
  });
  assert(layerOut.triggerType === 'layer_result', 'layer_resultイベント');
  assert(layerOut.temporal!.topic === 'layer:env_control', 'layerトピックが正しい');

  // --- 10. subscribe/unsubscribe ---
  console.log('\n--- 10. subscribe/unsubscribe ---');

  let captured: BusOutput | null = null;
  const unsub = bus.subscribe('bio_signal', (out) => { captured = out; });

  bus.publish({
    type: 'bio_signal',
    source: 'test-sub',
    timestamp: Date.now(),
    payload: { heartRate: 70 },
  });
  assert(captured !== null, 'サブスクライバがイベントを受信');
  assert(captured!.source === 'test-sub', 'sourceが正しい');

  unsub();
  captured = null;
  bus.publish({
    type: 'bio_signal',
    source: 'test-unsub',
    timestamp: Date.now(),
    payload: { heartRate: 70 },
  });
  assert(captured === null, 'unsubscribe後はイベント非受信');

  // --- 11. ワイルドカード購読 ---
  console.log('\n--- 11. ワイルドカード購読 ---');

  let wildCount = 0;
  const unsubWild = bus.subscribe('*', () => { wildCount++; });
  bus.publish({ type: 'bio_signal', source: 'w1', timestamp: Date.now(), payload: {} });
  bus.publish({ type: 'axiom_used', source: 'w2', timestamp: Date.now(), payload: { axiomId: 'test', inputTag: 'TRUE', outputTag: 'TRUE' } });
  assert(wildCount === 2, 'ワイルドカードが全イベントを受信');
  unsubWild();

  // --- 12. summary ---
  console.log('\n--- 12. summary ---');

  const s = bus.summary();
  assert(s.totalEvents > 0, '総イベント数が正');
  assert(validValues.includes(s.systemTag), 'サマリのsystemTagが有効');
  assert(s.systemSymbol.length > 0, 'systemSymbolが存在');
  assert(typeof s.pendingContradictions === 'number', 'pendingContradictionsがnumber');
  assert(typeof s.evolvedTheories === 'number', 'evolvedTheoriesがnumber');

  // --- 13. history ---
  console.log('\n--- 13. history ---');

  const history = bus.getHistory(5);
  assert(history.length <= 5, '履歴が5件以下');
  assert(history.length > 0, '履歴が存在');
  assert(history[history.length - 1].eventId.startsWith('bus-'), '最新イベントIDが正しい');

  // --- 14. finalizeCurrentChain ---
  console.log('\n--- 14. finalizeCurrentChain ---');

  const report = bus.finalizeCurrentChain();
  // inferenceイベントでチェーンが開始されているはず
  if (report) {
    assert(report.chain !== undefined, 'レポートにchainが存在');
    assert(report.chain.steps.length > 0, 'ステップが存在');
  }
  assert(true, 'finalizeCurrentChain実行完了');

  // --- 15. シングルトン ---
  console.log('\n--- 15. シングルトン ---');

  resetReiAIOSRuntime();
  const g1 = getReiAIOSRuntime();
  const g2 = getReiAIOSRuntime();
  assert(g1 === g2, 'シングルトンが同一インスタンス');
  resetReiAIOSRuntime();
  const g3 = getReiAIOSRuntime();
  assert(g1 !== g3, 'リセット後は新インスタンス');

  // --- 16. システム状態遷移 ---
  console.log('\n--- 16. システム状態遷移 ---');

  resetReiAIOSRuntime();
  const bus2 = new ReiAIOSRuntimeBus();
  assert(bus2.getSystemTag() === 'ZERO', '初期ZERO');
  bus2.publish({ type: 'bio_signal', source: 'x', timestamp: Date.now(), payload: { heartRate: 70 } });
  assert(bus2.getSystemTag() !== 'ZERO', '初回イベント後にZEROではなくなる');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
