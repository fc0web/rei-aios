/**
 * Rei-AIOS — ローカルLLMアダプター (local-llm-adapter.ts)
 * Phase 2 実装
 *
 * node-llama-cppを使ってGGUF形式のモデルをプロセス内に常駐させる。
 * APIキー不要・完全オフライン・低レイテンシを実現。
 *
 * 対応モデル（GGUFフォーマット）:
 *   - Phi-3 mini 4K（推奨: 2.2GB, RAM 4GB以上）
 *   - Phi-3 mini 128K（3.8GB, RAM 6GB以上）
 *   - TinyLlama 1.1B（600MB, RAM 2GB以上）
 *   - Gemma 2B（1.5GB, RAM 4GB以上）
 *
 * 使用方法:
 *   const adapter = new LocalLLMAdapter();
 *   await adapter.loadModel('/path/to/phi-3-mini.gguf');
 *   const res = await adapter.complete({ messages: [...] });
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  ILLMAdapter, LLMRequest, LLMResponse,
  LLMProviderConfig, LLMAdapterStatus,
} from '../llm-adapter';

// ============================================================
// 型定義
// ============================================================

/** ローカルモデルの状態 */
export type LocalModelStatus =
  | 'unloaded'    // 未ロード
  | 'loading'     // ロード中
  | 'ready'       // 使用可能
  | 'generating'  // 生成中
  | 'error';      // エラー

/** ローカルモデルの設定 */
export interface LocalModelConfig {
  modelPath: string;          // GGUFファイルのパス
  contextSize?: number;       // コンテキストサイズ（デフォルト: 4096）
  threads?: number;           // CPUスレッド数（デフォルト: 自動）
  gpuLayers?: number;         // GPUオフロード層数（デフォルト: 0=CPU専用）
  temperature?: number;       // 生成温度（デフォルト: 0.7）
  maxTokens?: number;         // 最大生成トークン（デフォルト: 512）
}

/** モデル情報 */
export interface LocalModelInfo {
  name: string;
  path: string;
  sizeBytes: number;
  status: LocalModelStatus;
  loadedAt?: number;
}

// ============================================================
// LocalLLMAdapter クラス
// ============================================================

export class LocalLLMAdapter implements ILLMAdapter {
  readonly providerId = 'local';
  readonly providerName = 'ローカルAI（オフライン）';

  private config: LocalModelConfig | null = null;
  private status: LocalModelStatus = 'unloaded';
  private loadedModelPath: string | null = null;

  // node-llama-cpp の動的インポート用（オプショナル依存）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private llamaContext: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private llamaModel: any = null;

  private errorMessage: string | null = null;

  // ============================================================
  // ILLMAdapter 実装
  // ============================================================

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (this.status !== 'ready') {
      throw new Error(`ローカルモデル未準備: ${this.status}${this.errorMessage ? ` (${this.errorMessage})` : ''}`);
    }

    this.status = 'generating';

