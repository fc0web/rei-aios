/**
 * Rei-AIOS Multi-Agent — 具体的エージェント実装 (agents.ts)
 *
 * ReiAgent   : 内蔵エージェント。D-FUMTエンジンを直接操作する
 * LLMAgent   : 外部LLM(Claude/GPT)を呼び出すエージェント
 * OrchestratorAgent: タスクを分解・分配する指揮者エージェント
 */

import { BaseAgent, AgentConfig, AgentTask, AgentMessage } from './agent';
import { DFUMTAIOSBridge } from '../actions/dfumt';

// ============================================================
// ReiAgent — D-FUMTエンジン内蔵エージェント
// ============================================================

export class ReiAgent extends BaseAgent {
  private bridge: DFUMTAIOSBridge;

  constructor(config?: Partial<AgentConfig>) {
    super({
      id:           config?.id   ?? 'rei-agent',
      name:         config?.name ?? 'Rei Agent',
      role:         'analyzer',
      maxConcurrent: 5,
      timeout:      15_000,
      ...config,
    });
    this.bridge = new DFUMTAIOSBridge();
  }

  protected async executeTask(task: AgentTask): Promise<unknown> {
    const input = task.input as Record<string, unknown>;

    switch (task.type) {

      case 'dfumt_analyze': {
        // D-FUMTフルパイプライン分析
        const vector = (input.vector as number[]) ?? [0, 1, 1.618, 3.14159];
        return await this.bridge.call('dfumt_engine_run', { input_vector: vector });
      }

      case 'dfumt_verify': {
        const value = (input.value as number) ?? 0;
        return await this.bridge.call('dfumt_verify', { value });
      }

      case 'dfumt_extend': {
        const origin = (input.origin as number) ?? 0;
        const depth  = (input.depth  as number) ?? 3;
        return await this.bridge.call('dfumt_seed_extend', { origin, depth });
      }

      case 'dfumt_synthesize': {
        return await this.bridge.call('dfumt_metabolism_synthesize', {
          value_a: (input.value_a as number) ?? 0,
          value_b: (input.value_b as number) ?? 1,
          mode:    (input.mode    as string) ?? 'dual',
        });
      }

      case 'axiom_branch': {
        // 公理分岐: テキストを3軸で分析（Thinking Gym統合）
        const text = String(input.text ?? '');
        return {
          input: text,
          branches: {
            logical:   `[論理] D-FUMT双対性に基づき "${text}" を⊕⊖構造で解析します。`,
            practical: `[実用] "${text}" をRei Automatorのタスクとして実行可能な形に変換します。`,
            critical:  `[批判] "${text}" の前提条件と制約事項を公理的に検証します。`,
          },
          agentId: this.id,
        };
      }

      default:
        throw new Error(`ReiAgent: 未知のタスクタイプ: ${task.type}`);
    }
  }

  protected onMessage(msg: AgentMessage): void {
    // taskメッセージを受信したら自動でキューに追加
    if (msg.type === 'task' && msg.to === this.id) {
      const taskPayload = msg.payload as Partial<AgentTask>;
      this.enqueue({
        id:          this._makeTaskId(),
        type:        taskPayload.type ?? 'dfumt_analyze',
        description: taskPayload.description ?? '',
        input:       taskPayload.input ?? {},
        createdAt:   Date.now(),
      });
    }
  }
}

// ============================================================
// LLMAgent — 外部LLM呼び出しエージェント
// ============================================================

export type LLMProvider = 'claude' | 'openai' | 'mock';

export class LLMAgent extends BaseAgent {
  private provider: LLMProvider;
  private apiKey:   string;
  private model:    string;

  constructor(provider: LLMProvider, config?: Partial<AgentConfig>) {
    const providerName = provider === 'claude' ? 'Claude' : provider === 'openai' ? 'GPT' : 'Mock';
    super({
      id:           config?.id   ?? `llm-${provider}`,
      name:         config?.name ?? `${providerName} Agent`,
      role:         'executor',
      maxConcurrent: 2,
      timeout:      60_000,
      ...config,
    });
    this.provider = provider;
    this.apiKey   = config?.apiKey ?? '';
    this.model    = config?.model
      ?? (provider === 'claude' ? 'claude-sonnet-4-6' : 'gpt-4o');
  }

