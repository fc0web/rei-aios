/**
 * Rei AIOS — LLM Adapter Common Interface
 * v0.5.0: 全LLMプロバイダー共通の型定義とファクトリー
 */

// ─── 型定義 ──────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  finishReason?: string;
}

export interface LLMProviderConfig {
  id: string;
  name: string;
  type: 'claude' | 'openai' | 'openai-compat' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  availableModels: string[];
  maxTokens?: number;
}

export interface LLMAdapterStatus {
  connected: boolean;
  provider: string;
  model: string;
  error?: string;
}

// ─── 共通アダプタインターフェース ────────────────────

export interface ILLMAdapter {
  readonly providerId: string;
  readonly providerName: string;

  /** テキスト補完を実行 */
  complete(request: LLMRequest): Promise<LLMResponse>;

  /** 接続テスト */
  test(): Promise<LLMAdapterStatus>;

  /** プロバイダー設定を更新 */
  configure(config: Partial<LLMProviderConfig>): void;

  /** インストール済みモデル一覧（Ollamaなど動的取得対応プロバイダーのみ） */
  listModels?(): Promise<string[]>;
}

// ─── ヘルパー ────────────────────────────────────────

/**
 * HTTPリクエストをNode.js標準モジュールで実行
 */
export async function httpPost(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<{ status: number; data: unknown }> {
  const https = require('https');
  const http = require('http');
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}
