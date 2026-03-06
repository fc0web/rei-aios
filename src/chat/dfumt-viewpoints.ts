/**
 * Rei-AIOS STEP 13-A — DFUMTViewpoints
 * D-FUMT七価論理7視点での回答生成エンジン
 */

import { UniversalChat, DEFAULT_PROVIDERS, ProviderName, ProviderConfig } from './universal-chat';
import type { DFUMTValue } from '../memory/aios-memory';

export interface ViewpointConfig {
  value: DFUMTValue;
  symbol: string;
  nameJa: string;
  nameEn: string;
  color: string;
  description: string;
  systemPromptAddition: string; // この視点用のプロンプト追加
}

export const DFUMT_VIEWPOINTS: ViewpointConfig[] = [
  {
    value: 'TRUE',
    symbol: '⊤',
    nameJa: '論理的視点',
    nameEn: 'Logical',
    color: '#88aaff',
    description: '事実・論理・証拠に基づいて確定的に答える',
    systemPromptAddition: `
【回答スタイル: ⊤ TRUE（論理的視点）】
事実と論理に基づいて、確定的・断言的に答えてください。
根拠を明示し、論理的な構造で回答してください。
曖昧な表現は避け、明確に述べてください。`,
  },
  {
    value: 'FALSE',
    symbol: '⊥',
    nameJa: '批判的視点',
    nameEn: 'Critical',
    color: '#cc6677',
    description: '反論・問題点・リスクを指摘する',
    systemPromptAddition: `
【回答スタイル: ⊥ FALSE（批判的視点）】
反論・問題点・リスク・デメリットの観点から答えてください。
「なぜそれが問題か」「何が欠けているか」を中心に述べてください。
建設的な批判として、改善点も示してください。`,
  },
  {
    value: 'BOTH',
    symbol: 'B',
    nameJa: '両面視点',
    nameEn: 'Both Sides',
    color: '#aa88ff',
    description: '賛否・メリットデメリット両方を提示する',
    systemPromptAddition: `
【回答スタイル: B BOTH（両面視点）】
賛成側と反対側、メリットとデメリット、両方の観点から答えてください。
「一方では...、他方では...」という構造で回答してください。
どちらか一方に偏らず、公平に両面を示してください。`,
  },
  {
    value: 'NEITHER',
    symbol: 'N',
    nameJa: '中立視点',
    nameEn: 'Neutral',
    color: '#888888',
    description: '判断を保留し、問いをより深く掘り下げる',
    systemPromptAddition: `
【回答スタイル: N NEITHER（中立視点）】
即断せず、問いそのものを深く掘り下げてください。
「そもそもこの問いは何を前提としているか」
「本当に問うべきことは何か」を探ってください。
ソクラテス的な問い返しも有効です。`,
  },
  {
    value: 'INFINITY',
    symbol: '∞',
    nameJa: '発散視点',
    nameEn: 'Expansive',
    color: '#ffaa44',
    description: '可能性を最大限に広げ、斬新なアイデアを出す',
    systemPromptAddition: `
【回答スタイル: ∞ INFINITY（発散視点）】
可能性を最大限に広げて答えてください。
「もしこうだったら」「極端に言えば」「宇宙規模で考えると」
など、通常の枠を超えた発想で回答してください。
創造的・革新的・斬新なアイデアを優先してください。`,
  },
  {
    value: 'ZERO',
    symbol: '〇',
    nameJa: '本質視点',
    nameEn: 'Essential',
    color: '#44aacc',
    description: '本質・核心だけを最小限の言葉で答える',
    systemPromptAddition: `
【回答スタイル: 〇 ZERO（本質視点）】
余分なものを全て削ぎ落とし、本質だけを答えてください。
できるだけ短く、しかし深く。
「一言で言えば何か」を意識してください。
禅問答のように、核心を突いた言葉で答えてください。`,
  },
  {
    value: 'FLOWING',
    symbol: '～',
    nameJa: '変化視点',
    nameEn: 'Dynamic',
    color: '#88ccaa',
    description: '時間軸・プロセス・変化の観点で答える',
    systemPromptAddition: `
【回答スタイル: ～ FLOWING（変化視点）】
時間の流れ・変化・プロセスの観点から答えてください。
「過去はどうだったか」「現在はどうか」「未来はどうなるか」
「この状況はどのように変化していくか」を中心に述べてください。
静的な答えではなく、動的・流動的な視点で回答してください。`,
  },
];

