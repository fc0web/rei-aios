import { DependentOrigination } from '../src/axiom-os/dependent-origination';

let passed = 0; let failed = 0;
function ok(name: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else       { console.log(`  ✗ ${name}`); failed++; }
}

async function main() {
  console.log('\n=== DependentOrigination テスト ===\n');

  const engine = new DependentOrigination();

  // ── D-FUMTの主要公理を縁起ノードとして登録 ──────────
  // catuskoti は flowing-value と zero-state に依存する
  engine.addAxiomNode('dfumt-zero-state',    'ZERO状態',   []);  // 根拠公理（条件なし）
  engine.addAxiomNode('dfumt-flowing-value', '流動値',     ['dfumt-zero-state']);
  engine.addAxiomNode('dfumt-catuskoti',     '四値論理',   ['dfumt-flowing-value', 'dfumt-zero-state']);
  engine.addAxiomNode('dfumt-narcissus',     '自己認識',   ['dfumt-catuskoti']);
  engine.addAxiomNode('dfumt-anti-axiom',    '反公理',     ['dfumt-catuskoti']);
  engine.addAxiomNode('nagarjuna-sunyata',   '空',         ['dfumt-catuskoti', 'dfumt-narcissus', 'dfumt-anti-axiom']);

  // T-1: 条件なしノード（根拠公理）は独立自性 → FALSE
  const zeroResult = engine.canArise('dfumt-zero-state');
  ok('根拠公理: 条件なし → FALSE（四不生の帰結）', zeroResult.logicValue === 'FALSE');

  // T-2: 依存ノードは縁起として生起 → TRUE or FLOWING
  const flowingResult = engine.canArise('dfumt-flowing-value');
  ok('流動値: 依存あり → 生起できる', flowingResult.canArise || flowingResult.logicValue === 'FLOWING');

  // T-3: 空は全依存が揃えば TRUE
  const sunyataResult = engine.canArise('nagarjuna-sunyata');
  ok('空: 縁起として生起可能', sunyataResult.logicValue === 'TRUE' || sunyataResult.logicValue === 'FLOWING');

  // T-4: 存在しないノード → ZERO
  const missingResult = engine.canArise('non-existent-node');
  ok('存在しないノード → ZERO', missingResult.logicValue === 'ZERO');

  // T-5: 循環依存 → BOTH（許容）または INFINITY（阻止）
  const cycleEngine = new DependentOrigination();
  cycleEngine.addAxiomNode('A', 'ノードA', ['B']);
  cycleEngine.addAxiomNode('B', 'ノードB', ['A']);
  const cycleResult = cycleEngine.canArise('A');
  ok('循環依存 → BOTH または INFINITY', cycleResult.logicValue === 'BOTH' || cycleResult.logicValue === 'INFINITY');

  // T-6: mapAll でシステム全体を評価
  const map = engine.mapAll();
  ok('mapAll: 総ノード数 6', map.totalNodes === 6);
  ok('mapAll: overallHealth が七価値', ['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'].includes(map.overallHealth));
  console.log(`\n  縁起マップ: ${map.summary}`);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
}

main().catch(console.error);