  protected async executeTask(task: AgentTask): Promise<unknown> {
    const input = task.input as Record<string, unknown>;

    switch (task.type) {
      case 'chat': {
        const prompt = String(input.prompt ?? '');
        return await this._callLLM(prompt, input.system as string | undefined);
      }
      case 'analyze': {
        const target = String(input.target ?? '');
        const system = 'あなたはRei-AIOSのAIアシスタントです。D-FUMT理論に基づいて分析してください。';
        return await this._callLLM(`次の内容を分析してください: ${target}`, system);
      }
      case 'summarize': {
        const content = String(input.content ?? '');
        return await this._callLLM(`以下を簡潔に要約してください:\n${content}`);
      }
      default:
        throw new Error(`LLMAgent: 未知のタスクタイプ: ${task.type}`);
    }
  }

  private async _callLLM(prompt: string, system?: string): Promise<unknown> {
    // モックモード（APIキー未設定時）
    if (this.provider === 'mock' || !this.apiKey) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
      return {
        provider: this.provider,
        model:    this.model,
        response: `[${this.name} モック応答] "${prompt.slice(0, 50)}..." への回答です。`,
        tokens:   { input: prompt.length, output: 80 },
        mock:     true,
      };
    }

    // Anthropic Claude API
    if (this.provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      this.model,
          max_tokens: 1024,
          system:     system ?? 'あなたはRei-AIOSのAIアシスタントです。',
          messages:   [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
      const data = await res.json() as { content: Array<{ text: string }>; usage: unknown };
      return {
        provider: 'claude',
        model:    this.model,
        response: data.content[0]?.text ?? '',
        usage:    data.usage,
      };
    }

    // OpenAI GPT API
    if (this.provider === 'openai') {
      const messages = [];
      if (system) messages.push({ role: 'system', content: system });
      messages.push({ role: 'user', content: prompt });

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, messages, max_tokens: 1024 }),
      });
      if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
      const data = await res.json() as {
        choices: Array<{ message: { content: string } }>;
        usage: unknown;
      };
      return {
        provider: 'openai',
        model:    this.model,
        response: data.choices[0]?.message.content ?? '',
        usage:    data.usage,
      };
    }

    throw new Error(`未対応のプロバイダー: ${this.provider}`);
  }
}

// ============================================================
// OrchestratorAgent — 指揮者エージェント
// ============================================================

export class OrchestratorAgent extends BaseAgent {
  private agents: Map<string, BaseAgent> = new Map();
  private taskResults: Map<string, unknown> = new Map();

  constructor(config?: Partial<AgentConfig>) {
    super({
      id:           config?.id   ?? 'orchestrator',
      name:         config?.name ?? 'Orchestrator',
      role:         'orchestrator',
      maxConcurrent: 10,
      timeout:      120_000,
      ...config,
    });
  }

