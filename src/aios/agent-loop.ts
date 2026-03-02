/**
 * Rei AIOS — Agent Loop
 * Phase A: Observe → Think → Act の中核実装
 *
 * D-FUMT 中心-周囲パターン:
 *   中心 = ユーザーの意図（goal）
 *   周囲 = Observe(画面) → Think(LLM) → Act(Rei) のサイクル
 *
 * 自律進化サイクル（概念設計 §5.2）の最初の実装:
 *   観察 → 判断 → 実行 → 学習（Phase D）→ 進化（Phase G）
 *   Phase A では 観察 → 判断 → 実行 を実現する。
 */

import { EventEmitter } from 'events';
import { LLMManager } from './llm-manager';
import { LLMRequest, LLMResponse, LLMProviderConfig } from './llm-adapter';
import { ScreenObserver, ScreenObservation, ScreenObserverConfig } from './screen-observer';
import { ActionExecutor, ActionResult, ActionExecutorConfig } from './action-executor';
import {
  buildAgentSystemPrompt,
  buildStepPrompt,
  buildPlanPrompt,
  parseAgentResponse,
  AgentResponse,
  AgentContext,
  StepRecord,
} from './agent-prompts';

// ─── 型定義 ──────────────────────────────────────────

export interface AgentLoopConfig {
  /** データディレクトリ（LLMManager設定の保存先） */
  dataDir: string;
  /** 最大ステップ数 */
  maxSteps: number;
  /** ステップ間の最小待機時間（ms） */
  stepDelayMs: number;
  /** ドライラン（Rei コマンドを実行しない） */
  dryRun: boolean;
  /** 使用プロバイダID（省略時はアクティブプロバイダ） */
  providerId?: string;
  /** 使用モデル（省略時はデフォルト） */
  model?: string;
  /** スクリーンキャプチャ設定 */
  screen?: Partial<ScreenObserverConfig>;
  /** アクション実行設定 */
  executor?: Partial<ActionExecutorConfig>;
  /** Vision（スクリーンショット）を LLM に渡すか */
  useVision: boolean;
  /** ログ関数 */
  log?: (msg: string) => void;
  /** 豊聡耳相談を発動する連続失敗回数（デフォルト: 2） */
  toyosatomiThreshold?: number;
}

const DEFAULT_CONFIG: AgentLoopConfig = {
  dataDir: './data',
  maxSteps: 20,
  stepDelayMs: 1000,
  dryRun: false,
  useVision: false,
};

export interface AgentLoopResult {
  /** 成功 or 失敗 */
  success: boolean;
  /** 実行ステップ数 */
  totalSteps: number;
  /** 各ステップの記録 */
  history: StepRecord[];
  /** 最終サマリ */
  summary: string;
  /** 所要時間（ms） */
  totalElapsedMs: number;
  /** エラーメッセージ */
  error?: string;
}

// ─── AgentLoop クラス ─────────────────────────────────

export class AgentLoop extends EventEmitter {
  private config: AgentLoopConfig;
  private llmManager: LLMManager;
  private observer: ScreenObserver;
  private executor: ActionExecutor;
  private log: (msg: string) => void;
  private aborted = false;

  // ★ Phase 5-C: 豊聡耳パイプライン（連続失敗時の相談用）
  private toyoPipeline: {
    consultForAgent: (
      goal: string, observation: string, failedActions: string[], step: number,
    ) => Promise<{ synthesis: string; recommendation: string; consensus: string }>;
  } | null = null;
  private consecutiveFailures = 0;

  constructor(config: Partial<AgentLoopConfig> & { dataDir: string }) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.log = this.config.log || ((msg: string) => console.log(`[AgentLoop] ${msg}`));

