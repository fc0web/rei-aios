/**
 * Rei AIOS — OpenAI Compatible Adapter
 * OpenAI互換API形式のプロバイダーを設定ベースで対応
 * Gemini, Mistral, DeepSeek, Groq, Together AI, Perplexity, Cohere 等
 */

import {
  ILLMAdapter, LLMRequest, LLMResponse, LLMProviderConfig,
  LLMAdapterStatus, httpPost
} from './llm-adapter';

export class OpenAICompatAdapter implements ILLMAdapter {
  readonly providerId: string;
  readonly providerName: string;

  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private maxTokens: number;
  private completionsPath: string;

  constructor(config: LLMProviderConfig) {
    this.providerId = config.id;
    this.providerName = config.name;
    this.apiKey = config.apiKey || '';
    this.baseUrl = (config.baseUrl || '').replace(/\/$/, '');
    this.model = config.defaultModel;
    this.maxTokens = config.maxTokens || 4096;
    // Google Gemini uses a different path
    this.completionsPath = this.resolveCompletionsPath(config.id);
  }

  private resolveCompletionsPath(providerId: string): string {
    switch (providerId) {
      case 'gemini':
        return '/v1beta/chat/completions';
      default:
        return '/v1/chat/completions';
    }
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
      max_tokens: request.maxTokens || this.maxTokens,
      messages,
    };

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    const url = `${this.baseUrl}${this.completionsPath}`;
    const headers: Record<string, string> = {};

    // Gemini uses a different auth header
    if (this.providerId === 'gemini') {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    } else {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const { status, data } = await httpPost(url, headers, body);

    if (status !== 200) {
      const err = data as any;
      throw new Error(
        `${this.providerName} API error (${status}): ${err?.error?.message || JSON.stringify(err)}`
      );
    }

    const resp = data as any;
    const choice = resp.choices?.[0];
    return {
      content: choice?.message?.content || '',
      model: resp.model || model,
      provider: this.providerId,
      usage: resp.usage ? {
        inputTokens: resp.usage.prompt_tokens || 0,
        outputTokens: resp.usage.completion_tokens || 0,
      } : undefined,
      finishReason: choice?.finish_reason,
    };
  }

  async test(): Promise<LLMAdapterStatus> {
    try {
      const resp = await this.complete({
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10,
      });
      return { connected: true, provider: this.providerName, model: resp.model };
    } catch (e: any) {
      return {
        connected: false, provider: this.providerName,
        model: this.model, error: e.message,
      };
    }
  }

  configure(config: Partial<LLMProviderConfig>): void {
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.baseUrl) this.baseUrl = config.baseUrl.replace(/\/$/, '');
    if (config.defaultModel) this.model = config.defaultModel;
    if (config.maxTokens) this.maxTokens = config.maxTokens;
  }
}
