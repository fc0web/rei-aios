/**
 * toyosatomi-ui.ts — 豊聡耳モード UIレンダラー側コード
 *
 * index.htmlから読み込まれる豊聡耳パネルの描画・操作ロジック
 */

import type { ToyosatomiPanelResult, ToyosatomiSession, ToyosatomiDisplayCount } from './toyosatomi';

// ─── パネルグリッドレイアウト ─────────────────────────

const GRID_LAYOUTS: Record<ToyosatomiDisplayCount, string> = {
  2:  'grid-cols-2 grid-rows-1',
  4:  'grid-cols-2 grid-rows-2',
  6:  'grid-cols-3 grid-rows-2',
  10: 'grid-cols-5 grid-rows-2',
};

// ─── HTMLテンプレート ────────────────────────────────

export function renderToyosatomiSection(): string {
  return `
<!-- ★ 豊聡耳モード UI -->
<div id="toyosatomi-section" class="hidden">
  <!-- ヘッダー -->
  <div class="toyosatomi-header">
    <h2>🎏 豊聡耳モード <span class="subtitle">— 複数AI同時比較</span></h2>
    <div class="toyosatomi-controls">

      <!-- モード選択 -->
      <div class="control-group">
        <label>モード</label>
        <select id="toyosatomi-mode">
          <option value="comparison">🔍 比較モード</option>
          <option value="roles">🎭 役割分担モード</option>
          <option value="judge">⚖️ 豊聡耳ジャッジ</option>
        </select>
      </div>

      <!-- 表示数 -->
      <div class="control-group">
        <label>表示数</label>
        <select id="toyosatomi-count">
          <option value="2">2画面</option>
          <option value="4" selected>4画面</option>
          <option value="6">6画面</option>
          <option value="10">10画面</option>
        </select>
      </div>

      <!-- AIプロバイダー選択 -->
      <div class="control-group">
        <label>使用AI</label>
        <div id="toyosatomi-provider-checkboxes" class="provider-checkboxes">
          <!-- JSで動的生成 -->
        </div>
      </div>
    </div>

    <!-- プロンプト入力 -->
    <div class="toyosatomi-prompt">
      <textarea
        id="toyosatomi-prompt"
        placeholder="すべてのAIへの質問を入力..."
        rows="3"
      ></textarea>
      <div class="toyosatomi-btn-group">
        <button id="toyosatomi-run" class="btn-run">
          🎏 全AI同時問い合わせ
        </button>
        <button id="toyosatomi-apikey-open" class="btn-apikey-settings">
          🔑 APIキー設定
        </button>
      </div>
    </div>
  </div>

  <!-- パネルグリッド -->
  <div id="toyosatomi-grid" class="toyosatomi-grid grid-cols-2">
    <!-- JSで動的生成 -->
  </div>

  <!-- 豊聡耳ジャッジパネル（judgeモード時のみ表示） -->
  <div id="toyosatomi-judge-panel" class="hidden judge-panel">
    <h3>⚖️ 豊聡耳ジャッジ — 統合見解</h3>
    <div class="judge-grid">
      <div class="judge-card">
        <h4>🔮 統合見解</h4>
        <div id="judge-synthesis"></div>
      </div>
      <div class="judge-card">
        <h4>🤝 合意点</h4>
        <div id="judge-consensus"></div>
      </div>
      <div class="judge-card">
        <h4>⚡ 相違点</h4>
        <div id="judge-divergence"></div>
      </div>
      <div class="judge-card full-width">
        <h4>✅ 最終推薦</h4>
        <div id="judge-recommendation"></div>
      </div>
    </div>
    <div id="judge-loading" class="hidden">
      <div class="spinner"></div>
      <span>Claude が回答を統合中...</span>
    </div>
  </div>
</div>
`;
}

// ─── CSS ────────────────────────────────────────────

