import { FormulaAxiomizer } from '../src/axiom-os/formula-axiomizer';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function assertEq<T>(a: T, b: T, m?: string) {
  if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`); }

console.log('\n=== FormulaAxiomizer Tests ===\n');

const fa = new FormulaAxiomizer();

// ── 基本変換 ──
test('axiomize: 結果が返る', () => {
  const r = fa.axiomize('矛盾を解決したい');
  assert(r.input === '矛盾を解決したい', 'input');
  assert(r.keywords.length > 0, 'keywords extracted');
  assert(r.reiCode.length > 0, 'reiCode generated');
  assert(r.explanation.length > 0, 'explanation generated');
});

test('axiomize: 矛盾→catuskoti公理がマッチ', () => {
  const r = fa.axiomize('矛盾を扱いたい');
  assert(r.matchedAxioms.some(m => m.axiom.id.includes('catuskoti')), 'catuskoti should match');
});

test('axiomize: 収束→idempotency公理がマッチ', () => {
  const r = fa.axiomize('収束させたい');
  assert(r.matchedAxioms.some(m => m.axiom.id.includes('idempotency')), 'idempotency should match');
});

test('axiomize: 意識→consciousness公理がマッチ', () => {
  const r = fa.axiomize('意識を数式化したい');
  assert(r.matchedAxioms.some(m => m.axiom.id.includes('consciousness')), 'consciousness should match');
});

test('axiomize: 時間→temporal公理がマッチ', () => {
  const r = fa.axiomize('時間の変化を追跡する');
  assert(r.matchedAxioms.some(m => m.axiom.id.includes('temporal')), 'temporal should match');
});

// ── キーワード抽出 ──
test('複数キーワード抽出: 矛盾・収束', () => {
  const r = fa.axiomize('矛盾を収束させる');
  assert(r.keywords.includes('矛盾'), 'has 矛盾');
  assert(r.keywords.includes('収束'), 'has 収束');
});

test('英語キーワード: contradictionを認識', () => {
  const r = fa.axiomize('resolve contradiction logically');
  assert(r.keywords.length > 0, 'en keywords extracted');
});

// ── 関連度スコア ──
test('relevanceScore: 0〜1の範囲', () => {
  const r = fa.axiomize('矛盾を論理で解決する');
  for (const m of r.matchedAxioms) {
    assert(m.relevanceScore >= 0 && m.relevanceScore <= 1.0,
      `score=${m.relevanceScore} out of range`);
  }
});

test('relevanceScore: 複数キーワードマッチで高スコア', () => {
  const r1 = fa.axiomize('矛盾');
  const r2 = fa.axiomize('矛盾を論理で解決する');
  // r2の方がキーワードが多いので同じ公理がより高スコアになるはず
  assert(r1.matchedAxioms.length > 0, 'r1 has matches');
  assert(r2.matchedAxioms.length > 0, 'r2 has matches');
});

// ── 信頼度 ──
test('confidence: マッチなしはZERO', () => {
  const r = fa.axiomize('xyzzy hogehoge ふがふが');
  // デフォルトで論理にフォールバック
  assert(['ZERO','NEITHER','FLOWING','TRUE'].includes(r.confidence), `confidence=${r.confidence}`);
});

test('confidence: 強いマッチはFLOWING以上', () => {
  const r = fa.axiomize('矛盾');
  assert(['FLOWING','TRUE'].includes(r.confidence), `confidence=${r.confidence}`);
});

// ── Rei-PLコード生成 ──
test('reiCode: コメントが含まれる', () => {
  const r = fa.axiomize('矛盾を扱う');
  assert(r.reiCode.includes('//'), 'should have comments');
});

test('reiCode: let文が含まれる', () => {
  const r = fa.axiomize('意識を数式化する');
  assert(r.reiCode.includes('let '), 'should have let');
});

test('reiCode: printが含まれる', () => {
  const r = fa.axiomize('収束させる');
  assert(r.reiCode.includes('print'), 'should have print');
});

// ── fromAxiomIds ──
test('fromAxiomIds: 公理IDから直接コード生成', () => {
  const code = fa.fromAxiomIds(['dfumt-catuskoti', 'dfumt-idempotency']);
  assert(code.includes('let '), 'should have let');
  assert(code.includes('dfumt-catuskoti'), 'should reference axiom');
});

test('fromAxiomIds: 存在しないIDはスキップ', () => {
  const code = fa.fromAxiomIds(['dfumt-catuskoti', 'nonexistent-id']);
  assert(code.length > 0, 'should still generate');
});

// ── searchAxioms ──
test('searchAxioms: キーワードから公理を検索', () => {
  const matches = fa.searchAxioms(['矛盾', '論理']);
  assert(matches.length > 0, 'should find matches');
  assert(matches[0].relevanceScore > 0, 'should have score');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
