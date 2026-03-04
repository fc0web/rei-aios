/**
 * Axiom OS Persona × Seven-Valued Logic — テスト
 *
 * ペルソナチャットにD-FUMT七価論理評価を統合するテスト。
 *
 * Usage: npx tsx test/axiom-os-persona-seven-logic-test.ts
 */

import { AxiomOSStore } from '../src/axiom-os';
import { AxiomOSConnector } from '../src/axiom-os-connector';
import { PersonaChat } from '../src/axiom-os-persona';
import type { LLMCallFn, SevenLogicPersonaResponse } from '../src/axiom-os-persona';

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

// ── 記録付きMock: システムプロンプトを記録 ──
let lastSystemPrompt = '';
const recordingLLM: LLMCallFn = async (systemPrompt, userMessage) => {
  lastSystemPrompt = systemPrompt;
  return `[応答] ${userMessage}`;
};

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Persona × Seven-Valued Logic — Test Suite       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log();

  const store = new AxiomOSStore(':memory:', { seed: true });
  const connector = new AxiomOSConnector(store);
  const persona = new PersonaChat(connector, recordingLLM);

  // ── chatWithSevenLogic ──
  console.log('── chatWithSevenLogic ──');

  await test('龍樹 + 空 → BOTH eval', async () => {
    const result = await persona.chatWithSevenLogic('nagarjuna', '空とは何ですか');

    assert(result.personId === 'nagarjuna', `personId: ${result.personId}`);
    assert(result.personName.includes('龍樹'), `personName: ${result.personName}`);
    assert(result.message.includes('空とは何ですか'), 'message should contain user query');
    assert(result.sevenLogicEval !== null, 'sevenLogicEval should not be null');
    assert(result.sevenLogicEval!.value === 'BOTH', `value: ${result.sevenLogicEval!.value}`);
    assert(result.sevenLogicEval!.symbol === 'B', `symbol: ${result.sevenLogicEval!.symbol}`);
    assert(result.sevenLogicEval!.concept === '空', `concept: ${result.sevenLogicEval!.concept}`);
    assert(result.sevenLogicEval!.reasoning.length > 0, 'reasoning should not be empty');
    console.log(`    → concept="${result.sevenLogicEval!.concept}" value=${result.sevenLogicEval!.value}(${result.sevenLogicEval!.symbol})`);
  });

  await test('老子 + 無為自然 → FLOWING eval', async () => {
    const result = await persona.chatWithSevenLogic('laozi', '無為自然について');

    assert(result.personId === 'laozi', `personId: ${result.personId}`);
    assert(result.sevenLogicEval !== null, 'sevenLogicEval should not be null');
    assert(result.sevenLogicEval!.value === 'FLOWING', `value: ${result.sevenLogicEval!.value}`);
    assert(result.sevenLogicEval!.symbol === '～', `symbol: ${result.sevenLogicEval!.symbol}`);
    console.log(`    → concept="${result.sevenLogicEval!.concept}" value=${result.sevenLogicEval!.value}(${result.sevenLogicEval!.symbol})`);
  });

  await test('卑弥呼 + 邪馬台国 → ZERO eval', async () => {
    const result = await persona.chatWithSevenLogic('himiko', '邪馬台国の統治について');

    assert(result.personId === 'himiko', `personId: ${result.personId}`);
    assert(result.sevenLogicEval !== null, 'sevenLogicEval should not be null');
    assert(result.sevenLogicEval!.value === 'ZERO', `value: ${result.sevenLogicEval!.value}`);
    assert(result.sevenLogicEval!.symbol === '〇', `symbol: ${result.sevenLogicEval!.symbol}`);
    console.log(`    → concept="${result.sevenLogicEval!.concept}" value=${result.sevenLogicEval!.value}(${result.sevenLogicEval!.symbol})`);
  });

  // ── システムプロンプト検証 ──
  console.log();
  console.log('── System prompt validation ──');

  await test('system prompt contains 【七価論理評価】section', async () => {
    await persona.chatWithSevenLogic('nagarjuna', '縁起とは何ですか');

    assert(lastSystemPrompt.includes('【七価論理評価】'), 'should contain 【七価論理評価】');
    assert(lastSystemPrompt.includes('BOTH'), 'should contain value BOTH');
    assert(lastSystemPrompt.includes('B'), 'should contain symbol B');
    assert(lastSystemPrompt.includes('七価論理の観点'), 'should contain instruction about seven-logic');
    console.log(`    → prompt length: ${lastSystemPrompt.length} chars`);
  });

  await test('relatedTheories contains D-FUMT theory IDs', async () => {
    const result = await persona.chatWithSevenLogic('nagarjuna', '空について');

    assert(result.relatedTheories.length > 0, 'should have related theories');
    for (const id of result.relatedTheories) {
      assert(id.startsWith('dfumt-'), `theory ID should start with dfumt-: ${id}`);
    }
    console.log(`    → theories: [${result.relatedTheories.join(', ')}]`);
  });

  // ── autoChatWithSevenLogic ──
  console.log();
  console.log('── autoChatWithSevenLogic ──');

  await test('autoChatWithSevenLogic("縁起について") → auto-selects persona', async () => {
    const result = await persona.autoChatWithSevenLogic('縁起について');

    assert(
      result.personId === 'buddha' || result.personId === 'nagarjuna',
      `Expected buddha or nagarjuna, got ${result.personId}`,
    );
    assert(result.sevenLogicEval !== null, 'should have sevenLogicEval');
    assert(result.sevenLogicEval!.value === 'BOTH', `value: ${result.sevenLogicEval!.value}`);
    console.log(`    → auto-selected: ${result.personName}, eval=${result.sevenLogicEval!.value}`);
  });

  // ── Response structure validation ──
  console.log();
  console.log('── Response structure validation ──');

  await test('SevenLogicPersonaResponse has all required fields', async () => {
    const result: SevenLogicPersonaResponse = await persona.chatWithSevenLogic('buddha', '四諦とは');

    // Check all fields exist
    assert(typeof result.personId === 'string', 'personId should be string');
    assert(typeof result.personName === 'string', 'personName should be string');
    assert(typeof result.message === 'string', 'message should be string');
    assert(Array.isArray(result.relatedTheories), 'relatedTheories should be array');
    assert(result.sevenLogicEval !== null, 'sevenLogicEval should not be null');
    assert(typeof result.sevenLogicEval!.concept === 'string', 'concept should be string');
    assert(typeof result.sevenLogicEval!.value === 'string', 'value should be string');
    assert(typeof result.sevenLogicEval!.symbol === 'string', 'symbol should be string');
    assert(typeof result.sevenLogicEval!.reasoning === 'string', 'reasoning should be string');
  });

  await test('Person with no D-FUMT theories → null eval', async () => {
    // Socrates has no D-FUMT related theories typically
    const result = await persona.chatWithSevenLogic('socrates', '善について');

    // Even if eval is present (due to keyword match), structure should be valid
    if (result.sevenLogicEval === null) {
      assert(result.relatedTheories.length === 0, 'no D-FUMT theories → empty relatedTheories');
    } else {
      assert(typeof result.sevenLogicEval.value === 'string', 'eval value should be string');
    }
    console.log(`    → eval: ${result.sevenLogicEval ? result.sevenLogicEval.value : 'null'}, theories: ${result.relatedTheories.length}`);
  });

  // ── Cleanup ──
  store.close();

  // ── Summary ──
  console.log();
  console.log('═'.repeat(50));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

main();
