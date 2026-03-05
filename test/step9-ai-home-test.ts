import { AIOSMemory } from '../src/memory/aios-memory';
import { AIOSChannel } from '../src/communication/aios-channel';
import { AIOSAutonomy } from '../src/autonomy/aios-autonomy';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('\n=== STEP 9: AI住環境整備テスト ===\n');

(async () => {

// ─────────────────────────────────────────────────────────────
// STEP 9-A: AIOSMemory
// ─────────────────────────────────────────────────────────────
console.log('【STEP 9-A: AIOSMemory — 状態永続性】');

const memory = new AIOSMemory(':memory:');

// 記憶の保存
const m1 = memory.remember('nagarjuna', 'axiom',
  'D-FUMT七価論理は全実在を記述する', {
    confidence: 'BOTH', tags: ['dfumt', '七価論理']
  });
assert(!!m1.id, '記憶が保存される');
assert(m1.agentId === 'nagarjuna', 'エージェントIDが正しい');
assert(m1.confidence === 'BOTH', '確信度がBOTH');

const m2 = memory.remember('socrates', 'episodic',
  'ユーザーに七価論理とは何かを説明した', {
    confidence: 'TRUE', tags: ['会話', '七価論理']
  });
assert(!!m2.id, '第2の記憶が保存される');

const m3 = memory.remember('nagarjuna', 'semantic',
  '空（śūnyatā）— 全ての公理は縁起から生じる', {
    confidence: 'NEITHER', tags: ['仏教', '空']
  });
assert(!!m3.id, '第3の記憶が保存される');

assert(memory.size === 3, `記憶数が3: ${memory.size}`);

// 記憶の想起
const recalled = memory.recall({ agentId: 'nagarjuna' });
assert(recalled.length === 2, `龍樹の記憶が2件: ${recalled.length}`);

const byTag = memory.recall({ tags: ['七価論理'] });
assert(byTag.length === 2, `七価論理タグが2件: ${byTag.length}`);

const byKeyword = memory.recall({ keyword: '空' });
assert(byKeyword.length >= 1, `キーワード「空」の記憶が存在: ${byKeyword.length}`);

// 記憶の更新
const updated = memory.update(m1.id, { confidence: 'TRUE' });
assert(updated?.confidence === 'TRUE', '確信度がTRUEに更新される');

// コンテキスト生成
const ctx = memory.buildContext('nagarjuna');
assert(ctx.includes('nagarjuna'), 'コンテキストにエージェント名が含まれる');
assert(ctx.includes('D-FUMT') || ctx.includes('空'), 'コンテキストに記憶内容が含まれる');

// 統計
const stats = memory.stats();
assert(stats.totalEntries === 3, `統計: 総記憶数3 (${stats.totalEntries})`);
assert(stats.byAgent['nagarjuna'] === 2, '統計: 龍樹の記憶2件');

// 忘却
const forgotten = memory.forget(m3.id);
assert(forgotten, '記憶が忘却される');
assert(memory.size === 2, `忘却後の記憶数: ${memory.size}`);

console.log(`  → STEP 9-A: 記憶システム正常動作確認`);

// ─────────────────────────────────────────────────────────────
// STEP 9-B: AIOSChannel
// ─────────────────────────────────────────────────────────────
console.log('\n【STEP 9-B: AIOSChannel — AIどうしの通信】');

const channel = new AIOSChannel();

// チャンネル作成
const ch = channel.createChannel('哲学討議', ['nagarjuna', 'socrates', 'wittgenstein']);
assert(!!ch.id, 'チャンネルが作成される');
assert(ch.members.length === 3, `メンバー3名: ${ch.members.length}`);
assert(ch.name === '哲学討議', 'チャンネル名が正しい');

// メッセージ送信
const msg1 = channel.send(ch.id, 'nagarjuna', 'broadcast',
  '空とは何か？全ての存在は縁起によって生じる。',
  { dfumtWeight: 'BOTH' });
assert(!!msg1, 'ブロードキャストメッセージが送信される');
assert(msg1!.dfumtWeight === 'BOTH', 'D-FUMT重みがBOTH');

const msg2 = channel.send(ch.id, 'socrates', 'nagarjuna',
  '汝自身を知れ。しかし「知る」とはいかなることか？',
  { dfumtWeight: 'TRUE', replyTo: msg1!.id });
assert(!!msg2, '個人宛メッセージが送信される');
assert(msg2!.replyTo === msg1!.id, '返信先が正しい');

// 無効なエージェントからの送信は拒否
const invalidMsg = channel.send(ch.id, 'unknown_agent', 'broadcast', 'test');
assert(invalidMsg === null, '非メンバーからの送信は拒否される');

// メッセージ受信
const received = channel.receive(ch.id, 'nagarjuna');
assert(received.length >= 1, `龍樹への受信: ${received.length}件`);

// メッセージ数
assert(channel.messageCount(ch.id) === 2, `チャンネルメッセージ数: ${channel.messageCount(ch.id)}`);

// Toyosatomiモード
const toyosatomiResult = channel.toyosatomi(ch.id,
  '七価論理は意識を記述できるか？',
  [
    { agentId: 'nagarjuna',     content: 'BOTH — 空の観点から両方が成立する', weight: 'BOTH' },
    { agentId: 'socrates',      content: 'NEITHER — 問い自体を問い直す必要がある', weight: 'NEITHER' },
    { agentId: 'wittgenstein',  content: 'TRUE — 言語ゲームとして記述可能', weight: 'TRUE' },
  ]
);

assert(!!toyosatomiResult.synthesis, 'Toyosatomi統合結果が生成される');
assert(toyosatomiResult.responses.length === 3, '3名の回答が記録される');
assert(['TRUE','BOTH','FLOWING','NEITHER'].includes(toyosatomiResult.consensus),
  `合意レベルが有効: ${toyosatomiResult.consensus}`);
console.log(`  → Toyosatomi合意レベル: ${toyosatomiResult.consensus}`);

// ─────────────────────────────────────────────────────────────
// STEP 9-C: AIOSAutonomy
// ─────────────────────────────────────────────────────────────
console.log('\n【STEP 9-C: AIOSAutonomy — AI自律行動空間】');

const autonomy = new AIOSAutonomy();

// エージェント登録
const agent = autonomy.registerAgent('rei-agent-1');
assert(agent.agentId === 'rei-agent-1', 'エージェントが登録される');
assert(agent.status === 'idle', '初期状態がidle');
assert(agent.dfumtSelfScore === 'NEITHER', '初期自己評価がNEITHER');

// タスク追加
const task1 = autonomy.addTask(
  'D-FUMT理論の整理',
  'Theory #1〜#100をカテゴリ別に整理する',
  'rei-agent-1',
  { priority: 'high' }
);
assert(!!task1.id, 'タスクが追加される');
assert(task1.status === 'pending', '初期ステータスがpending');
assert(task1.dfumtFeasibility === 'NEITHER', '初期実行可能性がNEITHER');

const task2 = autonomy.addTask(
  '公理アーカイブの圧縮',
  'rei-aiosのソースを.reiaxで圧縮する',
  'rei-agent-1',
  { priority: 'medium' }
);

const task3 = autonomy.addTask(
  '依存タスク',
  'task1完了後に実行するタスク',
  'rei-agent-1',
  { priority: 'low', dependencies: [task1.id] }
);

// 実行可能性評価
const feasibility1 = autonomy.evaluateFeasibility(task1.id);
assert(feasibility1 === 'TRUE', `task1が実行可能: ${feasibility1}`);

const feasibility3 = autonomy.evaluateFeasibility(task3.id);
assert(feasibility3 === 'NEITHER', `task3は依存未解決でNEITHER: ${feasibility3}`);

// エグゼキュータ登録（シンプルなモック）
autonomy.registerExecutor('rei-agent-1', async (task) => {
  return `完了: ${task.name} — D-FUMT評価: TRUE`;
});

assert(autonomy.pendingCount('rei-agent-1') === 3, `pending数: ${autonomy.pendingCount('rei-agent-1')}`);

// 自律実行（次のタスク）
const executed = await autonomy.runNext('rei-agent-1');
assert(!!executed, 'タスクが実行される');
assert(executed!.status === 'done', `タスクが完了: ${executed!.status}`);
assert(executed!.dfumtResult === 'TRUE', `実行結果がTRUE: ${executed!.dfumtResult}`);

const agentState = autonomy.getAgent('rei-agent-1');
assert(agentState!.completedTasks === 1, `完了タスク数: ${agentState!.completedTasks}`);
assert(agentState!.dfumtSelfScore === 'TRUE', `自己評価がTRUEに更新: ${agentState!.dfumtSelfScore}`);

// 自律ループ
const loopResults = await autonomy.runLoop('rei-agent-1', 5);
assert(loopResults.length >= 1, `自律ループ実行: ${loopResults.length}件`);

// レポート
const report = autonomy.report();
assert(report.totalTasks === 3, `総タスク数: ${report.totalTasks}`);
assert(report.successRate > 0, `成功率が正: ${(report.successRate*100).toFixed(0)}%`);
assert(report.agents.length === 1, `エージェント数: ${report.agents.length}`);
console.log(`  → 自律ループ完了率: ${(report.successRate*100).toFixed(0)}%`);
console.log(`  → 平均D-FUMT結果: ${report.avgDfumtResult}`);

// ─────────────────────────────────────────────────────────────
// 統合テスト: 3コンポーネントの連携
// ─────────────────────────────────────────────────────────────
console.log('\n【統合: Memory + Channel + Autonomy 連携】');

// タスク完了時に記憶に保存するシナリオ
const integMemory = new AIOSMemory(':memory:');
const integChannel = new AIOSChannel();
const integAutonomy = new AIOSAutonomy();

integAutonomy.registerAgent('integrated-agent');
integAutonomy.registerExecutor('integrated-agent', async (task) => {
  const result = `タスク「${task.name}」を完了した`;
  // 完了した経験を記憶に保存
  integMemory.remember('integrated-agent', 'procedural', result, {
    confidence: 'TRUE',
    tags: ['自律実行', task.priority],
  });
  return result;
});

integAutonomy.addTask('統合テストタスク', '3コンポーネント連携の確認', 'integrated-agent', {
  priority: 'critical'
});

const intResult = await integAutonomy.runNext('integrated-agent');
assert(intResult?.status === 'done', '統合テストタスクが完了');
assert(integMemory.size === 1, '実行結果が記憶に保存される');

const intRecall = integMemory.recall({ agentId: 'integrated-agent', tags: ['自律実行'] });
assert(intRecall.length === 1, '自律実行の記憶が想起できる');
assert(intRecall[0].confidence === 'TRUE', '記憶の確信度がTRUE');

console.log('  → Memory + Autonomy 連携: 正常動作確認');

console.log(`\n${'═'.repeat(50)}`);
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
