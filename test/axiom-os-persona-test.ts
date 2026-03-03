/**
 * Axiom OS Persona — テスト
 *
 * LLM呼び出しはモックで検証。プロンプト生成・人物選択ロジックを確認する。
 *
 * Usage: npx tsx test/axiom-os-persona-test.ts
 */

import { AxiomOSStore } from '../src/axiom-os';
import { AxiomOSConnector } from '../src/axiom-os-connector';
import { PersonaChat } from '../src/axiom-os-persona';
import type { LLMCallFn } from '../src/axiom-os-persona';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// ── Mock LLM: システムプロンプトとユーザーメッセージをエコーバック ──
const mockLLM: LLMCallFn = async (systemPrompt, userMessage) => {
  return `[MOCK] system=${systemPrompt.length}chars | user="${userMessage}"`;
};

// ── 記録付きMock: 呼び出し内容を記録 ──
let lastCall = { systemPrompt: '', userMessage: '' };
const recordingLLM: LLMCallFn = async (systemPrompt, userMessage) => {
  lastCall = { systemPrompt, userMessage };
  return `[応答] ${userMessage}`;
};

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Axiom OS Persona — Test Suite           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log();

  const store = new AxiomOSStore(':memory:', { seed: true });
  const connector = new AxiomOSConnector(store);

  // ── buildSystemPrompt ──
  console.log('── buildSystemPrompt ──');

  const persona = new PersonaChat(connector, recordingLLM);

  await test('仏陀のプロンプト生成', async () => {
    const thought = connector.getPersonThought('buddha')!;
    const prompt = persona.buildSystemPrompt(thought.person, thought.relatedTheories);

    assert(prompt.includes('仏陀'), 'should contain 仏陀');
    assert(prompt.includes('Siddhartha Gautama'), 'should contain English name');
    assert(prompt.includes('四諦'), 'should contain 四諦');
    assert(prompt.includes('八正道'), 'should contain 八正道');
    assert(prompt.includes('縁起'), 'should contain 縁起');
    assert(prompt.includes('南アジア'), 'should contain 南アジア');
    assert(prompt.includes('核心公理'), 'should contain 核心公理 section');
    assert(prompt.includes('応答ルール'), 'should contain 応答ルール');
    console.log(`    → ${prompt.split('\n').length} lines generated`);
  });

  await test('ソクラテスのプロンプト生成', async () => {
    const thought = connector.getPersonThought('socrates')!;
    const prompt = persona.buildSystemPrompt(thought.person);

    assert(prompt.includes('ソクラテス'), 'should contain ソクラテス');
    assert(prompt.includes('Socrates'), 'should contain Socrates');
    assert(prompt.includes('無知の知'), 'should contain 無知の知');
    assert(prompt.includes('問答法'), 'should contain 問答法');
    assert(prompt.includes('古代ギリシア'), 'should contain 古代ギリシア');
  });

  await test('卑弥呼のプロンプト（一人称: わらわ）', async () => {
    const thought = connector.getPersonThought('himiko')!;
    const prompt = persona.buildSystemPrompt(thought.person);

    assert(prompt.includes('卑弥呼'), 'should contain 卑弥呼');
    assert(prompt.includes('わらわ'), 'should contain わらわ');
    assert(prompt.includes('鬼道'), 'should contain 鬼道');
  });

  await test('ヴィトゲンシュタインのプロンプト', async () => {
    const thought = connector.getPersonThought('wittgenstein')!;
    const prompt = persona.buildSystemPrompt(thought.person);

    assert(prompt.includes('ヴィトゲンシュタイン'), 'should contain name');
    assert(prompt.includes('言語ゲーム'), 'should contain 言語ゲーム');
    assert(prompt.includes('近世〜近代ヨーロッパ'), 'should contain region');
  });

  // ── chat ──
  console.log();
  console.log('── chat (指定人物で応答) ──');

  await test('chat("himiko", "邪馬台国について教えて")', async () => {
    const result = await persona.chat('himiko', '邪馬台国について教えて');

    assert(result.personId === 'himiko', 'personId mismatch');
    assert(result.personName === '卑弥呼', 'personName mismatch');
    assert(result.response.includes('邪馬台国について教えて'), 'response should echo user message');
    assert(lastCall.systemPrompt.includes('卑弥呼'), 'LLM should receive 卑弥呼 prompt');
    assert(lastCall.systemPrompt.includes('鬼道'), 'prompt should contain 鬼道');
    console.log(`    → prompt: ${result.systemPrompt.length} chars`);
  });

  await test('chat("socrates", "数学とは何ですか")', async () => {
    const result = await persona.chat('socrates', '数学とは何ですか');

    assert(result.personId === 'socrates', 'personId mismatch');
    assert(lastCall.systemPrompt.includes('ソクラテス'), 'should be Socrates prompt');
    assert(lastCall.systemPrompt.includes('無知の知'), 'should contain core axiom');
    assert(lastCall.userMessage === '数学とは何ですか', 'user message should pass through');
  });

  await test('chat("laozi", "現代のストレスについて")', async () => {
    const result = await persona.chat('laozi', '現代のストレスについて');

    assert(result.personId === 'laozi', 'personId mismatch');
    assert(lastCall.systemPrompt.includes('老子'), 'should be Laozi prompt');
    assert(lastCall.systemPrompt.includes('無為自然'), 'should contain 無為自然');
    assert(lastCall.systemPrompt.includes('道徳経'), 'should contain 道徳経');
  });

  await test('chat with non-existent person → error', async () => {
    try {
      await persona.chat('nonexistent', 'test');
      throw new Error('Should have thrown');
    } catch (e: any) {
      assert(e.message.includes('Person not found'), `Unexpected error: ${e.message}`);
    }
  });

  // ── autoChat ──
  console.log();
  console.log('── autoChat (自動人物選択) ──');

  await test('autoChat("縁起について教えて") → 仏陀 or 龍樹', async () => {
    const result = await persona.autoChat('縁起について教えて');

    assert(
      result.personId === 'buddha' || result.personId === 'nagarjuna',
      `Expected buddha or nagarjuna, got ${result.personId}`,
    );
    assert(result.searchScore > 0, 'should have positive score');
    assert(result.candidateCount > 0, 'should have candidates');
    console.log(`    → selected: ${result.personName} (score=${result.searchScore}, candidates=${result.candidateCount})`);
  });

  await test('autoChat("弁証法とは") → ヘーゲル', async () => {
    const result = await persona.autoChat('弁証法とは');

    assert(result.personId === 'hegel', `Expected hegel, got ${result.personId}`);
    console.log(`    → selected: ${result.personName} (score=${result.searchScore})`);
  });

  await test('autoChat("無為自然について") → 老子', async () => {
    const result = await persona.autoChat('無為自然について');

    assert(result.personId === 'laozi', `Expected laozi, got ${result.personId}`);
    console.log(`    → selected: ${result.personName} (score=${result.searchScore})`);
  });

  await test('autoChat("イデアとは何か") → プラトン', async () => {
    const result = await persona.autoChat('イデアとは何か');

    assert(result.personId === 'plato', `Expected plato, got ${result.personId}`);
    console.log(`    → selected: ${result.personName} (score=${result.searchScore})`);
  });

  await test('autoChat("即身成仏について") → 空海', async () => {
    const result = await persona.autoChat('即身成仏について');

    assert(result.personId === 'kukai', `Expected kukai, got ${result.personId}`);
    console.log(`    → selected: ${result.personName} (score=${result.searchScore})`);
  });

  // ── multiChat ──
  console.log();
  console.log('── multiChat (多視点応答) ──');

  await test('multiChat("道とは") → 複数人物が応答', async () => {
    const results = await persona.multiChat('道とは', 3);

    assert(results.length > 0, 'should have at least 1 result');
    assert(results.length <= 3, `should have at most 3, got ${results.length}`);

    const ids = results.map(r => r.personId);
    console.log(`    → ${results.map(r => r.personName).join(', ')}`);

    // 老子 or 荘子 or 道元 が含まれるはず
    const daoRelated = ids.filter(id => ['laozi', 'zhuangzi', 'dogen', 'kukai'].includes(id));
    assert(daoRelated.length > 0, `Expected dao-related persons, got [${ids.join(', ')}]`);
  });

  // ── Cleanup ──
  store.close();

  // ── Summary ──
  console.log();
  console.log('═'.repeat(42));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(42));

  process.exit(failed > 0 ? 1 : 0);
}

main();
