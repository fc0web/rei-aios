// ============================================================
// Rei-AIOS AGI Phase 4-3: スマートモデルルーター
// src/aios/local-llm/smart-model-router.ts
//
// 【概要】
//   タスクの種類に応じて最適なローカルモデルを自動選択する。
//
//   code_gen / excel / automation → DeepSeek-Coder (コード特化)
//   search / summarize / compute  → Phi-4 (汎用・高品質)
//   vision                        → プライマリモデル（Cloudなど）
//
// 【Ollama連携フロー】
//   1. Ollama が起動しているか確認
//   2. 指定モデルがインストール済みか確認 (/api/tags)
//   3. 未インストールなら `ollama pull` を案内 / 自動実行
//   4. タスクを実行
//
// 【統合方法】
//   AGILayer の bridge.llmCall を SmartModelRouter でラップする:
//
//   const router = new SmartModelRouter(primaryLlmCall);
//   await router.init(); // Ollama 接続確認
//
//   const agi = new AGILayer({
//     llmCall: (sys, msg) => router.call(sys, msg, taskType),
//     ...
//   });
// ============================================================

import { execFile, exec } from 'child_process';
import * as http from 'http';

// ──────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────

/** モデルの用途プロファイル */
export interface ModelProfile {
  ollamaName: string;       // ollama pull で使う名前
  displayName: string;
  specialty: string;
  taskTypes: string[];      // 得意なタスクタイプ
  systemPromptExtra?: string; // このモデル専用の追加システムプロンプト
  temperature?: number;     // 推奨温度
  contextSize?: number;     // コンテキストサイズ
}

/** ルーター設定 */
export interface RouterConfig {
  ollamaBaseUrl: string;
  enableLocalModels: boolean;
  autoFallbackToPrimary: boolean;  // Ollama失敗時にプライマリへフォールバック
  timeoutMs: number;
}

export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  ollamaBaseUrl: 'http://localhost:11434',
  enableLocalModels: true,
  autoFallbackToPrimary: true,
  timeoutMs: 120000,  // 2分（ローカルモデルは遅い場合がある）
};

/** ルーター状態 */
export interface RouterStatus {
  ollamaRunning: boolean;
  availableModels: string[];
  installedProfiles: string[];      // インストール済みプロファイル名
  activeRoute: string;              // 最後に使ったルート
}

// ──────────────────────────────────────────
// モデルプロファイル定義
// ──────────────────────────────────────────

/**
 * DeepSeek-Coder V2: コード生成・自動修復特化
 * AGI の code_gen / automation / excel タスクに最適
 */
export const DEEPSEEK_CODER_PROFILE: ModelProfile = {
  ollamaName: 'deepseek-coder-v2',
  displayName: 'DeepSeek-Coder V2',
  specialty: 'コード生成・デバッグ・自動修復',
  taskTypes: ['code_gen', 'automation', 'excel', 'file_op'],
  systemPromptExtra: `
あなたはDeepSeek-Coderです。コード生成・デバッグ・リファクタリングを得意とします。
- コードは必ずシンタックスハイライト付きのmarkdownコードブロックで返してください
- Rei言語の場合: launch(), win_type(), shortcut(), wait() 等を使ってください
- TypeScript/JavaScript の場合: 型安全なコードを書いてください
- エラー修復の場合: 根本原因を特定してから修正してください
`,
  temperature: 0.1,   // コードは低温度で決定的に
  contextSize: 16384,
};

/**
 * Phi-4: 汎用・推論・日本語強化
 * AGI の search / summarize / compute タスクに最適
 */
export const PHI4_PROFILE: ModelProfile = {
  ollamaName: 'phi4',
  displayName: 'Phi-4',
  specialty: '汎用推論・日本語・数学・要約',
  taskTypes: ['search', 'summarize', 'compute', 'browser'],
  systemPromptExtra: `
あなたはPhi-4です。高度な推論・日本語処理・数学的思考を得意とします。
- 複雑な問題は段階的に分解して考えてください
- 日本語で回答してください
- D-FUMT理論に関する質問には、数学的厳密性を保って回答してください
`,
  temperature: 0.7,
  contextSize: 16384,
};

/**
 * 追加プロファイル: qwen2.5（日本語最強）
 */
export const QWEN25_PROFILE: ModelProfile = {
  ollamaName: 'qwen2.5:7b',
  displayName: 'Qwen 2.5 7B',
  specialty: '日本語・中国語・汎用',
  taskTypes: ['search', 'summarize'],
  temperature: 0.7,
  contextSize: 32768,
};

