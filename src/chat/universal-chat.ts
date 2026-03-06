/**
 * Rei-AIOS STEP 10-A — UniversalChat
 * 14プロバイダー対応汎用チャットエンジン
 *
 * Rei-Automatorの多プロバイダー対応を流用。
 * Ollama等ローカル環境でも動作する。
 */

import * as https from 'https';
import * as http from 'http';

export type ProviderName =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'ollama'
  | 'groq'
  | 'openrouter'
  | 'mistral'
  | 'cohere'
  | 'perplexity'
  | 'together'
  | 'deepseek'
  | 'xai'
  | 'fireworks'
  | 'local';

export type DFUMTValue =
  'TRUE' | 'FALSE' | 'BOTH' | 'NEITHER' | 'INFINITY' | 'ZERO' | 'FLOWING';

export interface ProviderConfig {
  name: ProviderName;
  label: string;           // 表示名
  apiKey?: string;         // APIキー（Ollama等は不要）
  baseUrl?: string;        // カスタムエンドポイント
  model?: string;          // 使用モデル
  free: boolean;           // 無料で使えるか
  requiresKey: boolean;    // APIキーが必要か
  description: string;     // 説明
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  provider: ProviderName;
  config: ProviderConfig;
  messages: ChatMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  provider: ProviderName;
  model: string;
  dfumtConfidence: DFUMTValue;  // 回答の確信度（自動評価）
  tokensUsed?: number;
  latencyMs: number;
  error?: string;
}

// ─── デフォルトプロバイダー設定 ───────────────────────────────
export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    name: 'ollama',
    label: 'Ollama（ローカル・完全無料）',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    free: true,
    requiresKey: false,
    description: 'ローカルで動くAI。完全無料・プライバシー保護',
  },
  {
    name: 'groq',
    label: 'Groq（無料枠あり・超高速）',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    free: true,
    requiresKey: true,
    description: '無料枠で使える超高速AI',
  },
  {
    name: 'gemini',
    label: 'Google Gemini（無料枠あり）',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-1.5-flash',
    free: true,
    requiresKey: true,
    description: 'Googleの無料枠AI',
  },
  {
    name: 'anthropic',
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-4-5-20251001',
    free: false,
    requiresKey: true,
    description: 'Anthropic Claude（APIキー必要）',
  },
  {
    name: 'openai',
    label: 'OpenAI GPT',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    free: false,
    requiresKey: true,
    description: 'OpenAI GPT（APIキー必要）',
  },
  {
    name: 'openrouter',
    label: 'OpenRouter（多モデル）',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.2-3b-instruct:free',
    free: true,
    requiresKey: true,
    description: '無料モデルも選べるマルチプロバイダー',
  },
  {
    name: 'mistral',
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    free: false,
    requiresKey: true,
    description: 'Mistral AI（APIキー必要）',
  },
  {
    name: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    free: false,
    requiresKey: true,
    description: 'DeepSeek（APIキー必要・低コスト）',
  },
  {
    name: 'xai',
    label: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-beta',
    free: false,
    requiresKey: true,
    description: 'xAI Grok（APIキー必要）',
  },
  {
    name: 'fireworks',
    label: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    free: false,
    requiresKey: true,
    description: 'Fireworks AI（高速・低コスト）',
  },
  {
    name: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    free: false,
    requiresKey: true,
    description: 'Together AI（オープンモデル）',
  },
  {
    name: 'perplexity',
    label: 'Perplexity AI',
    baseUrl: 'https://api.perplexity.ai',
    model: 'llama-3.1-sonar-small-128k-online',
    free: false,
    requiresKey: true,
    description: 'Perplexity（Web検索統合AI）',
  },
  {
    name: 'cohere',
    label: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v1',
    model: 'command-r',
    free: false,
    requiresKey: true,
    description: 'Cohere（RAG特化）',
  },
  {
    name: 'local',
    label: 'ローカルサーバー（カスタム）',
    baseUrl: 'http://localhost:8080/v1',
    model: 'local-model',
    free: true,
    requiresKey: false,
    description: 'カスタムローカルサーバー',
  },
];

