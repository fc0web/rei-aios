/**
 * STEP 22 統合テスト
 *
 * テスト内容:
 *   Task 1: NumericalReasoningEngine — 螺旋数・ゼロπ・区間演算・BigInt
 *   Task 2: scheduled-tasks.ts T-10 — AxiomAutoLearner登録確認
 *   Task 4: MultiAgentCoordinator — 協調推論・合意形成
 */

import {
  SpiralArithmetic,
  ZeroPiTransform,
  IntervalArithmetic,
  BigIntArithmetic,
  NumericalReasoningEngine,
} from '../src/axiom-os/numerical-reasoning-engine';
import { MultiAgentCoordinator, type AgentProfile } from '../src/axiom-os/multi-agent-coordinator';
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

console.log('\n=== STEP 22: 数値処理 + T-10統合 + マルチエージェント ===\n');

// ══════════════════════════════════════════════════════════
// Task 1: NumericalReasoningEngine
// ══════════════════════════════════════════════════════════
console.log('--- Task 1: NumericalReasoningEngine ---');

// ── SpiralArithmetic ──
test('SpiralArithmetic: fromReal(0) → ZERO', () => {
  const s = SpiralArithmetic.fromReal(0);
  assert(s.dfumt === 'ZERO', `expected ZERO, got ${s.dfumt}`);
  assert(s.r === 0);
  assert(s.layer === 0);
});

test('SpiralArithmetic: fromReal(5) → TRUE (正の整数)', () => {
  const s = SpiralArithmetic.fromReal(5);
  assert(s.dfumt === 'TRUE', `expected TRUE, got ${s.dfumt}`);
  assert(s.r === 5);
});

test('SpiralArithmetic: fromReal(-3) → FALSE (負の整数)', () => {
  const s = SpiralArithmetic.fromReal(-3);
  assert(s.dfumt === 'FALSE', `expected FALSE, got ${s.dfumt}`);
});

test('SpiralArithmetic: fromReal(Infinity) → INFINITY', () => {
  const s = SpiralArithmetic.fromReal(Infinity);
  assert(s.dfumt === 'INFINITY');
});

test('SpiralArithmetic: fromReal(NaN) → NEITHER', () => {
  const s = SpiralArithmetic.fromReal(NaN);
  assert(s.dfumt === 'NEITHER');
});

test('SpiralArithmetic: fromReal(3.14) → FLOWING (小数)', () => {
  const s = SpiralArithmetic.fromReal(3.14);
  assert(s.dfumt === 'FLOWING', `expected FLOWING, got ${s.dfumt}`);
});

test('SpiralArithmetic: add(3, -3) → ZERO', () => {
  const a = SpiralArithmetic.fromReal(3);
  const b = SpiralArithmetic.fromReal(-3);
  const result = SpiralArithmetic.add(a, b);
  assert(Math.abs(SpiralArithmetic.toReal(result)) < 1e-10, 'sum should be ~0');
});

test('SpiralArithmetic: mul は極形式で正しく計算', () => {
  const a = SpiralArithmetic.fromReal(2);
  const b = SpiralArithmetic.fromReal(3);
  const result = SpiralArithmetic.mul(a, b);
  assert(Math.abs(result.r - 6) < 1e-10, `expected r=6, got ${result.r}`);
});

test('SpiralArithmetic: fromComplex(1, 1) → BOTH', () => {
  const s = SpiralArithmetic.fromComplex(1, 1);
  assert(s.dfumt === 'BOTH', `expected BOTH, got ${s.dfumt}`);
  assert(Math.abs(s.r - Math.SQRT2) < 1e-10);
});

test('SpiralArithmetic: rotate → FLOWING + layer increment', () => {
  const s = SpiralArithmetic.fromReal(5);
  const rotated = SpiralArithmetic.rotate(s);
  assert(rotated.dfumt === 'FLOWING');
  assert(rotated.layer === s.layer + 1);
});

// ── ZeroPiTransform ──
test('ZeroPiTransform: project(0) → 0', () => {
  assert(ZeroPiTransform.project(0) === 0);
});

test('ZeroPiTransform: project(pi) → 0 (πの倍数)', () => {
  assert(Math.abs(ZeroPiTransform.project(Math.PI)) < 1e-10);
});

test('ZeroPiTransform: project(2*pi) → 0', () => {
  assert(Math.abs(ZeroPiTransform.project(2 * Math.PI)) < 1e-10);
});

test('ZeroPiTransform: piEncode(3*pi) → [3, ~0]', () => {
  const [coeff, rem] = ZeroPiTransform.piEncode(3 * Math.PI);
  assert(coeff === 3, `coeff: expected 3, got ${coeff}`);
  assert(Math.abs(rem) < 1e-10, `remainder: expected ~0, got ${rem}`);
});