export interface ViewpointResponse {
  viewpoint: ViewpointConfig;
  content: string;
  confidence: number;  // 0〜100
  latencyMs: number;
  provider: string;
  error?: string;
}

export interface MultiViewpointResult {
  question: string;
  responses: ViewpointResponse[];
  selectedValues: DFUMTValue[];
  totalLatencyMs: number;
}

// ─── DFUMTViewpoints メインクラス ────────────────────────────
export class DFUMTViewpoints {
  private chat: UniversalChat;
  private provider: ProviderName = 'ollama';
  private config: ProviderConfig;

  constructor() {
    this.chat = new UniversalChat(DEFAULT_PROVIDERS);
    this.config = DEFAULT_PROVIDERS.find(p => p.name === 'ollama')!;
  }

  setProvider(name: ProviderName, apiKey?: string, model?: string): void {
    this.provider = name;
    const base = DEFAULT_PROVIDERS.find(p => p.name === name);
    if (!base) return;
    this.config = { ...base, apiKey, model: model ?? base.model };
    this.chat.configure(name, this.config);
  }

  // ── 全視点または選択視点で回答 ───────────────────────────
  async generateMultiViewpoint(
    question: string,
    selectedValues: DFUMTValue[] = ['TRUE', 'FALSE', 'BOTH'],
    baseSystemPrompt = 'あなたは親切なアシスタントです。日本語で答えてください。'
  ): Promise<MultiViewpointResult> {
    const start = Date.now();
    const selectedViewpoints = DFUMT_VIEWPOINTS.filter(v =>
      selectedValues.includes(v.value)
    );

    const responses: ViewpointResponse[] = [];

    for (const vp of selectedViewpoints) {
      const vpStart = Date.now();
      try {
        const result = await this.chat.send({
          provider: this.provider,
          config: this.config,
          messages: [{ role: 'user', content: question }],
          systemPrompt: baseSystemPrompt + vp.systemPromptAddition,
          maxTokens: 300,
          temperature: 0.7,
        });

        responses.push({
          viewpoint: vp,
          content: result.content || `[${vp.nameJa}として回答できませんでした]`,
          confidence: this._calcConfidence(result.content, vp.value),
          latencyMs: Date.now() - vpStart,
          provider: this.provider,
          error: result.error,
        });
      } catch (e: any) {
        responses.push({
          viewpoint: vp,
          content: this._fallbackResponse(question, vp),
          confidence: 50,
          latencyMs: Date.now() - vpStart,
          provider: 'fallback',
          error: e.message,
        });
      }
    }

    return {
      question,
      responses,
      selectedValues,
      totalLatencyMs: Date.now() - start,
    };
  }

  // ── 確信度計算 ──────────────────────────────────────────
  private _calcConfidence(content: string, value: DFUMTValue): number {
    if (!content || content.length < 10) return 20;
    const len = Math.min(content.length, 500);
    const base = 50 + (len / 500) * 30;
    const bonus: Record<DFUMTValue, number> = {
      TRUE: 10, FALSE: 5, BOTH: 8,
      NEITHER: 3, INFINITY: 7, ZERO: 12, FLOWING: 6,
    };
    return Math.min(95, Math.round(base + (bonus[value] ?? 0)));
  }

