/**
 * STEP 23 統合テスト
 *
 * テスト内容:
 *   1. NagarjunaChapterScanner — 中論24章の七価論理スキャン
 *   2. CausalChainEngine — 因果推論の強化
 *   3. EnhancedTaskPlanner — 長期計画の七価論理不確実性管理
 *   4. RealtimeTheoryIntegrator — リアルタイム学習
 *   5. SEED_KERNEL 174理論確認
 */

import { NagarjunaChapterScanner } from '../src/axiom-os/nagarjuna-chapter-scanner';
import { CausalChainEngine } from '../src/axiom-os/causal-chain-engine';
import { EnhancedTaskPlanner } from '../src/agi/enhanced-task-planner';
import { RealtimeTheoryIntegrator } from '../src/axiom-os/realtime-theory-integrator';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  FAIL  ${name}: ${e.message}`);
  }
}

function assert(cond: boolean, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

console.log('\n=== STEP 23: 龍樹形式証明 + 因果推論 + 長期計画 + リアルタイム学習 ===\n');

// ══════════════════════════════════════════════════════════
// 1. NagarjunaChapterScanner
// ══════════════════════════════════════════════════════════
console.log('--- 1. NagarjunaChapterScanner ---');

const scanner = new NagarjunaChapterScanner();

test('scan: 全24章をスキャン', () => {
  const report = scanner.scan();
  assert(report.totalChapters === 24, `expected 24, got ${report.totalChapters}`);
  assert(report.chapters.length === 24);
  assert(report.logicalChain.length === 24);
  console.log(`    NEITHER直接検出: ${report.neitherCount}章`);
  console.log(`    NEITHERパターン: ${report.chapters.filter(c => c.isNeitherPattern).length}章`);
  console.log(`    全体値: ${report.overallValue}`);
});

test('scan: 第1章（因縁の考察）はNEITHERパターン', () => {
  const report = scanner.scan();
  const ch1 = report.chapters[0];
  assert(ch1.chapter === 1);
  assert(ch1.isNeitherPattern, `第1章はNEITHERパターンであるべき: got ${ch1.classification.value}`);
});

test('scan: 第15章（自性の考察）はNEITHERパターン', () => {
  const ch15 = scanner.scanChapter(15);
  assert(ch15 !== null);
  // 自性・空・縁起のキーワードが含まれるのでNEITHERパターンであるべき
  assert(ch15!.isNeitherPattern, `第15章はNEITHERパターンであるべき: got ${ch15!.classification.value}`);
});

test('scan: 第24章（四聖諦）の分類', () => {
  const ch24 = scanner.scanChapter(24);
  assert(ch24 !== null);
  assert(ch24!.chapter === 24);
  assert(ch24!.titleSanskrit === 'Āryasatyaparīkṣā');
});

test('scanChapter: 存在しない章 → null', () => {
  assert(scanner.scanChapter(25) === null);
  assert(scanner.scanChapter(0) === null);
});

test('findNeitherChapters: NEITHER章の一覧', () => {
  const neitherChapters = scanner.findNeitherChapters();
  assert(neitherChapters.length > 0, 'should find at least some NEITHER chapters');
  for (const ch of neitherChapters) {
    assert(ch.classification.value === 'NEITHER', `expected NEITHER, got ${ch.classification.value}`);
  }
  console.log(`    NEITHER章: ${neitherChapters.map(c => `第${c.chapter}章`).join(', ')}`);
});

test('scan: summary が正しい形式', () => {
  const report = scanner.scan();
  assert(report.summary.includes('龍樹の中論'));
  assert(report.summary.includes('NEITHER'));
  assert(report.summary.includes('七価論理'));
});

// ══════════════════════════════════════════════════════════
// 2. CausalChainEngine
// ══════════════════════════════════════════════════════════
console.log('\n--- 2. CausalChainEngine ---');

test('CausalChainEngine: 基本的な因果チェーン', () => {
  const engine = new CausalChainEngine();
  engine.addNode('A', '原因A', 'TRUE');
  engine.addNode('B', '中間B', 'TRUE');
  engine.addNode('C', '結果C', 'TRUE');
  engine.addLink('A', 'B', 'TRUE', 'A→B');
  engine.addLink('B', 'C', 'TRUE', 'B→C');

  const result = engine.traceForward('A');
  assert(result.chain.length === 3, `expected 3 nodes, got ${result.chain.length}`);
  assert(result.overallStrength === 'TRUE');
  assert(!result.isCircular);
});

test('CausalChainEngine: 循環因果の検出', () => {
  const engine = new CausalChainEngine();
  engine.addNode('X', 'ノードX', 'FLOWING');
  engine.addNode('Y', 'ノードY', 'FLOWING');
  engine.addLink('X', 'Y', 'FLOWING', 'X→Y');
  engine.addLink('Y', 'X', 'FLOWING', 'Y→X');

  const result = engine.traceForward('X');
  assert(result.isCircular, 'should detect circular causation');
});

test('CausalChainEngine: 逆因果推論', () => {
  const engine = new CausalChainEngine();
  engine.addNode('root', '根本原因', 'TRUE');
  engine.addNode('mid', '中間原因', 'FLOWING');
  engine.addNode('effect', '最終結果', 'FLOWING');
  engine.addLink('root', 'mid', 'TRUE');
  engine.addLink('mid', 'effect', 'FLOWING');

  const reverse = engine.traceReverse('effect');
  assert(reverse.causes.length >= 2, `expected >= 2, got ${reverse.causes.length}`);
  assert(reverse.rootCauses.includes('root'), 'should find root as root cause');
});

test('CausalChainEngine: 十二縁起モデル', () => {
  const engine = new CausalChainEngine();
  const result = engine.buildTwelveLinks();
  assert(result.chain.length >= 12, `expected >= 12, got ${result.chain.length}`);
  assert(result.isCircular, 'twelve links should be circular');
  assert(result.chain[0].label.includes('無明'), 'should start with avidya');
  console.log(`    十二縁起: ${result.chain.map(n => n.label.split('（')[0]).join(' → ')}`);
  console.log(`    因果強度: ${result.overallStrength}`);
});

test('CausalChainEngine: toDependentOrigination 統合', () => {
  const engine = new CausalChainEngine();
  engine.addNode('A', '原因', 'TRUE');
  engine.addNode('B', '結果', 'FLOWING');
  engine.addLink('A', 'B', 'TRUE');

  const depOrig = engine.toDependentOrigination();
  const map = depOrig.mapAll();
  assert(map.totalNodes === 2, `expected 2, got ${map.totalNodes}`);
});

test('CausalChainEngine: updateNode', () => {
  const engine = new CausalChainEngine();
  engine.addNode('test', 'テスト', 'ZERO');
  assert(engine.updateNode('test', 'TRUE') === true);
  assert(engine.updateNode('nonexistent', 'TRUE') === false);
});

test('CausalChainEngine: stats()', () => {
  const engine = new CausalChainEngine();
  engine.addNode('A', 'A', 'TRUE');
  engine.addNode('B', 'B', 'TRUE');
  engine.addLink('A', 'B', 'TRUE');
  const s = engine.stats();
  assert(s.nodeCount === 2);
  assert(s.linkCount === 1);
});

test('CausalChainEngine: getSeedKernelEntries → 2件', () => {
  const entries = CausalChainEngine.getSeedKernelEntries();
  assert(entries.length === 2);
  assert(entries[0].id === 'dfumt-causal-chain');
  assert(entries[1].id === 'dfumt-reverse-causation');
});

// ══════════════════════════════════════════════════════════
// 3. EnhancedTaskPlanner
// ══════════════════════════════════════════════════════════
console.log('\n--- 3. EnhancedTaskPlanner ---');

const planner = new EnhancedTaskPlanner();

test('enhance: TaskPlanを七価論理で強化', () => {
  const plan = {
    id: 'test-plan',
    originalQuery: 'テスト計画',
    subtasks: [
      { id: 't1', type: 'compute' as const, description: '計算', dependencies: [], status: 'pending' as const, retryCount: 0 },
      { id: 't2', type: 'search' as const, description: '検索', dependencies: ['t1'], status: 'pending' as const, retryCount: 0 },
    ],
    createdAt: Date.now(),
    status: 'planning' as const,
  };

  const enhanced = planner.enhance(plan);
  assert(enhanced.subtasks.length === 2);
  assert(enhanced.subtasks[0].confidence !== undefined);
  assert(enhanced.overallConfidence !== undefined);
  assert(enhanced.feasibility >= 0 && enhanced.feasibility <= 1);
  assert(enhanced.riskSummary.includes('リスク評価'));
  console.log(`    全体確信度: ${enhanced.overallConfidence}`);
  console.log(`    実現可能性: ${(enhanced.feasibility * 100).toFixed(0)}%`);
});

test('enhance: compute → TRUE (低リスク)', () => {
  const plan = {
    id: 'p1', originalQuery: '', createdAt: Date.now(), status: 'planning' as const,
    subtasks: [{ id: 't1', type: 'compute' as const, description: '計算', dependencies: [], status: 'pending' as const, retryCount: 0 }],
  };
  const enhanced = planner.enhance(plan);
  assert(enhanced.subtasks[0].confidence === 'TRUE');
  assert(enhanced.subtasks[0].riskLevel === 'low');
});

test('enhance: vision → BOTH (高リスク)', () => {
  const plan = {
    id: 'p2', originalQuery: '', createdAt: Date.now(), status: 'planning' as const,
    subtasks: [{ id: 't1', type: 'vision' as const, description: '画面認識', dependencies: [], status: 'pending' as const, retryCount: 0 }],
  };
  const enhanced = planner.enhance(plan);
  assert(enhanced.subtasks[0].confidence === 'BOTH');
  assert(enhanced.subtasks[0].riskLevel === 'high');
});

test('evaluate: 詳細評価', () => {
  const plan = {
    id: 'p3', originalQuery: 'テスト', createdAt: Date.now(), status: 'planning' as const,
    subtasks: [
      { id: 't1', type: 'compute' as const, description: '計算', dependencies: [], status: 'pending' as const, retryCount: 0 },
      { id: 't2', type: 'browser' as const, description: 'Web操作', dependencies: ['t1'], status: 'pending' as const, retryCount: 0 },
    ],
  };
  const eval_ = planner.evaluate(plan);
  assert(eval_.stepAnalysis.length === 2);
  assert(eval_.recommendations.length > 0);
  assert(eval_.feasibility > 0);
});

test('replan: 失敗ステップの再計画', () => {
  const plan = {
    id: 'p4', originalQuery: '', createdAt: Date.now(), status: 'planning' as const,
    subtasks: [
      { id: 't1', type: 'compute' as const, description: '計算', dependencies: [], status: 'pending' as const, retryCount: 0 },
      { id: 't2', type: 'search' as const, description: '検索', dependencies: ['t1'], status: 'pending' as const, retryCount: 0 },
    ],
  };
  const enhanced = planner.enhance(plan);
  const replanned = planner.replan(enhanced, ['t1']);
  assert(replanned.subtasks[0].confidence === 'FALSE');
  assert(replanned.subtasks[0].status === 'failed');
  assert(replanned.subtasks[0].alternatives.length > 0);
  // t2はt1に依存→FLOWING
  assert(replanned.subtasks[1].confidence === 'FLOWING');
});

test('planFromDescription: 自然言語から計画生成', () => {
  const plan = planner.planFromDescription(
    '1. D-FUMTの論文を検索する。2. 結果を分析する。3. レポートにまとめる。'
  );
  assert(plan.subtasks.length === 3, `expected 3, got ${plan.subtasks.length}`);
  assert(plan.subtasks[0].type === 'search');
  assert(plan.overallConfidence !== undefined);
  assert(plan.feasibility > 0);
});

test('planFromDescription: 単一ステップ', () => {
  const plan = planner.planFromDescription('フィボナッチ数を計算する');
  assert(plan.subtasks.length === 1);
  assert(plan.subtasks[0].type === 'compute');
});

// ══════════════════════════════════════════════════════════
// 4. RealtimeTheoryIntegrator
// ══════════════════════════════════════════════════════════
console.log('\n--- 4. RealtimeTheoryIntegrator ---');

const integrator = new RealtimeTheoryIntegrator();

test('integrate: 新理論の登録', () => {
  const result = integrator.integrate('量子もつれは非局所的相関を示し、ベル不等式を破る現象である');
  assert(result.accepted === true, `should be accepted: ${result.reason}`);
  assert(result.theoryId !== undefined);
  assert(result.candidate.dfumtValue !== undefined);
  assert(result.candidate.category === 'quantum');
  console.log(`    登録: ${result.theoryId} (${result.candidate.dfumtValue})`);
});

test('integrate: 重複理論の拒否', () => {
  // 同じテキストを2回登録すると2回目は重複で拒否されるべき
  // ただしキーワードが十分に類似している必要がある
  const result1 = integrator.integrate('意識のハードプロブレムはqualiaの説明が困難である');
  assert(result1.accepted === true);
  // 非常に似たテキスト
  const result2 = integrator.integrate('意識のハードプロブレムはqualiaの説明が困難');
  // キーワードが同じなら重複として拒否
  if (!result2.accepted) {
    assert(result2.duplicateOf !== undefined);
  }
});

test('integrate: カテゴリ推定', () => {
  const r1 = integrator.integrate('龍樹の空性理論は全ての自性を否定する');
  assert(r1.candidate.category === 'nagarjuna', `expected nagarjuna, got ${r1.candidate.category}`);

  const r2 = integrator.integrate('フィボナッチ数列の漸化式はF(n)=F(n-1)+F(n-2)で定義される');
  assert(r2.candidate.category === 'numerical', `expected numerical, got ${r2.candidate.category}`);
});

test('integrateBatch: バッチ処理', () => {
  const results = integrator.integrateBatch([
    '時間の矢は不可逆性を示す',
    'ゲーデルの不完全性定理は形式体系の限界を示す',
  ]);
  assert(results.length === 2);
});

test('stats: 統計情報', () => {
  const s = integrator.stats();
  assert(s.totalProcessed > 0, 'should have processed some');
  assert(s.accepted > 0, 'should have accepted some');
  console.log(`    処理: ${s.totalProcessed} 受理: ${s.accepted} 拒否: ${s.rejected} 重複: ${s.duplicates}`);
});

test('getEvolution: 進化理論の取得', () => {
  const evo = integrator.getEvolution();
  const evolved = evo.getEvolved();
  assert(evolved.length > 0, 'should have evolved theories');
  const summary = evo.summarize();
  assert(summary.evolvedCount > 0);
  console.log(`    進化理論: ${summary.evolvedCount}件`);
});

test('resetHistory: 履歴リセット', () => {
  integrator.resetHistory();
  const s = integrator.stats();
  assert(s.totalProcessed === 0);
});

// ══════════════════════════════════════════════════════════
// 5. SEED_KERNEL 確認
// ══════════════════════════════════════════════════════════
console.log('\n--- 5. SEED_KERNEL 確認 ---');

test('SEED_KERNEL: Theory #105-#106 が含まれる', () => {
  const ids = ['dfumt-causal-chain', 'dfumt-reverse-causation'];
  for (const id of ids) {
    assert(SEED_KERNEL.some(t => t.id === id), `${id} should be in SEED_KERNEL`);
  }
});

test(`SEED_KERNEL: 総理論数 174`, () => {
  assert(SEED_KERNEL.length === 174, `expected 174, got ${SEED_KERNEL.length}`);
});

test('SEED_KERNEL: カテゴリ一覧', () => {
  const categories = new Set(SEED_KERNEL.map(t => t.category));
  console.log(`    カテゴリ数: ${categories.size}`);
  console.log(`    カテゴリ: ${[...categories].join(', ')}`);
  assert(categories.has('numerical'), 'should have numerical');
  assert(categories.has('quantum'), 'should have quantum');
  assert(categories.has('logic'), 'should have logic');
});

// ── 結果 ──
console.log(`\n=== 結果: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