test('ZeroPiTransform: zeroPiDual(0) → pi', () => {
  const result = ZeroPiTransform.zeroPiDual(0);
  assert(Math.abs(result - Math.PI) < 1e-10, `expected pi, got ${result}`);
});

test('ZeroPiTransform: zeroPiDual(pi) → pi (project(pi)=0, pi-0=pi)', () => {
  const result = ZeroPiTransform.zeroPiDual(Math.PI);
  assert(Math.abs(result - Math.PI) < 1e-10, `expected pi, got ${result}`);
});

test('ZeroPiTransform: classify(0) → ZERO', () => {
  assert(ZeroPiTransform.classify(0) === 'ZERO');
});

test('ZeroPiTransform: classify(Infinity) → INFINITY', () => {
  assert(ZeroPiTransform.classify(Infinity) === 'INFINITY');
});

test('ZeroPiTransform: sinClassify(0) → ZERO', () => {
  assert(ZeroPiTransform.sinClassify(0) === 'ZERO');
});

test('ZeroPiTransform: sinClassify(pi/2) → TRUE', () => {
  assert(ZeroPiTransform.sinClassify(Math.PI / 2) === 'TRUE');
});

// ── IntervalArithmetic ──
test('IntervalArithmetic: add([1,2], [3,4]) → [4,6]', () => {
  const r = IntervalArithmetic.add({ lo: 1, hi: 2 }, { lo: 3, hi: 4 });
  assert(r.lo === 4 && r.hi === 6, `expected [4,6], got [${r.lo},${r.hi}]`);
});

test('IntervalArithmetic: sub([5,10], [1,3]) → [2,9]', () => {
  const r = IntervalArithmetic.sub({ lo: 5, hi: 10 }, { lo: 1, hi: 3 });
  assert(r.lo === 2 && r.hi === 9, `expected [2,9], got [${r.lo},${r.hi}]`);
});

test('IntervalArithmetic: mul([2,3], [-1,4]) → [-3,12]', () => {
  const r = IntervalArithmetic.mul({ lo: 2, hi: 3 }, { lo: -1, hi: 4 });
  assert(r.lo === -3 && r.hi === 12, `expected [-3,12], got [${r.lo},${r.hi}]`);
});

test('IntervalArithmetic: div by zero → null', () => {
  const r = IntervalArithmetic.div({ lo: 1, hi: 2 }, { lo: -1, hi: 1 });
  assert(r === null, 'division by interval containing 0 should return null');
});

test('IntervalArithmetic: width([1,5]) → 4', () => {
  assert(IntervalArithmetic.width({ lo: 1, hi: 5 }) === 4);
});

test('IntervalArithmetic: contains([1,5], 3) → true', () => {
  assert(IntervalArithmetic.contains({ lo: 1, hi: 5 }, 3) === true);
  assert(IntervalArithmetic.contains({ lo: 1, hi: 5 }, 6) === false);
});

test('IntervalArithmetic: intersect([1,5], [3,7]) → [3,5]', () => {
  const r = IntervalArithmetic.intersect({ lo: 1, hi: 5 }, { lo: 3, hi: 7 });
  assert(r !== null && r.lo === 3 && r.hi === 5);
});

test('IntervalArithmetic: intersect disjoint → null', () => {
  const r = IntervalArithmetic.intersect({ lo: 1, hi: 2 }, { lo: 3, hi: 4 });
  assert(r === null);
});

test('IntervalArithmetic: classify([1,5]) → TRUE (正)', () => {
  assert(IntervalArithmetic.classify({ lo: 1, hi: 5 }) === 'TRUE');
});

test('IntervalArithmetic: classify([-5,-1]) → FALSE (負)', () => {
  assert(IntervalArithmetic.classify({ lo: -5, hi: -1 }) === 'FALSE');
});

test('IntervalArithmetic: classify([-3,3]) → BOTH (正負またがる)', () => {
  assert(IntervalArithmetic.classify({ lo: -3, hi: 3 }) === 'BOTH');
});

// ── BigIntArithmetic ──
test('BigIntArithmetic: fibonacci(10) → 55', () => {
  assert(BigIntArithmetic.fibonacci(10) === 55n);
});

test('BigIntArithmetic: fibonacci(50) → 大きい数', () => {
  const f50 = BigIntArithmetic.fibonacci(50);
  assert(f50 === 12586269025n, `expected 12586269025n, got ${f50}`);
});