    try {
      const prompt = this.buildPrompt(request);
      const content = await this.generate(prompt, request.maxTokens ?? 512);

      this.status = 'ready';

      return {
        content,
        model: path.basename(this.loadedModelPath ?? 'local-model'),
        provider: this.providerId,
        usage: {
          inputTokens: Math.ceil(prompt.length / 4),   // 概算
          outputTokens: Math.ceil(content.length / 4),
        },
        finishReason: 'stop',
      };
    } catch (err) {
      this.status = 'ready'; // エラー後もreadyに戻す
      throw err;
    }
  }

  async test(): Promise<LLMAdapterStatus> {
    if (this.status === 'ready') {
      try {
        // 短いテスト生成
        await this.complete({
          messages: [{ role: 'user', content: 'こんにちは' }],
          maxTokens: 20,
        });
        return { connected: true, provider: this.providerId, model: this.getModelName() };
      } catch (err) {
        return { connected: false, provider: this.providerId, model: this.getModelName(), error: String(err) };
      }
    }
    return {
      connected: false,
      provider: this.providerId,
      model: this.getModelName(),
      error: this.errorMessage ?? `モデル未ロード (${this.status})`,
    };
  }

  configure(config: Partial<LLMProviderConfig>): void {
    // ローカルモデルではbaseUrlをモデルパスとして使用
    if (config.baseUrl && this.config) {
      this.config.modelPath = config.baseUrl;
    }
  }

  // ============================================================
  // モデル管理
  // ============================================================

  /**
   * GGUFモデルをロードして常駐させる
   * node-llama-cppが未インストールの場合はモックモードで動作
   */
  async loadModel(modelPath: string, config?: Partial<LocalModelConfig>): Promise<void> {
    if (!fs.existsSync(modelPath)) {
      throw new Error(`モデルファイルが見つかりません: ${modelPath}`);
    }

    this.status = 'loading';
    this.config = {
      modelPath,
      contextSize: config?.contextSize ?? 4096,
      threads: config?.threads ?? Math.max(1, (require('os').cpus().length) - 1),
      gpuLayers: config?.gpuLayers ?? 0,
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 512,
      ...config,
    };

    try {
      await this.loadWithNodeLlamaCpp(modelPath);
      this.loadedModelPath = modelPath;
      this.status = 'ready';
      console.log(`[LocalLLM] モデルロード完了: ${path.basename(modelPath)}`);
    } catch (err) {
      // node-llama-cppが未インストールの場合はモックモードへ
      if (String(err).includes('Cannot find module')) {
        console.warn('[LocalLLM] node-llama-cpp未インストール → モックモードで動作');
        this.loadedModelPath = modelPath;
        this.status = 'ready';
        this.errorMessage = null;
      } else {
        this.status = 'error';
        this.errorMessage = String(err);
        throw err;
      }
    }
  }

  /** モデルをアンロードしてメモリを解放 */
  async unloadModel(): Promise<void> {
    if (this.llamaContext) {
      try { this.llamaContext.dispose?.(); } catch { /* ignore */ }
      this.llamaContext = null;
    }
    if (this.llamaModel) {
      try { this.llamaModel.dispose?.(); } catch { /* ignore */ }
      this.llamaModel = null;
    }
    this.loadedModelPath = null;
    this.status = 'unloaded';
    this.errorMessage = null;
    console.log('[LocalLLM] モデルアンロード完了');
  }

  /** 現在のモデル情報を取得 */
  getModelInfo(): LocalModelInfo | null {
    if (!this.loadedModelPath) return null;
    return {
      name: path.basename(this.loadedModelPath),
      path: this.loadedModelPath,
      sizeBytes: fs.existsSync(this.loadedModelPath)
        ? fs.statSync(this.loadedModelPath).size
        : 0,
      status: this.status,
      loadedAt: this.status === 'ready' ? Date.now() : undefined,
    };
  }

  getModelStatus(): LocalModelStatus {
    return this.status;
  }

  isReady(): boolean {
    return this.status === 'ready';
  }

  // ============================================================
  // プライベートメソッド
  // ============================================================

  private async loadWithNodeLlamaCpp(modelPath: string): Promise<void> {
    // node-llama-cppの動的インポート（オプショナル依存）
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getLlama, LlamaChatSession } = require('node-llama-cpp');

    const llama = await getLlama();
    this.llamaModel = await llama.loadModel({ modelPath });
    this.llamaContext = await this.llamaModel.createContext({
      contextSize: this.config?.contextSize ?? 4096,
    });

    console.log('[LocalLLM] node-llama-cpp ロード成功');
  }

  private async generate(prompt: string, maxTokens: number): Promise<string> {
    // node-llama-cppが使える場合
    if (this.llamaContext) {
      try {
        const { LlamaChatSession } = require('node-llama-cpp');
        const session = new LlamaChatSession({ contextSequence: this.llamaContext.getSequence() });
        const response = await session.prompt(prompt, {
          maxTokens,
          temperature: this.config?.temperature ?? 0.7,
        });
        return response;
      } catch (err) {
        console.warn('[LocalLLM] 生成エラー、モックにフォールバック:', err);
      }
    }

    // モックモード（node-llama-cpp未インストール時）
    return this.mockGenerate(prompt);
  }

  private mockGenerate(prompt: string): string {
    const modelName = this.loadedModelPath ? path.basename(this.loadedModelPath) : 'local-model';
    return `[${modelName} / モック応答]\n\n` +
      `プロンプトを受信しました。node-llama-cppをインストールすると実際の推論が動作します。\n` +
      `インストール: npm install node-llama-cpp\n\n` +
      `受信内容の概要: ${prompt.slice(0, 100)}...`;
  }

  private buildPrompt(request: LLMRequest): string {
    // Phi-3形式のプロンプトテンプレート（多くのGGUFモデルに対応）
    let prompt = '';

    if (request.systemPrompt) {
      prompt += `<|system|>\n${request.systemPrompt}<|end|>\n`;
    }

    for (const msg of request.messages) {
      if (msg.role === 'user') {
        prompt += `<|user|>\n${msg.content}<|end|>\n<|assistant|>\n`;
      } else if (msg.role === 'assistant') {
        prompt += `${msg.content}<|end|>\n`;
      }
    }

    return prompt;
  }

  private getModelName(): string {
    return this.loadedModelPath
      ? path.basename(this.loadedModelPath)
      : 'local-model（未ロード）';
  }
}
