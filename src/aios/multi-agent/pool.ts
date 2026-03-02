/**
 * Rei-AIOS Multi-Agent — エージェントプール (pool.ts)
 * テーマE: マルチエージェント並列化
 *
 * AIエージェントの「出入り口」。登録・起動・停止・
 * メッセージルーティング・負荷分散を一元管理する。
 */

import { EventEmitter } from 'events';
import { BaseAgent, AgentMessage, AgentTask, AgentTaskResult } from './agent';
import { ReiAgent, LLMAgent, OrchestratorAgent } from './agents';

// ============================================================
// 型定義
// ============================================================

/** プール統計 */
export interface PoolStats {
  totalAgents:    number;
  activeAgents:   number;
  idleAgents:     number;
  totalMessages:  number;
  totalTasks:     number;
  completedTasks: number;
  failedTasks:    number;
  uptimeMs:       number;
}

/** プールイベントログ */
export interface PoolEvent {
  type:      'agent_enter' | 'agent_exit' | 'message_routed' | 'task_dispatched' | 'task_complete';
  timestamp: number;
  data:      unknown;
}

/** 負荷分散戦略 */
export type DispatchStrategy = 'round-robin' | 'least-busy' | 'role-match' | 'random';

// ============================================================
// AgentPool — エージェントプール
// ============================================================

export class AgentPool extends EventEmitter {
  private agents:       Map<string, BaseAgent> = new Map();
  private orchestrator: OrchestratorAgent;
  private msgCounter:   number = 0;
  private taskCounter:  number = 0;
  private completedTasks: number = 0;
  private failedTasks:  number = 0;
  private eventLog:     PoolEvent[] = [];
  private startedAt:    number = Date.now();
  private rrIndex:      number = 0;         // ラウンドロビン用インデックス

  constructor() {
    super();
    // オーケストレーターは常に1体、プールに内包
    this.orchestrator = new OrchestratorAgent({ id: 'orchestrator', name: 'Orchestrator' });
    this._bindOrchestratorEvents();
  }

  // ----------------------------------------------------------
  // エージェントの入退室 (出入り口)
  // ----------------------------------------------------------

  /**
   * エージェントがプールに入室
   * Rei-AIOS内を自由に出入りするAIエージェントの「入口」
   */
  async enter(agent: BaseAgent): Promise<void> {
    if (this.agents.has(agent.id)) {
      console.warn(`[Pool] エージェント ${agent.id} は既に入室しています`);
      return;
    }

    this.agents.set(agent.id, agent);
    this.orchestrator.registerAgent(agent);
    await agent.start();

    this._logEvent('agent_enter', { agentId: agent.id, role: agent.role, name: agent.name });
    this.emit('agentEnter', { agentId: agent.id, name: agent.name, role: agent.role });

    console.log(`[Pool] ✓ ${agent.name} (${agent.role}) が入室しました`);
  }

  /**
   * エージェントがプールを退室
   * タスクが残っている場合は警告を出す
   */
  async exit(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    if (agent.runningTaskCount > 0) {
      console.warn(`[Pool] 警告: ${agent.name} はタスク実行中に退室します`);
    }

    await agent.stop();
    this.agents.delete(agentId);

    this._logEvent('agent_exit', { agentId, name: agent.name });
    this.emit('agentExit', { agentId, name: agent.name });

    console.log(`[Pool] ✓ ${agent.name} が退室しました`);
  }

  /** 全エージェントを退室させる */
  async exitAll(): Promise<void> {
    const ids = [...this.agents.keys()];
    await Promise.all(ids.map(id => this.exit(id)));
  }

  // ----------------------------------------------------------
  // メッセージルーティング
  // ----------------------------------------------------------

  /**
   * メッセージをルーティング
   * 'to' フィールドに基づいて宛先エージェントに配送
   */
  route(msg: AgentMessage): void {
    this.msgCounter++;

    if (msg.to === '*') {
      // ブロードキャスト: 全エージェントに配送
      for (const agent of this.agents.values()) {
        if (agent.id !== msg.from) {
          agent.receiveMessage(msg);
        }
      }
    } else {
      const target = this.agents.get(msg.to);
      if (target) {
        target.receiveMessage(msg);
      } else {
        console.warn(`[Pool] 宛先エージェントが見つかりません: ${msg.to}`);
      }
    }

    this._logEvent('message_routed', { msgId: msg.id, from: msg.from, to: msg.to, type: msg.type });
    this.emit('messageRouted', msg);
  }

  // ----------------------------------------------------------
  // タスクディスパッチ
  // ----------------------------------------------------------

  /**
   * タスクを適切なエージェントにディスパッチ
   * strategy で負荷分散方式を指定
   */
  async dispatch(
    task: Omit<AgentTask, 'id' | 'createdAt'>,
    strategy: DispatchStrategy = 'role-match',
  ): Promise<AgentTaskResult | null> {
    const fullTask: AgentTask = {
      ...task,
      id:        `pool_task_${++this.taskCounter}`,
      createdAt: Date.now(),
    };

    const agent = this._selectAgent(fullTask, strategy);
    if (!agent) {
      console.warn(`[Pool] タスク "${fullTask.type}" を処理できるエージェントがいません`);
      return null;
    }

    agent.enqueue(fullTask);
    this._logEvent('task_dispatched', { taskId: fullTask.id, agentId: agent.id, type: fullTask.type });
    this.emit('taskDispatched', { taskId: fullTask.id, agentId: agent.id });

    const result = await agent.processNext();

    if (result) {
      if (result.success) this.completedTasks++;
      else                this.failedTasks++;
      this._logEvent('task_complete', { taskId: fullTask.id, success: result.success });
      this.emit('taskComplete', result);
    }

    return result;
  }

