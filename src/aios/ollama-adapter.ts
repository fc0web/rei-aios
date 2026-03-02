/**
 * Rei AIOS — Ollama Adapter
 * ローカルLLM（Ollama）対応 — APIキー不要、完全オフライン動作
 */

import {
  ILLMAdapter, LLMRequest, LLMResponse, LLMProviderConfig,
  LLMAdapterStatus, httpPost
} from './llm-adapter';

export class OllamaAdapter implements ILLMAdapter {
  readonly providerId = 'ollama';
  readonly providerName = 'Ollama (Local)';

  private baseUrl: string;
  private model: string;

  constructor(config: LLMProviderConfig) {
    this.baseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
    this.model = config.defaultModel || 'llama3';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model || this.model;
    const messages = request.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    if (request.systemPrompt) {
      messages.unshift({ role: 'system', content: request.systemPrompt });
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };

    if (request.temperature !== undefined) {
      body.options = { temperature: request.temperature };
    }

    // ★ 出力トークン数制限（num_predictはOllamaのmax_tokens相当）
    if (request.maxTokens) {
      body.options = {
        ...(body.options as Record<string, unknown> || {}),
        num_predict: request.maxTokens,
      };
    }

    const { status, data } = await httpPost(
      `${this.baseUrl}/api/chat`,
      {},
      body
    );

    if (status !== 200) {
      const err = data as any;
      throw new Error(`Ollama error (${status}): ${err?.error || JSON.stringify(err)}`);
    }

    const resp = data as any;
    return {
      content: resp.message?.content || '',
      model: resp.model || model,
      provider: this.providerId,
      usage: resp.prompt_eval_count ? {
        inputTokens: resp.prompt_eval_count || 0,
        outputTokens: resp.eval_count || 0,
      } : undefined,
      finishReason: resp.done ? 'stop' : undefined,
    };
  }

  async test(): Promise<LLMAdapterStatus> {
    try {
      // Ollama: まずモデル一覧を取得して接続確認
      const http = require('http');
      const url = new URL(`${this.baseUrl}/api/tags`);

      const connected = await new Promise<boolean>((resolve) => {
        const req = http.get(url, (res: any) => {
          res.on('data', () => {});
          res.on('end', () => resolve(res.statusCode === 200));
        });
        req.on('error', () => resolve(false));
        req.setTimeout(3000, () => { req.destroy(); resolve(false); });
      });

      if (!connected) {
        return {
          connected: false, provider: this.providerName,
          model: this.model, error: `Ollama not running at ${this.baseUrl}`,
        };
      }

      return { connected: true, provider: this.providerName, model: this.model };
    } catch (e: any) {
      return {
        connected: false, provider: this.providerName,
        model: this.model, error: e.message,
      };
    }
  }

  /**
   * インストール済みモデル一覧を取得（/api/tags エンドポイント）
   */
  async listModels(): Promise<string[]> {
    try {
      const http = require('http');
      const url = new URL(`${this.baseUrl}/api/tags`);

      const body = await new Promise<string>((resolve, reject) => {
        const req = http.get(url, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => data += chunk);
          res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
      });

      const json = JSON.parse(body);
      // { models: [{ name: "llama3:latest", ... }, ...] }
      return (json.models || []).map((m: any) => m.name as string);
    } catch {
      return [];
    }
  }

  configure(config: Partial<LLMProviderConfig>): void {
    if (config.baseUrl) this.baseUrl = config.baseUrl.replace(/\/$/, '');
    if (config.defaultModel) this.model = config.defaultModel;
  }
}
