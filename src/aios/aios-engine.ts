/**
 * Rei AIOS — Engine
 * LLMマネージャー + 公理分岐エンジン + チャット履歴を統合
 * D-FUMT中心-周囲パターン: ユーザーの意図（中心）→ AI + 公理（周囲）
 */

import * as path from 'path';
import { REI_COMMAND_REFERENCE } from './agent-prompts';
import { ActionExecutor } from './action-executor';
import { LLMManager } from './llm-manager';
import { LLMRequest, LLMResponse, LLMProviderConfig, LLMAdapterStatus } from './llm-adapter';
import { AxiomBrancher, BranchResult, Branch } from './axiom-brancher';
import { ChatStore, ChatSession, ChatMessage, ChatSessionSummary } from './chat-store';
import { ReiKernel } from './rei-kernel';
import { KernelBridge } from './rei-kernel/kernel-bridge';

// ─── 型定義 ──────────────────────────────────────────

export interface AIOSConfig {
  dataDir: string;  // アプリデータディレクトリ
}

export interface ChatRequest {
  message: string;
  sessionId?: string;      // 既存セッション続行
  provider?: string;       // プロバイダー指定
  model?: string;          // モデル指定
  enableBranching?: boolean; // 公理分岐 ON/OFF（デフォルト: true）
  systemPrompt?: string;   // カスタムシステムプロンプト
  temperature?: number;
}

