/**
 * Rei AIOS — LLM Manager
 * プロバイダー設定管理、アダプタ生成、永続化
 */

import * as fs from 'fs';
import * as path from 'path';
import { ILLMAdapter, LLMProviderConfig, LLMAdapterStatus } from './llm-adapter';
import { ClaudeAdapter } from './claude-adapter';
import { OpenAIAdapter } from './openai-adapter';
import { OpenAICompatAdapter } from './openai-compat-adapter';
import { OllamaAdapter } from './ollama-adapter';

// ─── デフォルトプロバイダー定義 ─────────────────────

const DEFAULT_PROVIDERS: LLMProviderConfig[] = [
  {
    id: 'claude',
    name: 'Anthropic Claude',
    type: 'claude',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    availableModels: [
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-6',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    baseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o',
    availableModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o3-mini'],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'openai-compat',
    baseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.5-flash',
    availableModels: [
      'gemini-2.5-flash',       // 推奨: 高速・高品質・無料枠あり
      'gemini-2.5-flash-lite',  // 最速・最安価（無料: 1000回/日）
      'gemini-2.5-pro',         // 最高品質（無料: 50回/日）
      'gemini-2.0-flash',       // ※2026年3月廃止予定
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    type: 'openai-compat',
    baseUrl: 'https://api.mistral.ai',
    defaultModel: 'mistral-large-latest',
    availableModels: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'openai-compat',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    availableModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'groq',
    name: 'Groq',
    type: 'openai-compat',
    baseUrl: 'https://api.groq.com/openai',
    defaultModel: 'llama-3.3-70b-versatile',
    availableModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    type: 'openai-compat',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'sonar',
    availableModels: ['sonar', 'sonar-pro', 'sonar-reasoning'],
  },
  {
    id: 'together',
    name: 'Together AI',
    type: 'openai-compat',
    baseUrl: 'https://api.together.xyz',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    availableModels: [
      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
    ],
  },
  {
    id: 'cohere',
    name: 'Cohere',
    type: 'openai-compat',
    baseUrl: 'https://api.cohere.com/compatibility',
    defaultModel: 'command-a-03-2025',
    availableModels: ['command-a-03-2025', 'command-r-plus-08-2024', 'command-r-08-2024'],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2:latest',
    availableModels: [
      'llama3.2:latest', 'llama3:8b', 'mistral', 'gemma2', 'phi3', 'qwen2',
      'deepseek-coder-v2',  // ★ 新追加
      'phi4',               // ★ 新追加
      'qwen2.5',            // ★ 日本語最強
      'qwen2.5:7b',
      'qwen2.5:14b',
      'qwen2.5:72b',
    ],
  },
  // ★ 新プロバイダー追加 ──────────────────────────────
  {
    id: 'openrouter',
    name: 'OpenRouter (300+ models)',
    type: 'openai-compat',
    baseUrl: 'https://openrouter.ai/api',
    defaultModel: 'anthropic/claude-sonnet-4',
    availableModels: [
      'anthropic/claude-sonnet-4',
      'anthropic/claude-3.5-haiku',
      'openai/gpt-4o',
      'openai/o3-mini',
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
      'deepseek/deepseek-r1',
      'mistralai/mistral-large',
      'qwen/qwen-2.5-72b-instruct',
      'x-ai/grok-2-1212',
      'thudm/glm-4-9b',
    ],
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    type: 'openai-compat',
    baseUrl: 'https://api.x.ai',
    defaultModel: 'grok-3',
    availableModels: [
      'grok-3',
      'grok-3-mini',
      'grok-2-1212',
      'grok-2-vision-1212',
    ],
  },
  {
    id: 'glm',
    name: 'GLM (清華大学 Zhipu)',
    type: 'openai-compat',
    baseUrl: 'https://open.bigmodel.cn/api/paas',
    defaultModel: 'glm-4-flash',
    availableModels: [
      'glm-4-flash',    // 超安価・無料枠あり
      'glm-4-air',
      'glm-4-plus',
      'glm-4',
      'glm-z1-flash',
    ],
  },
];

// ─── LLMManager クラス ──────────────────────────────

export class LLMManager {
  private providers: Map<string, LLMProviderConfig> = new Map();
  private adapters: Map<string, ILLMAdapter> = new Map();
  private activeProviderId: string = 'claude';
  private configPath: string;

  constructor(configDir: string) {
    this.configPath = path.join(configDir, 'llm-config.json');
    this.loadConfig();
  }

  // ─── 設定の読み込み・保存 ────────────────────────

  private loadConfig(): void {
    // デフォルトプロバイダーをまず登録
    for (const p of DEFAULT_PROVIDERS) {
      this.providers.set(p.id, { ...p });
    }

    // 保存済み設定があれば上書き（APIキー等）
    try {
      if (fs.existsSync(this.configPath)) {
        const saved = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        if (saved.activeProviderId) {
          this.activeProviderId = saved.activeProviderId;
        }
        if (saved.providers) {
          for (const sp of saved.providers) {
            const existing = this.providers.get(sp.id);
            if (existing) {
              // APIキーとカスタム設定をマージ
              Object.assign(existing, sp);
            } else {
              // ユーザー追加のカスタムプロバイダー
              this.providers.set(sp.id, sp);
            }
          }
        }
      }
    } catch {
      // 設定ファイルが壊れている場合はデフォルトのまま
    }
  }

  saveConfig(): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      activeProviderId: this.activeProviderId,
      providers: Array.from(this.providers.values()).map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        apiKey: p.apiKey,
        baseUrl: p.baseUrl,
        defaultModel: p.defaultModel,
        availableModels: p.availableModels,
        maxTokens: p.maxTokens,
      })),
    };

    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // ─── アダプタ管理 ────────────────────────────────

  private createAdapter(config: LLMProviderConfig): ILLMAdapter {
    switch (config.type) {
      case 'claude':
        return new ClaudeAdapter(config);
      case 'openai':
        return new OpenAIAdapter(config);
      case 'ollama':
        return new OllamaAdapter(config);
      case 'openai-compat':
      default:
        return new OpenAICompatAdapter(config);
    }
  }

  getAdapter(providerId?: string): ILLMAdapter {
    const id = providerId || this.activeProviderId;
    let adapter = this.adapters.get(id);

    if (!adapter) {
      const config = this.providers.get(id);
      if (!config) {
        throw new Error(`Unknown provider: ${id}`);
      }
      adapter = this.createAdapter(config);
      this.adapters.set(id, adapter);
    }

    return adapter;
  }

  // ─── 公開API ─────────────────────────────────────

  getActiveProviderId(): string {
    return this.activeProviderId;
  }

  setActiveProvider(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    this.activeProviderId = providerId;
    this.saveConfig();
  }

  getProviderList(): LLMProviderConfig[] {
    return Array.from(this.providers.values()).map(p => ({
      ...p,
      apiKey: p.apiKey ? '***' : '', // APIキーはマスク
    }));
  }

  getProviderConfig(providerId: string): LLMProviderConfig | undefined {
    return this.providers.get(providerId);
  }

  updateProvider(providerId: string, updates: Partial<LLMProviderConfig>): void {
    const config = this.providers.get(providerId);
    if (!config) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    Object.assign(config, updates);

    // 既存アダプタがあれば再設定
    const adapter = this.adapters.get(providerId);
    if (adapter) {
      adapter.configure(updates);
    }

    this.saveConfig();
  }

  async testProvider(providerId: string): Promise<LLMAdapterStatus> {
    const adapter = this.getAdapter(providerId);
    return adapter.test();
  }

  // カスタムプロバイダー追加
  addCustomProvider(config: LLMProviderConfig): void {
    this.providers.set(config.id, config);
    this.adapters.delete(config.id); // キャッシュクリア
    this.saveConfig();
  }

  removeCustomProvider(providerId: string): boolean {
    // デフォルトプロバイダーは削除不可
    const isDefault = DEFAULT_PROVIDERS.some(p => p.id === providerId);
    if (isDefault) return false;

    this.providers.delete(providerId);
    this.adapters.delete(providerId);
    if (this.activeProviderId === providerId) {
      this.activeProviderId = 'claude';
    }
    this.saveConfig();
    return true;
  }
}
