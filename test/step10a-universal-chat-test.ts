import { UniversalChat, DEFAULT_PROVIDERS, generateUniversalChatPanel, evalDFUMT } from '../src/chat/universal-chat';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('\n=== STEP 10-A: UniversalChat テスト ===\n');

const chat = new UniversalChat();

// ─── 1. プロバイダー一覧テスト ────────────────────────────────
console.log('【1. プロバイダー一覧】');
const providers = chat.listProviders();
assert(providers.length === 14, `14プロバイダー: ${providers.length}件`);

const freeProviders = chat.listFreeProviders();
assert(freeProviders.length >= 3, `無料プロバイダー3件以上: ${freeProviders.length}件`);

const ollamaConfig = chat.getProvider('ollama');
assert(ollamaConfig !== null, 'Ollamaが存在する');
assert(ollamaConfig!.free === true, 'Ollamaは無料');
assert(ollamaConfig!.requiresKey === false, 'OllamaはAPIキー不要');

const anthropicConfig = chat.getProvider('anthropic');
assert(anthropicConfig !== null, 'Anthropicが存在する');
assert(anthropicConfig!.requiresKey === true, 'AnthropicはAPIキー必要');

console.log(`    無料プロバイダー: ${freeProviders.map(p=>p.label).join(', ')}`);

// ─── 2. プロバイダー設定テスト ────────────────────────────────
console.log('\n【2. プロバイダー設定更新】');
chat.configure('anthropic', { apiKey: 'test-key-12345', model: 'claude-haiku-4-5-20251001' });
const updated = chat.getProvider('anthropic');
assert(updated!.apiKey === 'test-key-12345', 'APIキーが更新される');
assert(updated!.model === 'claude-haiku-4-5-20251001', 'モデルが更新される');

// ─── 3. D-FUMT確信度評価テスト ────────────────────────────────
console.log('\n【3. D-FUMT確信度の自動評価】');
const testCases = [
  { text: 'まず水を沸騰させてください。次に...', expected: 'TRUE' },
  { text: '一方で、場合によっては異なる方法もあります', expected: 'BOTH' },
  { text: 'この情報は最新のものです。現在変化しています', expected: 'FLOWING' },
  { text: 'わかりません。確認が必要です', expected: 'NEITHER' },
];

for (const tc of testCases) {
  const result = evalDFUMT(tc.text);
  assert(result === tc.expected, `evalDFUMT: "${tc.text.slice(0,20)}..." → ${result} (期待: ${tc.expected})`);
}

// ─── 4. WebUIパネル生成テスト ─────────────────────────────────
console.log('\n【4. WebUIパネル生成（axiom-os.html用）】');
const panel = generateUniversalChatPanel(DEFAULT_PROVIDERS);
assert(panel.includes('panel-universal'), 'パネルIDが存在する');
assert(panel.includes('provider-select'), 'プロバイダー選択が存在する');
assert(panel.includes('ollama'), 'Ollamaオプションが存在する');
assert(panel.includes('sendUniversal'), '送信関数が存在する');
assert(panel.includes('PRESETS'), 'プリセットが存在する');
assert(panel.includes('料理'), '料理プリセットが存在する');
assert(panel.includes('スポーツ'), 'スポーツプリセットが存在する');
assert(panel.includes('ゲーム'), 'ゲームプリセットが存在する');
assert(panel.includes('英語'), '英語プリセットが存在する');
assert(panel.includes('数学'), '数学プリセットが存在する');
assert(panel.includes('D-FUMT'), 'D-FUMTプリセットが存在する');
assert(panel.includes('DFUMT_SYMBOLS'), 'D-FUMT統合が存在する');
console.log(`    パネルサイズ: ${panel.length}文字`);

// ─── 5. プロバイダー完全性テスト ──────────────────────────────
console.log('\n【5. 14プロバイダー完全性確認】');
const providerNames = [
  'anthropic', 'openai', 'gemini', 'ollama', 'groq',
  'openrouter', 'mistral', 'cohere', 'perplexity',
  'together', 'deepseek', 'xai', 'fireworks', 'local'
];
for (const name of providerNames) {
  const p = chat.getProvider(name as any);
  assert(p !== null, `${name}プロバイダーが存在する`);
}

// ─── 6. ネットワーク不要テスト（モック） ─────────────────────
console.log('\n【6. エラーハンドリング（ネットワークなし）】');

(async () => {
  const chatNoNetwork = new UniversalChat();
  const mockResult = await chatNoNetwork.send({
    provider: 'local',
    config: {
      name: 'local',
      label: 'テスト',
      baseUrl: 'http://localhost:99999', // 存在しないポート
      free: true,
      requiresKey: false,
      description: 'テスト用',
    },
    messages: [{ role: 'user', content: 'テスト' }],
  });
  assert(mockResult.dfumtConfidence === 'FALSE', 'エラー時はFALSE判定');
  assert(!!mockResult.error, 'エラーメッセージが存在する');
  assert(mockResult.latencyMs >= 0, 'レイテンシが記録される');

  console.log(`\n結果: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