// ─── D-FUMT確信度の自動評価 ─────────────────────────────────
export function evalDFUMT(content: string): DFUMTValue {
  const lower = content.toLowerCase();
  // 不確かさの表現
  if (lower.includes('わかりません') || lower.includes('不明') ||
      lower.includes('確認が必要') || lower.includes('i\'m not sure')) {
    return 'NEITHER';
  }
  // 複数の解釈
  if (lower.includes('一方で') || lower.includes('ただし') ||
      lower.includes('場合によって') || lower.includes('however') ||
      lower.includes('on the other hand')) {
    return 'BOTH';
  }
  // 変化・進行中
  if (lower.includes('変化') || lower.includes('更新') ||
      lower.includes('現在') || lower.includes('最新')) {
    return 'FLOWING';
  }
  // 手順・レシピ（確定的）
  if (lower.includes('手順') || lower.includes('レシピ') ||
      lower.includes('まず') || lower.includes('次に')) {
    return 'TRUE';
  }
  return 'TRUE';
}

// ─── HTTP リクエストヘルパー ─────────────────────────────────
function httpRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── UniversalChat メインクラス ──────────────────────────────
export class UniversalChat {
  private providers: Map<ProviderName, ProviderConfig> = new Map();

  constructor(configs: ProviderConfig[] = DEFAULT_PROVIDERS) {
    for (const c of configs) {
      this.providers.set(c.name, c);
    }
  }

  // プロバイダー設定の更新（APIキー等）
  configure(name: ProviderName, updates: Partial<ProviderConfig>): void {
    const existing = this.providers.get(name);
    if (existing) {
      this.providers.set(name, { ...existing, ...updates });
    }
  }

  getProvider(name: ProviderName): ProviderConfig | null {
    return this.providers.get(name) ?? null;
  }

  listProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  listFreeProviders(): ProviderConfig[] {
    return Array.from(this.providers.values()).filter(p => p.free);
  }

  // ─── メイン送信メソッド ────────────────────────────────────
  async send(req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();

    try {
      let content: string;
      const model = req.config.model ?? 'unknown';

      switch (req.provider) {
        case 'anthropic':
          content = await this._sendAnthropic(req);
          break;
        case 'ollama':
          content = await this._sendOllama(req);
          break;
        case 'gemini':
          content = await this._sendGemini(req);
          break;
        default:
          // OpenAI互換API（Groq・OpenRouter・Mistral・DeepSeek・xAI等）
          content = await this._sendOpenAICompat(req);
          break;
      }

      return {
        content,
        provider: req.provider,
        model,
        dfumtConfidence: evalDFUMT(content),
        latencyMs: Date.now() - start,
      };

    } catch (e: any) {
      return {
        content: '',
        provider: req.provider,
        model: req.config.model ?? 'unknown',
        dfumtConfidence: 'FALSE',
        latencyMs: Date.now() - start,
        error: e.message,
      };
    }
  }