/** 全プロファイルマップ */
export const MODEL_PROFILES: Record<string, ModelProfile> = {
  'deepseek-coder-v2': DEEPSEEK_CODER_PROFILE,
  'phi4':              PHI4_PROFILE,
  'qwen2.5:7b':        QWEN25_PROFILE,
};

// ──────────────────────────────────────────
// SmartModelRouter クラス
// ──────────────────────────────────────────

export class SmartModelRouter {
  private config: RouterConfig;
  private primaryLlmCall: (system: string, message: string) => Promise<string>;
  private status: RouterStatus = {
    ollamaRunning: false,
    availableModels: [],
    installedProfiles: [],
    activeRoute: 'primary',
  };

  constructor(
    primaryLlmCall: (system: string, message: string) => Promise<string>,
    config?: Partial<RouterConfig>
  ) {
    this.primaryLlmCall = primaryLlmCall;
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
  }

  // ──────────────────────────────────────────
  // 初期化・接続確認
  // ──────────────────────────────────────────

  /**
   * Ollama接続確認・利用可能モデル一覧取得
   * main.ts の初期化時に呼ぶ
   */
  async init(): Promise<RouterStatus> {
    if (!this.config.enableLocalModels) {
      console.log('[Router] ローカルモデル無効 → プライマリのみ使用');
      return this.status;
    }

    try {
      const models = await this._listOllamaModels();
      this.status.ollamaRunning = true;
      this.status.availableModels = models;
      this.status.installedProfiles = Object.keys(MODEL_PROFILES)
        .filter(name => models.some(m => m.startsWith(name.split(':')[0])));

      console.log(`[Router] Ollama稼働中 ✅ モデル: ${models.join(', ') || 'なし'}`);
      console.log(`[Router] 利用可能プロファイル: ${this.status.installedProfiles.join(', ') || 'なし'}`);
    } catch (e) {
      this.status.ollamaRunning = false;
      console.log('[Router] Ollama未起動 → プライマリLLMのみ使用');
    }

    return this.status;
  }

  // ──────────────────────────────────────────
  // メインルーティング
  // ──────────────────────────────────────────

  /**
   * タスクタイプに応じて最適モデルでLLMを呼び出す
   *
   * @param system  システムプロンプト
   * @param message ユーザーメッセージ
   * @param taskType AGIタスクタイプ（省略時はプライマリを使用）
   */
  async call(
    system: string,
    message: string,
    taskType?: string
  ): Promise<string> {
    if (!this.config.enableLocalModels || !this.status.ollamaRunning || !taskType) {
      return this.primaryLlmCall(system, message);
    }

    const profile = this._selectProfile(taskType);
    if (!profile) {
      return this.primaryLlmCall(system, message);
    }

    // インストール確認
    const isInstalled = this.status.availableModels.some(
      m => m.startsWith(profile.ollamaName.split(':')[0])
    );

    if (!isInstalled) {
      console.log(`[Router] ${profile.displayName} 未インストール → プライマリへフォールバック`);
      this.status.activeRoute = 'primary (fallback)';
      return this.primaryLlmCall(system, message);
    }

    // ローカルモデルで実行
    try {
      console.log(`[Router] → ${profile.displayName} (${profile.ollamaName}) でタスク実行`);
      this.status.activeRoute = profile.ollamaName;

      const enrichedSystem = profile.systemPromptExtra
        ? system + '\n' + profile.systemPromptExtra
        : system;

      const result = await this._ollamaCall(
        profile.ollamaName,
        enrichedSystem,
        message,
        profile.temperature,
        profile.contextSize
      );
      return result;
    } catch (e: any) {
      console.warn(`[Router] ${profile.displayName} 呼び出し失敗:`, e.message);
      if (this.config.autoFallbackToPrimary) {
        console.log('[Router] プライマリへフォールバック');
        this.status.activeRoute = 'primary (fallback)';
        return this.primaryLlmCall(system, message);
      }
      throw e;
    }
  }

  /**
   * タスクタイプから最適プロファイルを選択
   */
  private _selectProfile(taskType: string): ModelProfile | null {
    for (const profile of Object.values(MODEL_PROFILES)) {
      if (profile.taskTypes.includes(taskType)) {
        // インストール済みかチェック
        const installed = this.status.availableModels.some(
          m => m.startsWith(profile.ollamaName.split(':')[0])
        );
        if (installed) return profile;
      }
    }
    return null;
  }

  // ──────────────────────────────────────────
  // Ollama API 呼び出し
  // ──────────────────────────────────────────

