/**
 * Rei-AIOS STEP 10-B — ChatMemoryBridge
 * 汎用チャット × AIOSMemory 連携ブリッジ
 *
 * 機能:
 *   - 会話を自動的にMemoryに保存
 *   - 過去の会話をコンテキストとして次回に注入
 *   - D-FUMT七価論理で会話の重要度を評価
 *   - プロバイダー別・プリセット別の記憶管理
 */

import { AIOSMemory, MemoryEntry, DFUMTValue } from '../memory/aios-memory';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  preset?: string;
  dfumtConfidence?: DFUMTValue;
  timestamp: string;
}

export interface SavedConversation {
  id: string;
  agentId: string;
  turns: ConversationTurn[];
  topic: string;           // 自動抽出されたトピック
  preset: string;
  provider: string;
  dfumtSummary: DFUMTValue; // 会話全体の七価論理評価
  savedAt: string;
}

export interface ContextSuggestion {
  memoryId: string;
  topic: string;
  summary: string;
  dfumt: DFUMTValue;
  relevanceScore: number;
}

// ─── ChatMemoryBridge メインクラス ────────────────────────────
export class ChatMemoryBridge {
  private memory: AIOSMemory;

  constructor(dbPath = './dist/chat-memory.json') {
    this.memory = new AIOSMemory(dbPath);
  }

  // ── 会話ターンの自動保存 ────────────────────────────────────
  saveConversationTurn(
    agentId: string,
    userMessage: string,
    assistantResponse: string,
    opts: {
      provider?: string;
      preset?: string;
      dfumtConfidence?: DFUMTValue;
    } = {}
  ): MemoryEntry {
    // トピックを自動抽出（最初の20文字）
    const topic = this._extractTopic(userMessage);

    // 会話ペアをひとつの記憶として保存
    const content = [
      `[Q] ${userMessage.slice(0, 200)}`,
      `[A] ${assistantResponse.slice(0, 300)}`,
    ].join('\n');

    const tags = [
      'chat',
      opts.preset ?? 'general',
      opts.provider ?? 'unknown',
      topic,
    ].filter(Boolean);

    return this.memory.remember(agentId, 'episodic', content, {
      confidence: opts.dfumtConfidence ?? 'TRUE',
      tags,
    });
  }

  // ── 過去の会話からコンテキストを生成 ───────────────────────
  buildChatContext(
    agentId: string,
    currentMessage: string,
    maxEntries = 3
  ): string {
    // キーワードで関連記憶を検索
    const keyword = this._extractTopic(currentMessage);
    const related = this.memory.recall({
      agentId,
      kind: 'episodic',
      keyword,
      limit: maxEntries,
    });

    if (related.length === 0) return '';

    const lines = related.map(e => {
      const preview = e.content.slice(0, 100).replace(/\n/g, ' ');
      return `- ${preview}...`;
    });

    return [
      `[過去の関連会話 ${related.length}件]`,
      ...lines,
    ].join('\n');
  }

  // ── 関連コンテキストの提案 ─────────────────────────────────
  suggestContext(
    agentId: string,
    currentMessage: string
  ): ContextSuggestion[] {
    const keyword = this._extractTopic(currentMessage);
    const entries = this.memory.recall({
      agentId,
      kind: 'episodic',
      keyword,
      limit: 5,
    });

    return entries.map(e => ({
      memoryId: e.id,
      topic: e.tags.find(t => !['chat','general','unknown'].includes(t)) ?? '会話',
      summary: e.content.slice(0, 80),
      dfumt: e.confidence,
      relevanceScore: e.accessCount + 1,
    }));
  }

  // ── 記憶統計 ───────────────────────────────────────────────
  stats(agentId: string) {
    const allStats = this.memory.stats();
    const agentEntries = this.memory.recall({ agentId, limit: 1000 });

    const byPreset: Record<string, number> = {};
    const byProvider: Record<string, number> = {};

    for (const e of agentEntries) {
      for (const tag of e.tags) {
        if (['cooking','sports','game','english','math','dfumt','general'].includes(tag)) {
          byPreset[tag] = (byPreset[tag] ?? 0) + 1;
        }
        if (['anthropic','openai','ollama','groq','gemini','openrouter',
             'mistral','deepseek','xai','fireworks','together',
             'perplexity','cohere','local'].includes(tag)) {
          byProvider[tag] = (byProvider[tag] ?? 0) + 1;
        }
      }
    }

    return {
      totalMemories: allStats.totalEntries,
      agentMemories: agentEntries.length,
      byPreset,
      byProvider,
      byConfidence: allStats.byConfidence,
    };
  }

  // ── 記憶のクリア ───────────────────────────────────────────
  clearAgentMemory(agentId: string): number {
    const entries = this.memory.recall({ agentId, limit: 1000 });
    let count = 0;
    for (const e of entries) {
      if (this.memory.forget(e.id)) count++;
    }
    return count;
  }

  // ── プライベートメソッド ────────────────────────────────────
  private _extractTopic(text: string): string {
    // 日本語の助詞・助動詞・記号で分割し、最初の実質的なキーワードを取る
    const cleaned = text
      .replace(/[。、！？\.\!\?\s「」『』（）\(\)]/g, ' ')
      .trim();
    // 日本語助詞パターンで分割して最初の名詞的トークンを取る
    const tokens = cleaned.split(/[のをはがにでとへもからまでについてとは\s]+/)
      .filter(w => w.length >= 2);
    return tokens[0] ?? cleaned.slice(0, 10);
  }