  // ── フォールバック応答 ───────────────────────────────────
  private _fallbackResponse(question: string, vp: ViewpointConfig): string {
    const templates: Record<DFUMTValue, string> = {
      TRUE: `${question}について、論理的に述べると: 事実に基づいた判断が必要です。`,
      FALSE: `${question}には問題点があります: 批判的に見ると改善の余地があります。`,
      BOTH: `${question}には両面あります: 一方ではメリットがあり、他方ではデメリットもあります。`,
      NEITHER: `${question}という問い自体を問い直してみましょう。本当に問うべきことは何でしょうか？`,
      INFINITY: `${question}の可能性は無限です！全く別の角度から考えると...`,
      ZERO: `${question}の本質は一言で言えば: 核心を見極めることです。`,
      FLOWING: `${question}は時間とともに変化します: 過去・現在・未来の流れで捉えましょう。`,
    };
    return templates[vp.value] ?? `${vp.nameJa}として回答します。`;
  }

  listViewpoints(): ViewpointConfig[] { return DFUMT_VIEWPOINTS; }

  getViewpoint(value: DFUMTValue): ViewpointConfig | null {
    return DFUMT_VIEWPOINTS.find(v => v.value === value) ?? null;
  }
}

// ─── WebUIパネル用スクリプト生成 ─────────────────────────────
export function generateViewpointSelectorScript(): string {
  return `
// ─── STEP 13-A: D-FUMT七価論理7視点セレクター ──────────────
const DFUMT_VIEWPOINTS_CONFIG = ${JSON.stringify(DFUMT_VIEWPOINTS)};

let selectedViewpoints = new Set(['TRUE', 'FALSE', 'BOTH']);

function renderViewpointSelector(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = \`
    <div class="viewpoint-selector">
      <div class="viewpoint-label">回答視点を選択（複数可）:</div>
      <div class="viewpoint-chips">
        \${DFUMT_VIEWPOINTS_CONFIG.map(vp => \`
          <label class="viewpoint-chip \${selectedViewpoints.has(vp.value) ? 'active' : ''}"
            style="--vp-color: \${vp.color}"
            onclick="toggleViewpoint('\${vp.value}', this)">
            <input type="checkbox" value="\${vp.value}"
              \${selectedViewpoints.has(vp.value) ? 'checked' : ''}
              style="display:none"/>
            <span class="vp-symbol">\${vp.symbol}</span>
            <span class="vp-name">\${vp.nameJa}</span>
          </label>
        \`).join('')}
      </div>
      <div style="font-size:0.72rem;color:#555;margin-top:0.25rem">
        選択中: <span id="selected-count">\${selectedViewpoints.size}</span>視点
        （多いほど回答生成に時間がかかります）
      </div>
    </div>
  \`;
}

function toggleViewpoint(value, labelEl) {
  if (selectedViewpoints.has(value)) {
    if (selectedViewpoints.size <= 1) return; // 最低1つは必要
    selectedViewpoints.delete(value);
    labelEl.classList.remove('active');
  } else {
    selectedViewpoints.add(value);
    labelEl.classList.add('active');
  }
  const countEl = document.getElementById('selected-count');
  if (countEl) countEl.textContent = selectedViewpoints.size;
}

function renderMultiViewpointResponse(containerId, responses) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = responses.map(r => {
    const vp = r.viewpoint;
    const barWidth = r.confidence + '%';
    return \`
      <div class="viewpoint-response">
        <div class="vp-response-header">
          <span class="vp-badge" style="background:\${vp.color}">
            \${vp.symbol} \${vp.nameJa}
          </span>
          <span class="vp-provider" style="font-size:0.72rem;color:#555">
            \${r.provider} | \${r.latencyMs}ms
          </span>
          <div class="vp-confidence-bar">
            <div class="vp-confidence-fill"
              style="width:\${barWidth};background:\${vp.color}"></div>
          </div>
          <span class="vp-confidence-num">\${r.confidence}%</span>
        </div>
        <div class="vp-response-content">
          \${escHtml(r.content)}
        </div>
      </div>
    \`;
  }).join('');
}
`;
}
