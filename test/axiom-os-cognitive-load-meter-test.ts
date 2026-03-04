import { CognitiveLoadMeter } from '../src/axiom-os/cognitive-load-meter';
import type { SevenLogicValue } from '../src/axiom-os/seven-logic';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch(e: any) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function assertEq<T>(a: T, b: T, m?: string) {
  if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`); }

const VALID_SEVEN: SevenLogicValue[] = ['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'];

console.log('\n=== CognitiveLoadMeter Tests ===\n');
const meter = new CognitiveLoadMeter();

// ── セッション ──
test('startSession: IDが返る', () => {
  const id = meter.startSession('テスト');
  assert(id.startsWith('load-session-'), `id=${id}`);
});

test('getSession: セッションが取得できる', () => {
  const id = meter.startSession();
  const s = meter.getSession(id);
  assert(s !== undefined, 'session exists');
  assertEq(s!.snapshots.length, 0, 'empty snapshots');
});

// ── 計測 ──
test('measure: スナップショットが返る', () => {
  const id = meter.startSession();
  const snap = meter.measure(id, { depth: 2, axiomCount: 3, logicValues: ['TRUE','FALSE'] });
  assert(snap !== null, 'snap not null');
  assert(snap!.id.startsWith('snap-'), `snapId=${snap!.id}`);
  assert(VALID_SEVEN.includes(snap!.loadValue), `loadValue=${snap!.loadValue}`);
});

test('measure: rawScoreが0〜100', () => {
  const id = meter.startSession();
  const snap = meter.measure(id, { depth: 3, axiomCount: 5, logicValues: ['TRUE','BOTH','FLOWING'] });
  assert(snap!.rawScore >= 0 && snap!.rawScore <= 100, `score=${snap!.rawScore}`);
});

test('measure: 深度が高いほどスコアが高い', () => {
  const id = meter.startSession();
  const s1 = meter.measure(id, { depth: 1, axiomCount: 1, logicValues: ['TRUE'] });
  const s2 = meter.measure(id, { depth: 5, axiomCount: 1, logicValues: ['TRUE'] });
  assert(s2!.rawScore > s1!.rawScore, `s1=${s1!.rawScore} s2=${s2!.rawScore}`);
});

test('measure: 矛盾が多いとBOTH', () => {
  const id = meter.startSession();
  const snap = meter.measure(id, {
    depth: 1, axiomCount: 1,
    logicValues: ['BOTH','BOTH','BOTH','BOTH','TRUE'],
  });
  assertEq(snap!.loadValue, 'BOTH', 'high contradiction → BOTH');
});

test('measure: 過負荷はINFINITY', () => {
  const id = meter.startSession();
  const snap = meter.measure(id, {
    depth: 8, axiomCount: 10,
    logicValues: ['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'],
  });
  assert(snap!.rawScore > 60, `score should be high: ${snap!.rawScore}`);
  assert(['INFINITY','FLOWING','BOTH'].includes(snap!.loadValue),
    `overload loadValue=${snap!.loadValue}`);
});

test('measure: 最適負荷はTRUE', () => {
  const id = meter.startSession();
  const snap = meter.measure(id, { depth: 2, axiomCount: 2, logicValues: ['TRUE','TRUE'] });
  assertEq(snap!.loadValue, 'TRUE', 'optimal → TRUE');
});

test('measure: 存在しないセッションはnull', () => {
  const r = meter.measure('invalid', { depth: 1, axiomCount: 1, logicValues: [] });
  assert(r === null, 'invalid session → null');
});

// ── アラート ──
test('getAlerts: optimal範囲でoptimalアラート', () => {
  const id = meter.startSession();
  meter.measure(id, { depth: 2, axiomCount: 2, logicValues: ['TRUE','TRUE'] });
  const alerts = meter.getAlerts(id);
  assert(alerts.includes('optimal'), `alerts=${alerts}`);
});

test('getAlerts: 矛盾多でcontradictionアラート', () => {
  const id = meter.startSession();
  meter.measure(id, { depth: 1, axiomCount: 1, logicValues: ['BOTH','BOTH','BOTH'] });
  const alerts = meter.getAlerts(id);
  assert(alerts.includes('contradiction'), `alerts=${alerts}`);
});

test('getAlerts: 高スコアでoverloadアラート', () => {
  const id = meter.startSession();
  meter.measure(id, { depth: 9, axiomCount: 15, logicValues: ['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'] });
  const alerts = meter.getAlerts(id);
  assert(alerts.includes('overload') || alerts.includes('approaching'), `alerts=${alerts}`);
});

// ── 推奨 ──
test('recommend: 最適時は最適メッセージ', () => {
  const id = meter.startSession();
  meter.measure(id, { depth: 2, axiomCount: 2, logicValues: ['TRUE'] });
  const recs = meter.recommend(id);
  assert(recs.length > 0, 'has recommendations');
  assert(recs.some(r => r.includes('最適')), 'optimal message');
});

test('recommend: 矛盾時はContradictionDetector提案', () => {
  const id = meter.startSession();
  meter.measure(id, { depth: 1, axiomCount: 1, logicValues: ['BOTH','BOTH','BOTH'] });
  const recs = meter.recommend(id);
  assert(recs.some(r => r.includes('ContradictionDetector')), 'contradiction recommendation');
});

// ── summarize ──
test('summarize: 構造が正しい', () => {
  const s = meter.summarize();
  assert(typeof s.totalSessions === 'number', 'totalSessions');
  assert(typeof s.totalSnapshots === 'number', 'totalSnapshots');
  assert(s.totalSessions > 0, 'has sessions');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
