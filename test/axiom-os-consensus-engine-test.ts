import { ConsensusEngine } from '../src/axiom-os/consensus-engine';
import type { InstanceVote } from '../src/axiom-os/consensus-engine';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch(e: any) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function assertEq<T>(a: T, b: T, m?: string) {
  if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`); }

function makeVote(id: string, value: import('../src/axiom-os/seven-logic').SevenLogicValue,
  confidence = 0.9): InstanceVote {
  return { instanceId: id, value, reasoning: `${id}の推論`, axiomRefs: ['dfumt-catuskoti'], confidence, timestamp: Date.now() };
}

console.log('\n=== ConsensusEngine Tests ===\n');
const ce = new ConsensusEngine();

// ── 全員一致 ──
test('全員TRUE → 合意TRUE', () => {
  const r = ce.reach('テスト', [makeVote('a','TRUE'), makeVote('b','TRUE'), makeVote('c','TRUE')]);
  assertEq(r.finalValue, 'TRUE', 'all TRUE → TRUE');
  assertEq(r.rounds[0].converged, true, 'converged round 1');
});

test('全員FALSE → 合意FALSE', () => {
  const r = ce.reach('テスト', [makeVote('a','FALSE'), makeVote('b','FALSE')]);
  assertEq(r.finalValue, 'FALSE');
});

// ── 矛盾と収束 ──
test('TRUE+FALSE → FALSE（AND論理）', () => {
  const r = ce.reach('矛盾テスト', [makeVote('a','TRUE'), makeVote('b','FALSE')]);
  assertEq(r.finalValue, 'FALSE', 'and(TRUE,FALSE) = FALSE');
});

test('BOTHのみ → TRUE（Ω収束）', () => {
  const r = ce.reach('BOTH収束', [makeVote('a','BOTH'), makeVote('b','BOTH')]);
  assertEq(r.finalValue, 'TRUE', 'BOTH → TRUE');
});

// ── FLOWING ──
test('FLOWINGは追加ラウンドで解決', () => {
  const r = ce.reach('流動テスト', [makeVote('a','TRUE'), makeVote('b','FLOWING')], 3);
  assert(r.rounds.length >= 1, 'should have rounds');
  assert(['TRUE','FALSE','NEITHER'].includes(r.finalValue), `final=${r.finalValue}`);
});

// ── NEITHER ──
test('NEITHERで合意 → 判断保留', () => {
  const r = ce.reach('保留テスト', [makeVote('a','NEITHER'), makeVote('b','NEITHER')]);
  assertEq(r.finalValue, 'NEITHER');
  assert(r.rounds[0].converged, 'NEITHER is converged');
});

// ── plurality ──
test('plurality: 最頻値を返す', () => {
  const votes = [makeVote('a','TRUE'), makeVote('b','TRUE'), makeVote('c','FALSE')];
  assertEq(ce.plurality(votes), 'TRUE', 'majority TRUE');
});

test('plurality: 票がなければZERO', () => {
  assertEq(ce.plurality([]), 'ZERO');
});

// ── weighted ──
test('weighted: 高信頼票が勝つ', () => {
  const votes = [
    makeVote('a','FALSE', 0.3),
    makeVote('b','TRUE',  0.9),
    makeVote('c','TRUE',  0.8),
  ];
  assertEq(ce.weighted(votes), 'TRUE', 'high confidence TRUE wins');
});

// ── 結果構造 ──
test('result: sessionIdが発行される', () => {
  const r = ce.reach('ID確認', [makeVote('a','TRUE')]);
  assert(r.sessionId.startsWith('consensus-'), `id=${r.sessionId}`);
});

test('result: axiomChainが含まれる', () => {
  const r = ce.reach('公理確認', [makeVote('a','TRUE'), makeVote('b','TRUE')]);
  assert(r.axiomChain.length > 0, 'axiom chain');
  assert(r.axiomChain.includes('dfumt-catuskoti'), 'catuskoti in chain');
});

test('result: totalVotesが正確', () => {
  const votes = [makeVote('a','TRUE'), makeVote('b','FALSE'), makeVote('c','NEITHER')];
  const r = ce.reach('投票数確認', votes);
  assertEq(r.totalVotes, 3, 'total votes');
});

// ── summarize ──
test('summarize: 文字列が返る', () => {
  const r = ce.reach('サマリーテスト', [makeVote('a','TRUE'), makeVote('b','TRUE')]);
  const s = ce.summarize(r);
  assert(s.includes('合意セッション'), 'has session');
  assert(s.includes('最終合意'), 'has final');
});

// ── confidence ──
test('全員一致は高確信度', () => {
  const r = ce.reach('確信度テスト', [makeVote('a','TRUE'), makeVote('b','TRUE'), makeVote('c','TRUE')]);
  assert(r.finalConfidence > 0.8, `confidence=${r.finalConfidence}`);
});

test('矛盾ありは低確信度', () => {
  const r = ce.reach('低信頼テスト', [makeVote('a','TRUE'), makeVote('b','FALSE'), makeVote('c','FALSE')]);
  assert(r.finalConfidence < 1.0, `confidence=${r.finalConfidence}`);
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
