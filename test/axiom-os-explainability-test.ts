import { ExplainabilityEngine } from '../src/axiom-os/explainability-engine';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function assertEq<T>(a: T, b: T, m?: string) {
  if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`);
}

console.log('\n=== ExplainabilityEngine Tests ===\n');

const engine = new ExplainabilityEngine();

// ── チェーン開始 ──
test('startChain: chainIdが返る', () => {
  const id = engine.startChain('テスト問い');
  assert(id.startsWith('chain-'), `id=${id}`);
});

test('getChain: 開始したチェーンが取得できる', () => {
  const id = engine.startChain('問い1');
  const chain = engine.getChain(id);
  assert(chain !== undefined, 'chain not found');
  assertEq(chain!.question, '問い1', 'question');
  assertEq(chain!.conclusion, 'ZERO', 'initial conclusion');
});

// ── ステップ記録 ──
test('recordStep: ステップが記録される', () => {
  const id = engine.startChain('推論テスト');
  const step = engine.recordStep(id, 'dfumt-catuskoti', 'ZERO', 'NEITHER', '四値論理適用');
  assert(step !== null, 'step should not be null');
  assert(step!.stepId.startsWith('step-'), `stepId=${step!.stepId}`);
  assertEq(step!.inputValue, 'ZERO', 'input');
  assertEq(step!.outputValue, 'NEITHER', 'output');
});

test('recordStep: 結論が更新される', () => {
  const id = engine.startChain('結論更新テスト');
  engine.recordStep(id, 'dfumt-catuskoti', 'ZERO', 'TRUE', 'テスト');
  const chain = engine.getChain(id)!;
  assertEq(chain.conclusion, 'TRUE', 'conclusion should update');
});

test('recordStep: 存在しないchainIdはnullを返す', () => {
  const r = engine.recordStep('invalid-id', 'dfumt-zero-pi', 'TRUE', 'FALSE', 'test');
  assert(r === null, 'Should return null for invalid chain');
});

// ── finalize ──
test('finalize: ExplanationReportが返る', () => {
  const id = engine.startChain('説明テスト');
  engine.recordStep(id, 'dfumt-idempotency', 'BOTH', 'TRUE', 'Ω収束');
  const report = engine.finalize(id);
  assert(report !== null, 'report should not be null');
  assert(report!.summary.length > 0, 'summary should not be empty');
  assert(report!.detail.length > 0, 'detail should not be empty');
  assert(report!.logicFlow.includes('→'), 'logicFlow should have arrow');
});

test('finalize: axiomRefsが含まれる', () => {
  const id = engine.startChain('公理参照テスト');
  engine.recordStep(id, 'dfumt-catuskoti', 'ZERO', 'NEITHER', 'step1');
  engine.recordStep(id, 'dfumt-idempotency', 'NEITHER', 'TRUE', 'step2');
  const report = engine.finalize(id)!;
  assert(report.axiomRefs.includes('dfumt-catuskoti'), 'axiomRef catuskoti');
  assert(report.axiomRefs.includes('dfumt-idempotency'), 'axiomRef idempotency');
  assertEq(report.axiomRefs.length, 2, 'unique axiomRefs');
});

test('finalize: 空チェーンでも動作する', () => {
  const id = engine.startChain('空チェーン');
  const report = engine.finalize(id);
  assert(report !== null, 'should work on empty chain');
  assert(report!.logicFlow === '〇', `logicFlow=${report!.logicFlow}`);
});

// ── buildChain ──
test('buildChain: 公理チェーンを自動構築', () => {
  const report = engine.buildChain(
    '意識とは何か',
    ['dfumt-zero-state', 'dfumt-consciousness-math', 'dfumt-center-periphery'],
    'ZERO',
  );
  assert(report !== null, 'should build chain');
  assert(report!.chain.steps.length > 0, 'should have steps');
  assert(report!.summary.includes('意識とは何か'), 'summary has question');
});

test('buildChain: 存在しない公理IDはスキップ', () => {
  const report = engine.buildChain(
    'テスト',
    ['dfumt-catuskoti', 'nonexistent-axiom', 'dfumt-idempotency'],
    'ZERO',
  );
  assert(report !== null, 'should work');
  assertEq(report!.chain.steps.length, 2, 'should skip invalid axiom');
});

// ── 信頼度 ──
test('overallConfidence: 全ステップTRUEなら信頼度TRUE', () => {
  const id = engine.startChain('信頼度テスト');
  engine.recordStep(id, 'dfumt-zero-pi', 'TRUE', 'TRUE', '恒等操作');
  const chain = engine.getChain(id)!;
  assertEq(chain.overallConfidence, 'TRUE', 'all same → TRUE');
});

test('overallConfidence: BOTHが含まれると信頼度BOTH', () => {
  const id = engine.startChain('矛盾信頼度テスト');
  engine.recordStep(id, 'dfumt-catuskoti', 'TRUE', 'BOTH', '矛盾発生');
  const chain = engine.getChain(id)!;
  assertEq(chain.overallConfidence, 'BOTH', 'contradiction → BOTH');
});

// ── logicFlow ──
test('logicFlow: 値の流れが記号で表現される', () => {
  const id = engine.startChain('フローテスト');
  engine.recordStep(id, 'dfumt-zero-state', 'ZERO', 'NEITHER', 'step1');
  engine.recordStep(id, 'dfumt-consciousness-math', 'NEITHER', 'FLOWING', 'step2');
  engine.recordStep(id, 'dfumt-idempotency', 'FLOWING', 'TRUE', 'step3');
  const report = engine.finalize(id)!;
  assert(report.logicFlow.includes('〇'), 'has ZERO symbol');
  assert(report.logicFlow.includes('⊤'), 'has TRUE symbol');
});

// ── getAll ──
test('getAll: 全チェーンが取得できる', () => {
  const before = engine.getAll().length;
  engine.startChain('追加テスト');
  const after = engine.getAll().length;
  assert(after > before, 'getAll should grow');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
