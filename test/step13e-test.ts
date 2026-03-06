import { ConfidenceTracker, generateConfidencePanel } from '../src/knowledge/confidence-tracker';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('\n=== STEP 13-E: 確信度トラッキングテスト ===\n');

const tracker = new ConfidenceTracker(':memory:');

// ─── 1. 新規登録テスト ────────────────────────────────────────
console.log('【1. 公理の新規登録】');
const conf1 = tracker.register('#101', '意識の自己参照公理', 20, '初回登録');
assert(conf1.axiomId === '#101',   'ID が正しい');
assert(conf1.currentScore === 20,  '初期スコアが20');
assert(conf1.currentValue === 'NEITHER', '20%はNEITHER');
assert(conf1.status === 'GROWING', '初期ステータスはGROWING');
assert(conf1.history.length === 1, '履歴が1件');
assert(conf1.history[0].trigger === 'REGISTRATION', '初回イベントはREGISTRATION');
console.log(`    初期状態: ${conf1.currentScore}% / ${conf1.currentValue}`);

// ─── 2. 確信度更新テスト ─────────────────────────────────────
console.log('\n【2. 確信度の段階的更新】');

// 整合性確認 (+12)
const conf2 = tracker.update('#101', 'CONSISTENCY_CHECK', '他の公理と矛盾なし');
assert(conf2 !== null, '更新成功');
assert(conf2!.currentScore === 32, `整合性確認後: 32% (${conf2!.currentScore}%)`);
assert(conf2!.currentValue === 'NEITHER', '32%はまだNEITHER');

// 矛盾解消 (+18)
const conf3 = tracker.update('#101', 'CONTRADICTION_RESOLVED', 'Theory #3との矛盾解消');
assert(conf3!.currentScore === 50, `矛盾解消後: 50% (${conf3!.currentScore}%)`);
assert(conf3!.currentValue === 'FLOWING', '50%はFLOWING');
assert(conf3!.status === 'GROWING', 'ステータスはGROWING');

// Nostr確認 (+10)
const conf4 = tracker.update('#101', 'NOSTR_CONFIRMED', 'Nostrネットワークで確認');
assert(conf4!.currentScore === 60, `Nostr確認後: 60% (${conf4!.currentScore}%)`);

// 他者検証 (+15)
const conf5 = tracker.update('#101', 'PEER_VERIFICATION', '研究者Aが検証');
assert(conf5!.currentScore === 75, `他者検証後: 75% (${conf5!.currentScore}%)`);
assert(conf5!.currentValue === 'BOTH', '75%はBOTH');

// Rei-PL証明 (+25)
const conf6 = tracker.update('#101', 'REI_PL_PROOF', 'Rei-PLで実行証明完了');
assert(conf6!.currentScore === 100, `Rei-PL証明後: 100% (${conf6!.currentScore}%)`);
assert(conf6!.currentValue === 'TRUE', '100%はTRUE');
assert(conf6!.status === 'PROVEN', 'ステータスはPROVEN');
assert(conf6!.verificationCount >= 5, `検証回数: ${conf6!.verificationCount}回`);
console.log(`    最終状態: ${conf6!.currentScore}% / ${conf6!.currentValue} / ${conf6!.status}`);

// ─── 3. 履歴テスト ───────────────────────────────────────────
console.log('\n【3. 確信度履歴の記録】');
const loaded = tracker.get('#101');
assert(loaded !== null, '公理が取得できる');
assert(loaded!.history.length >= 6, `履歴件数: ${loaded!.history.length}件`);
assert(loaded!.peakScore === 100, `ピークスコア: ${loaded!.peakScore}%`);

// 時系列で確信度が上昇しているか確認
const scores = loaded!.history.map(e => e.newScore);
assert(scores[0] < scores[scores.length - 1], '時系列で確信度が上昇している');
console.log(`    履歴: ${scores.join(' → ')}%`);

// ─── 4. 複数公理のテスト ─────────────────────────────────────
console.log('\n【4. 複数公理の管理】');
tracker.register('#102', '螺旋数論の拡張', 35);
tracker.register('#103', '縁起の圧縮定理', 55);
tracker.register('#104', '非数値数学基礎', 15);
tracker.update('#102', 'CONSISTENCY_CHECK');
tracker.update('#103', 'REI_PL_PROOF');

const all = tracker.listAll();
assert(all.length >= 4, `全公理数: ${all.length}件`);

// ─── 5. ランキングテスト ─────────────────────────────────────
console.log('\n【5. 確信度ランキング】');
const ranking = tracker.ranking(5);
assert(ranking.length >= 3, `ランキング件数: ${ranking.length}件`);
// 降順ソートの確認
for (let i = 0; i < ranking.length - 1; i++) {
  assert(
    ranking[i].currentScore >= ranking[i+1].currentScore,
    `ランキング順: ${ranking[i].currentScore}% >= ${ranking[i+1].currentScore}%`
  );
}
console.log('    ランキング:');
ranking.forEach((c, i) =>
  console.log(`      ${i+1}. ${c.axiomId} ${c.currentScore}% [${c.currentValue}]`)
);

// ─── 6. 統計テスト ───────────────────────────────────────────
console.log('\n【6. 統計情報】');
const stats = tracker.stats();
assert(stats.total >= 4, `登録総数: ${stats.total}件`);
assert(stats.proven >= 1, `証明済み: ${stats.proven}件`);
assert(stats.averageScore >= 0 && stats.averageScore <= 100,
  `平均確信度: ${stats.averageScore}%`);
assert(typeof stats.byDFUMT === 'object', 'D-FUMT別集計が存在する');
console.log(`    合計: ${stats.total}件 / 証明済: ${stats.proven}件 / 平均: ${stats.averageScore}%`);

// ─── 7. マニュアル更新テスト ─────────────────────────────────
console.log('\n【7. マニュアル更新テスト】');
tracker.register('#105', '試験公理', 80);
const manual = tracker.update('#105', 'MANUAL_UPDATE', '手動修正', 40);
assert(manual !== null, 'マニュアル更新成功');
assert(manual!.currentScore === 40, `手動で40%に変更: ${manual!.currentScore}%`);
assert(manual!.status === 'DECLINING', 'スコア低下でDECLINING');

// ─── 8. WebUIパネル生成テスト ────────────────────────────────
console.log('\n【8. WebUIパネル生成】');
const panel = generateConfidencePanel();
assert(panel.includes('panel-confidence'), 'パネルIDが存在する');
assert(panel.includes('registerAxiomConf'), '登録関数が存在する');
assert(panel.includes('updateAxiomConf'), '更新関数が存在する');
assert(panel.includes('lookupConfidence'), '検索関数が存在する');
assert(panel.includes('renderConfRanking'), 'ランキング関数が存在する');
assert(panel.includes('renderConfStats'), '統計関数が存在する');
assert(panel.includes('conf-timeline'), 'タイムラインUIが存在する');
assert(panel.includes('PROVEN'), 'PROVENステータスが定義されている');
assert(panel.includes('REI_PL_PROOF'), 'Rei-PL証明トリガーが存在する');
console.log(`    パネルサイズ: ${panel.length}文字`);

console.log(`\n${'═'.repeat(50)}`);
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
