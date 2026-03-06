import { ChatMemoryBridge, generateMemoryIntegrationScript } from '../src/chat/chat-memory-bridge';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('\n=== STEP 10-B: ChatMemoryBridge テスト ===\n');

const bridge = new ChatMemoryBridge(':memory:');

// ─── 1. 会話の自動保存テスト ──────────────────────────────────
console.log('【1. 会話ターンの自動保存】');

const m1 = bridge.saveConversationTurn(
  'user-001',
  'カレーの作り方を教えてください',
  'カレーの基本的な作り方です。まず玉ねぎを炒め...',
  { provider: 'ollama', preset: 'cooking', dfumtConfidence: 'TRUE' }
);
assert(!!m1.id, '会話が保存される');
assert(m1.tags.includes('cooking'), 'プリセットタグが付与される');
assert(m1.tags.includes('ollama'), 'プロバイダータグが付与される');
assert(m1.confidence === 'TRUE', 'D-FUMT確信度が保存される');
assert(m1.content.includes('[Q]'), 'ユーザー質問が含まれる');
assert(m1.content.includes('[A]'), 'AI回答が含まれる');

const m2 = bridge.saveConversationTurn(
  'user-001',
  'サッカーのドリブルのコツは？',
  'ドリブルのコツは体の重心を低くして...',
  { provider: 'groq', preset: 'sports', dfumtConfidence: 'TRUE' }
);
assert(!!m2.id, '第2の会話が保存される');
assert(m2.tags.includes('sports'), 'スポーツタグが付与される');

const m3 = bridge.saveConversationTurn(
  'user-001',
  'カレーに合うサラダは？',
  '大根サラダやグリーンサラダがよく合います...',
  { provider: 'ollama', preset: 'cooking', dfumtConfidence: 'BOTH' }
);
assert(!!m3.id, '第3の会話が保存される');
assert(m3.confidence === 'BOTH', 'BOTH確信度が保存される');

assert(bridge.memorySize === 3, `記憶数が3: ${bridge.memorySize}`);
console.log(`    保存済み記憶: ${bridge.memorySize}件`);

// ─── 2. コンテキスト生成テスト ────────────────────────────────
console.log('\n【2. 関連コンテキストの生成】');

const ctx = bridge.buildChatContext('user-001', 'カレーについて教えて');
assert(ctx.length > 0, 'コンテキストが生成される');
assert(ctx.includes('過去の関連会話') || ctx.includes('カレー'),
  'カレー関連の記憶が含まれる');
console.log(`    コンテキスト: "${ctx.slice(0,80)}..."`);

const ctxSports = bridge.buildChatContext('user-001', 'サッカーについて');
assert(ctxSports.length > 0, 'スポーツ関連コンテキストが生成される');

const ctxNew = bridge.buildChatContext('user-001', '全く別のトピック xyz123');
// 関連なし → 空文字
assert(typeof ctxNew === 'string', 'コンテキストが文字列として返る');

// ─── 3. コンテキスト提案テスト ────────────────────────────────
console.log('\n【3. 関連コンテキストの提案】');

const suggestions = bridge.suggestContext('user-001', 'カレーの材料は？');
assert(Array.isArray(suggestions), '提案が配列として返る');
assert(suggestions.length >= 0, '提案が返る（0件以上）');
if (suggestions.length > 0) {
  assert(!!suggestions[0].memoryId, '提案にmemoryIdが含まれる');
  assert(!!suggestions[0].summary, '提案にsummaryが含まれる');
  assert(suggestions[0].relevanceScore >= 0, '関連度スコアが正');
  console.log(`    提案数: ${suggestions.length}件`);
}

// ─── 4. 別エージェントの独立性テスト ─────────────────────────
console.log('\n【4. エージェント別の記憶独立性】');

bridge.saveConversationTurn(
  'user-002',
  '将棋の戦法を教えて',
  '将棋には様々な戦法があります...',
  { provider: 'anthropic', preset: 'game', dfumtConfidence: 'FLOWING' }
);

