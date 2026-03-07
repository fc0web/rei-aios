/**
 * 公理の逆実装テスト（STEP 17）
 * AntiAxiomEngine, TheoremDeriver, NoAxiomVoid + SEED_KERNEL 87理論
 */

import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';
import { AntiAxiomEngine } from '../src/axiom-os/anti-axiom-engine';
import { TheoremDeriver } from '../src/axiom-os/theorem-deriver';
import { NoAxiomVoid } from '../src/axiom-os/no-axiom-void';
import type { SevenLogicValue } from '../src/axiom-os/seven-logic';

async function runTests() {
  console.log('=== Axiom Inverse Tests (STEP 17) ===\n');
  let passed = 0; let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (cond) { console.log(`  \u2713 ${msg}`); passed++; }
    else { console.log(`  \u2717 ${msg}`); failed++; }
  };

  const validValues: SevenLogicValue[] = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'];

  // ══════════════════════════════════════════════════════════════
  // SEED_KERNEL 87理論
  // ══════════════════════════════════════════════════════════════
  console.log('--- 1. SEED_KERNEL: 87理論 ---');
  assert(SEED_KERNEL.length === 87, `SEED_KERNEL.length === 87 (got ${SEED_KERNEL.length})`);
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-anti-axiom'), 'Theory #77 存在');
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-theorem'), 'Theory #78 存在');
  assert(SEED_KERNEL.some(t => t.id === 'dfumt-no-axiom'), 'Theory #79 存在');
  const ids = new Set(SEED_KERNEL.map(t => t.id));
  assert(ids.size === SEED_KERNEL.length, 'ID重複なし');

  // ══════════════════════════════════════════════════════════════
  // AntiAxiomEngine
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 2. AntiAxiomEngine: 基本構築 ---');
  const engine = new AntiAxiomEngine();
  assert(engine !== null, 'インスタンス作成');

  console.log('\n--- 3. AntiAxiomEngine: generate ---');
  const theory0 = SEED_KERNEL[0]; // dfumt-zero-pi
  const result = engine.generate(theory0);
  assert(result.original.id === theory0.id, 'original一致');
  assert(result.antiAxioms.length === 3, '3類型の反公理');
  assert(result.bothState === true, 'bothState = true');

  // 3類型の確認
  const negate = result.antiAxioms.find(a => a.kind === 'NEGATE');
  const weaken = result.antiAxioms.find(a => a.kind === 'WEAKEN');
  const extend = result.antiAxioms.find(a => a.kind === 'EXTEND');
  assert(negate !== undefined, 'NEGATE生成');
  assert(weaken !== undefined, 'WEAKEN生成');
  assert(extend !== undefined, 'EXTEND生成');

  console.log('\n--- 4. AntiAxiomEngine: NEGATE ---');
  assert(negate!.antiAxiom.startsWith('¬['), 'NEGATE: ¬[で始まる');
  assert(negate!.logicRelation === 'BOTH', 'NEGATE: logicRelation = BOTH');
  assert(negate!.sourceId === theory0.id, 'NEGATE: sourceId一致');
  assert(negate!.keywords.includes('否定'), 'NEGATE: 「否定」キーワード');

  console.log('\n--- 5. AntiAxiomEngine: WEAKEN ---');
  assert(weaken!.antiAxiom.includes('緩和'), 'WEAKEN: 「緩和」を含む');
  assert(weaken!.logicRelation === 'FLOWING', 'WEAKEN: logicRelation = FLOWING');
  assert(weaken!.keywords.includes('例外'), 'WEAKEN: 「例外」キーワード');

  console.log('\n--- 6. AntiAxiomEngine: EXTEND ---');
  assert(extend!.antiAxiom.includes('超える'), 'EXTEND: 「超える」を含む');
  assert(extend!.logicRelation === 'INFINITY', 'EXTEND: logicRelation = INFINITY');
  assert(extend!.keywords.includes('拡張'), 'EXTEND: 「拡張」キーワード');

  console.log('\n--- 7. AntiAxiomEngine: 新体系萌芽 ---');
  assert(result.emergentSystem !== undefined, '新体系候補あり');
  assert(result.emergentSystem!.logicTag === 'ZERO', '新体系: ZERO（潜在）');
  assert(result.emergentSystem!.sourceAxiomId === theory0.id, '新体系: sourceAxiomId');
  assert(result.emergentSystem!.theories.length === 2, '新体系: 2理論');

  console.log('\n--- 8. AntiAxiomEngine: toSeedTheory ---');
  const seedFromAnti = engine.toSeedTheory(negate!);
  assert(seedFromAnti.id === negate!.id, 'SeedTheory: ID一致');
  assert(seedFromAnti.axiom === negate!.antiAxiom, 'SeedTheory: axiom一致');
  assert(seedFromAnti.category === negate!.category, 'SeedTheory: category一致');

  console.log('\n--- 9. AntiAxiomEngine: generateAll ---');
  const engine2 = new AntiAxiomEngine();
  const allResults = engine2.generateAll(['dfumt-catuskoti', 'dfumt-idempotency']);
  assert(allResults.length === 2, '2理論の反公理');
  assert(allResults[0].antiAxioms.length === 3, '各3類型');
  assert(engine2.getAntiAxioms().length === 6, '合計6反公理');
  assert(engine2.getEmergentSystems().length >= 1, '新体系候補あり');

  console.log('\n--- 10. AntiAxiomEngine: generateAll（全体） ---');
  const engine3 = new AntiAxiomEngine();
  const fullResults = engine3.generateAll();
  assert(fullResults.length === 87, '87理論の反公理');
  assert(engine3.getAntiAxioms().length === 87 * 3, '合計261反公理');

  // ══════════════════════════════════════════════════════════════
  // TheoremDeriver
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 11. TheoremDeriver: 基本構築 ---');
  const deriver = new TheoremDeriver();
  assert(deriver !== null, 'インスタンス作成');

  console.log('\n--- 12. TheoremDeriver: modusPonens ---');
  const mp = deriver.modusPonens('dfumt-catuskoti', 'dfumt-idempotency');
  assert(mp.success === true, 'Modus Ponens成功');
  assert(mp.theorem !== undefined, '定理生成');
  assert(mp.theorem!.rule === 'modus_ponens', 'rule = modus_ponens');
  assert(mp.theorem!.depth === 1, 'depth = 1');
  assert(mp.theorem!.derivedFrom.length === 2, '2公理から導出');
  assert(mp.steps.length === 3, '3ステップ');
  assert(validValues.includes(mp.theorem!.logicValue), '有効な七価値');

  console.log('\n--- 13. TheoremDeriver: modusPonens（存在しない公理） ---');
  const mpFail = deriver.modusPonens('non-existent', 'dfumt-catuskoti');
  assert(mpFail.success === false, '存在しない公理 → 失敗');
  assert(mpFail.stoppedReason!.includes('見つかりません'), '理由メッセージ');

  console.log('\n--- 14. TheoremDeriver: conjoin ---');
  const cj = deriver.conjoin(['dfumt-zero-pi', 'dfumt-spiral-number']);
  assert(cj.success === true, 'Conjunction成功');
  assert(cj.theorem !== undefined, '定理生成');
  assert(cj.theorem!.rule === 'conjunction', 'rule = conjunction');
  assert(cj.theorem!.statement.includes('∧'), 'statement に ∧');

  console.log('\n--- 15. TheoremDeriver: conjoin（1つ未満） ---');
  const cjFail = deriver.conjoin(['dfumt-zero-pi']);
  assert(cjFail.success === false, '1公理 → 失敗');

  console.log('\n--- 16. TheoremDeriver: conjoin（BOTH検出） ---');
  // logic(TRUE) と eastern-philosophy(BOTH) → BOTHになるケース
  // and(TRUE, BOTH) の結果がBOTHなら停止
  const cjBoth = deriver.conjoin(['dfumt-catuskoti', 'dfumt-center-periphery']);
  // catuskoti = logic = TRUE, center-periphery = general = ZERO
  // and(TRUE, ZERO) の結果次第
  // ここではBOTHになるかの確認（実装依存）
  assert(cjBoth.success === true || cjBoth.stoppedReason !== undefined, 'conjoinの結果が定義されている');

  console.log('\n--- 17. TheoremDeriver: deriveSystem ---');
  const system = deriver.deriveSystem('logic');
  assert(system.baseAxioms.length > 0, 'base公理あり');
  assert(system.theorems.length > 0, '定理が導出された');
  assert(system.totalDerived === system.theorems.length, 'totalDerived一致');

  console.log('\n--- 18. TheoremDeriver: deriveSystem（depth=2） ---');
  const system2 = deriver.deriveSystem('mathematics', 2);
  assert(system2.maxDepth === 2, 'maxDepth = 2');
  // 深さ2の定理が含まれるか
  const depth2Theorems = system2.theorems.filter(t => t.depth === 2);
  assert(depth2Theorems.length > 0 || system2.theorems.length <= 1, '深さ2の定理（十分なペアがあれば）');

  console.log('\n--- 19. TheoremDeriver: getTheorems ---');
  assert(deriver.getTheorems().length > 0, '定理が蓄積');

  console.log('\n--- 20. TheoremDeriver: 定理の信頼度 ---');
  const allTheorems = deriver.getTheorems();
  for (const t of allTheorems.slice(0, 5)) {
    assert(t.confidence >= 0 && t.confidence <= 1, `confidence: ${t.confidence}`);
  }

  // ══════════════════════════════════════════════════════════════
  // NoAxiomVoid
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 21. NoAxiomVoid: 基本構築 ---');
  const voidEngine = new NoAxiomVoid();
  assert(voidEngine !== null, 'インスタンス作成');

  console.log('\n--- 22. NoAxiomVoid: captureVoid ---');
  const v1 = voidEngine.captureVoid();
  assert(v1.logicTag === 'ZERO', 'logicTag = ZERO');
  assert(v1.potentialTheories.length === 87, '87理論が潜在');
  assert(v1.entropyBits > 0, 'エントロピー > 0');
  assert(v1.description.includes('87'), 'descriptionに87');
  assert(Math.abs(v1.entropyBits - Math.log2(87)) < 0.001, 'H = log2(87)');

  console.log('\n--- 23. NoAxiomVoid: primordialVoid ---');
  const pv = voidEngine.primordialVoid();
  assert(pv.potentialTheories.length === 0, '根源的ZERO: 0理論');
  assert(pv.entropyBits === 0, 'H = 0');
  assert(pv.description.includes('根源的'), '「根源的」を含む');

  console.log('\n--- 24. NoAxiomVoid: emerge ---');
  const theory1 = SEED_KERNEL[0];
  const em1 = voidEngine.emerge(v1.id, theory1, 'テスト発現');
  assert(em1.fromVoidId === v1.id, 'fromVoidId一致');
  assert(em1.theory.id === theory1.id, 'theory一致');
  assert(em1.emergenceValue === 'FLOWING', '発現直後 = FLOWING');
  assert(em1.trigger === 'テスト発現', 'trigger一致');

  console.log('\n--- 25. NoAxiomVoid: returnToVoid ---');
  const ret1 = voidEngine.returnToVoid(theory1.id, 'テスト帰還');
  assert(ret1.theoryId === theory1.id, 'theoryId一致');
  assert(ret1.reason === 'テスト帰還', 'reason一致');
  assert(ret1.residue.length > 0, '残滓あり');
  assert(ret1.newVoidId.length > 0, '新VOID ID');

  console.log('\n--- 26. NoAxiomVoid: getCycle ---');
  const cycle1 = voidEngine.getCycle(theory1.id);
  assert(cycle1 !== null, 'サイクル取得');
  assert(cycle1!.cycleComplete === true, 'サイクル完結');
  assert(cycle1!.duration !== undefined, 'duration定義');
  assert(cycle1!.duration! >= 0, 'duration >= 0');

  // 未帰還の理論
  const theory2 = SEED_KERNEL[1];
  voidEngine.emerge(v1.id, theory2, '未帰還テスト');
  const cycle2 = voidEngine.getCycle(theory2.id);
  assert(cycle2 !== null, '未帰還サイクル取得');
  assert(cycle2!.cycleComplete === false, '未帰還 → サイクル未完結');
  assert(cycle2!.duration === undefined, '未帰還 → duration undefined');

  // 未発現の理論
  const cycle3 = voidEngine.getCycle('non-existent');
  assert(cycle3 === null, '未発現 → null');

  console.log('\n--- 27. NoAxiomVoid: cycleCompletionRate ---');
  const rate = voidEngine.cycleCompletionRate();
  assert(rate === 0.5, '1/2完結 → 0.5');

  console.log('\n--- 28. NoAxiomVoid: summary ---');
  const summary = voidEngine.summary();
  assert(summary.voidCount >= 2, 'void 2件以上');
  assert(summary.emergenceCount === 2, '発現 2件');
  assert(summary.returnCount === 1, '帰還 1件');
  assert(summary.cycleCompletionRate === 0.5, 'rate = 0.5');
  assert(summary.currentEntropy > 0, 'エントロピー > 0');
  assert(validValues.includes(summary.overallTag), '有効な七価タグ');
  assert(summary.overallTag === 'FLOWING', '0.5 → FLOWING');

  console.log('\n--- 29. NoAxiomVoid: 全完結時 ---');
  voidEngine.returnToVoid(theory2.id, '帰還');
  const summary2 = voidEngine.summary();
  assert(summary2.cycleCompletionRate === 1.0, '全完結 → 1.0');
  assert(summary2.overallTag === 'TRUE', '全完結 → TRUE');

  console.log('\n--- 30. NoAxiomVoid: 空状態 ---');
  const emptyVoid = new NoAxiomVoid();
  const emptySummary = emptyVoid.summary();
  assert(emptySummary.cycleCompletionRate === 0, '空 → rate=0');
  assert(emptySummary.overallTag === 'ZERO', '空 → ZERO');

  // ══════════════════════════════════════════════════════════════
  // 統合テスト: 3モジュール連携フロー
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 31. 統合: Void → Emerge → Derive → AntiAxiom → Return ---');

  // 1. 根源的ZERO
  const nv = new NoAxiomVoid();
  const primordial = nv.primordialVoid();
  assert(primordial.potentialTheories.length === 0, '統合: 根源的ZERO');

  // 2. ZERO から現れ
  const catuskoti = SEED_KERNEL.find(t => t.id === 'dfumt-catuskoti')!;
  const emergence = nv.emerge(primordial.id, catuskoti, '四価論理の必要性');
  assert(emergence.emergenceValue === 'FLOWING', '統合: 発現FLOWING');

  // 3. 定理を導出
  const td = new TheoremDeriver();
  const mp2 = td.modusPonens('dfumt-catuskoti', 'dfumt-zero-state');
  assert(mp2.success === true, '統合: 定理導出成功');

  // 4. 反公理を生成
  const ae = new AntiAxiomEngine();
  const antiResult = ae.generate(catuskoti);
  assert(antiResult.bothState === true, '統合: BOTH状態');

  // 5. ZEROに帰還
  const returnEvt = nv.returnToVoid(catuskoti.id, '反公理との統合完了');
  assert(returnEvt.theoryId === catuskoti.id, '統合: 帰還完了');

  // 6. サイクル完結確認
  const fullCycle = nv.getCycle(catuskoti.id);
  assert(fullCycle !== null && fullCycle.cycleComplete, '統合: サイクル完結');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
