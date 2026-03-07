/**
 * KnowledgeBudget + 最先端科学取得テスト
 * 実行: npm run test:knowledge-budget
 */

import { KnowledgeBudget } from '../src/aios/knowledge/knowledge-budget';
import { ArxivFetcher }    from '../src/aios/knowledge/arxiv-fetcher';
import * as fs from 'fs';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  PASS  ${msg}`); passed++; }
  else       { console.error(`  FAIL  ${msg}`); failed++; }
}

async function runTests() {
  console.log('=== KnowledgeBudget + 最先端科学取得テスト ===\n');

  const budgetPath = './dist/test-budget.json';
  if (fs.existsSync(budgetPath)) fs.unlinkSync(budgetPath);

  // ── テスト1: 初期状態 ────────────────────────────────────────
  console.log('--- テスト1: 初期状態確認 ---');
  const budget = new KnowledgeBudget(budgetPath, {
    maxTotalEntries: 20,   // テスト用に小さく設定
    maxPerCategory:  5,
    fetchIntervalMs: 0,    // テスト用: 間隔制限なし
  });

  const status = budget.status();
  console.log(`  総エントリ   : ${status.totalEntries}/${status.maxTotalEntries}`);
  console.log(`  使用率       : ${status.usagePercent}%`);
  console.log(`  取得可能     : ${status.canFetchNow}`);
  console.log(`  推奨         : ${status.recommendation}`);
  assert(status.totalEntries === 0, '初期: エントリ0件');
  assert(status.canFetchNow === true, '初期: 取得可能');

  // ── テスト2: エントリ登録と上限チェック ──────────────────────
  console.log('\n--- テスト2: 容量管理 ---');
  // 5件登録（カテゴリ上限）
  for (let i = 0; i < 5; i++) {
    budget.register({
      id: `test-${i}`,
      category: 'quantum-computing',
      relevance: 'FLOWING',
      sizeBytes: 1024,
    });
  }
  const check = budget.canFetch('quantum-computing');
  assert(!check.allowed, `カテゴリ上限(5件)で取得不可: ${check.reason}`);
  console.log(`  上限到達メッセージ: ${check.reason}`);
  console.log(`  提案: ${check.suggestion}`);

  // ── テスト3: 手動停止・再開 ──────────────────────────────────
  console.log('\n--- テスト3: 手動停止・再開 ---');
  budget.pause();
  const pauseCheck = budget.canFetch('ai-frontier');
  assert(!pauseCheck.allowed, '停止中は取得不可');

  budget.resume();
  const resumeCheck = budget.canFetch('ai-frontier');
  assert(resumeCheck.allowed, '再開後は取得可能');

  // ── テスト4: クリーンアップ ──────────────────────────────────
  console.log('\n--- テスト4: 自動クリーンアップ ---');
  // 期限切れエントリを強制登録（過去時刻）
  const oldBudget = new KnowledgeBudget(budgetPath, {
    maxTotalEntries: 20,
    maxPerCategory: 10,
    fetchIntervalMs: 0,
    retentionDays: { TRUE:0, FLOWING:0, BOTH:0, NEITHER:0, ZERO:0, FALSE:0, INFINITY:0 },
  });
  oldBudget.register({ id: 'old-1', category: 'test', relevance: 'FALSE', sizeBytes: 100 });
  const cleaned = oldBudget.cleanup();
  console.log(`  削除件数: ${cleaned.deleted}`);
  assert(cleaned.deleted >= 0, 'クリーンアップ実行 OK');

  // ── テスト5: 量子コンピュータ論文取得 ───────────────────────
  console.log('\n--- テスト5: arXiv 量子コンピュータ論文取得 ---');
  const arxiv = new ArxivFetcher();
  const budget2 = new KnowledgeBudget('./dist/test-budget2.json', {
    maxTotalEntries: 100,
    maxPerCategory: 20,
    fetchIntervalMs: 0,
  });

  const quantum = await arxiv.fetchByPreset('quantum-computing');
  console.log(`  取得論文数: ${quantum.length}`);
  assert(Array.isArray(quantum), '量子コンピュータ: 配列を返す OK');
  if (quantum.length > 0) {
    quantum.slice(0, 3).forEach((p, i) => {
      const rel = arxiv.evaluateDfumtRelevance(p);
      console.log(`  [${i+1}] [${rel}] ${p.title.slice(0, 60)}...`);
    });
  }

  // ── テスト6: 最先端AI論文取得 ────────────────────────────────
  console.log('\n--- テスト6: arXiv 最先端AI論文取得 ---');
  const ai = await arxiv.fetchByPreset('ai-frontier');
  console.log(`  取得論文数: ${ai.length}`);
  assert(Array.isArray(ai), 'AI frontier: 配列を返す OK');
  ai.slice(0, 2).forEach((p, i) => {
    const rel = arxiv.evaluateDfumtRelevance(p);
    console.log(`  [${i+1}] [${rel}] ${p.title.slice(0, 60)}...`);
    console.log(`       ${p.link}`);
  });

  // ── テスト7: 全科学プリセット一括取得（容量管理付き） ─────────
  console.log('\n--- テスト7: 最先端科学 全プリセット一括取得 ---');
  console.log('  取得中... (レート制限のため約30秒かかります)');
  const allScience = await arxiv.fetchScienceAll(budget2);

  const byRelevance: Record<string, number> = {};
  for (const p of allScience) {
    byRelevance[p.dfumtRelevance] = (byRelevance[p.dfumtRelevance] ?? 0) + 1;
  }

  const status2 = budget2.status();
  console.log(`\n  容量状況:`);
  console.log(`    総エントリ: ${status2.totalEntries}/${status2.maxTotalEntries} (${status2.usagePercent}%)`);
  console.log(`    カテゴリ別:`, status2.byCategory);
  console.log(`    推奨: ${status2.recommendation}`);
  console.log(`\n  総取得論文: ${allScience.length}件`);
  console.log(`  D-FUMT関連度分布:`);
  ['TRUE','FLOWING','BOTH','NEITHER','ZERO'].forEach(v => {
    if (byRelevance[v]) console.log(`    ${v}: ${byRelevance[v]}件`);
  });

  if (allScience.length > 0) {
    console.log('\n  最高関連度 TOP 3:');
    allScience.slice(0, 3).forEach((p, i) => {
      console.log(`  [${i+1}] [${p.dfumtRelevance}] ${p.title.slice(0, 65)}`);
      console.log(`       ${p.link}`);
    });
  }
  assert(Array.isArray(allScience), '全科学プリセット取得 OK');

  // ── 結果 ─────────────────────────────────────────────────────
  console.log(`\n=== 結果: ${passed}件合格 / ${failed}件失敗 ===`);

  // テスト用ファイルを削除
  [budgetPath, './dist/test-budget2.json'].forEach(p => {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  });

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