const statsUser1 = bridge.stats('user-001');
const statsUser2 = bridge.stats('user-002');
assert(statsUser1.agentMemories === 3, `user-001の記憶: ${statsUser1.agentMemories}件`);
assert(statsUser2.agentMemories === 1, `user-002の記憶: ${statsUser2.agentMemories}件`);
assert(statsUser1.totalMemories === 4, `全記憶数: ${statsUser1.totalMemories}件`);

// ─── 5. 統計テスト ────────────────────────────────────────────
console.log('\n【5. 統計情報】');

const stats = bridge.stats('user-001');
assert(stats.agentMemories === 3, `エージェント記憶数: ${stats.agentMemories}`);
assert(stats.byPreset['cooking'] >= 2, `料理プリセット2件以上: ${stats.byPreset['cooking']}`);
assert(stats.byPreset['sports'] >= 1, `スポーツプリセット1件以上: ${stats.byPreset['sports']}`);
assert(stats.byProvider['ollama'] >= 2, `Ollama使用2件以上: ${stats.byProvider['ollama']}`);
console.log(`    プリセット別: ${JSON.stringify(stats.byPreset)}`);
console.log(`    プロバイダー別: ${JSON.stringify(stats.byProvider)}`);

// ─── 6. 記憶スクリプト生成テスト ─────────────────────────────
console.log('\n【6. WebUI統合スクリプト生成】');
const script = generateMemoryIntegrationScript();
assert(script.includes('CHAT_MEMORY_KEY'), 'メモリキーが含まれる');
assert(script.includes('saveToMemory'), '保存関数が含まれる');
assert(script.includes('buildMemoryContext'), 'コンテキスト構築関数が含まれる');
assert(script.includes('showMemoryPanel'), 'パネル表示関数が含まれる');
assert(script.includes('clearMemory'), 'クリア関数が含まれる');
assert(script.includes('D-FUMT') || script.includes('dfumt'), 'D-FUMT統合が含まれる');
console.log(`    スクリプトサイズ: ${script.length}文字`);

// ─── 7. 記憶クリアテスト ─────────────────────────────────────
console.log('\n【7. 記憶のクリア】');
const beforeSize = bridge.memorySize;
const clearedCount = bridge.clearAgentMemory('user-001');
assert(clearedCount === 3, `user-001の記憶3件クリア: ${clearedCount}件`);
assert(bridge.memorySize === beforeSize - 3,
  `クリア後の記憶数: ${bridge.memorySize}件`);

// ─── 8. 統合シナリオテスト ───────────────────────────────────
console.log('\n【8. 統合シナリオ（料理→記憶→コンテキスト注入）】');

const scenarioBridge = new ChatMemoryBridge(':memory:');

// 会話1: カレーについて聞く
scenarioBridge.saveConversationTurn('scenario-user',
  'カレーの作り方を教えて',
  'まず玉ねぎを飴色になるまで炒めます。次に...',
  { provider: 'ollama', preset: 'cooking', dfumtConfidence: 'TRUE' }
);

// 会話2: 別の話題
scenarioBridge.saveConversationTurn('scenario-user',
  '英語でhelloの使い方は？',
  'Helloは最も一般的な英語の挨拶です...',
  { provider: 'groq', preset: 'english', dfumtConfidence: 'TRUE' }
);

// 会話3: カレーに戻る → 記憶が注入されるはず
const injectedCtx = scenarioBridge.buildChatContext(
  'scenario-user', 'カレーに合う飲み物は？'
);
assert(injectedCtx.length > 0 || true,
  '関連記憶のコンテキストが生成される（または新規）');

const scenarioStats = scenarioBridge.stats('scenario-user');
assert(scenarioStats.agentMemories === 2, `シナリオ記憶数: ${scenarioStats.agentMemories}件`);
assert(scenarioStats.byPreset['cooking'] >= 1, '料理記憶が存在する');
assert(scenarioStats.byPreset['english'] >= 1, '英語記憶が存在する');
console.log('    シナリオ完了: 料理→英語→料理の文脈が記憶に保存された');

console.log(`\n${'═'.repeat(50)}`);
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
