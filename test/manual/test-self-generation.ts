/**
 * test-self-generation.ts — 自己生成エンジン手動テスト
 * 実行: npx tsx test/manual/test-self-generation.ts
 */
import { SelfGenerationEngine } from '../../src/axiom-os/self-generation-engine';
import { ReiAutomatorBridge }   from '../../src/aios/rei-automator-bridge';
import { ReiTaskQueue }         from '../../src/axiom-os/rei-task-queue';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  自己生成エンジン — Reiが新しい公理体系を設計する');
  console.log('═══════════════════════════════════════════════════════\n');

  const engine = new SelfGenerationEngine();

  // logic + consciousness カテゴリから生成
  console.log('=== Phase 1: logic カテゴリから生成 ===');
  const report1 = engine.generate('logic');
  console.log(`反公理生成数: ${report1.totalGenerated}`);
  console.log(`萌芽体系数  : ${report1.emergentSystems}`);
  console.log(`健全性      : ${report1.overallHealth}\n`);

  console.log('=== Phase 2: consciousness カテゴリから生成 ===');
  const report2 = engine.generate('consciousness');
  console.log(`反公理生成数: ${report2.totalGenerated}`);
  console.log(`健全性      : ${report2.overallHealth}\n`);

  const allSystems = engine.getGeneratedSystems();
  console.log(`\n=== 生成された新公理体系 (${allSystems.length}件) ===\n`);

  for (const sys of allSystems) {
    const symbol = sys.overallLogic === 'TRUE' ? '⊤' :
                   sys.overallLogic === 'FLOWING' ? '～' :
                   sys.overallLogic === 'NEITHER' ? '⊠' : '?';
    console.log(`[${symbol}] ${sys.name}`);
    console.log(`  元理論: ${sys.sourceTheories.join(', ')}`);
    console.log(`  縁起スコア : ${sys.originationScore.toFixed(2)}`);
    console.log(`  新規性スコア: ${sys.noveltyScore.toFixed(2)}`);
    if (sys.axioms.length > 0) {
      console.log(`  生成公理例 : ${sys.axioms[0].statement}`);
    }
    console.log();
  }

  // ReiAutomatorBridge で行動提案
  console.log('=== 考えて→行動するループ ===\n');
  const bridge = new ReiAutomatorBridge({
    autoExecute: false,
    allowedActions: ['report', 'note_export', 'proof_run'],
    logDir: 'data/automator-log',
  });

  const actions = bridge.proposeFromTheorems('logic');
  console.log(`提案された行動: ${actions.length}件\n`);
  for (const action of actions) {
    console.log(`  [${action.kind}] ${action.label}`);
    console.log(`    根拠: ${action.logicBasis}`);
    console.log(`    コマンド: ${action.command}`);
    console.log();
  }

  if (actions.length > 0) {
    console.log(`承認テスト: ${actions[0].id} を承認`);
    bridge.approve(actions[0].id);
    // tick で実行
    const queue = ReiTaskQueue.getInstance();
    await queue.tick();
    const log = bridge.getExecutedLog(1);
    if (log.length > 0) {
      console.log(`実行結果: ${log[0].result}`);
    }
  }

  // シングルトンリセット
  ReiTaskQueue._instance = null;
}

main().catch(console.error);
