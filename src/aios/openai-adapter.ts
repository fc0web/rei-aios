/**
 * Rei AIOS — OpenAI Adapter
 * OpenAI Chat Completions API 対応
 */

import {
  ILLMAdapter, LLMRequest, LLMResponse, LLMProviderConfig,
  LLMAdapterStatus, httpPost
} from './llm-adapter';

export class OpenAIAdapter implements ILLMAdapter {
  readonly providerId = 'openai';
  readonly providerName = 'OpenAI';

  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private maxTokens: number;

  constructor(config: LLMProviderConfig) {
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com';
    this.model = config.defaultModel || 'gpt-4o';
    this.maxTokens = config.maxTokens || 4096;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model || this.model;
    const messages = request.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // systemPromptがあればmessages先頭に追加
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

    const { status, data } = await httpPost(
      `${this.baseUrl}/v1/chat/completions`,
      { Authorization: `Bearer ${this.apiKey}` },
      body
    );

    if (status !== 200) {
      const err = data as any;
      throw new Error(`OpenAI API error (${status}): ${err?.error?.message || JSON.stringify(err)}`);
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
      return { connected: false, provider: this.providerName, model: this.model, error: e.message };
    }
  }

  configure(config: Partial<LLMProviderConfig>): void {
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    if (config.defaultModel) this.model = config.defaultModel;
    if (config.maxTokens) this.maxTokens = config.maxTokens;
  }
}