  get memorySize(): number {
    return this.memory.size;
  }
}

// ─── WebUI統合用スクリプト生成 ────────────────────────────────
// axiom-os-webui.ts に追加するJavaScriptコード
export function generateMemoryIntegrationScript(): string {
  return `
// ─── STEP 10-B: チャット記憶統合 ──────────────────────────────
const CHAT_MEMORY_KEY = 'rei_aios_chat_memory';
const CURRENT_AGENT = 'user';

// ローカルストレージベースの記憶（ブラウザ側）
function loadChatMemory() {
  try {
    const raw = localStorage.getItem(CHAT_MEMORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveChatMemory(memories) {
  try {
    // 最新100件のみ保持
    const trimmed = memories.slice(-100);
    localStorage.setItem(CHAT_MEMORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

function saveToMemory(userMsg, assistantMsg, provider, preset, dfumt) {
  const memories = loadChatMemory();
  memories.push({
    id: Date.now().toString(),
    user: userMsg.slice(0, 200),
    assistant: assistantMsg.slice(0, 300),
    provider,
    preset,
    dfumt,
    timestamp: new Date().toISOString(),
    topic: userMsg.slice(0, 20),
  });
  saveChatMemory(memories);
  updateMemoryBadge(memories.length);
}

function findRelatedMemories(currentMsg, limit) {
  limit = limit || 3;
  const memories = loadChatMemory();
  const keyword = currentMsg.slice(0, 15).toLowerCase();

  return memories
    .filter(function(m) {
      return m.user.toLowerCase().indexOf(keyword) >= 0 ||
        m.topic.toLowerCase().indexOf(keyword) >= 0;
    })
    .slice(-limit);
}

function buildMemoryContext(currentMsg) {
  const related = findRelatedMemories(currentMsg);
  if (related.length === 0) return null;

  const lines = related.map(function(m) {
    return '- [過去の質問] ' + m.topic + '... → ' + m.assistant.slice(0,60) + '...';
  });
  return '[関連する過去の会話 ' + related.length + '件]\\n' + lines.join('\\n');
}

function updateMemoryBadge(count) {
  const badge = document.getElementById('memory-count-badge');
  if (badge) badge.textContent = '記憶: ' + count + '件';
}

function showMemoryPanel() {
  const memories = loadChatMemory();
  const panel = document.getElementById('memory-panel');
  if (!panel) return;

  var dfumtColors = {
    TRUE:'#88aaff', FALSE:'#666688', BOTH:'#aa88ff',
    NEITHER:'#888888', INFINITY:'#ffaa44', ZERO:'#44aacc', FLOWING:'#88ccaa'
  };
  var dfumtSymbols = {
    TRUE:'⊤', FALSE:'⊥', BOTH:'B', NEITHER:'N',
    INFINITY:'∞', ZERO:'〇', FLOWING:'～'
  };

  if (memories.length === 0) {
    panel.innerHTML = '<div style="color:#666;padding:1rem">記憶がまだありません</div>';
    return;
  }

  panel.innerHTML = memories.slice(-20).reverse().map(function(m) {
    var col = dfumtColors[m.dfumt] || '#666';
    var sym = dfumtSymbols[m.dfumt] || '?';
    var date = new Date(m.timestamp).toLocaleString('ja-JP');
    return '<div class="memory-item">' +
      '<div class="memory-meta">' +
      '<span style="color:#888;font-size:0.75rem">' + date + '</span>' +
      ' <span class="msg-dfumt" style="background:' + col + ';color:#fff">' + sym + ' ' + m.dfumt + '</span>' +
      ' <span style="color:#666;font-size:0.75rem">' + m.provider + ' / ' + m.preset + '</span>' +
      '</div>' +
      '<div class="memory-q">💬 ' + escHtml(m.user) + '</div>' +
      '<div class="memory-a">🤖 ' + escHtml(m.assistant.slice(0,100)) + '...</div>' +
      '</div>';
  }).join('');
}

function clearMemory() {
  if (confirm('すべての記憶を削除しますか？')) {
    localStorage.removeItem(CHAT_MEMORY_KEY);
    updateMemoryBadge(0);
    var panel = document.getElementById('memory-panel');
    if (panel) panel.innerHTML = '<div style="color:#666;padding:1rem">記憶を削除しました</div>';
  }
}

// sendUniversal を記憶統合版に拡張 — D-FUMT統合
var _originalSendUniversal = typeof sendUniversal === 'function' ? sendUniversal : null;
async function sendUniversalWithMemory() {
  var input = document.getElementById('universal-input');
  var content = input.value.trim();
  if (!content) return;

  // 関連する過去の記憶をコンテキストに注入
  var memCtx = buildMemoryContext(content);
  if (memCtx) {
    var preset = document.getElementById('system-preset').value;
    // システムプロンプトに記憶コンテキストを追加
    var origPreset = PRESETS[preset] || PRESETS.general;
    PRESETS['_memory_injected'] = origPreset + '\\n\\n' + memCtx;
    document.getElementById('system-preset').value = '_memory_injected';
  }

  // 元の送信処理を実行
  if (_originalSendUniversal) await _originalSendUniversal();

  // 送信後にプリセットを戻す
  if (memCtx) {
    document.getElementById('system-preset').value =
      document.getElementById('system-preset').dataset.original || 'general';
    delete PRESETS['_memory_injected'];
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', function() {
  updateMemoryBadge(loadChatMemory().length);
});
`;
}
