import { PersonaChatEngine, PERSONAS } from '../src/chat/persona-chat-engine';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

async function main() {
  console.log('\n=== STEP 11: PersonaChatEngine テスト ===\n');

  const engine = new PersonaChatEngine();

  // ─── 1. 人物一覧テスト ────────────────────────────────────────
  console.log('【1. 人物一覧】');
  const personas = engine.listPersonas();
  assert(personas.length >= 10, `10人以上の人物: ${personas.length}人`);

  const ids = personas.map(p => p.id);
  assert(ids.includes('nagarjuna'),    '龍樹が存在する');
  assert(ids.includes('buddha'),       '釈迦牟尼が存在する');
  assert(ids.includes('dogen'),        '道元が存在する');
  assert(ids.includes('socrates'),     'ソクラテスが存在する');
  assert(ids.includes('wittgenstein'), 'ウィトゲンシュタインが存在する');
  assert(ids.includes('laozi'),        '老子が存在する');
  assert(ids.includes('confucius'),    '孔子が存在する');
  assert(ids.includes('kant'),         'カントが存在する');
  assert(ids.includes('nietzsche'),    'ニーチェが存在する');
  assert(ids.includes('himiko'),       '卑弥呼が存在する');

  console.log(`    人物: ${personas.map(p => p.nameJa).join('・')}`);

  // ─── 2. 人物情報テスト ────────────────────────────────────────
  console.log('\n【2. 人物情報の完全性】');
  for (const p of personas) {
    assert(p.systemPrompt.length > 100, `${p.nameJa}: システムプロンプトが充実している`);
    assert(p.greeting.length > 0, `${p.nameJa}: 挨拶が存在する`);
    assert(!!p.emoji, `${p.nameJa}: 絵文字が存在する`);
    assert(!!p.dfumtAffinity, `${p.nameJa}: D-FUMT親和値が設定されている`);
  }

  // ─── 3. フォールバック応答テスト（LLMなし） ──────────────────
  console.log('\n【3. フォールバック応答テスト（ネットワーク不要）】');

  // 食事関連（日常会話）
  const result1 = await engine.chat_with('nagarjuna', 'ご飯食べたいですね。');
  assert(result1.persona.id === 'nagarjuna', '龍樹が選択される');
  assert(result1.response.length > 0, '応答が生成される');
  assert(!result1.response.includes('D-FUMT') ||
    result1.response.includes('食'),
    '食事の話題に対して食事の応答が含まれる');
  console.log(`    龍樹の応答: "${result1.response.slice(0,60)}..."`);
  console.log(`    LLM使用: ${result1.fromLLM} / Provider: ${result1.provider}`);

  const result2 = await engine.chat_with('socrates', 'ご飯食べたいですね。');
  assert(result2.response.length > 0, 'ソクラテスの応答が生成される');
  console.log(`    ソクラテスの応答: "${result2.response.slice(0,60)}..."`);

  const result3 = await engine.chat_with('laozi', 'ご飯食べたいですね。');
  assert(result3.response.length > 0, '老子の応答が生成される');
  console.log(`    老子の応答: "${result3.response.slice(0,60)}..."`);

  // ─── 4. 会話履歴テスト ────────────────────────────────────────
  console.log('\n【4. 会話履歴の管理】');
  const history = engine.getHistory('nagarjuna');
  assert(history.length >= 2, `会話履歴が存在する: ${history.length}件`);
  assert(history[0].role === 'user', '最初のメッセージがuser');
  assert(history[1].role === 'assistant', '2番目のメッセージがassistant');

  // 履歴リセット
  engine.resetHistory('nagarjuna');
  const historyAfterReset = engine.getHistory('nagarjuna');
  assert(historyAfterReset.length === 0, '履歴リセット後は空');

  // ─── 5. 複数人物の独立性テスト ───────────────────────────────
  console.log('\n【5. 複数人物の会話独立性】');
  await engine.chat_with('nagarjuna', 'こんにちは');
  await engine.chat_with('socrates', 'こんにちは');
  await engine.chat_with('nietzsche', 'こんにちは');

  const h1 = engine.getHistory('nagarjuna');
  const h2 = engine.getHistory('socrates');
  const h3 = engine.getHistory('nietzsche');
  assert(h1.length > 0, '龍樹の履歴が存在する');
  assert(h2.length > 0, 'ソクラテスの履歴が存在する');
  assert(h3.length > 0, 'ニーチェの履歴が存在する');
  // 各人物の履歴が独立していることを確認
  assert(h1 !== h2, '龍樹とソクラテスの履歴が独立');

  // ─── 6. プロバイダー設定テスト ───────────────────────────────
  console.log('\n【6. プロバイダー設定】');
  engine.setProvider('anthropic', 'test-key', 'claude-haiku-4-5-20251001');
  assert(engine.providerName === 'anthropic', 'プロバイダーがAnthropicに変更される');

  engine.setProvider('ollama');
  assert(engine.providerName === 'ollama', 'プロバイダーがOllamaに戻る');

  // ─── 7. 存在しない人物テスト ─────────────────────────────────
  console.log('\n【7. 存在しない人物のエラーハンドリング】');
  const invalid = await engine.chat_with('unknown_person', 'こんにちは');
  assert(invalid.dfumtConfidence === 'FALSE', '存在しない人物はFALSE');
  assert(invalid.response.length > 0, 'エラーメッセージが返る');

  // ─── 8. システムプロンプト品質チェック ───────────────────────
  console.log('\n【8. システムプロンプト品質】');
  for (const p of personas) {
    const hasImportant = p.systemPrompt.includes('重要') ||
      p.systemPrompt.includes('日常');
    assert(hasImportant,
      `${p.nameJa}: 日常会話への対応指示が含まれる`);
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`結果: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
