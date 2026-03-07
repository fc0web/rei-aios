// MoiraTerminator — 推論プロセスのライフサイクル管理
import { MoiraTerminator } from '../../src/axiom-os/moira-terminator';

const moira = new MoiraTerminator();

console.log('=== クロト: 推論を開始 ===');
const proc = moira.clotho('龍樹の中論第一偈は七価論理で表現できるか？', {
  maxIterations: 10,
  timeoutMs: 5000,
});
console.log(`プロセスID: ${proc.id}`);
console.log(`初期値: ${proc.finalValue}`);

console.log('\n=== ラケシス: 評価1回目（FLOWING）===');
let judgment = moira.lachesis(proc.id, 'FLOWING');
console.log(`終了すべきか: ${judgment.shouldTerminate}`);
console.log(`メッセージ: ${judgment.message}`);

console.log('\n=== ラケシス: 評価2回目（TRUE = 収束）===');
judgment = moira.lachesis(proc.id, 'TRUE');
console.log(`終了すべきか: ${judgment.shouldTerminate}`);
console.log(`理由: ${judgment.reason}`);
console.log(`最終値: ${judgment.finalValue}`);

console.log('\n=== アトロポス: 収束完了で終了 ===');
const terminated = moira.atropos(proc.id, 'convergence', '七価論理でBOTH値として表現可能と判明');
console.log(`終了理由: ${terminated?.terminationReason}`);
console.log(`最終値: ${terminated?.finalValue}`);
console.log('アクティブプロセス数:', moira.getActiveProcesses().length);