    this.llmManager = new LLMManager(this.config.dataDir);
    this.observer = new ScreenObserver(this.config.screen);
    this.executor = new ActionExecutor({
      ...this.config.executor,
      dryRun: this.config.dryRun,
      log: (msg: string) => this.log(`  [Exec] ${msg}`),
    });
  }

  // ─── プロバイダー管理（委譲） ────────────────────

  getLLMManager(): LLMManager { return this.llmManager; }

  /** ★ Phase 5-C: 豊聡耳パイプラインを注入 */
  setToyosatomiPipeline(pipeline: {
    consultForAgent: (
      goal: string, observation: string, failedActions: string[], step: number,
    ) => Promise<{ synthesis: string; recommendation: string; consensus: string }>;
  }): void {
    this.toyoPipeline = pipeline;
  }

  updateProvider(providerId: string, updates: Partial<LLMProviderConfig>): void {
    this.llmManager.updateProvider(providerId, updates);
  }

  // ─── メインループ ────────────────────────────────

  /**
   * ユーザーの自然言語指示を受け取り、Agent Loop を回す
   */
  async run(userGoal: string): Promise<AgentLoopResult> {
    this.aborted = false;
    const startTime = Date.now();
    const history: StepRecord[] = [];
    const maxSteps = this.config.maxSteps;

    this.log(`\n${'═'.repeat(60)}`);
    this.log(`Agent Loop Start — Goal: ${userGoal}`);
    this.log(`Max steps: ${maxSteps}, Dry run: ${this.config.dryRun}`);
    this.log(`${'═'.repeat(60)}\n`);

    this.emit('loop:start', { goal: userGoal, maxSteps });

    try {
      for (let step = 1; step <= maxSteps; step++) {
        if (this.aborted) {
          this.log('Agent loop aborted by user');
          return this.buildResult(false, history, 'Aborted by user', startTime);
        }

        this.log(`\n── Step ${step}/${maxSteps} ${'─'.repeat(40)}`);
        this.emit('step:start', { step, maxSteps });

        // ─── 1. OBSERVE ──────────────────────────
        let observation: ScreenObservation;
        let obsText: string;

        if (this.config.dryRun && step > 1) {
          // ドライランではステップ2以降の画面状態は変化しないため、
          // 前ステップのアクション結果を仮定した観察結果を構築
          const lastAction = history[history.length - 1]?.action || '';
          observation = {
            activeWindow: '(dry-run: assumed previous action succeeded)',
            windowList: [],
            timestamp: Date.now(),
            errors: [],
          };
          obsText = `[DRY RUN MODE — Screen observation skipped]\n`
            + `Previous action "${lastAction}" is assumed to have succeeded.\n`
            + `Continue with the next logical step toward the goal.`;
          this.log('  [Observe] Skipped (dry-run mode)');
        } else {
          this.log('  [Observe] Capturing screen state...');
          observation = await this.observer.observe();
          obsText = this.observer.describeObservation(observation);
          this.log(`  [Observe] Active: ${observation.activeWindow}`);
          this.log(`  [Observe] Windows: ${observation.windowList.length}`);
          if (observation.errors.length > 0) {
            this.log(`  [Observe] Warnings: ${observation.errors.join('; ')}`);
          }
        }

        // ─── 2. THINK ───────────────────────────
        this.log('  [Think] Querying LLM...');
        const agentResponse = await this.think(
          userGoal, obsText, observation, history, step, maxSteps
        );
        this.log(`  [Think] Thought: ${agentResponse.thought.slice(0, 100)}...`);
        this.log(`  [Think] Action: ${agentResponse.action || '(none)'}`);
        this.log(`  [Think] Done: ${agentResponse.done}`);

        // ─── 完了チェック ─────────────────────────
        if (agentResponse.done) {
          const record: StepRecord = {
            step,
            thought: agentResponse.thought,
            action: agentResponse.action || '(done)',
            result: 'success',
          };
          history.push(record);
          this.emit('step:complete', record);

          const summary = agentResponse.summary || agentResponse.thought;
          this.log(`\n✅ Agent finished at step ${step}: ${summary}`);
          this.emit('loop:complete', { summary, steps: step });
          return this.buildResult(true, history, summary, startTime);
        }

        // ─── 3. ACT ─────────────────────────────
        if (!agentResponse.action) {
          this.log('  [Act] No action — skipping');
          history.push({
            step,
            thought: agentResponse.thought,
            action: '(no action)',
            result: 'error',
            errorMessage: 'LLM did not provide an action',
          });
          continue;
        }

        this.log(`  [Act] Executing: ${agentResponse.action}`);
        const actionResult = await this.executor.execute(agentResponse.action);

        const record: StepRecord = {
          step,
          thought: agentResponse.thought,
          action: agentResponse.action,
          result: actionResult.success ? 'success' : 'error',
          errorMessage: actionResult.error || actionResult.rejectionReason,
        };
        history.push(record);
        this.emit('step:complete', record);

        if (!actionResult.success) {
          this.log(`  [Act] Failed: ${actionResult.error || actionResult.rejectionReason}`);
          this.consecutiveFailures++;

          // ★ Phase 5-C: 豊聡耳相談（連続失敗閾値超過時）
          const threshold = this.config.toyosatomiThreshold ?? 2;
          if (this.toyoPipeline && this.consecutiveFailures >= threshold) {
            this.log(`\n  🔔 [豊聡耳] 連続${this.consecutiveFailures}回失敗 → 複数AIに相談...`);
            this.emit('toyosatomi:consult', { failures: this.consecutiveFailures });

            const failedActions = history
              .filter(h => h.result === 'error')
              .slice(-this.consecutiveFailures)
              .map(h => `${h.action} (${h.errorMessage || 'unknown'})`);

            try {
              const consultation = await this.toyoPipeline.consultForAgent(
                userGoal, obsText, failedActions, step,
              );
              this.log(`  [豊聡耳] 合意: ${consultation.consensus.substring(0, 80)}`);
              this.log(`  [豊聡耳] 推薦: ${consultation.recommendation.substring(0, 80)}`);

              // 推薦アクションからReiコマンドを抽出して次ステップで使用
              const cmdMatch = consultation.recommendation.match(/コマンド[:：]\s*(.+)/);
              if (cmdMatch) {
                this.log(`  [豊聡耳] 次アクション候補: ${cmdMatch[1]}`);
                // 豊聡耳の推薦を直接実行
                const toyoResult = await this.executor.execute(cmdMatch[1].trim());
                if (toyoResult.success) {
                  this.log(`  [豊聡耳] ✓ 推薦アクション成功`);
                  this.consecutiveFailures = 0;
                }
              }

              this.emit('toyosatomi:result', consultation);
            } catch (toyoErr: any) {
              this.log(`  [豊聡耳] 相談エラー: ${toyoErr.message}`);
            }
          }
        } else {
          this.log(`  [Act] OK (${actionResult.elapsedMs}ms)`);
          this.consecutiveFailures = 0;  // 成功したらリセット
        }

        // ステップ間待機
        if (step < maxSteps) {
          await this.delay(this.config.stepDelayMs);
        }
      }

      // 最大ステップ到達
      const summary = `Reached maximum steps (${maxSteps}) without completing the goal.`;
      this.log(`\n⚠️ ${summary}`);
      this.emit('loop:timeout', { maxSteps });
      return this.buildResult(false, history, summary, startTime);

    } catch (err: any) {
      const errorMsg = `Agent loop error: ${err.message}`;
      this.log(`\n❌ ${errorMsg}`);
      this.emit('loop:error', { error: err.message });
      return this.buildResult(false, history, errorMsg, startTime);
    }
  }

  /**
   * ループを中断する
   */
  abort(): void {
    this.aborted = true;
    this.log('Abort requested');
    this.emit('loop:abort');
  }

  // ─── Think フェーズ（LLM 呼び出し） ─────────────

  private async think(
    userGoal: string,
    obsText: string,
    observation: ScreenObservation,
    history: StepRecord[],
    step: number,
    maxSteps: number
  ): Promise<AgentResponse> {
    const providerId = this.config.providerId || this.llmManager.getActiveProviderId();
    const adapter = this.llmManager.getAdapter(providerId);

    // プロンプト構築
    const systemPrompt = buildAgentSystemPrompt(maxSteps);
    let userMessage: string;

    if (step === 1 && history.length === 0) {
      // 初回: 計画立案プロンプト
      userMessage = buildPlanPrompt(userGoal, obsText);
    } else {
      // 継続: ステップ実行プロンプト
      userMessage = buildStepPrompt({
        userGoal,
        observation: obsText,
        history,
        stepNumber: step,
        maxSteps,
      });
    }

    // Vision（スクリーンショット）対応
    // Claude Messages API のマルチモーダルフォーマット
    let messages: any[];
    if (this.config.useVision && observation.screenshot && providerId === 'claude') {
      const content = this.observer.buildVisionContent(observation, userMessage);
      messages = [{ role: 'user', content }];
    } else {
      messages = [{ role: 'user', content: userMessage }];
    }

    const request: LLMRequest = {
      messages,
      systemPrompt,
      model: this.config.model,
      temperature: 0.2,  // 低めで安定した出力を期待
      maxTokens: 1024,
    };

    try {
      const response = await adapter.complete(request);
      this.log(`  [Think] Tokens: in=${response.usage?.inputTokens || '?'}, out=${response.usage?.outputTokens || '?'}`);
      return parseAgentResponse(response.content);
    } catch (err: any) {
      this.log(`  [Think] LLM Error: ${err.message}`);
      // LLM エラー時はループを終了させる
      return {
        thought: `LLM Error: ${err.message}`,
        action: '',
        done: true,
        summary: `Failed to get LLM response: ${err.message}`,
      };
    }
  }

  // ─── ヘルパー ────────────────────────────────────

  private buildResult(
    success: boolean,
    history: StepRecord[],
    summary: string,
    startTime: number
  ): AgentLoopResult {
    return {
      success,
      totalSteps: history.length,
      history,
      summary,
      totalElapsedMs: Date.now() - startTime,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
