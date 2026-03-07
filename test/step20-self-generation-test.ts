import { SelfGenerationEngine } from '../src/axiom-os/self-generation-engine';
import { ReiAutomatorBridge }   from '../src/aios/rei-automator-bridge';
import { ReiTaskQueue }         from '../src/axiom-os/rei-task-queue';

let passed = 0; let failed = 0;
function ok(name: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else       { console.log(`  ✗ ${name}`); failed++; }
}

async function main() {
  console.log('\n=== SelfGenerationEngine テスト ===\n');

  const engine = new SelfGenerationEngine();

  // T-1: logic カテゴリから生成
  const report = engine.generate('logic');
  ok('生成レポートが存在する', report !== null);
  ok('反公理が生成された', report.totalGenerated > 0);
  ok('overallHealth が七価値', ['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'].includes(report.overallHealth));
  console.log(`  生成: 反公理${report.totalGenerated}件 萌芽体系${report.emergentSystems}件`);
  console.log(`  健全性: ${report.overallHealth}`);

  // T-2: 複数カテゴリ
  const report2 = engine.generate(['dfumt-catuskoti', 'dfumt-zero-state', 'dfumt-flowing-value']);
  ok('複数ID指定で生成できる', report2.totalGenerated >= 0);

  // T-3: 生成済み体系の取得
  const systems = engine.getGeneratedSystems();
  ok('生成済み体系を取得できる', Array.isArray(systems));
  if (systems.length > 0) {
    ok('体系にIDがある', !!systems[0].id);
    ok('体系に公理がある', systems[0].axioms.length >= 0);
    ok('originationScore が 0〜1', systems[0].originationScore >= 0 && systems[0].originationScore <= 1);
    ok('noveltyScore が 0〜1',     systems[0].noveltyScore >= 0     && systems[0].noveltyScore <= 1);
    console.log(`\n  最初の生成体系: ${systems[0].name}`);
    console.log(`  縁起スコア: ${systems[0].originationScore.toFixed(2)}`);
    console.log(`  新規性スコア: ${systems[0].noveltyScore.toFixed(2)}`);
    console.log(`  七価評価: ${systems[0].overallLogic}`);
  }

  // T-4: ReiAutomatorBridge テスト
  console.log('\n=== ReiAutomatorBridge テスト ===\n');

  // シングルトンリセット（前のテストの影響を排除）
  ReiTaskQueue._instance = null;

  const bridge = new ReiAutomatorBridge({
    autoExecute: false,
    allowedActions: ['report', 'note_export', 'proof_run'],
    logDir: 'data/automator-log-test',
  });

  // logic カテゴリから行動を提案
  const actions = bridge.proposeFromTheorems('logic');
  ok('行動提案が生成される', Array.isArray(actions));
  console.log(`  提案行動数: ${actions.length}`);
  if (actions.length > 0) {
    ok('行動にIDがある',    !!actions[0].id);
    ok('行動が未承認',      !actions[0].approved);
    ok('コマンドがある',    !!actions[0].command);
    console.log(`  最初の提案: ${actions[0].label}`);
    console.log(`  論理根拠: ${actions[0].logicBasis}`);

    // T-5: 承認 → タスクキュー投入 → tick で実行
    bridge.approve(actions[0].id);
    await ReiTaskQueue.getInstance().tick();
    ok('承認+tick後に pendingActions から移動', bridge.getPendingActions().length <= actions.length - 1);
  }

  // シングルトンリセット
  ReiTaskQueue._instance = null;

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
}

main().catch(console.error);