export const TOYOSATOMI_CSS = `
/* ─── 豊聡耳モード ──────────────────────────── */
#toyosatomi-section {
  padding: 12px;
  background: var(--bg-secondary, #1a1a2e);
  border-radius: 8px;
  margin: 8px 0;
}

.toyosatomi-header h2 {
  font-size: 1.1rem;
  color: var(--accent-gold, #d4a93a);
  margin: 0 0 12px;
}

.toyosatomi-header h2 .subtitle {
  font-size: 0.8rem;
  color: var(--text-muted, #888);
  font-weight: normal;
}

.toyosatomi-controls {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.control-group label {
  font-size: 0.75rem;
  color: var(--text-muted, #888);
}

.control-group select {
  background: var(--bg-tertiary, #16213e);
  color: var(--text-primary, #e0e0e0);
  border: 1px solid var(--border, #333);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 0.8rem;
}

.provider-checkboxes {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.provider-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--text-secondary, #bbb);
  cursor: pointer;
}

.toyosatomi-prompt {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.toyosatomi-prompt textarea {
  flex: 1;
  background: var(--bg-tertiary, #16213e);
  color: var(--text-primary, #e0e0e0);
  border: 1px solid var(--border, #333);
  border-radius: 6px;
  padding: 8px;
  font-size: 0.85rem;
  resize: vertical;
}

.btn-run {
  background: linear-gradient(135deg, #d4a93a, #b8862a);
  color: #1a1a00;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-weight: bold;
  cursor: pointer;
  white-space: nowrap;
}

.btn-run:hover {
  background: linear-gradient(135deg, #e8c04a, #d4a93a);
}

.toyosatomi-btn-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.btn-apikey-settings {
  background: #16213e;
  color: #d4a93a;
  border: 1px solid #d4a93a55;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
}

.btn-apikey-settings:hover {
  background: #1e2d4a;
  border-color: #d4a93a;
}

/* ─── パネルグリッド ──────────────── */
.toyosatomi-grid {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.toyosatomi-grid.grid-cols-2  { grid-template-columns: repeat(2, 1fr); }
.toyosatomi-grid.grid-cols-3  { grid-template-columns: repeat(3, 1fr); }
.toyosatomi-grid.grid-cols-5  { grid-template-columns: repeat(5, 1fr); }

.toyosatomi-panel {
  background: var(--bg-tertiary, #16213e);
  border: 1px solid var(--border, #333);
  border-radius: 6px;
  padding: 10px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  position: relative;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.panel-provider {
  font-size: 0.75rem;
  font-weight: bold;
  color: var(--accent-blue, #4fc3f7);
}

.panel-role-badge {
  font-size: 0.65rem;
  background: var(--bg-secondary, #1a1a2e);
  border-radius: 10px;
  padding: 2px 6px;
  color: var(--text-muted, #888);
}

.panel-latency {
  font-size: 0.65rem;
  color: var(--text-muted, #888);
}

.panel-content {
  flex: 1;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--text-primary, #e0e0e0);
  overflow-y: auto;
  max-height: 250px;
  white-space: pre-wrap;
}

.panel-pending  .panel-provider { color: var(--text-muted, #888); }
.panel-error    { border-color: #f44336; }
.panel-error    .panel-content { color: #f44336; }
.panel-done     { border-color: #4caf50; }
.panel-streaming { border-color: #ff9800; }

.panel-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border, #333);
  border-top-color: #ff9800;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: auto;
}

/* ─── ジャッジパネル ──────────────── */
.judge-panel {
  margin-top: 16px;
  background: var(--bg-tertiary, #16213e);
  border: 2px solid var(--accent-gold, #d4a93a);
  border-radius: 8px;
  padding: 16px;
}

.judge-panel h3 {
  color: var(--accent-gold, #d4a93a);
  margin: 0 0 12px;
  font-size: 1rem;
}

.judge-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.judge-card {
  background: var(--bg-secondary, #1a1a2e);
  border-radius: 6px;
  padding: 10px;
}

.judge-card.full-width {
  grid-column: 1 / -1;
}

.judge-card h4 {
  font-size: 0.8rem;
  color: var(--accent-gold, #d4a93a);
  margin: 0 0 6px;
}

.judge-card div {
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--text-primary, #e0e0e0);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
`;