  /**
   * 複数タスクを並列ディスパッチ
   */
  async dispatchAll(
    tasks: Array<Omit<AgentTask, 'id' | 'createdAt'>>,
    strategy: DispatchStrategy = 'least-busy',
  ): Promise<(AgentTaskResult | null)[]> {
    return Promise.all(tasks.map(t => this.dispatch(t, strategy)));
  }

  // ----------------------------------------------------------
  // エージェント選択ロジック
  // ----------------------------------------------------------

  private _selectAgent(task: AgentTask, strategy: DispatchStrategy): BaseAgent | null {
    const available = [...this.agents.values()].filter(a => a.isAvailable);
    if (available.length === 0) {
      // 利用可能なエージェントがいなければ全エージェントから選ぶ
      return [...this.agents.values()][0] ?? null;
    }

    switch (strategy) {
      case 'role-match': {
        // タスクタイプに適したロールを優先
        const roleMap: Record<string, BaseAgent['role']> = {
          dfumt_analyze:    'analyzer',
          dfumt_verify:     'analyzer',
          dfumt_extend:     'analyzer',
          dfumt_synthesize: 'analyzer',
          axiom_branch:     'analyzer',
          chat:             'executor',
          analyze:          'executor',
          summarize:        'executor',
          parallel_analyze: 'orchestrator',
          sequential_pipeline: 'orchestrator',
          broadcast:        'orchestrator',
        };
        const preferredRole = roleMap[task.type];
        const matched = available.filter(a => a.role === preferredRole);
        return matched[0] ?? available[0];
      }

      case 'least-busy': {
        return available.reduce((a, b) =>
          a.runningTaskCount <= b.runningTaskCount ? a : b,
        );
      }

      case 'round-robin': {
        const agent = available[this.rrIndex % available.length];
        this.rrIndex++;
        return agent;
      }

      case 'random':
        return available[Math.floor(Math.random() * available.length)];

      default:
        return available[0];
    }
  }

  // ----------------------------------------------------------
  // 統計・モニタリング
  // ----------------------------------------------------------

  getStats(): PoolStats {
    const agents = [...this.agents.values()];
    return {
      totalAgents:    agents.length,
      activeAgents:   agents.filter(a => a.status === 'running').length,
      idleAgents:     agents.filter(a => a.status === 'idle').length,
      totalMessages:  this.msgCounter,
      totalTasks:     this.taskCounter,
      completedTasks: this.completedTasks,
      failedTasks:    this.failedTasks,
      uptimeMs:       Date.now() - this.startedAt,
    };
  }

  getAgentSummaries() {
    return [...this.agents.values()].map(a => a.getSummary());
  }

  getEventLog(limit = 50): PoolEvent[] {
    return this.eventLog.slice(-limit);
  }

  getOrchestrator(): OrchestratorAgent { return this.orchestrator; }

  // ----------------------------------------------------------
  // デフォルトエージェントセットアップ
  // ----------------------------------------------------------

  /**
   * 標準構成でプールを初期化
   * ReiAgent + LLMAgent(mock) を自動入室させる
   */
  static async createDefault(): Promise<AgentPool> {
    const pool = new AgentPool();

    // 内蔵 Rei エージェント
    await pool.enter(new ReiAgent());

    // モックLLMエージェント（APIキー設定後に実LLMに切替）
    await pool.enter(new LLMAgent('mock', {
      id:   'llm-claude',
      name: 'Claude Agent',
      role: 'executor',
    }));

    return pool;
  }

  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------

  private _logEvent(type: PoolEvent['type'], data: unknown): void {
    this.eventLog.push({ type, timestamp: Date.now(), data });
    // 最大1000件まで保持
    if (this.eventLog.length > 1000) {
      this.eventLog.splice(0, this.eventLog.length - 1000);
    }
  }

  private _bindOrchestratorEvents(): void {
    this.orchestrator.on('agentTaskComplete', (e) => {
      this.emit('orchestratorTaskComplete', e);
    });
  }

  /** プール状態サマリー文字列 */
  summary(): string {
    const stats = this.getStats();
    const uptime = Math.floor(stats.uptimeMs / 1000);
    return [
      '=== AgentPool サマリー ===',
      `エージェント数: ${stats.totalAgents} (稼働:${stats.activeAgents} 待機:${stats.idleAgents})`,
      `タスク: 完了${stats.completedTasks} / 失敗${stats.failedTasks} / 総計${stats.totalTasks}`,
      `メッセージ: ${stats.totalMessages}件`,
      `稼働時間: ${uptime}秒`,
    ].join('\n');
  }
}

// デフォルトエクスポート
export { ReiAgent, LLMAgent, OrchestratorAgent };