test('BigIntArithmetic: factorial(20)', () => {
  const f20 = BigIntArithmetic.factorial(20);
  assert(f20 === 2432902008176640000n, `expected 2432902008176640000n, got ${f20}`);
});

test('BigIntArithmetic: pow(2, 64)', () => {
  const p = BigIntArithmetic.pow(2n, 64);
  assert(p === 18446744073709551616n);
});

test('BigIntArithmetic: gcd(12, 8) → 4', () => {
  assert(BigIntArithmetic.gcd(12n, 8n) === 4n);
});

test('BigIntArithmetic: modPow(2, 10, 1000) → 24', () => {
  assert(BigIntArithmetic.modPow(2n, 10n, 1000n) === 24n);
});

test('BigIntArithmetic: digitCount(12345) → 5', () => {
  assert(BigIntArithmetic.digitCount(12345n) === 5);
});

// ── NumericalReasoningEngine 統合 ──
test('NumericalReasoningEngine: evaluate(42) → TRUE', () => {
  const engine = new NumericalReasoningEngine();
  const r = engine.evaluate(42);
  assert(r.dfumt === 'TRUE', `expected TRUE, got ${r.dfumt}`);
  assert(r.confidence > 0, 'confidence should be > 0');
});

test('NumericalReasoningEngine: evaluate(0) → ZERO', () => {
  const engine = new NumericalReasoningEngine();
  const r = engine.evaluate(0);
  assert(r.dfumt === 'ZERO');
});

test('NumericalReasoningEngine: computeWithError add', () => {
  const engine = new NumericalReasoningEngine();
  const r = engine.computeWithError(1.5, 2.5, 'add');
  assert(Math.abs(r.value - 4.0) < 0.01, `expected ~4.0, got ${r.value}`);
  assert(r.confidence > 0.9, `confidence should be high, got ${r.confidence}`);
});

test('NumericalReasoningEngine: computeWithError div by zero', () => {
  const engine = new NumericalReasoningEngine();
  const r = engine.computeWithError(1, 0, 'div', 0.1);
  assert(r.dfumt === 'NEITHER', `expected NEITHER, got ${r.dfumt}`);
});

test('NumericalReasoningEngine: spiralCompute add', () => {
  const engine = new NumericalReasoningEngine();
  const r = engine.spiralCompute(3, 4, 'add');
  assert(Math.abs(SpiralArithmetic.toReal(r) - 7) < 1e-10);
});

// ── SEED_KERNEL Theory #102-#104 ──
test('SEED_KERNEL: Theory #102-#104 (numerical) が含まれる', () => {
  const ids = ['dfumt-spiral-number', 'dfumt-zero-pi-transform', 'dfumt-interval-arithmetic'];
  for (const id of ids) {
    assert(SEED_KERNEL.some(t => t.id === id), `${id} should be in SEED_KERNEL`);
  }
});

test('SEED_KERNEL: numerical カテゴリが3件', () => {
  const numerical = SEED_KERNEL.filter(t => t.category === 'numerical');
  assert(numerical.length === 3, `expected 3, got ${numerical.length}`);
});

test(`SEED_KERNEL: 総理論数 174`, () => {
  assert(SEED_KERNEL.length === 174, `expected 174, got ${SEED_KERNEL.length}`);
});

test('NumericalReasoningEngine: getSeedKernelEntries() → 3件', () => {
  const entries = NumericalReasoningEngine.getSeedKernelEntries();
  assert(entries.length === 3);
  assert(entries.every(e => e.category === 'numerical'));
});

// ══════════════════════════════════════════════════════════
// Task 2: T-10 AxiomAutoLearner スケジューラ登録確認
// ══════════════════════════════════════════════════════════
console.log('\n--- Task 2: T-10 AxiomAutoLearner スケジューラ登録 ---');

test('scheduled-tasks: AxiomAutoLearnerのimportが正しい', () => {
  // AxiomAutoLearner が正しくインスタンス化できることを確認
  const { AxiomAutoLearner } = require('../src/axiom-os/axiom-auto-learner');
  const learner = new AxiomAutoLearner({ dataDir: '/tmp/test' });
  assert(learner !== undefined, 'AxiomAutoLearner should be instantiable');
});

test('scheduled-tasks: registerDefaultTasks にT-10が含まれる', () => {
  // scheduled-tasks.tsのソースに axiom-auto-learner が含まれることを確認
  const fs = require('fs');
  const source = fs.readFileSync('src/aios/scheduler/scheduled-tasks.ts', 'utf8');
  assert(source.includes('axiom-auto-learner'), 'should import axiom-auto-learner');
  assert(source.includes('T-10'), 'should have T-10 comment');
  assert(source.includes("id: 'axiom-auto-learner'"), 'should register axiom-auto-learner task');
  assert(source.includes('24 * 60 * 60 * 1000'), 'should have 24h interval');
});