// ─── UIコントローラー ────────────────────────────────

export class ToyosatomiUIController {
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement;
  }

  /**
   * プロバイダーチェックボックスを動的生成
   */
  renderProviderCheckboxes(providers: Array<{ id: string; name: string; connected: boolean }>) {
    const el = document.getElementById('toyosatomi-provider-checkboxes');
    if (!el) return;

    el.innerHTML = providers.map(p => `
      <label class="provider-checkbox">
        <input type="checkbox"
          id="toy-prov-${p.id}"
          value="${p.id}"
          ${p.connected ? 'checked' : 'disabled'}
        >
        ${p.name}
        ${!p.connected ? '<span style="color:#666">(未接続)</span>' : ''}
      </label>
    `).join('');
  }

  /**
   * グリッドを指定枚数にリセット
   */
  resetGrid(count: ToyosatomiDisplayCount, agentNames: string[]) {
    const grid = document.getElementById('toyosatomi-grid');
    if (!grid) return;

    // グリッドクラス更新
    grid.className = `toyosatomi-grid ${GRID_LAYOUTS[count]}`;

    // パネル生成
    grid.innerHTML = agentNames.slice(0, count).map(name => `
      <div class="toyosatomi-panel panel-pending" id="panel-${name}">
        <div class="panel-header">
          <span class="panel-provider">${name}</span>
          <span class="panel-latency">—</span>
        </div>
        <div class="panel-content">
          <div class="panel-spinner"></div>
        </div>
      </div>
    `).join('');
  }

  /**
   * パネルを更新
   */
  updatePanel(panel: ToyosatomiPanelResult) {
    const el = document.getElementById(`panel-${panel.agent.providerId}`);
    if (!el) return;

    el.className = `toyosatomi-panel panel-${panel.status}`;

    const header = el.querySelector('.panel-header');
    const content = el.querySelector('.panel-content');
    if (!header || !content) return;

    const roleLabel = panel.agent.role !== 'general'
      ? `<span class="panel-role-badge">${panel.agent.role}</span>`
      : '';

    const latencyLabel = panel.latencyMs
      ? `<span class="panel-latency">${(panel.latencyMs / 1000).toFixed(1)}s</span>`
      : '<span class="panel-latency">...</span>';

    header.innerHTML = `
      <span class="panel-provider">${panel.agent.providerName}</span>
      ${roleLabel}
      ${latencyLabel}
    `;

    if (panel.status === 'pending' || panel.status === 'streaming') {
      content.innerHTML = '<div class="panel-spinner"></div>';
      if (panel.streaming) {
        content.innerHTML = `<div class="panel-spinner"></div><pre>${panel.streaming}</pre>`;
      }
    } else if (panel.status === 'done' && panel.response) {
      content.innerHTML = `<pre>${escapeHtml(panel.response.content)}</pre>`;
    } else if (panel.status === 'error') {
      content.innerHTML = `<span>❌ ${escapeHtml(panel.error ?? 'Error')}</span>`;
    }
  }

  /**
   * ジャッジ結果を表示
   */
  renderJudgeResult(result: {
    synthesis: string;
    consensus: string;
    divergence: string;
    recommendation: string;
  }) {
    const panel = document.getElementById('toyosatomi-judge-panel');
    const loading = document.getElementById('judge-loading');
    if (panel) panel.classList.remove('hidden');
    if (loading) loading.classList.add('hidden');

    const set = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    set('judge-synthesis', result.synthesis);
    set('judge-consensus', result.consensus);
    set('judge-divergence', result.divergence);
    set('judge-recommendation', result.recommendation);
  }

  showJudgeLoading() {
    const panel = document.getElementById('toyosatomi-judge-panel');
    const loading = document.getElementById('judge-loading');
    if (panel) panel.classList.remove('hidden');
    if (loading) loading.classList.remove('hidden');
  }

  getSelectedProviders(): string[] {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      '#toyosatomi-provider-checkboxes input:checked'
    );
    return Array.from(checkboxes).map(cb => cb.value);
  }

  getSelectedMode(): 'comparison' | 'roles' | 'judge' {
    const select = document.getElementById('toyosatomi-mode') as HTMLSelectElement;
    return (select?.value as any) ?? 'comparison';
  }

  getSelectedCount(): ToyosatomiDisplayCount {
    const select = document.getElementById('toyosatomi-count') as HTMLSelectElement;
    return (parseInt(select?.value ?? '4') as ToyosatomiDisplayCount);
  }

  getPrompt(): string {
    const textarea = document.getElementById('toyosatomi-prompt') as HTMLTextAreaElement;
    return textarea?.value.trim() ?? '';
  }
}

