import { TemporalReasoningEngine } from '../src/axiom-os/temporal-reasoning';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function assertEq<T>(a: T, b: T, m?: string) {
  if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`);
}

console.log('\n=== TemporalReasoningEngine Tests ===\n');

const engine = new TemporalReasoningEngine();

// ── トラック開始 ──
test('startTrack: IDが返る', () => {
  const id = engine.startTrack('テストトピック');
  assert(id.startsWith('track-'), `id=${id}`);
});

test('startTrack: 初期スナップショットが記録される', () => {
  const id = engine.startTrack('初期値テスト', 'TRUE');
  const tl = engine.getTimeline(id)!;
  assert(tl.now !== undefined, 'now should exist');
  assertEq(tl.now!.value, 'TRUE', 'initial value');
});

// ── past演算子 ──
test('applyPast: 全値→〇', () => {
  const values = ['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'] as const;
  for (const v of values) {
    assertEq(engine.applyPast(v), 'ZERO', `past(${v}) should be ZERO`);
  }
});

test('recordPast: スナップショットが記録される', () => {
  const id = engine.startTrack('past記録テスト');
  const snap = engine.recordPast(id, 'TRUE', 'テスト過去');
  assert(snap !== null, 'snap should not be null');
  assertEq(snap!.axis, 'past', 'axis');
  assertEq(snap!.value, 'ZERO', 'past value should be ZERO');
});

// ── future演算子 ──
test('applyFuture: ⊤→～', () => {
  assertEq(engine.applyFuture('TRUE'), 'FLOWING');
});
test('applyFuture: ⊥→～', () => {
  assertEq(engine.applyFuture('FALSE'), 'FLOWING');
});
test('applyFuture: both→∞', () => {
  assertEq(engine.applyFuture('BOTH'), 'INFINITY');
});
test('applyFuture: neither→〇', () => {
  assertEq(engine.applyFuture('NEITHER'), 'ZERO');
});
test('applyFuture: 〇→～', () => {
  assertEq(engine.applyFuture('ZERO'), 'FLOWING');
});
test('applyFuture: ∞→∞', () => {
  assertEq(engine.applyFuture('INFINITY'), 'INFINITY');
});

// ── recordNow ──
test('recordNow: currentValueが更新される', () => {
  const id = engine.startTrack('now更新テスト', 'ZERO');
  engine.recordNow(id, 'TRUE', '状態変化');
  const tl = engine.getTimeline(id)!;
  assertEq(tl.currentValue, 'TRUE', 'currentValue updated');
});

// ── 条件付き予測 ──
test('addPrediction: 予測が追加される', () => {
  const id = engine.startTrack('予測テスト');
  const pred = engine.addPrediction(id, '条件X', 'TRUE', 'TRUE');
  assert(pred !== null, 'pred should not be null');
  assert(pred!.id.startsWith('pred-'), `predId=${pred!.id}`);
  assertEq(pred!.condition, '条件X', 'condition');
});

test('addPrediction: 条件がFLOWINGなら予測も流動化', () => {
  const id = engine.startTrack('流動予測テスト');
  const pred = engine.addPrediction(id, '不確定条件', 'FLOWING', 'TRUE');
  assert(pred !== null, 'pred should not be null');
  assertEq(pred!.predictedValue, 'FLOWING', 'flowing condition → flowing prediction');
});

// ── 予測解決 ──
test('resolvePrediction: 正解はTRUE', () => {
  const id = engine.startTrack('解決テスト');
  const pred = engine.addPrediction(id, 'テスト条件', 'TRUE', 'TRUE')!;
  const result = engine.resolvePrediction(id, pred.id, 'TRUE');
  assert(result !== null, 'result not null');
  assert(result!.correct, 'should be correct');
  assertEq(result!.delta, 'TRUE', 'delta TRUE');
});

test('resolvePrediction: 不正解はBOTH（矛盾）', () => {
  const id = engine.startTrack('不正解テスト');
  const pred = engine.addPrediction(id, 'テスト条件', 'TRUE', 'TRUE')!;
  const result = engine.resolvePrediction(id, pred.id, 'FALSE');
  assert(result !== null, 'result not null');
  assert(!result!.correct, 'should be incorrect');
  assertEq(result!.delta, 'BOTH', 'misprediction → BOTH');
});

// ── getTimeline ──
test('getTimeline: past/now/futureに分類される', () => {
  const id = engine.startTrack('タイムライン分類テスト', 'ZERO');
  engine.recordPast(id, 'TRUE', '過去');
  engine.recordFuture(id, 'TRUE', '未来');
  const tl = engine.getTimeline(id)!;
  assert(tl.past.length >= 1, 'past exists');
  assert(tl.now !== undefined, 'now exists');
  assert(tl.future.length >= 1, 'future exists');
});

test('getTimeline: 存在しないトラックはnull', () => {
  const r = engine.getTimeline('invalid-track');
  assert(r === null, 'Should return null');
});

// ── トレンド ──
test('trend: 同じ値が続くとTRUE（安定）', () => {
  const id = engine.startTrack('安定トレンドテスト', 'TRUE');
  engine.recordNow(id, 'TRUE');
  engine.recordNow(id, 'TRUE');
  const tl = engine.getTimeline(id)!;
  assertEq(tl.trend, 'TRUE', 'stable trend = TRUE');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
