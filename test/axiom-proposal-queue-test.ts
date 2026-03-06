/**
 * AxiomProposalQueue + AxiomDiscoveryAgent テスト
 */

import {
  AxiomProposalQueue,
  type AxiomProposal,
  type ProposalStatus,
  type DiscoverySource,
  type QueueStats,
} from '../src/axiom-os/axiom-proposal-queue';
import {
  AxiomDiscoveryAgent,
  DEFAULT_CONFIG,
  type DiscoveryConfig,
  type DiscoveryReport,
} from '../src/axiom-os/axiom-discovery-agent';
import { type SeedTheory } from '../src/axiom-os/seed-kernel';

async function runTests() {
  console.log('=== AxiomProposalQueue + DiscoveryAgent Tests ===\n');
  let passed = 0; let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (cond) { console.log(`  \u2713 ${msg}`); passed++; }
    else { console.log(`  \u2717 ${msg}`); failed++; }
  };

  // ══════════════════════════════════════════════════════════════
  // 1. AxiomProposalQueue — 基本構築
  // ══════════════════════════════════════════════════════════════
  console.log('--- 1. ProposalQueue: 基本構築 ---');

  const queue = new AxiomProposalQueue();
  assert(queue.getPending().length === 0, '初期状態: PENDINGなし');
  assert(queue.getApproved().length === 0, '初期状態: APPROVEDなし');
  const s0 = queue.stats();
  assert(s0.total === 0, '初期統計: total=0');

  // ══════════════════════════════════════════════════════════════
  // 2. enqueue — 候補追加
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 2. enqueue: 候補追加 ---');

  const seed1: SeedTheory = { id: 'test-1', axiom: 'テスト公理A', category: 'logic', keywords: ['catuskoti', '四値論理'] };
  const p1 = queue.enqueue({
    seed: seed1,
    source: 'arxiv',
    sourceUrl: 'https://example.com/paper1',
    sourceTitle: 'Test Paper 1',
    discoveryScore: 0.85,
    dfumtAlignment: {
      relatedTheoryIds: ['dfumt-catuskoti'],
      alignmentScore: 0.7,
      alignmentNote: '関連理論: dfumt-catuskoti',
      isContradicting: false,
    },
  });

  assert(p1.id.startsWith('proposal-'), 'IDがproposal-で始まる');
  assert(p1.status === 'PENDING', 'ステータスがPENDING');
  assert(p1.seed.axiom === 'テスト公理A', 'seedのaxiomが正しい');
  assert(p1.source === 'arxiv', 'sourceがarxiv');
  assert(p1.discoveryScore === 0.85, 'discoveryScoreが0.85');
  assert(p1.confidenceTag === 'TRUE', 'スコア0.85+alignment0.7=TRUE');
  assert(p1.expiresAt > Date.now(), '期限が未来');
  assert(queue.getPending().length === 1, 'PENDING 1件');

  // ══════════════════════════════════════════════════════════════
  // 3. 複数追加
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 3. 複数追加 ---');

  const p2 = queue.enqueue({
    seed: { id: 'test-2', axiom: 'テスト公理B', category: 'consciousness', keywords: ['IIT', 'phi'] },
    source: 'wikipedia',
    discoveryScore: 0.55,
    dfumtAlignment: { relatedTheoryIds: [], alignmentScore: 0.45, alignmentNote: 'テスト', isContradicting: false },
  });
  assert(p2.confidenceTag === 'FLOWING', 'スコア0.55+alignment0.45=FLOWING');

  const p3 = queue.enqueue({
    seed: { id: 'test-3', axiom: 'テスト公理C', category: 'logic', keywords: [] },
    source: 'github',
    discoveryScore: 0.2,
    dfumtAlignment: { relatedTheoryIds: [], alignmentScore: 0.1, alignmentNote: 'テスト', isContradicting: false },
  });
  assert(p3.confidenceTag === 'NEITHER', 'alignment<0.2=NEITHER');

  const p4 = queue.enqueue({
    seed: { id: 'test-4', axiom: 'テスト公理D', category: 'logic', keywords: [] },
    source: 'manual',
    discoveryScore: 0.6,
    dfumtAlignment: { relatedTheoryIds: [], alignmentScore: 0.5, alignmentNote: 'テスト', isContradicting: true },
  });
  assert(p4.confidenceTag === 'BOTH', '矛盾あり=BOTH');

  assert(queue.getPending().length === 4, 'PENDING 4件');

  // ══════════════════════════════════════════════════════════════
  // 4. approve — 承認
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 4. approve: 承認 ---');

  const approved = queue.approve(p1.id, '良い公理');
  assert(approved !== null, '承認が成功');
  assert(approved!.status === 'APPROVED', 'ステータスがAPPROVED');
  assert(approved!.reviewNote === '良い公理', 'レビューノートが正しい');
  assert(approved!.reviewedAt! > 0, 'reviewedAtが設定');
  assert(queue.getApproved().length === 1, 'APPROVED 1件');
  assert(queue.getPending().length === 3, 'PENDING 3件');

  // 無効な承認
  const invalidApprove = queue.approve('nonexistent');
  assert(invalidApprove === null, '存在しないIDの承認はnull');

  // ══════════════════════════════════════════════════════════════
  // 5. reject — 却下
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 5. reject: 却下 ---');

  const rejected = queue.reject(p3.id, 'スコア不足');
  assert(rejected !== null, '却下が成功');
  assert(rejected!.status === 'REJECTED', 'ステータスがREJECTED');
  assert(rejected!.reviewNote === 'スコア不足', '却下理由が正しい');

  // 承認済みは却下不可
  const rejectApproved = queue.reject(p1.id, 'テスト');
  assert(rejectApproved === null, '承認済みは却下不可');

  // ══════════════════════════════════════════════════════════════
  // 6. requestRevision — 修正依頼
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 6. requestRevision: 修正依頼 ---');

  const revision = queue.requestRevision(p2.id, 'キーワードを追加してください');
  assert(revision !== null, '修正依頼が成功');
  assert(revision!.status === 'NEEDS_REVISION', 'ステータスがNEEDS_REVISION');
  assert(revision!.revisionRequest === 'キーワードを追加してください', '修正依頼内容が正しい');

  // ══════════════════════════════════════════════════════════════
  // 7. revise — 修正して再提出
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 7. revise: 修正して再提出 ---');

  const revised = queue.revise(p2.id, { keywords: ['IIT', 'phi', 'consciousness'] });
  assert(revised !== null, '修正が成功');
  assert(revised!.status === 'PENDING', '修正後はPENDINGに戻る');
  assert(revised!.seed.keywords.length === 3, 'キーワードが更新');
  assert(revised!.revisionRequest === undefined, '修正依頼がクリア');

  // NEEDS_REVISION以外は修正不可
  const invalidRevise = queue.revise(p1.id, { axiom: '変更' });
  assert(invalidRevise === null, 'APPROVED状態は修正不可');

  // ══════════════════════════════════════════════════════════════
  // 8. NEEDS_REVISIONからの承認
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 8. NEEDS_REVISIONからの承認 ---');

  queue.requestRevision(p2.id, '再度修正');
  const approveRevision = queue.approve(p2.id, 'OK');
  assert(approveRevision !== null, 'NEEDS_REVISIONから承認可能');
  assert(approveRevision!.status === 'APPROVED', 'ステータスがAPPROVED');

  // ══════════════════════════════════════════════════════════════
  // 9. getByStatus / getById
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 9. getByStatus / getById ---');

  assert(queue.getByStatus('APPROVED').length === 2, 'APPROVED 2件');
  assert(queue.getByStatus('REJECTED').length === 1, 'REJECTED 1件');
  const found = queue.getById(p4.id);
  assert(found !== undefined, 'getByIdで取得可能');
  assert(found!.seed.axiom === 'テスト公理D', '正しいproposalが取得');
  const notFound = queue.getById('nonexistent');
  assert(notFound === undefined, '存在しないIDはundefined');

  // ══════════════════════════════════════════════════════════════
  // 10. exportApprovedSeeds
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 10. exportApprovedSeeds ---');

  const seeds = queue.exportApprovedSeeds();
  assert(seeds.length === 2, '承認済みseedが2件');
  assert(seeds.every(s => s.axiom && s.category), '全seedにaxiomとcategoryがある');

  // ══════════════════════════════════════════════════════════════
  // 11. stats
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 11. stats ---');

  const stats = queue.stats();
  assert(stats.total === 4, '総計4件');
  assert(stats.byStatus.APPROVED === 2, 'APPROVED 2件');
  assert(stats.byStatus.REJECTED === 1, 'REJECTED 1件');
  assert(stats.bySource.arxiv === 1, 'arxiv 1件');
  assert(stats.bySource.wikipedia === 1, 'wikipedia 1件');
  assert(stats.bySource.github === 1, 'github 1件');
  assert(stats.bySource.manual === 1, 'manual 1件');
  assert(stats.avgAlignmentScore > 0, '平均alignmentが正');

  // ══════════════════════════════════════════════════════════════
  // 12. scoreToLogic — 全パターン
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 12. scoreToLogic: 全パターン ---');

  const queueLogic = new AxiomProposalQueue();

  // INFINITY: alignment > 0.95
  const pInf = queueLogic.enqueue({
    seed: { id: 'inf', axiom: 'test', category: 'test', keywords: [] },
    source: 'manual', discoveryScore: 0.9,
    dfumtAlignment: { relatedTheoryIds: [], alignmentScore: 0.96, alignmentNote: '', isContradicting: false },
  });
  assert(pInf.confidenceTag === 'INFINITY', 'alignment>0.95=INFINITY');

  // FALSE: score < 0.3
  const pFalse = queueLogic.enqueue({
    seed: { id: 'false', axiom: 'test', category: 'test', keywords: [] },
    source: 'manual', discoveryScore: 0.25,
    dfumtAlignment: { relatedTheoryIds: [], alignmentScore: 0.3, alignmentNote: '', isContradicting: false },
  });
  assert(pFalse.confidenceTag === 'FALSE', 'score<0.3=FALSE');

  // FLOWING (default fallback)
  const pFlow = queueLogic.enqueue({
    seed: { id: 'flow', axiom: 'test', category: 'test', keywords: [] },
    source: 'manual', discoveryScore: 0.5,
    dfumtAlignment: { relatedTheoryIds: [], alignmentScore: 0.35, alignmentNote: '', isContradicting: false },
  });
  assert(pFlow.confidenceTag === 'FLOWING', 'デフォルト=FLOWING');

  // ══════════════════════════════════════════════════════════════
  // 13. DiscoveryAgent — 基本構築
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 13. DiscoveryAgent: 基本構築 ---');

  const agentQueue = new AxiomProposalQueue();
  const agent = new AxiomDiscoveryAgent(agentQueue);
  assert(agent.getNextRunIn() === 0, '初回は即座に実行可能');

  // ══════════════════════════════════════════════════════════════
  // 14. DiscoveryAgent — DEFAULT_CONFIG
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 14. DEFAULT_CONFIG ---');

  assert(DEFAULT_CONFIG.minScore === 0.4, 'minScore=0.4');
  assert(DEFAULT_CONFIG.maxPerRun === 10, 'maxPerRun=10');
  assert(DEFAULT_CONFIG.intervalMs === 86400000, 'intervalMs=24時間');
  assert(DEFAULT_CONFIG.enabledSources.includes('arxiv'), 'arxivが有効');
  assert(DEFAULT_CONFIG.enabledSources.includes('wikipedia'), 'wikipediaが有効');
  assert(DEFAULT_CONFIG.enabledSources.includes('github'), 'githubが有効');
  assert(DEFAULT_CONFIG.dfumtKeywords.length > 20, 'キーワード20以上');
  assert(DEFAULT_CONFIG.dfumtKeywords.includes('catuskoti'), 'catuskotiキーワード');
  assert(DEFAULT_CONFIG.dfumtKeywords.includes('IIT'), 'IITキーワード');

  // ══════════════════════════════════════════════════════════════
  // 15. DiscoveryAgent — 間隔制御
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 15. 間隔制御 ---');

  // ソースなしで実行（APIコールなし）
  const agent2 = new AxiomDiscoveryAgent(new AxiomProposalQueue(), {
    enabledSources: [], // ソースなし→候補0件
  });
  const report1 = await agent2.discover(true);
  assert(report1.found === 0, 'ソースなし: found=0');
  assert(report1.queued === 0, 'ソースなし: queued=0');
  assert(report1.duration >= 0, 'durationが計算される');

  // 間隔内の再実行は空レポート
  const report2 = await agent2.discover(false);
  assert(report2.found === 0, '間隔内: 空レポート');
  assert(report2.queued === 0, '間隔内: queued=0');

  // ══════════════════════════════════════════════════════════════
  // 16. DiscoveryAgent — getNextRunIn
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 16. getNextRunIn ---');

  assert(agent2.getNextRunIn() > 0, '実行後は待ち時間が正');
  assert(agent2.getNextRunIn() <= DEFAULT_CONFIG.intervalMs, '待ち時間がintervalMs以内');

  // ══════════════════════════════════════════════════════════════
  // 17. DiscoveryAgent — カスタム設定
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 17. カスタム設定 ---');

  const customAgent = new AxiomDiscoveryAgent(new AxiomProposalQueue(), {
    minScore: 0.8,
    maxPerRun: 3,
    intervalMs: 1000,
    enabledSources: [],
    dfumtKeywords: ['test'],
  });
  const customReport = await customAgent.discover(true);
  assert(customReport.runAt > 0, 'カスタム設定で実行可能');

  // ══════════════════════════════════════════════════════════════
  // 18. DiscoveryAgent — 重複実行防止
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 18. 重複実行防止 ---');

  // forceRunで即時に2回目を実行
  const shortIntervalAgent = new AxiomDiscoveryAgent(new AxiomProposalQueue(), {
    enabledSources: [],
    intervalMs: 100,
  });
  await shortIntervalAgent.discover(true);
  // 100ms後に再実行（間隔短い設定）
  await new Promise(r => setTimeout(r, 150));
  const thirdRun = await shortIntervalAgent.discover(false);
  assert(thirdRun.duration >= 0, '間隔経過後に再実行可能');

  // ══════════════════════════════════════════════════════════════
  // 19. ProposalQueue — 期限切れ
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 19. 期限切れ ---');

  const expQueue = new AxiomProposalQueue();
  const expP = expQueue.enqueue({
    seed: { id: 'exp', axiom: 'expired test', category: 'test', keywords: [] },
    source: 'manual', discoveryScore: 0.5,
    dfumtAlignment: { relatedTheoryIds: [], alignmentScore: 0.3, alignmentNote: '', isContradicting: false },
  });
  // 手動で期限切れに設定
  (expP as any).expiresAt = Date.now() - 1000;
  const pending = expQueue.getPending();
  assert(pending.length === 0, '期限切れはPENDINGに含まれない');
  assert(expP.status === 'EXPIRED', '期限切れステータスがEXPIRED');

  // ══════════════════════════════════════════════════════════════
  // 20. DiscoveryReport 型
  // ══════════════════════════════════════════════════════════════
  console.log('\n--- 20. DiscoveryReport構造 ---');

  const emptyAgent = new AxiomDiscoveryAgent(new AxiomProposalQueue(), { enabledSources: [] });
  const emptyReport = await emptyAgent.discover(true);
  assert(typeof emptyReport.runAt === 'number', 'runAtがnumber');
  assert(typeof emptyReport.duration === 'number', 'durationがnumber');
  assert(typeof emptyReport.found === 'number', 'foundがnumber');
  assert(typeof emptyReport.queued === 'number', 'queuedがnumber');
  assert(typeof emptyReport.skipped === 'number', 'skippedがnumber');
  assert(Array.isArray(emptyReport.details), 'detailsが配列');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