// ─── ユーティリティ ──────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── 13プロバイダー定義 ──────────────────────────────

const TOYOSATOMI_PROVIDERS = [
  { id: 'claude',     name: 'Anthropic Claude',         placeholder: 'sk-ant-...',        color: 'claude',      noKey: false },
  { id: 'openai',     name: 'OpenAI',                   placeholder: 'sk-...',            color: 'openai',      noKey: false },
  { id: 'gemini',     name: 'Google Gemini',            placeholder: 'AIza...',           color: 'gemini',      noKey: false },
  { id: 'mistral',    name: 'Mistral AI',               placeholder: 'xxxxxxxx...',       color: 'mistral',     noKey: false },
  { id: 'deepseek',   name: 'DeepSeek',                 placeholder: 'sk-...',            color: 'deepseek',    noKey: false },
  { id: 'groq',       name: 'Groq',                     placeholder: 'gsk_...',           color: 'groq',        noKey: false },
  { id: 'perplexity', name: 'Perplexity',               placeholder: 'pplx-...',          color: 'perplexity',  noKey: false },
  { id: 'together',   name: 'Together AI',              placeholder: 'xxxxxxxx...',       color: 'together',    noKey: false },
  { id: 'cohere',     name: 'Cohere',                   placeholder: 'xxxxxxxx...',       color: 'cohere',      noKey: false },
  { id: 'ollama',     name: 'Ollama (Local)',            placeholder: '',                  color: 'ollama',      noKey: true  },
  { id: 'openrouter', name: 'OpenRouter (300+ models)', placeholder: 'sk-or-...',         color: 'openrouter',  noKey: false },
  { id: 'xai',        name: 'xAI (Grok)',               placeholder: 'xai-...',           color: 'xai',         noKey: false },
  { id: 'glm',        name: 'GLM (清華大学 Zhipu)',      placeholder: 'xxxx.xxxx',         color: 'glm',         noKey: false },
] as const;

// ─── APIキー設定モーダル HTML ────────────────────────

export function renderToyosatomiApiKeyModal(): string {
  const rows = TOYOSATOMI_PROVIDERS.map(p => {
    if (p.noKey) {
      return `
      <div class="toy-apikey-row">
        <div class="toy-apikey-label">
          <span class="toy-provider-badge toy-badge-${p.color}">${p.name}</span>
        </div>
        <div class="toy-apikey-input-wrap">
          <span class="toy-ollama-info">🟢 APIキー不要 — ローカル自動接続</span>
        </div>
        <span class="toy-apikey-status" id="toy-status-${p.id}">✅ 接続済み</span>
      </div>`;
    }
    return `
      <div class="toy-apikey-row">
        <div class="toy-apikey-label">
          <span class="toy-provider-badge toy-badge-${p.color}">${p.name}</span>
        </div>
        <div class="toy-apikey-input-wrap">
          <input type="password" id="toy-key-${p.id}"
            placeholder="${p.placeholder}" class="toy-apikey-input" autocomplete="off" />
          <button class="toy-apikey-save-btn" data-provider="${p.id}">保存</button>
        </div>
        <span class="toy-apikey-status" id="toy-status-${p.id}"></span>
      </div>`;
  }).join('\n');

  return `
<!-- ★ 豊聡耳 APIキー設定モーダル -->
<div id="toyosatomi-apikey-modal" class="toy-modal-overlay hidden">
  <div class="toy-modal">
    <div class="toy-modal-header">
      <div>
        <h3>🔑 豊聡耳 APIキー設定</h3>
        <p class="toy-modal-subtitle">13プロバイダー — APIキーを設定するとチェックボックスが有効になります</p>
      </div>
      <button id="toyosatomi-apikey-close" class="toy-modal-close">✕</button>
    </div>
    <div class="toy-modal-body">
      ${rows}
    </div>
    <div class="toy-modal-footer">
      🔒 APIキーは端末内のみに保存されます。外部送信されません。
    </div>
  </div>
</div>
`;
}