// ══════════════════════════════════════════════════════════
// Task 4: MultiAgentCoordinator
// ══════════════════════════════════════════════════════════
console.log('\n--- Task 4: MultiAgentCoordinator ---');

const coordinator = new MultiAgentCoordinator();

test('MultiAgentCoordinator: デフォルト5エージェント', () => {
  const agents = coordinator.getAgents();
  assert(agents.length === 5, `expected 5, got ${agents.length}`);
});

test('MultiAgentCoordinator: stats()', () => {
  const s = coordinator.stats();
  assert(s.agentCount === 5);
  assert(s.specialities.length >= 4, `expected >= 4 specialities, got ${s.specialities.length}`);
  assert(s.sessions === 0);
});

test('MultiAgentCoordinator: coordinate — 量子論理トピック', () => {
  const result = coordinator.coordinate({
    topic: '量子重ね合わせ状態は真かつ偽である',
  });
  assert(result.sessionId.startsWith('coord-'));
  assert(result.reasonings.length === 5, `expected 5 reasonings, got ${result.reasonings.length}`);
  assert(result.consensus.finalValue !== undefined);
  assert(result.summary.includes('協調推論結果'));
  console.log(`    合意値: ${result.consensus.finalValue}`);
});

test('MultiAgentCoordinator: coordinate — 空性トピック', () => {
  const result = coordinator.coordinate({
    topic: '空は実体を持たない、全ては無自性である',
  });
  assert(result.consensus.finalValue !== undefined);
  // 龍樹エージェントがNEITHERを推すはず
  const nagarjunaVote = result.reasonings.find(r => r.agentId === 'agent-nagarjuna');
  assert(nagarjunaVote !== undefined, 'nagarjuna agent should participate');
  assert(nagarjunaVote!.vote === 'NEITHER', `nagarjuna should vote NEITHER, got ${nagarjunaVote!.vote}`);
  console.log(`    合意値: ${result.consensus.finalValue}`);
});

test('MultiAgentCoordinator: coordinate — 数値処理トピック', () => {
  const result = coordinator.coordinate({
    topic: 'フィボナッチ数列は真理を表す証明済み定理である',
  });
  assert(result.consensus.finalValue !== undefined);
  console.log(`    合意値: ${result.consensus.finalValue}`);
});

test('MultiAgentCoordinator: coordinate — 指定エージェントのみ', () => {
  const result = coordinator.coordinate({
    topic: '意識は情報統合のFLOWINGである',
    agentIds: ['agent-logic', 'agent-consciousness'],
  });
  assert(result.agents.length === 2, `expected 2, got ${result.agents.length}`);
  assert(result.reasonings.length === 2);
});

test('MultiAgentCoordinator: coordinateBySpeciality(quantum)', () => {
  const result = coordinator.coordinateBySpeciality(
    '量子もつれは非局所的相関を示す',
    'quantum',
  );
  assert(result.consensus.finalValue !== undefined);
  console.log(`    量子専門合意: ${result.consensus.finalValue}`);
});

test('MultiAgentCoordinator: addAgent / removeAgent', () => {
  const custom: AgentProfile = {
    id: 'agent-custom',
    name: 'カスタムエージェント',
    speciality: 'mathematics',
    biasValue: 'TRUE',
    confidence: 0.8,
  };
  coordinator.addAgent(custom);
  assert(coordinator.getAgents().length === 6);
  coordinator.removeAgent('agent-custom');
  assert(coordinator.getAgents().length === 5);
});

test('MultiAgentCoordinator: coordinate maxRounds=1', () => {
  const result = coordinator.coordinate({
    topic: '未定義の状態',
    maxRounds: 1,
  });
  assert(result.consensus.rounds.length <= 1, 'should have at most 1 round');
});

test('MultiAgentCoordinator: summary に必要な情報が含まれる', () => {
  const result = coordinator.coordinate({ topic: '矛盾する命題の分析' });
  assert(result.summary.includes('トピック'));
  assert(result.summary.includes('参加エージェント'));
  assert(result.summary.includes('最終合意値'));
  assert(result.summary.includes('合意確信度'));
});

test('MultiAgentCoordinator: sessions カウントが増加', () => {
  const before = coordinator.stats().sessions;
  coordinator.coordinate({ topic: 'テスト推論' });
  const after = coordinator.stats().sessions;
  assert(after === before + 1, `sessions should increment: ${before} → ${after}`);
});

// ── 結果 ──
console.log(`\n=== 結果: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