  // ─── Anthropic ──────────────────────────────────────────────
  private async _sendAnthropic(req: ChatRequest): Promise<string> {
    const body = JSON.stringify({
      model: req.config.model,
      max_tokens: req.maxTokens ?? 1000,
      system: req.systemPrompt ?? 'You are a helpful assistant.',
      messages: req.messages.filter(m => m.role !== 'system'),
    });

    const raw = await httpRequest(
      `${req.config.baseUrl}/messages`,
      'POST',
      {
        'Content-Type': 'application/json',
        'x-api-key': req.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body
    );

    const json = JSON.parse(raw);
    if (json.error) throw new Error(json.error.message);
    return json.content?.[0]?.text ?? '';
  }

  // ─── Ollama（ローカル） ──────────────────────────────────────
  private async _sendOllama(req: ChatRequest): Promise<string> {
    const body = JSON.stringify({
      model: req.config.model ?? 'llama3.2',
      messages: req.messages,
      stream: false,
    });

    const raw = await httpRequest(
      `${req.config.baseUrl}/api/chat`,
      'POST',
      { 'Content-Type': 'application/json' },
      body
    );

    const json = JSON.parse(raw);
    return json.message?.content ?? json.response ?? '';
  }

  // ─── Google Gemini ───────────────────────────────────────────
  private async _sendGemini(req: ChatRequest): Promise<string> {
    const contents = req.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body = JSON.stringify({ contents });
    const url = `${req.config.baseUrl}/models/${req.config.model}:generateContent?key=${req.config.apiKey}`;

    const raw = await httpRequest(url, 'POST',
      { 'Content-Type': 'application/json' }, body);

    const json = JSON.parse(raw);
    if (json.error) throw new Error(json.error.message);
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  // ─── OpenAI互換（Groq・Mistral・DeepSeek等） ─────────────────
  private async _sendOpenAICompat(req: ChatRequest): Promise<string> {
    const messages = req.systemPrompt
      ? [{ role: 'system', content: req.systemPrompt }, ...req.messages]
      : req.messages;

    const body = JSON.stringify({
      model: req.config.model,
      messages,
      max_tokens: req.maxTokens ?? 1000,
      temperature: req.temperature ?? 0.7,
    });

    const raw = await httpRequest(
      `${req.config.baseUrl}/chat/completions`,
      'POST',
      {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.config.apiKey ?? ''}`,
      },
      body
    );

    const json = JSON.parse(raw);
    if (json.error) throw new Error(
      typeof json.error === 'string' ? json.error : json.error.message
    );
    return json.choices?.[0]?.message?.content ?? '';
  }
}

// ─── WebUI用HTMLスニペット生成 ─────────────────────────────────
// axiom-os-webui.ts に統合するためのHTMLパーツを生成する
export function generateUniversalChatPanel(providers: ProviderConfig[]): string {
  const freeProviders = providers.filter(p => p.free);
  const paidProviders = providers.filter(p => !p.free);

  const providerOptions = [
    '<optgroup label="🆓 無料・ローカル">',
    ...freeProviders.map(p =>
      `<option value="${p.name}" data-needs-key="${p.requiresKey}">${p.label}</option>`
    ),
    '</optgroup>',
    '<optgroup label="🔑 APIキー必要">',
    ...paidProviders.map(p =>
      `<option value="${p.name}" data-needs-key="true">${p.label}</option>`
    ),
    '</optgroup>',
  ].join('\n');

  return `
<!-- ⬡ 汎用チャットパネル -->
<div id="panel-universal" class="panel" style="display:none">
  <div class="universal-chat-container">

    <!-- プロバイダー選択 -->
    <div class="provider-bar">
      <select id="provider-select" class="provider-select">
        ${providerOptions}
      </select>
      <div id="api-key-field" class="api-key-field" style="display:none">
        <input type="password" id="api-key-input"
          placeholder="APIキーを入力..." class="api-key-input"/>
        <button onclick="saveApiKey()" class="btn-small">保存</button>
      </div>
      <div id="model-field" class="model-field">
        <input type="text" id="model-input"
          placeholder="モデル名..." class="model-input"/>
      </div>
    </div>

    <!-- システムプロンプト -->
    <div class="system-prompt-bar">
      <select id="system-preset" onchange="applyPreset()" class="preset-select">
        <option value="general">汎用アシスタント</option>
        <option value="cooking">🍳 料理・レシピ</option>
        <option value="sports">⚽ スポーツ・健康</option>
        <option value="game">🎮 ゲーム・攻略</option>
        <option value="english">🌍 英語学習</option>
        <option value="math">📐 数学・理系</option>
        <option value="dfumt">⬡ D-FUMT哲学</option>
        <option value="custom">カスタム</option>
      </select>
      <span id="dfumt-badge" class="dfumt-badge">⊤ TRUE</span>
    </div>

    <!-- チャット履歴 -->
    <div id="universal-chat-history" class="chat-history"></div>

    <!-- 入力エリア -->
    <div class="input-bar">
      <textarea id="universal-input" class="chat-input"
        placeholder="何でも聞いてください（料理・スポーツ・ゲーム・勉強など）..."
        rows="3"
        onkeydown="if(event.ctrlKey&&event.key==='Enter')sendUniversal()">
      </textarea>
      <button onclick="sendUniversal()" class="btn-send">送信</button>
    </div>

    <div id="universal-status" class="status-bar"></div>
  </div>
</div>

<style>
.universal-chat-container {
  display: flex; flex-direction: column; height: 100%; gap: 0.5rem;
}
.provider-bar {
  display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;
}
.provider-select {
  background: var(--surface); color: var(--text);
  border: 1px solid #444; border-radius: 6px;
  padding: 0.4rem 0.6rem; font-size: 0.85rem; flex: 1;
}
.api-key-input, .model-input {
  background: var(--surface); color: var(--text);
  border: 1px solid #555; border-radius: 6px;
  padding: 0.4rem 0.6rem; font-size: 0.8rem;
}
.api-key-field, .model-field { display: flex; gap: 0.3rem; align-items: center; }
.model-input { width: 160px; }
.api-key-input { width: 220px; }
.system-prompt-bar {
  display: flex; gap: 0.5rem; align-items: center;
}
.preset-select {
  background: var(--surface); color: var(--text);
  border: 1px solid #444; border-radius: 6px;
  padding: 0.3rem 0.5rem; font-size: 0.8rem;
}
.dfumt-badge {
  font-size: 0.75rem; padding: 2px 8px;
  border-radius: 4px; background: var(--accent); color: #fff;
  font-weight: bold; letter-spacing: 0.05em;
}
.chat-history {
  flex: 1; overflow-y: auto; padding: 0.5rem;
  background: #111115; border-radius: 8px;
  min-height: 300px; max-height: 450px;
}
.msg-user {
  margin: 0.5rem 0; padding: 0.5rem 0.75rem;
  background: #2a2a35; border-radius: 8px;
  border-left: 3px solid var(--accent);
  font-size: 0.9rem;
}
.msg-assistant {
  margin: 0.5rem 0; padding: 0.5rem 0.75rem;
  background: #1e1e28; border-radius: 8px;
  border-left: 3px solid var(--highlight);
  font-size: 0.9rem; white-space: pre-wrap;
}
.msg-meta {
  font-size: 0.7rem; color: #666; margin-top: 0.25rem;
}
.msg-dfumt {
  font-size: 0.7rem; padding: 1px 5px;
  border-radius: 3px; margin-left: 0.5rem;
}
.input-bar { display: flex; gap: 0.5rem; align-items: flex-end; }
.chat-input {
  flex: 1; background: var(--surface); color: var(--text);
  border: 1px solid #444; border-radius: 8px;
  padding: 0.5rem; font-size: 0.9rem; resize: vertical;
  font-family: inherit;
}
.btn-send {
  background: var(--accent); color: #fff;
  border: none; border-radius: 8px;
  padding: 0.5rem 1.2rem; cursor: pointer;
  font-size: 0.9rem; white-space: nowrap;
}
.btn-send:hover { background: var(--highlight); }
.btn-small {
  background: #333; color: #ccc;
  border: none; border-radius: 4px;
  padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.75rem;
}
.status-bar { font-size: 0.75rem; color: #666; min-height: 1.2em; }
</style>

<script>
// ─── プリセットシステムプロンプト ─────────────────────────────
const PRESETS = {
  general: 'あなたは親切で知識豊富なアシスタントです。日本語で丁寧に答えてください。',
  cooking: 'あなたはプロの料理人です。レシピ・食材・調理法について詳しく、わかりやすく説明してください。',
  sports: 'あなたはスポーツトレーナーです。運動・健康・競技について科学的な根拠を踏まえて説明してください。',
  game: 'あなたはゲームの専門家です。攻略・戦略・ゲームデザインについて詳しく説明してください。',
  english: 'You are an English teacher. Help the user learn English naturally. Mix Japanese and English explanations.',
  math: 'あなたは数学の教師です。数学・理科・プログラミングについて、ステップバイステップで丁寧に説明してください。',
  dfumt: 'あなたはD-FUMT七価論理の研究者です。全ての問いをTRUE/FALSE/BOTH/NEITHER/INFINITY/ZERO/FLOWINGの七価論理で考察してください。',
  custom: '',
};

const DFUMT_SYMBOLS = {
  TRUE:'⊤', FALSE:'⊥', BOTH:'B', NEITHER:'N',
  INFINITY:'∞', ZERO:'〇', FLOWING:'～'
};
const DFUMT_COLORS = {
  TRUE:'#88aaff', FALSE:'#666688', BOTH:'#aa88ff',
  NEITHER:'#888888', INFINITY:'#ffaa44', ZERO:'#44aacc', FLOWING:'#88ccaa'
};

let universalHistory = [];
let apiKeys = {};
let currentProvider = 'ollama';

// ─── プロバイダー選択時の処理 ─────────────────────────────────
document.getElementById('provider-select').addEventListener('change', function() {
  currentProvider = this.value;
  const needsKey = this.options[this.selectedIndex].dataset.needsKey === 'true';
  document.getElementById('api-key-field').style.display = needsKey ? 'flex' : 'none';

  // 保存済みAPIキーを復元
  if (apiKeys[currentProvider]) {
    document.getElementById('api-key-input').value = apiKeys[currentProvider];
  } else {
    document.getElementById('api-key-input').value = '';
  }
});

function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (key) {
    apiKeys[currentProvider] = key;
    document.getElementById('universal-status').textContent =
      '✓ ' + currentProvider + ' のAPIキーを保存しました';
    setTimeout(function() {
      document.getElementById('universal-status').textContent = '';
    }, 2000);
  }
}

function applyPreset() {
  const preset = document.getElementById('system-preset').value;
  // カスタムの場合は何もしない
}

// ─── メッセージ送信 ───────────────────────────────────────────
async function sendUniversal() {
  const input = document.getElementById('universal-input');
  const content = input.value.trim();
  if (!content) return;

  const provider = document.getElementById('provider-select').value;
  const apiKey = apiKeys[provider] || document.getElementById('api-key-input').value.trim();
  const model = document.getElementById('model-input').value.trim();
  const preset = document.getElementById('system-preset').value;
  const systemPrompt = PRESETS[preset] || PRESETS.general;

  // ユーザーメッセージ表示
  universalHistory.push({ role: 'user', content: content });
  renderHistory();
  input.value = '';

  const status = document.getElementById('universal-status');
  status.textContent = '⏳ ' + provider + ' に送信中...';

  try {
    // Rei-AIOSバックエンドAPIを呼び出す（または直接API）
    const response = await callProviderAPI({
      provider: provider, apiKey: apiKey, model: model, systemPrompt: systemPrompt,
      messages: universalHistory,
    });

    universalHistory.push({ role: 'assistant', content: response.content,
      provider: provider, dfumt: response.dfumt, latency: response.latency });
    renderHistory();

    // D-FUMTバッジ更新
    const badge = document.getElementById('dfumt-badge');
    badge.textContent = (DFUMT_SYMBOLS[response.dfumt] || '?') + ' ' + response.dfumt;
    badge.style.background = DFUMT_COLORS[response.dfumt] || '#666';

    status.textContent = '✓ ' + provider + ' | ' + response.latency + 'ms';
  } catch (e) {
    status.textContent = '❌ エラー: ' + e.message;
    universalHistory.push({
      role: 'assistant',
      content: 'エラーが発生しました: ' + e.message + '\\n\\nOllamaを使用する場合は、まず ollama serve を実行してください。',
      provider: provider, dfumt: 'FALSE', latency: 0
    });
    renderHistory();
  }
}

// ─── プロバイダーAPI呼び出し（クライアントサイド） ─────────────
async function callProviderAPI(opts) {
  var provider = opts.provider, apiKey = opts.apiKey, model = opts.model;
  var systemPrompt = opts.systemPrompt, messages = opts.messages;
  const start = Date.now();

  // メッセージ形式の準備
  const msgs = messages.filter(function(m) { return m.role === 'user' || m.role === 'assistant'; })
    .map(function(m) { return { role: m.role, content: m.content }; });

  let content = '';

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: msgs,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    content = data.content && data.content[0] ? data.content[0].text : '';

  } else if (provider === 'ollama') {
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3.2',
        messages: [{ role: 'system', content: systemPrompt }].concat(msgs),
        stream: false,
      }),
    });
    const data = await res.json();
    content = (data.message ? data.message.content : '') || data.response || '';

  } else if (provider === 'gemini') {
    const geminiMsgs = msgs.map(function(m) {
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      };
    });
    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/'
      + (model || 'gemini-1.5-flash') + ':generateContent?key=' + apiKey;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: geminiMsgs }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    content = data.candidates && data.candidates[0] && data.candidates[0].content
      ? data.candidates[0].content.parts[0].text : '';

  } else {
    // OpenAI互換（Groq・OpenRouter・Mistral・DeepSeek・xAI等）
    var baseUrls = {
      openai: 'https://api.openai.com/v1',
      groq: 'https://api.groq.com/openai/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      mistral: 'https://api.mistral.ai/v1',
      deepseek: 'https://api.deepseek.com/v1',
      xai: 'https://api.x.ai/v1',
      fireworks: 'https://api.fireworks.ai/inference/v1',
      together: 'https://api.together.xyz/v1',
      perplexity: 'https://api.perplexity.ai',
      cohere: 'https://api.cohere.ai/v1',
      local: 'http://localhost:8080/v1',
    };
    var baseUrl = baseUrls[provider] || 'http://localhost:8080/v1';
    var defaultModels = {
      openai: 'gpt-4o-mini',
      groq: 'llama-3.3-70b-versatile',
      openrouter: 'meta-llama/llama-3.2-3b-instruct:free',
      mistral: 'mistral-small-latest',
      deepseek: 'deepseek-chat',
      xai: 'grok-beta',
      fireworks: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
      together: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
      perplexity: 'llama-3.1-sonar-small-128k-online',
      cohere: 'command-r',
      local: 'local-model',
    };

    const res = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: model || defaultModels[provider] || 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }].concat(msgs),
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(
      typeof data.error === 'string' ? data.error : data.error.message
    );
    content = data.choices && data.choices[0] ? data.choices[0].message.content : '';
  }

  // D-FUMT確信度評価
  var dfumt = evalDFUMTClient(content);
  return { content: content, dfumt: dfumt, latency: Date.now() - start };
}

