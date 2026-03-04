import { LocalAxiomLLM } from '../src/axiom-os/local-axiom-llm';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch(e: any) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function assertEq<T>(a: T, b: T, m?: string) {
  if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`); }

console.log('\n=== LocalAxiomLLM Tests ===\n');

const llm = new LocalAxiomLLM({ provider: 'mock' });

test('buildSystemPrompt: D-FUMTが注入される', () => {
  const p = llm.buildSystemPrompt();
  assert(p.includes('D-FUMT'), 'D-FUMT');
  assert(p.includes('七価論理'), '七価論理');
});
test('buildSystemPrompt: maxAxioms=3が守られる', () => {
  const llm3 = new LocalAxiomLLM({ provider: 'mock', maxAxioms: 3 });
  const p = llm3.buildSystemPrompt();
  assert((p.match(/dfumt-/g) ?? []).length <= 3, 'max 3 axioms');
});
test('classifyResponse: ⊤', () => { assertEq(llm.classifyResponse('[七価: ⊤]'), 'TRUE'); });
test('classifyResponse: ⊥', () => { assertEq(llm.classifyResponse('[七価: ⊥]'), 'FALSE'); });
test('classifyResponse: BOTH', () => { assertEq(llm.classifyResponse('[七価: BOTH]'), 'BOTH'); });
test('classifyResponse: ～', () => { assertEq(llm.classifyResponse('[七価: ～]'), 'FLOWING'); });
test('classifyResponse: NEITHER', () => { assertEq(llm.classifyResponse('[七価: NEITHER]'), 'NEITHER'); });
test('classifyResponse: ∞', () => { assertEq(llm.classifyResponse('[七価: ∞]'), 'INFINITY'); });
test('classifyResponse: 〇', () => { assertEq(llm.classifyResponse('[七価: 〇]'), 'ZERO'); });
test('classifyResponse: キーワード→TRUE', () => { assertEq(llm.classifyResponse('はい、正しい'), 'TRUE'); });
test('classifyResponse: キーワード→FALSE', () => { assertEq(llm.classifyResponse('いいえ、誤り'), 'FALSE'); });
test('classifyResponse: 不明→ZERO', () => { assertEq(llm.classifyResponse('xyzzy'), 'ZERO'); });
test('matchAxioms: 配列を返す', () => {
  assert(Array.isArray(llm.matchAxioms('テスト')), 'array');
});
test('matchAxioms: 最大3件', () => {
  assert(llm.matchAxioms('あらゆる質問').length <= 3, 'max 3');
});
test('mockComplete: 構造が正しい', () => {
  const r = (llm as any).mockComplete('テスト');
  assert(r.text.length > 0, 'text');
  assert(r.isOffline === true, 'isOffline');
  assert(r.providerInfo === 'mock', 'provider');
});
test('axiomCount: 75理論', () => {
  assertEq(SEED_KERNEL.length, 75, '75 theories');
});
test('axiomInjection=false: プロンプト空でも動作', () => {
  const llmOff = new LocalAxiomLLM({ provider: 'mock', axiomInjection: false });
  const r = (llmOff as any).mockComplete('テスト', undefined);
  assert(r.text.length > 0, 'still works');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
