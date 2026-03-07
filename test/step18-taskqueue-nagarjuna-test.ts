import { ReiTaskQueue } from '../src/axiom-os/rei-task-queue';
import { NagarjunaProof } from '../src/axiom-os/nagarjuna-proof';

// ── ReiTaskQueue テスト ───────────────────────────────────
let passed = 0; let failed = 0;
function ok(name: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else       { console.log(`  ✗ ${name}`); failed++; }
}

console.log('\n=== ReiTaskQueue テスト ===');

// T-1: エンキュー
const q = new ReiTaskQueue({ strategy: 'PRIORITY' });
const t1 = q.enqueue({ name: 'test1', category: 'logic', priority: 5, timeoutMs: 1000, maxRetries: 0, payload: null, fn: async () => 'ok' });
ok('エンキュー後 READY 状態', t1.state === 'READY');
ok('エンキュー後 NEITHER 値', t1.logicValue === 'NEITHER');
ok('待機キュー1件', q.getPending().length === 1);

// T-2: 優先度ソート
const t2 = q.enqueue({ name: 'test2-high', category: 'logic', priority: 9, timeoutMs: 1000, maxRetries: 0, payload: null, fn: async () => 'high' });
ok('優先度高タスクが先頭', q.getPending()[0].name === 'test2-high');

// T-3: tick 実行
async function runTaskTests() {
  console.log('\n=== tick 実行テスト ===');
  const q2 = new ReiTaskQueue({ strategy: 'FIFO', maxConcurrent: 2 });
  let result1 = '';
  let result2 = '';

  q2.enqueue({ name: 'task-A', category: 'test', priority: 5, timeoutMs: 5000, maxRetries: 0, payload: null, fn: async () => { result1 = 'done-A'; return 'done-A'; } });
  q2.enqueue({ name: 'task-B', category: 'test', priority: 5, timeoutMs: 5000, maxRetries: 0, payload: null, fn: async () => { result2 = 'done-B'; return 'done-B'; } });
  await q2.tick();

  ok('task-A 完了', result1 === 'done-A');
  ok('task-B 完了', result2 === 'done-B');

  const stats = q2.getStats();
  ok('統計: DONE が2件', (stats.byState['DONE'] ?? 0) === 2);
  ok('統計: FALSE が2件（完了=FALSE）', (stats.byLogicValue['FALSE'] ?? 0) === 2);

  // T-4: エラーハンドリング
  console.log('\n=== エラー・タイムアウトテスト ===');
  const q3 = new ReiTaskQueue({ strategy: 'FIFO' });
  q3.enqueue({ name: 'error-task', category: 'test', priority: 5, timeoutMs: 5000, maxRetries: 0, payload: null, fn: async () => { throw new Error('intentional'); } });
  await q3.tick();
  const hist = q3.getHistory(1)[0];
  ok('エラータスク: state=ERROR', hist?.state === 'ERROR');
  ok('エラータスク: logicValue=BOTH', hist?.logicValue === 'BOTH');

  // T-5: NagarjunaProof テスト
  console.log('\n=== 龍樹の中論 形式証明テスト ===');
  const prover = new NagarjunaProof();
  const result = await prover.prove();

  ok('証明完了', result.isProven);
  ok('結論は NEITHER', result.conclusion === 'NEITHER');
  ok('ステップ数 5', result.steps.length === 5);
  ok('自生の否定: FALSE', result.steps[0].logicValue === 'FALSE');
  ok('他生の否定: FALSE', result.steps[1].logicValue === 'FALSE');
  ok('共生の否定: NEITHER', result.steps[2].logicValue === 'NEITHER');
  ok('無因生の否定: FALSE', result.steps[3].logicValue === 'FALSE');
  ok('空の導出: NEITHER', result.steps[4].logicValue === 'NEITHER');
  ok('逆引きパスあり', result.backtrace.length > 0);
  ok('自己ループ検出（自生の循環参照を正しく検出）', result.narcissusCheck === 'LOOP_DETECTED');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
}

runTaskTests().catch(console.error);
