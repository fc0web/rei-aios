/**
 * test-discovery-now.ts — AxiomDiscovery を今すぐ1回実行
 * 実行: npx tsx test/manual/test-discovery-now.ts
 */
import * as path from 'path';
import * as fs   from 'fs';
import { AxiomProposalQueue }  from '../../src/axiom-os/axiom-proposal-queue';
import { AxiomDiscoveryAgent } from '../../src/axiom-os/axiom-discovery-agent';

async function main() {
  const dataDir = path.join(process.cwd(), 'data', 'discovery');
  fs.mkdirSync(dataDir, { recursive: true });

  const queue = new AxiomProposalQueue({
    persistPath: path.join(dataDir, 'proposal-queue.json'),
    maxSize: 500,
  });

  const agent = new AxiomDiscoveryAgent(queue, {
    intervalMs: 0,          // 今すぐ実行
    maxPerRun: 5,           // 最初は5件だけ
    minScore: 0.3,          // スコア閾値を少し下げて取得しやすく
    enabledSources: ['arxiv', 'wikipedia'],
  });

  console.log('=== AxiomDiscovery 手動実行 ===');
  console.log('arXiv と Wikipedia を探索中...\n');

  const report = await agent.discover(true);

  console.log(`探索完了:`);
  console.log(`  取得件数 : ${report.found}`);
  console.log(`  キュー追加: ${report.queued}`);
  console.log(`  スキップ  : ${report.skipped}`);
  console.log(`\n保存先: ${path.join(dataDir, 'proposal-queue.json')}`);

  // キューの中身を表示
  const queueStats = queue.stats();
  console.log(`\n=== キュー統計 ===`);
  console.log(`合計: ${queueStats.total}件`);
  console.log(`審査待ち: ${queueStats.byStatus.PENDING}件`);

  if (queueStats.total > 0) {
    console.log('\n=== 発見内容プレビュー（最初の3件）===');
    const exportPath = path.join(dataDir, 'preview-export.json');
    queue.exportToFile(exportPath);
    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    const proposals = exported.proposals?.slice(0, 3) ?? [];
    for (const p of proposals) {
      console.log(`\n[${p.id}]`);
      console.log(`  タイトル  : ${p.sourceTitle}`);
      console.log(`  ソース    : ${p.source}`);
      console.log(`  スコア    : ${p.discoveryScore?.toFixed(2)}`);
      console.log(`  D-FUMT整合: ${p.dfumtAlignment?.alignmentScore?.toFixed(2)}`);
      console.log(`  七価値    : ${p.confidenceTag}`);
      console.log(`  URL       : ${p.sourceUrl}`);
    }
  }
}

main().catch(err => {
  console.error('Discovery実行エラー:', err.message);
  console.log('\n※ ネットワーク接続が必要です。接続を確認してください。');
  process.exit(1);
});
