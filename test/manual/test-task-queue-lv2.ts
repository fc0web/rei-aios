/**
 * test-task-queue-lv2.ts — ReiTaskQueue Lv2 自動実行テスト
 * 実行: npx tsx test/manual/test-task-queue-lv2.ts
 */
import { ReiTaskQueue } from '../../src/axiom-os/rei-task-queue';

async function main() {
  console.log('=== ReiTaskQueue Lv2: 自動実行テスト ===\n');

  const queue = ReiTaskQueue.getInstance();

  // 3つのタスクを登録
  for (let i = 1; i <= 3; i++) {
    queue.enqueue({
      name: `自動タスク-${i}`,
      category: 'test',
      priority: i,
      timeoutMs: 5000,
      maxRetries: 0,
      payload: { index: i },
      fn: async () => {
        await new Promise(r => setTimeout(r, 100 * i));
        return `タスク${i}完了`;
      },
    });
  }

  console.log(`登録完了: ${queue.getPending().length}件`);
  console.log('自動実行開始（3秒後に確認）...\n');

  // 自動実行開始
  queue.startAutoTick(500); // 0.5秒間隔

  // 3秒後に確認
  await new Promise(r => setTimeout(r, 3000));
  queue.stopAutoTick();

  const stats = queue.getStats();
  console.log('=== 実行結果 ===');
  console.log(`合計: ${stats.total}件`);
  console.log(`状態別:`, stats.byState);
  console.log(`七価値別:`, stats.byLogicValue);
  console.log(`平均実行時間: ${stats.avgRunMs.toFixed(1)}ms`);

  const history = queue.getHistory(3);
  console.log('\n=== 実行履歴 ===');
  for (const t of history) {
    console.log(`  [${t.logicValue}] ${t.name}: ${JSON.stringify(t.result)}`);
  }

  // シングルトンをリセット（テスト後の片付け）
  ReiTaskQueue._instance = null;
}

main().catch(console.error);