// ─── APIキー設定モーダル CSS ─────────────────────────

export const TOYOSATOMI_APIKEY_CSS = `
/* ─── オーバーレイ ── */
.toy-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}
.toy-modal-overlay.hidden { display: none !important; }

/* ─── モーダル本体 ── */
.toy-modal {
  background: #1a1a2e;
  border: 1px solid #3a3a5a;
  border-radius: 12px;
  width: 640px;
  max-width: 96vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0,0,0,0.7);
}

/* ─── ヘッダー ── */
.toy-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 18px 22px 14px;
  border-bottom: 1px solid #2a2a4a;
  flex-shrink: 0;
}
.toy-modal-header h3 {
  margin: 0 0 4px;
  font-size: 1rem;
  color: #d4a93a;
}
.toy-modal-subtitle {
  margin: 0;
  font-size: 0.72rem;
  color: #888;
}
.toy-modal-close {
  background: none;
  border: none;
  color: #888;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
.toy-modal-close:hover { background: #333; color: #fff; }

/* ─── ボディ（スクロール可） ── */
.toy-modal-body {
  padding: 16px 22px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ─── 各行 ── */
.toy-apikey-row {
  display: grid;
  grid-template-columns: 160px 1fr auto;
  align-items: center;
  gap: 10px;
}

.toy-apikey-label {
  display: flex;
  align-items: center;
}

/* ─── プロバイダーバッジ ── */
.toy-provider-badge {
  font-size: 0.75rem;
  font-weight: bold;
  padding: 3px 10px;
  border-radius: 12px;
  white-space: nowrap;
}
.toy-badge-claude      { background: #2d1a4a; color: #c084fc; }
.toy-badge-openai      { background: #1a2d1a; color: #4ade80; }
.toy-badge-gemini      { background: #1a2a1a; color: #34d399; }
.toy-badge-mistral     { background: #2a1a1a; color: #f97316; }
.toy-badge-deepseek    { background: #1a1a2d; color: #60a5fa; }
.toy-badge-groq        { background: #2a2a1a; color: #facc15; }
.toy-badge-perplexity  { background: #1a2a2a; color: #22d3ee; }
.toy-badge-together    { background: #2d1a2d; color: #e879f9; }
.toy-badge-cohere      { background: #1a2d2d; color: #2dd4bf; }
.toy-badge-ollama      { background: #1a2a3a; color: #38bdf8; }
.toy-badge-openrouter  { background: #2a1a1a; color: #fb923c; }
.toy-badge-xai         { background: #1a1a1a; color: #e0e0e0; }
.toy-badge-glm         { background: #2a1a2a; color: #a78bfa; }

/* ─── 入力欄 ── */
.toy-apikey-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toy-ollama-info {
  font-size: 0.78rem;
  color: #4ade80;
}
.toy-apikey-input {
  flex: 1;
  background: #0f0f1e;
  border: 1px solid #3a3a5a;
  border-radius: 6px;
  color: #e0e0e0;
  padding: 6px 10px;
  font-size: 0.8rem;
  font-family: monospace;
  min-width: 0;
}
.toy-apikey-input:focus {
  outline: none;
  border-color: #d4a93a;
  box-shadow: 0 0 0 2px rgba(212,169,58,0.15);
}

/* ─── 保存ボタン ── */
.toy-apikey-save-btn {
  background: #d4a93a;
  color: #1a1a00;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-weight: bold;
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.toy-apikey-save-btn:hover { background: #e8c04a; }
.toy-apikey-save-btn:disabled { background: #555; color: #999; cursor: not-allowed; }

/* ─── ステータス ── */
.toy-apikey-status {
  font-size: 0.72rem;
  color: #4ade80;
  min-width: 70px;
  text-align: right;
  white-space: nowrap;
}
.toy-apikey-status.error { color: #f87171; }
.toy-apikey-status.saving { color: #facc15; }

/* ─── フッター ── */
.toy-modal-footer {
  padding: 12px 22px 16px;
  border-top: 1px solid #2a2a4a;
  font-size: 0.72rem;
  color: #666;
  text-align: center;
  flex-shrink: 0;
}

/* ─── レスポンシブ（狭い画面） ── */
@media (max-width: 500px) {
  .toy-apikey-row {
    grid-template-columns: 1fr;
  }
}
`;

