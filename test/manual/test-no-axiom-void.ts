// NoAxiomVoid — 無公理ZERO状態と公理の一生
import { NoAxiomVoid } from '../../src/axiom-os/no-axiom-void';
import { SEED_KERNEL } from '../../src/axiom-os/seed-kernel';

const void_ = new NoAxiomVoid();

console.log('=== 根源的ZERO（全公理が存在する前）===');
const primordial = void_.primordialVoid();
console.log(primordial.description);

console.log('\n=== 現在のZERO状態（84理論が潜在）===');
const current = void_.captureVoid();
console.log(current.description);
console.log(`エントロピー: ${current.entropyBits.toFixed(4)} bits`);

console.log('\n=== 公理が「現れる」===');
const theory = SEED_KERNEL.find(t => t.id === 'dfumt-catuskoti')
  ?? SEED_KERNEL[0];
const emergence = void_.emerge(current.id, theory, '四値論理の必要性から');
console.log(`現れた公理: ${emergence.theory.id}`);
console.log(`現れた値: ${emergence.emergenceValue}`);

console.log('\n=== 公理がZEROに「帰還する」===');
const returned = void_.returnToVoid(theory.id, 'より一般的な七価論理に統合されたため');
console.log(`帰還した公理: ${returned.theoryId}`);
console.log(`残滓（キーワード）: ${returned.residue}`);

console.log('\n=== ZEROサイクルの完結確認 ===');
const cycle = void_.getCycle(theory.id);
console.log(`サイクル完結: ${cycle?.cycleComplete}`);

console.log('\n=== 全体サマリー ===');
const summary = void_.summary();
console.log(`VOID数: ${summary.voidCount}`);
console.log(`現れ: ${summary.emergenceCount}回`);
console.log(`帰還: ${summary.returnCount}回`);
console.log(`サイクル完結率: ${(summary.cycleCompletionRate * 100).toFixed(0)}%`);
console.log(`全体状態: ${summary.overallTag}`);