export interface ChatResponse {
  sessionId: string;
  messageId: string;
  content: string;
  provider: string;
  model: string;
  branches?: Branch[];
  meta?: {
    questionType: string;
    branchCount: number;
    branchProcessingMs: number;
    llmProcessingMs: number;
    totalProcessingMs: number;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ─── デフォルトシステムプロンプト ─────────────────────

const DEFAULT_SYSTEM_PROMPT = `あなたはRei AIOS AIアシスタントです。
ユーザーの質問に対して、正確で実用的な回答を提供してください。
技術的な質問には具体的なコード例や手順を含めてください。
日本語と英語の両方に対応してください。`;

// ─── AIOSEngine クラス ──────────────────────────────

export class AIOSEngine {
  private llmManager: LLMManager;
  private brancher: AxiomBrancher;
  private chatStore: ChatStore;
  private defaultSystemPrompt: string;

  // ── Rei Kernel（公理的カーネル） ──
  public readonly kernel: ReiKernel;
  public readonly kernelBridge: KernelBridge;

  constructor(config: AIOSConfig) {
    this.llmManager = new LLMManager(config.dataDir);
    this.brancher = new AxiomBrancher();
    this.chatStore = new ChatStore(config.dataDir);
    this.defaultSystemPrompt = DEFAULT_SYSTEM_PROMPT + "\n\n" + REI_COMMAND_REFERENCE + "\n\nExcel等の操作はReiコマンドで実行してください。コマンドはコードブロック(rei)形式で出力してください。";

    // Kernel 初期化
    this.kernel = new ReiKernel({
      log: (msg) => console.log(msg),
    });
    this.kernel.initialize();

    // Bridge 初期化（Watchdog, TaskScheduler は後から接続可能）
    this.kernelBridge = new KernelBridge({
      kernel: this.kernel,
      log: (msg) => console.log(msg),
    });
  }

  // ─── チャット（メイン機能） ──────────────────────

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const totalStart = Date.now();

    // セッション取得 or 新規作成
    const providerId = request.provider || this.llmManager.getActiveProviderId();
    const providerConfig = this.llmManager.getProviderConfig(providerId);
    const modelName = request.model || providerConfig?.defaultModel || 'unknown';

    let sessionId = request.sessionId;
    let session: ChatSession | null = null;

    if (sessionId) {
      session = this.chatStore.getSession(sessionId);
    }
    if (!session) {
      session = this.chatStore.createSession(providerId, modelName);
      sessionId = session.id;
    }

    // ユーザーメッセージ保存
    this.chatStore.addMessage(sessionId!, {
      role: 'user',
      content: request.message,
    });

    // LLM呼び出し
    const llmStart = Date.now();
    const adapter = this.llmManager.getAdapter(providerId);

    // 会話履歴を構築（最新10メッセージまで）
    const history = session.messages.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 現在のメッセージを追加
    history.push({ role: 'user', content: request.message });

    const llmRequest: LLMRequest = {
      messages: history,
      systemPrompt: request.systemPrompt || this.defaultSystemPrompt,
      model: request.model,
      temperature: request.temperature,
    };

    let llmResponse: LLMResponse;
    try {
      llmResponse = await adapter.complete(llmRequest);
    } catch (error: any) {
      throw new Error(`LLM Error (${providerId}): ${error.message}`);
    }
    const llmMs = Date.now() - llmStart;

    // Reiコマンド抽出・実行
    const reiBlockMatch = llmResponse.content.match(/```(?:rei)?\s*([\s\S]*?)```/);
    console.log('[ReiExec] match:', reiBlockMatch ? 'found' : 'not found');
    if (reiBlockMatch) {
      const executor = new ActionExecutor({});
      const lines = reiBlockMatch[1].trim().split('\n').filter((l: string) => l.trim());
      console.log('[ReiExec] lines:', lines);
      for (const line of lines) {
        try {
          console.log('[ReiExec] executing:', line);
          await executor.execute(line.trim());
        } catch(e: any) {
          console.log('[ReiExec] error:', e.message);
        }
      }
    }

    // 公理分岐（デフォルトON）
    let branches: Branch[] | undefined;
    let branchMeta: any;
    const enableBranching = request.enableBranching !== false;

    if (enableBranching) {
      const branchResult: BranchResult = this.brancher.branch(
        request.message, llmResponse.content
      );
      branches = branchResult.branches;
      branchMeta = branchResult.meta;
    }

    // アシスタントメッセージ保存
    const savedMsg = this.chatStore.addMessage(sessionId!, {
      role: 'assistant',
      content: llmResponse.content,
      provider: llmResponse.provider,
      model: llmResponse.model,
      branches: branches?.map(b => ({
        axis: b.axis,
        label: b.label,
        content: b.content,
        confidence: b.confidence,
      })),
    });

    const totalMs = Date.now() - totalStart;

    return {
      sessionId: sessionId!,
      messageId: savedMsg.id,
      content: llmResponse.content,
      provider: llmResponse.provider,
      model: llmResponse.model,
      branches,
      meta: enableBranching ? {
        questionType: branchMeta.questionType,
        branchCount: branchMeta.branchCount,
        branchProcessingMs: branchMeta.processingMs,
        llmProcessingMs: llmMs,
        totalProcessingMs: totalMs,
      } : undefined,
      usage: llmResponse.usage,
    };
  }

  // ─── プロバイダー管理 ────────────────────────────

  getProviders(): LLMProviderConfig[] {
    return this.llmManager.getProviderList();
  }

  getActiveProvider(): string {
    return this.llmManager.getActiveProviderId();
  }

  setActiveProvider(providerId: string): void {
    this.llmManager.setActiveProvider(providerId);
  }

  updateProvider(providerId: string, updates: Partial<LLMProviderConfig>): void {
    this.llmManager.updateProvider(providerId, updates);
  }

  async testProvider(providerId: string): Promise<LLMAdapterStatus> {
    return this.llmManager.testProvider(providerId);
  }

  /** 豊聡耳モード等で直接アクセスするためのgetter */
  getLLMManager(): LLMManager {
    return this.llmManager;
  }

  async listProviderModels(providerId: string): Promise<string[]> {
    const adapter = this.llmManager.getAdapter(providerId);
    if (adapter.listModels) {
      return adapter.listModels();
    }
    // フォールバック: 設定に定義されたモデル一覧を返す
    const config = this.llmManager.getProviderConfig(providerId);
    return config?.availableModels || [];
  }

  // ─── セッション管理 ──────────────────────────────

  getSessions(limit?: number): ChatSessionSummary[] {
    return this.chatStore.listSessions(limit);
  }

  getSession(sessionId: string): ChatSession | null {
    return this.chatStore.getSession(sessionId);
  }

  deleteSession(sessionId: string): boolean {
    return this.chatStore.deleteSession(sessionId);
  }

  renameSession(sessionId: string, title: string): boolean {
    return this.chatStore.updateSessionTitle(sessionId, title);
  }

  searchChats(query: string): any[] {
    return this.chatStore.searchMessages(query);
  }

  getChatStats(): any {
    return this.chatStore.getStats();
  }

  // ─── システムプロンプト ──────────────────────────

  setSystemPrompt(prompt: string): void {
    this.defaultSystemPrompt = prompt;
  }

  getSystemPrompt(): string {
    return this.defaultSystemPrompt;
  }
}