  private async _ollamaCall(
    model: string,
    system: string,
    message: string,
    temperature = 0.7,
    contextSize = 4096
  ): Promise<string> {
    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: message },
      ],
      stream: false,
      options: {
        temperature,
        num_ctx: contextSize,
      },
    });

    return new Promise((resolve, reject) => {
      const url = new URL(`${this.config.ollamaBaseUrl}/api/chat`);
      const req = http.request({
        hostname: url.hostname,
        port: url.port || 11434,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.message?.content || json.response || '');
          } catch {
            reject(new Error(`Ollama JSONパース失敗: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(this.config.timeoutMs, () => {
        req.destroy();
        reject(new Error(`Ollama タイムアウト (${this.config.timeoutMs}ms)`));
      });

      req.write(body);
      req.end();
    });
  }

  private async _listOllamaModels(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.config.ollamaBaseUrl}/api/tags`);
      const req = http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve((json.models || []).map((m: any) => m.name as string));
          } catch {
            resolve([]);
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  // ──────────────────────────────────────────
  // Ollama モデル管理
  // ──────────────────────────────────────────

  /**
   * ollama pull でモデルをインストール
   * IPC経由でプログレスをストリーム送信する
   */
  async pullModel(
    modelName: string,
    onProgress?: (data: OllamaPullProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ name: modelName, stream: true });
      const url = new URL(`${this.config.ollamaBaseUrl}/api/pull`);
      const req = http.request({
        hostname: url.hostname,
        port: url.port || 11434,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        res.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const data = JSON.parse(line) as OllamaPullProgress;
              onProgress?.(data);
              if (data.status === 'success') {
                this.status.availableModels.push(modelName);
                if (!this.status.installedProfiles.includes(modelName)) {
                  this.status.installedProfiles.push(modelName);
                }
              }
            } catch { /* ignore malformed lines */ }
          }
        });
        res.on('end', resolve);
        res.on('error', reject);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * ollama rm でモデルを削除
   */
  async deleteModel(modelName: string): Promise<void> {
    const body = JSON.stringify({ name: modelName });
    const url = new URL(`${this.config.ollamaBaseUrl}/api/delete`);
    await new Promise<void>((resolve, reject) => {
      const req = http.request({
        hostname: url.hostname,
        port: url.port || 11434,
        path: url.pathname,
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    this.status.availableModels = this.status.availableModels.filter(m => m !== modelName);
  }

  // ──────────────────────────────────────────
  // PowerShell による Ollama インストール補助
  // ──────────────────────────────────────────

  /**
   * Ollama 本体のインストールコマンドを生成
   * （実行はユーザーが行う）
   */
  static getOllamaInstallCommand(): string {
    return 'winget install Ollama.Ollama';
  }

  /**
   * Ollamaを起動するPowerShellコマンド
   */
  static getOllamaStartCommand(): string {
    return 'Start-Process ollama -ArgumentList "serve" -WindowStyle Hidden';
  }

  /**
   * モデルをpullするPowerShellコマンド
   */
  static getOllamaPullCommand(modelName: string): string {
    return `ollama pull ${modelName}`;
  }

  // ──────────────────────────────────────────
  // 状態・統計
  // ──────────────────────────────────────────

  getStatus(): RouterStatus { return { ...this.status }; }
  isOllamaRunning(): boolean { return this.status.ollamaRunning; }
  getAvailableModels(): string[] { return [...this.status.availableModels]; }

  /** モデルの推奨インストール順を返す */
  getRecommendedModels(): ModelProfile[] {
    return [DEEPSEEK_CODER_PROFILE, PHI4_PROFILE, QWEN25_PROFILE];
  }

  /** タスクタイプとルーティング先の対応表 */
  getRoutingTable(): Array<{ taskType: string; model: string; installed: boolean }> {
    const allTaskTypes = ['code_gen', 'automation', 'excel', 'file_op',
                          'search', 'summarize', 'compute', 'browser', 'vision'];
    return allTaskTypes.map(tt => {
      const profile = Object.values(MODEL_PROFILES).find(p => p.taskTypes.includes(tt));
      const installed = profile
        ? this.status.availableModels.some(m => m.startsWith(profile.ollamaName.split(':')[0]))
        : false;
      return {
        taskType: tt,
        model: profile ? profile.displayName : 'プライマリ (Claude等)',
        installed,
      };
    });
  }

  /** ルーターをプロキシとして AGI bridge に変換 */
  toBridgeLlmCall(): (system: string, message: string) => Promise<string> {
    return (system, message) => this.call(system, message);
  }
}

/** ollama pull のストリームレスポンス */
export interface OllamaPullProgress {
  status: string;            // "pulling manifest", "downloading", "success" etc.
  digest?: string;
  total?: number;
  completed?: number;
}
