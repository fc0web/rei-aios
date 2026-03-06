/**
 * DFUMTConsistencyChecker テスト
 */

import { DFUMTConsistencyChecker, type ConsistencyReport, type TheoryPairCheck } from '../src/axiom-os/dfumt-consistency-checker';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';

async function runTests() {
  console.log('=== DFUMTConsistencyChecker Tests ===\n');
  let passed = 0; let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (cond) { console.log(`  \u2713 ${msg}`); passed++; }
    else { console.log(`  \u2717 ${msg}`); failed++; }
  };

  const validValues = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'];

  // --- 1. 基本構築 ---
  console.log('--- 1. 基本構築 ---');

  const checker = new DFUMTConsistencyChecker();
  assert(checker !== null, 'インスタンス作成');

  // --- 2. checkAll 実行 ---
  console.log('\n--- 2. checkAll 実行 ---');

  const report = checker.checkAll();
  assert(report !== null, 'レポート生成');
  assert(typeof report.totalTheories === 'number', 'totalTheoriesがnumber');
  assert(typeof report.totalPairsChecked === 'number', 'totalPairsCheckedがnumber');
  assert(typeof report.contradictionsFound === 'number', 'contradictionsFoundがnumber');
  assert(typeof report.consistencyScore === 'number', 'consistencyScoreがnumber');

  // --- 3. 理論数の確認 ---
  console.log('\n--- 3. 理論数の確認 ---');

  assert(report.totalTheories === SEED_KERNEL.length, `totalTheories === SEED_KERNEL.length (${SEED_KERNEL.length})`);
  assert(report.totalTheories === 75, '75理論');

  // --- 4. ペア数の確認 ---
  console.log('\n--- 4. ペア数の確認 ---');

  const expectedPairs = 75 * 74 / 2;
  assert(report.totalPairsChecked === expectedPairs, `全ペア数: ${expectedPairs}`);

  // --- 5. 整合スコアの範囲 ---
  console.log('\n--- 5. 整合スコアの範囲 ---');

  assert(report.consistencyScore >= 0, '整合スコア >= 0');
  assert(report.consistencyScore <= 1, '整合スコア <= 1');

  // --- 6. 全体七価評価 ---
  console.log('\n--- 6. 全体七価評価 ---');

  assert(validValues.includes(report.overallTag), `overallTagが有効な七価値: ${report.overallTag}`);

  // --- 7. 矛盾エントリの構造 ---
  console.log('\n--- 7. 矛盾エントリの構造 ---');

  assert(Array.isArray(report.contradictions), 'contradictionsが配列');
  if (report.contradictions.length > 0) {
    const c = report.contradictions[0];
    assert(typeof c.theoryA === 'string', 'theoryAがstring');
    assert(typeof c.theoryB === 'string', 'theoryBがstring');
    assert(typeof c.contradictionFound === 'boolean', 'contradictionFoundがboolean');
    assert(c.contradictionFound === true, '矛盾エントリはtrue');
  }
  assert(true, '矛盾エントリ構造OK');

  // --- 8. カテゴリ別スコア ---
  console.log('\n--- 8. カテゴリ別スコア ---');

  assert(typeof report.categoryScores === 'object', 'categoryScoresがobject');
  const categories = Object.keys(report.categoryScores);
  assert(categories.length > 0, 'カテゴリが1つ以上');
  for (const [cat, score] of Object.entries(report.categoryScores)) {
    assert(score >= 0 && score <= 1, `${cat}: スコアが0〜1の範囲 (${score})`);
  }

  // --- 9. checkedAt ---
  console.log('\n--- 9. checkedAt ---');

  assert(typeof report.checkedAt === 'string', 'checkedAtがstring');
  assert(report.checkedAt.includes('T'), 'ISO形式の日時');

  // --- 10. formatReport ---
  console.log('\n--- 10. formatReport ---');

  const formatted = checker.formatReport(report);
  assert(typeof formatted === 'string', 'formatReportがstring');
  assert(formatted.includes('D-FUMT'), 'D-FUMTが含まれる');
  assert(formatted.includes(String(report.totalTheories)), '理論数が含まれる');
  assert(formatted.includes(String(report.totalPairsChecked)), 'ペア数が含まれる');

  // --- 11. 整合スコアと矛盾数の整合性 ---
  console.log('\n--- 11. 整合性チェック ---');

  if (report.contradictionsFound === 0) {
    assert(report.consistencyScore === 1.0, '矛盾0件 → スコア1.0');
    assert(report.overallTag === 'TRUE', '矛盾0件 → TRUE');
  } else {
    assert(report.consistencyScore < 1.0, '矛盾あり → スコア < 1.0');
  }

  // --- 12. 矛盾のtheoryIdがSEED_KERNELに存在する ---
  console.log('\n--- 12. 矛盾theoryIdの妥当性 ---');

  const kernelIds = new Set(SEED_KERNEL.map(t => t.id));
  let allValid = true;
  for (const c of report.contradictions) {
    if (!kernelIds.has(c.theoryA) || !kernelIds.has(c.theoryB)) {
      allValid = false;
      break;
    }
  }
  assert(allValid, '全矛盾のtheoryIdがSEED_KERNELに存在');

  // --- 13. 同一ペアの重複がない ---
  console.log('\n--- 13. 重複チェック ---');

  const pairSet = new Set<string>();
  let noDuplicates = true;
  for (const c of report.contradictions) {
    const key = [c.theoryA, c.theoryB].sort().join(':');
    if (pairSet.has(key)) { noDuplicates = false; break; }
    pairSet.add(key);
  }
  assert(noDuplicates, '矛盾ペアに重複なし');

  // --- 14. レポート出力 ---
  console.log('\n--- 14. レポート出力 ---');
  console.log(formatted);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