// ─── APIキー設定モーダル イベント登録 ────────────────

export function initToyosatomiApiKeyModal(): void {
  const openBtn  = document.getElementById('toyosatomi-apikey-open');
  const modal    = document.getElementById('toyosatomi-apikey-modal');
  const closeBtn = document.getElementById('toyosatomi-apikey-close');

  if (!modal) return;

  // ── 開く ──
  openBtn?.addEventListener('click', async () => {
    modal.classList.remove('hidden');
    await _refreshAllStatuses();
  });

  // ── 閉じる（✕ボタン） ──
  closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));

  // ── 閉じる（オーバーレイクリック） ──
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  // ── 保存ボタン（全プロバイダー共通） ──
  modal.querySelectorAll<HTMLButtonElement>('.toy-apikey-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const providerId = btn.dataset.provider!;
      const input     = document.getElementById(`toy-key-${providerId}`) as HTMLInputElement;
      const statusEl  = document.getElementById(`toy-status-${providerId}`)!;
      const apiKey    = input?.value.trim();

      if (!apiKey) {
        statusEl.textContent = '⚠️ キーを入力してください';
        statusEl.className = 'toy-apikey-status error';
        return;
      }

      btn.disabled = true;
      btn.textContent = '保存中...';
      statusEl.textContent = '⏳';
      statusEl.className = 'toy-apikey-status saving';

      try {
        const api = (window as any).toyosatomiAPI;
        const result = await api.updateApiKey(providerId, apiKey);
        if (result?.success) {
          statusEl.textContent = '✅ 保存済み';
          statusEl.className = 'toy-apikey-status';
          input.value = '';
          // プロバイダーチェックボックス再読み込み
          if ((window as any).__toyosatomiRefreshProviders) {
            await (window as any).__toyosatomiRefreshProviders();
          }
        } else {
          statusEl.textContent = `❌ ${result?.error ?? '保存失敗'}`;
          statusEl.className = 'toy-apikey-status error';
        }
      } catch (e: any) {
        statusEl.textContent = `❌ ${e.message ?? 'エラー'}`;
        statusEl.className = 'toy-apikey-status error';
      } finally {
        btn.disabled = false;
        btn.textContent = '保存';
      }
    });
  });
}

// ─── ステータス一括更新（内部用） ────────────────────

async function _refreshAllStatuses(): Promise<void> {
  try {
    const api = (window as any).toyosatomiAPI;
    const keys: Array<{ id: string; hasKey: boolean }> = await api.getApiKeys();
    keys.forEach(k => {
      const el = document.getElementById(`toy-status-${k.id}`);
      if (!el) return;
      if (k.id === 'ollama') {
        el.textContent = '✅ 接続済み';
        el.className = 'toy-apikey-status';
      } else {
        el.textContent = k.hasKey ? '✅ 設定済み' : '⚠️ 未設定';
        el.className = `toy-apikey-status${k.hasKey ? '' : ' error'}`;
      }
    });
  } catch {
    // エラーは無視
  }
}