  /** 配下エージェントを登録 */
  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.id, agent);

    // 配下エージェントのイベントを中継
    agent.on('taskComplete', (e) => {
      this.taskResults.set(e.result.taskId, e.result.output);
      this.emit('agentTaskComplete', { orchestratorId: this.id, ...e });
    });
    agent.on('statusChange', (e) => {
      this.emit('agentStatusChange', { orchestratorId: this.id, ...e });
    });
  }

  /** 登録済みエージェントを取得 */
  getAgent(id: string): BaseAgent | undefined { return this.agents.get(id); }

  /** 利用可能なエージェントを取得 */
  getAvailableAgents(role?: BaseAgent['role']): BaseAgent[] {
    return [...this.agents.values()].filter(a =>
      a.isAvailable && (!role || a.role === role),
    );
  }

  protected async executeTask(task: AgentTask): Promise<unknown> {
    const input = task.input as Record<string, unknown>;

    switch (task.type) {

      case 'parallel_analyze': {
        // 並列分析: ReiAgentとLLMAgentを同時に起動
        return await this._parallelAnalyze(
          input.query as string,
          input.vector as number[] | undefined,
        );
      }

      case 'sequential_pipeline': {
        // 逐次パイプライン: A→B→Cの順で処理
        return await this._sequentialPipeline(
          input.steps as Array<{ agentId: string; taskType: string; input: unknown }>,
        );
      }

      case 'broadcast': {
        // 全エージェントにブロードキャスト
        return await this._broadcast(
          input.message as string,
          input.taskType as string,
        );
      }

      case 'assign': {
        // 特定エージェントにタスクを割り当て
        const targetId = input.agentId as string;
        const agent = this.agents.get(targetId);
        if (!agent) throw new Error(`エージェントが見つかりません: ${targetId}`);
        const subTask: AgentTask = {
          id:          this._makeTaskId(),
          type:        input.taskType as string,
          description: input.description as string ?? '',
          input:       input.taskInput ?? {},
          createdAt:   Date.now(),
        };
        agent.enqueue(subTask);
        return await agent.processNext();
      }

      default:
        throw new Error(`Orchestrator: 未知のタスクタイプ: ${task.type}`);
    }
  }

  // ----------------------------------------------------------
  // 並列実行
  // ----------------------------------------------------------

  private async _parallelAnalyze(query: string, vector?: number[]): Promise<unknown> {
    const reiAgent = [...this.agents.values()].find(a => a.role === 'analyzer');
    const llmAgent = [...this.agents.values()].find(a => a.role === 'executor');

    const tasks: Promise<unknown>[] = [];

    if (reiAgent) {
      const t: AgentTask = {
        id: this._makeTaskId(), type: 'axiom_branch',
        description: '公理分岐分析', input: { text: query }, createdAt: Date.now(),
      };
      reiAgent.enqueue(t);
      tasks.push(reiAgent.processNext().then(r => ({ source: 'rei', result: r })));
    }

    if (llmAgent) {
      const t: AgentTask = {
        id: this._makeTaskId(), type: 'chat',
        description: 'LLM分析', input: { prompt: query }, createdAt: Date.now(),
      };
      llmAgent.enqueue(t);
      tasks.push(llmAgent.processNext().then(r => ({ source: 'llm', result: r })));
    }

    if (vector && reiAgent) {
      const t: AgentTask = {
        id: this._makeTaskId(), type: 'dfumt_analyze',
        description: 'D-FUMT分析', input: { vector }, createdAt: Date.now(),
      };
      reiAgent.enqueue(t);
      tasks.push(reiAgent.processNext().then(r => ({ source: 'dfumt', result: r })));
    }

    const results = await Promise.allSettled(tasks);
    return {
      query,
      parallelResults: results.map(r =>
        r.status === 'fulfilled' ? r.value : { error: String((r as PromiseRejectedResult).reason) },
      ),
      agentCount: tasks.length,
      timestamp: Date.now(),
    };
  }

  private async _sequentialPipeline(
    steps: Array<{ agentId: string; taskType: string; input: unknown }>,
  ): Promise<unknown> {
    const outputs: unknown[] = [];
    let prevOutput: unknown = null;

    for (const step of steps) {
      const agent = this.agents.get(step.agentId);
      if (!agent) {
        outputs.push({ error: `エージェント未登録: ${step.agentId}` });
        continue;
      }

      // 前ステップの出力を次の入力に注入
      const taskInput = typeof step.input === 'object' && step.input !== null
        ? { ...step.input as object, _prevOutput: prevOutput }
        : step.input;

      const task: AgentTask = {
        id: this._makeTaskId(), type: step.taskType,
        description: `Pipeline step: ${step.taskType}`,
        input: taskInput, createdAt: Date.now(),
      };

      agent.enqueue(task);
      const result = await agent.processNext();
      prevOutput = result?.output;
      outputs.push(result);
    }

    return { pipelineSteps: steps.length, outputs };
  }

  private async _broadcast(message: string, taskType: string): Promise<unknown> {
    const all = [...this.agents.values()];
    const results = await Promise.allSettled(
      all.map(agent => {
        const task: AgentTask = {
          id: this._makeTaskId(), type: taskType,
          description: `Broadcast: ${message}`,
          input: { message }, createdAt: Date.now(),
        };
        agent.enqueue(task);
        return agent.processNext();
      }),
    );
    return {
      broadcastTo: all.map(a => a.id),
      results: results.map((r, i) => ({
        agentId: all[i].id,
        result:  r.status === 'fulfilled' ? r.value : null,
        error:   r.status === 'rejected'  ? String(r.reason) : undefined,
      })),
    };
  }

  /** 全エージェントのサマリー */
  getAllSummaries() {
    return {
      orchestrator: this.getSummary(),
      agents: [...this.agents.values()].map(a => a.getSummary()),
      taskResults: this.taskResults.size,
    };
  }
}
