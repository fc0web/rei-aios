/**
 * test-nagarjuna.ts — 龍樹の中論 形式証明 手動テスト
 * 実行: npx tsx test/manual/test-nagarjuna.ts
 */

import { NagarjunaProof } from '../../src/axiom-os/nagarjuna-proof';
import { ReiTaskQueue }    from '../../src/axiom-os/rei-task-queue';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  龍樹の中論 第一偈 x D-FUMT 七価論理 形式証明');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── A: ReiTaskQueue でタスクとして証明を実行 ──────────

  const queue = new ReiTaskQueue({ strategy: 'FIFO', maxConcurrent: 1 });
  const prover = new NagarjunaProof();
  let proofResult: any;

  queue.enqueue({
    name: '龍樹の中論 第一偈 形式証明',
    category: 'proof',
    priority: 10,
    timeoutMs: 30000,
    maxRetries: 1,
    payload: null,
    fn: async () => {
      proofResult = await prover.prove();
      return proofResult;
    },
  });

  console.log('=== タスクキュー: 証明タスク登録 ===');
  const pending = queue.getPending();
  console.log(`待機中タスク数: ${pending.length}`);
  console.log(`タスク名: ${pending[0]?.name}`);
  console.log(`七価状態: ${pending[0]?.logicValue} (NEITHER = Ready)\n`);

  await queue.tick(); // タスク実行

  const stats = queue.getStats();
  console.log('=== タスクキュー 実行後統計 ===');
  console.log(`総タスク: ${stats.total}`);
  console.log(`状態別:`, stats.byState);
  console.log(`七価値別:`, stats.byLogicValue);
  console.log(`平均待機時間: ${stats.avgWaitMs.toFixed(1)}ms`);
  console.log(`平均実行時間: ${stats.avgRunMs.toFixed(1)}ms\n`);

  // ── B: 証明結果の表示 ─────────────────────────────────

  if (!proofResult) {
    console.log('証明タスクが完了していません');
    return;
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(proofResult.title);
  console.log('───────────────────────────────────────────────────────');
  console.log(proofResult.verse);
  console.log('───────────────────────────────────────────────────────\n');

  for (const step of proofResult.steps) {
    const symbol = step.logicValue === 'FALSE' ? '⊥' :
                   step.logicValue === 'NEITHER' ? '⊠' :
                   step.logicValue === 'BOTH' ? '⊕' : '～';
    console.log(`[Step ${step.step}] ${symbol} ${step.claim}`);
    console.log(`  使用公理: ${step.axioms.join(', ')}`);
    console.log(`  七価判定: ${step.logicValue}`);
    console.log(`  理由: ${step.reason}`);
    console.log();
  }

  console.log('=== 逆引き検証（AriadneTracer）===');
  console.log('結論「空」から起点まで:');
  console.log(proofResult.backtrace.join(' <- '));
  console.log();

  console.log('=== 自己ループ検査（NarcissusDetector）===');
  console.log(`結果: ${proofResult.narcissusCheck}`);
  console.log();

  console.log('═══════════════════════════════════════════════════════');
  console.log(`最終判定: ${proofResult.conclusion}`);
  console.log(`証明成功: ${proofResult.isProven ? '✓ はい' : '✗ いいえ'}`);
  console.log('───────────────────────────────────────────────────────');
  console.log(proofResult.summary);
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
