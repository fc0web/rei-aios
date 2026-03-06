/**
 * SAC Bio-AI Interface テスト
 */

import {
  evaluateBioSignal,
  detectConsciousnessShift,
  type BioSignal,
  type UIAdaptation,
} from '../src/aios/bio/sac-bio-interface';

async function runTests() {
  console.log('=== SAC Bio-AI Interface Tests ===\n');
  let passed = 0; let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (cond) { console.log(`  \u2713 ${msg}`); passed++; }
    else { console.log(`  \u2717 ${msg}`); failed++; }
  };

  // --- 1. 基本評価 ---
  console.log('--- 1. 基本バイオシグナル評価 ---');

  const flowSignal: BioSignal = {
    heartRate: 72, skinConductance: 5,
    eegAlpha: 20, eegBeta: 12, eegGamma: 3.5, eegTheta: 4,
  };
  const flowResult = evaluateBioSignal(flowSignal);
  assert(flowResult.consciousnessState !== undefined, 'フロー信号が評価される');
  assert(flowResult.sacEval.phi > 0, 'φが正の値');
  assert(flowResult.sacEval.c1_existence > 0, 'C1（意識存在）が正の値');
  assert(flowResult.confidence > 0, '信頼度が正の値');
  assert(flowResult.affectState === 'flow' || flowResult.affectState === 'focused', 'フロー/集中状態として分類');

  // --- 2. ストレス状態 ---
  console.log('\n--- 2. ストレス状態 ---');

  const stressSignal: BioSignal = {
    heartRate: 102, skinConductance: 18,
    eegAlpha: 4, eegBeta: 18, eegTheta: 3,
  };
  const stressResult = evaluateBioSignal(stressSignal);
  assert(stressResult.sacEval.phi >= 0, 'ストレス信号のφが非負');
  assert(stressResult.affectState === 'stressed' || stressResult.affectState === 'anxious', 'ストレス/不安として分類');

  // --- 3. 眠気状態 ---
  console.log('\n--- 3. 眠気状態 ---');

  const drowsySignal: BioSignal = {
    heartRate: 58, skinConductance: 1.2,
    eegAlpha: 8, eegTheta: 12, eegBeta: 5,
  };
  const drowsyResult = evaluateBioSignal(drowsySignal);
  assert(drowsyResult.affectState === 'drowsy' || drowsyResult.affectState === 'calm', '眠気/穏やかとして分類（α=8は境界値）');

  // --- 4. 最小センサー（意識なし相当） ---
  console.log('\n--- 4. 最小センサー入力 ---');

  const minSignal: BioSignal = { heartRate: 45 };
  const minResult = evaluateBioSignal(minSignal);
  assert(minResult.confidence <= 1.0 / 7 + 0.01, '信頼度が低い（センサー1つ）');
  assert(minResult.sacEval.c1_existence >= 0, 'C1が非負');

  // --- 5. UI適応勧告 ---
  console.log('\n--- 5. UI適応勧告 ---');

  assert(typeof flowResult.recommendedDensity === 'number', '推奨密度がnumber');
  assert(flowResult.recommendedDensity >= 0 && flowResult.recommendedDensity <= 1.0, '推奨密度が0〜1.0');
  assert(typeof flowResult.notificationsEnabled === 'boolean', '通知可否がboolean');
  assert(typeof flowResult.ambientMode === 'boolean', 'アンビエントモードがboolean');
  assert(flowResult.interventionReason.length > 0, '勧告理由が存在');

  // --- 6. SAC公理 C1〜C6 ---
  console.log('\n--- 6. SAC公理 C1〜C6 スコア ---');

  const ev = flowResult.sacEval;
  assert(ev.c1_existence >= 0 && ev.c1_existence <= 1, 'C1が0〜1');
  assert(ev.c2_intrinsic >= 0 && ev.c2_intrinsic <= 1, 'C2が0〜1');
  assert(ev.c3_structure >= 0 && ev.c3_structure <= 1, 'C3が0〜1');
  assert(ev.c4_specificity >= 0 && ev.c4_specificity <= 1, 'C4が0〜1');
  assert(ev.c5_integration >= 0 && ev.c5_integration <= 1, 'C5が0〜1');
  assert(ev.c6_exclusivity >= 0 && ev.c6_exclusivity <= 1, 'C6が0〜1');
  assert(ev.phi >= 0 && ev.phi <= 1, 'φが0〜1');

  // --- 7. 七価論理値の有効性 ---
  console.log('\n--- 7. 七価論理値 ---');

  const validValues = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'];
  assert(validValues.includes(flowResult.consciousnessState), 'フロー信号の七価論理値が有効');
  assert(validValues.includes(stressResult.consciousnessState), 'ストレス信号の七価論理値が有効');
  assert(validValues.includes(drowsyResult.consciousnessState), '眠気信号の七価論理値が有効');
  assert(validValues.includes(minResult.consciousnessState), '最小信号の七価論理値が有効');

  // --- 8. 意識変化検出 ---
  console.log('\n--- 8. 意識変化検出 ---');

  const stable = detectConsciousnessShift([flowSignal, flowSignal, flowSignal]);
  assert(stable.direction === 'stable' || !stable.shifting, '同一信号で安定');

  const ascending = detectConsciousnessShift([
    { heartRate: 45 },
    { heartRate: 65, eegAlpha: 10 },
    { heartRate: 72, eegAlpha: 20, eegBeta: 12, eegGamma: 3.5 },
  ]);
  assert(ascending.shifting === true, '上昇シフトが検出される');
  assert(ascending.direction === 'ascending', '上昇方向');

  const tooFew = detectConsciousnessShift([flowSignal]);
  assert(!tooFew.shifting, '履歴が少なすぎる場合はシフトなし');

  // --- 9. 空信号 ---
  console.log('\n--- 9. 空信号 ---');

  const emptyResult = evaluateBioSignal({});
  assert(emptyResult.sacEval.c1_existence === 0, '空信号でC1=0');
  assert(emptyResult.consciousnessState === 'ZERO', '空信号でZERO');

  // --- 10. 感情矛盾 ---
  console.log('\n--- 10. 感情矛盾（BOTH） ---');

  const contradictionSignal: BioSignal = {
    heartRate: 95, skinConductance: 2,
    eegAlpha: 15, eegBeta: 16,
  };
  const contResult = evaluateBioSignal(contradictionSignal);
  assert(contResult.sacEval.phi > 0, '矛盾信号のφが正');
  assert(validValues.includes(contResult.consciousnessState), '矛盾信号の七価論理値が有効');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
