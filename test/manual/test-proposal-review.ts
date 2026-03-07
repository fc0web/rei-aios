/**
 * test-proposal-review.ts — proposal-queue の審査対話スクリプト
 * 実行: npx tsx test/manual/test-proposal-review.ts
 */
import * as path from 'path';
import * as fs   from 'fs';
import { AxiomProposalQueue } from '../../src/axiom-os/axiom-proposal-queue';

function main() {
  const dataDir  = path.join(process.cwd(), 'data', 'discovery');
  const queuePath = path.join(dataDir, 'proposal-queue.json');

  if (!fs.existsSync(queuePath)) {
    console.log('proposal-queue.json が見つかりません。');
    console.log('先に test-discovery-now.ts を実行してください。');
    return;
  }

  const queue = new AxiomProposalQueue({
    persistPath: queuePath,
    maxSize: 500,
  });

  const queueStats = queue.stats();
  console.log('═══ proposal-queue 審査レポート ═══');
  console.log(`合計     : ${queueStats.total}件`);
  console.log(`審査待ち : ${queueStats.byStatus.PENDING}件`);
  console.log(`承認済み : ${queueStats.byStatus.APPROVED}件`);
  console.log(`却下済み : ${queueStats.byStatus.REJECTED}件`);
  console.log();

  // 審査待ちを全件表示
  const exportPath = path.join(dataDir, 'review-export.json');
  queue.exportToFile(exportPath);
  const exported = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
  const pending = (exported.proposals ?? []).filter((p: any) => p.status === 'PENDING');

  if (pending.length === 0) {
    console.log('審査待ちの提案はありません。');
    return;
  }

  // カテゴリ別に整理
  const byCategory: Record<string, any[]> = {};
  for (const p of pending) {
    const cat = p.dfumtAlignment?.alignmentNote || p.seed?.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }

  console.log('═══ 審査待ち一覧（カテゴリ別） ═══\n');
  for (const [cat, proposals] of Object.entries(byCategory)) {
    console.log(`【${cat}】 ${proposals.length}件`);
    for (const p of proposals) {
      const score = (p.discoveryScore ?? 0).toFixed(2);
      const tag   = p.confidenceTag ?? '?';
      console.log(`  [${tag}] ${p.sourceTitle}`);
      console.log(`       スコア: ${score}  ソース: ${p.source}  URL: ${p.sourceUrl}`);
    }
    console.log();
  }

  // 承認候補（スコア0.6以上）を強調
  const highScore = pending.filter((p: any) => (p.discoveryScore ?? 0) >= 0.6);
  if (highScore.length > 0) {
    console.log('═══ ★ 承認候補（D-FUMT整合スコア 0.6以上） ★ ═══');
    for (const p of highScore) {
      console.log(`  ID: ${p.id}`);
      console.log(`  タイトル: ${p.sourceTitle}`);
      console.log(`  スコア: ${(p.discoveryScore ?? 0).toFixed(2)} / 七価値: ${p.confidenceTag}`);
      console.log(`  キーワード: ${p.seed?.keywords?.join(', ')}`);
      console.log(`  公理: ${p.seed?.axiom?.slice(0, 120)}...`);
      console.log();
    }
  }

  console.log('─────────────────────────────────────────');
  console.log('次のステップ: 上記リストを Claude 先生に渡して審査対話を行う');
  console.log(`エクスポート先: ${exportPath}`);
}

main();
