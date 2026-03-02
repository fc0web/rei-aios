/**
 * Rei AIOS — Claude Adapter
 * Anthropic Messages API 対応
 */

import {
  ILLMAdapter, LLMRequest, LLMResponse, LLMProviderConfig,
  LLMAdapterStatus, httpPost
} from './llm-adapter';

export class ClaudeAdapter implements ILLMAdapter {
  readonly providerId = 'claude';
  readonly providerName = 'Anthropic Claude';

  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private maxTokens: number;

  constructor(config: LLMProviderConfig) {
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.model = config.defaultModel || 'claude-sonnet-4-6';
    this.maxTokens = config.maxTokens || 4096;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [2000, 5000, 10000]; // 2秒, 5秒, 10秒

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const model = request.model || this.model;
      const messages = request.messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const systemMsg = request.systemPrompt
        || request.messages.find(m => m.role === 'system')?.content
        || '';

      const body: Record<string, unknown> = {
        model,
        max_tokens: request.maxTokens || this.maxTokens,
        messages,
      };

      if (systemMsg) {
        body.system = systemMsg;
      }

      if (request.temperature !== undefined) {
        body.temperature = request.temperature;
      }

      const { status, data } = await httpPost(
        `${this.baseUrl}/v1/messages`,
        {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body
      );

      // 529 (Overloaded) はリトライ対象
      if (status === 529 && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`[Claude] 529 Overloaded — ${delay / 1000}秒後にリトライ (${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (status !== 200) {
        const err = data as any;
        throw new Error(`Claude API error (${status}): ${err?.error?.message || JSON.stringify(err)}`);
      }

      const resp = data as any;
      return {
        content: resp.content?.[0]?.text || '',
        model: resp.model || model,
        provider: this.providerId,
        usage: resp.usage ? {
          inputTokens: resp.usage.input_tokens || 0,
          outputTokens: resp.usage.output_tokens || 0,
        } : undefined,
        finishReason: resp.stop_reason,
      };
    }

    // ここには到達しないが型のために
    throw new Error('Claude API error: 最大リトライ回数を超えました');
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
