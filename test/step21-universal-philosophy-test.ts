import { DFUMTConsistencyChecker } from '../src/axiom-os/dfumt-consistency-checker';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';

let passed = 0; let failed = 0;
function ok(name: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else       { console.log(`  ✗ ${name}`); failed++; }
}

async function main() {
  console.log('\n=== STEP 21: 普遍哲学統合テスト ===\n');

  // T-1: 新理論が SEED_KERNEL に存在する
  const ids = SEED_KERNEL.map(t => t.id);
  ok('dfumt-ubuntu が存在',           ids.includes('dfumt-ubuntu'));
  ok('dfumt-bantu-force が存在',      ids.includes('dfumt-bantu-force'));
  ok('dfumt-teotl が存在',            ids.includes('dfumt-teotl'));
  ok('dfumt-nepantla が存在',         ids.includes('dfumt-nepantla'));
  ok('dfumt-dreamtime が存在',        ids.includes('dfumt-dreamtime'));
  ok('dfumt-whakapapa が存在',        ids.includes('dfumt-whakapapa'));
  ok('dfumt-wahdat-al-wujud が存在',  ids.includes('dfumt-wahdat-al-wujud'));
  ok('dfumt-barzakh が存在',          ids.includes('dfumt-barzakh'));

  // T-2: 新カテゴリが存在する
  const categories = [...new Set(SEED_KERNEL.map(t => t.category))];
  ok('african カテゴリが存在',        categories.includes('african'));
  ok('mesoamerican カテゴリが存在',   categories.includes('mesoamerican'));
  ok('oceanian カテゴリが存在',       categories.includes('oceanian'));
  ok('islamic カテゴリが存在',        categories.includes('islamic'));

  // T-3: 理論総数が 95 以上
  ok(`理論数が95以上 (現在: ${SEED_KERNEL.length})`, SEED_KERNEL.length >= 95);

  // T-4: 全理論が無矛盾
  const checker = new DFUMTConsistencyChecker();
  const report  = checker.checkAll();
  ok('全理論無矛盾', report.contradictions.length === 0);
  ok('整合スコア100%', report.consistencyScore >= 1.0);
  console.log(`\n  理論数: ${report.totalTheories} / ペア数: ${report.totalPairsChecked} / 矛盾: ${report.contradictions.length}`);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
}

main().catch(console.error);