function evalDFUMTClient(content) {
  var lower = content.toLowerCase();
  if (lower.indexOf('わかりません') >= 0 || lower.indexOf('不明') >= 0 ||
      lower.indexOf("i'm not sure") >= 0) return 'NEITHER';
  if (lower.indexOf('一方で') >= 0 || lower.indexOf('ただし') >= 0 ||
      lower.indexOf('however') >= 0 || lower.indexOf('場合によって') >= 0) return 'BOTH';
  if (lower.indexOf('変化') >= 0 || lower.indexOf('最新') >= 0 ||
      lower.indexOf('現在') >= 0) return 'FLOWING';
  if (lower.indexOf('手順') >= 0 || lower.indexOf('まず') >= 0 ||
      lower.indexOf('レシピ') >= 0) return 'TRUE';
  return 'TRUE';
}

// ─── 履歴レンダリング ─────────────────────────────────────────
function renderHistory() {
  var container = document.getElementById('universal-chat-history');
  container.innerHTML = universalHistory.map(function(m) {
    if (m.role === 'user') {
      return '<div class="msg-user"><strong>あなた</strong><br>' + escHtml(m.content) + '</div>';
    } else {
      var sym = DFUMT_SYMBOLS[m.dfumt] || '?';
      var col = DFUMT_COLORS[m.dfumt] || '#666';
      return '<div class="msg-assistant">' +
        '<div style="font-size:0.75rem;color:#888;margin-bottom:0.25rem">' +
        '⬡ ' + (m.provider || 'AI') +
        ' <span class="msg-dfumt" style="background:' + col + ';color:#fff">' + sym + ' ' + (m.dfumt||'') + '</span>' +
        ' <span style="margin-left:0.5rem">' + (m.latency||0) + 'ms</span>' +
        '</div>' +
        escHtml(m.content) +
        '</div>';
    }
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
</script>
`;
}
