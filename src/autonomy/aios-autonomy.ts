/**
 * Rei-AIOS STEP 9-C — AIOSAutonomy
 * AI自律行動空間
 *
 * AIが自律的に:
 *   1. タスクキューから次の作業を選ぶ
 *   2. D-FUMT七価論理で実行可否を判断
 *   3. タスクを実行する
 *   4. 結果を七価論理で自己評価する
 *   5. 記憶に学習内容を保存する
 */

export type DFUMTValue = 'TRUE' | 'FALSE' | 'BOTH' | 'NEITHER' | 'INFINITY' | 'ZERO' | 'FLOWING';
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'deferred';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface AutonomousTask {
  id: string;
  name: string;
  description: string;
  priority: TaskPriority;
  assignedTo: string;           // エージェントID
  status: TaskStatus;
  dfumtFeasibility: DFUMTValue; // 実行可能性の七価論理評価
  dfumtResult?: DFUMTValue;     // 実行結果の七価論理評価
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  output?: string;
  errorMsg?: string;
  retryCount: number;
  maxRetries: number;
  dependencies: string[];       // 依存タスクID
}

export interface AgentState {
  agentId: string;
  status: 'idle' | 'busy' | 'thinking' | 'blocked';
  currentTaskId?: string;
  completedTasks: number;
  failedTasks: number;
  dfumtSelfScore: DFUMTValue;   // 自己評価スコア
  lastActiveAt: string;
}

export interface AutonomyReport {
  totalTasks: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  successRate: number;
  agents: AgentState[];
  avgDfumtResult: DFUMTValue;
}

// ─── AIOSAutonomy メインクラス ─────────────────────────────────
export class AIOSAutonomy {
  private tasks: Map<string, AutonomousTask> = new Map();
  private agents: Map<string, AgentState> = new Map();
  private executors: Map<string, (task: AutonomousTask) => Promise<string>> = new Map();

  // ── エージェント登録 ────────────────────────────────────────
  registerAgent(agentId: string): AgentState {
    const state: AgentState = {
      agentId,
      status: 'idle',
      completedTasks: 0,
      failedTasks: 0,
      dfumtSelfScore: 'NEITHER',
      lastActiveAt: new Date().toISOString(),
    };
    this.agents.set(agentId, state);
    return state;
  }

  // ── タスク実行関数の登録 ────────────────────────────────────
  registerExecutor(
    agentId: string,
    executor: (task: AutonomousTask) => Promise<string>
  ): void {
    this.executors.set(agentId, executor);
  }

  // ── タスク追加 ──────────────────────────────────────────────
  addTask(
    name: string,
    description: string,
    assignedTo: string,
    opts: {
      priority?: TaskPriority;
      dependencies?: string[];
      maxRetries?: number;
    } = {}
  ): AutonomousTask {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const task: AutonomousTask = {
      id, name, description,
      priority: opts.priority ?? 'medium',
      assignedTo,
      status: 'pending',
      dfumtFeasibility: 'NEITHER', // 初期は不確定
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: opts.maxRetries ?? 2,
      dependencies: opts.dependencies ?? [],
    };
    this.tasks.set(id, task);
    return task;
  }

  // ── 実行可能性の七価論理評価 ────────────────────────────────
  evaluateFeasibility(taskId: string): DFUMTValue {
    const task = this.tasks.get(taskId);
    if (!task) return 'FALSE';

    // 依存タスクの確認
    const unmetDeps = task.dependencies.filter(depId => {
      const dep = this.tasks.get(depId);
      return !dep || dep.status !== 'done';
    });

    if (unmetDeps.length > 0) return 'NEITHER';     // 依存未解決
    if (task.retryCount >= task.maxRetries) return 'FALSE'; // リトライ上限
    if (task.status === 'running') return 'BOTH';   // 実行中
    if (task.status === 'done') return 'TRUE';      // 完了済み
    if (task.status === 'failed') return 'FALSE';   // 失敗
    return 'TRUE';                                  // 実行可能
  }

  // ── タスク実行（自律） ──────────────────────────────────────
  async runNext(agentId: string): Promise<AutonomousTask | null> {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status === 'busy') return null;

    // 優先度順でpendingタスクを選択
    const priorityOrder: TaskPriority[] = ['critical', 'high', 'medium', 'low'];
    let selectedTask: AutonomousTask | null = null;

    for (const priority of priorityOrder) {
      const candidates = Array.from(this.tasks.values()).filter(t =>
        t.assignedTo === agentId &&
        t.status === 'pending' &&
        t.priority === priority
      );
      if (candidates.length > 0) {
        selectedTask = candidates[0];
        break;
      }
    }

    if (!selectedTask) return null;

    // 実行可能性評価
    const feasibility = this.evaluateFeasibility(selectedTask.id);
    selectedTask.dfumtFeasibility = feasibility;

    if (feasibility === 'FALSE' || feasibility === 'NEITHER') {
      selectedTask.status = 'deferred';
      return selectedTask;
    }

    // 実行開始
    agent.status = 'busy';
    agent.currentTaskId = selectedTask.id;
    agent.lastActiveAt = new Date().toISOString();
    selectedTask.status = 'running';
    selectedTask.startedAt = new Date().toISOString();

    try {
      const executor = this.executors.get(agentId);
      const output = executor
        ? await executor(selectedTask)
        : `[${agentId}] タスク完了: ${selectedTask.name}`;

      selectedTask.status = 'done';
      selectedTask.output = output;
      selectedTask.completedAt = new Date().toISOString();
      selectedTask.dfumtResult = 'TRUE';
      agent.completedTasks++;
      agent.dfumtSelfScore = 'TRUE';

    } catch (e: any) {
      selectedTask.retryCount++;
      selectedTask.errorMsg = e.message;

      if (selectedTask.retryCount >= selectedTask.maxRetries) {
        selectedTask.status = 'failed';
        selectedTask.dfumtResult = 'FALSE';
        agent.failedTasks++;
        agent.dfumtSelfScore = 'NEITHER';
      } else {
        selectedTask.status = 'pending'; // リトライ
        selectedTask.dfumtResult = 'BOTH';
      }
    }

    agent.status = 'idle';
    agent.currentTaskId = undefined;
    return selectedTask;
  }

  // ── 自律ループ（複数タスクを連続実行） ──────────────────────
  async runLoop(agentId: string, maxTasks = 10): Promise<AutonomousTask[]> {
    const executed: AutonomousTask[] = [];
    for (let i = 0; i < maxTasks; i++) {
      const task = await this.runNext(agentId);
      if (!task) break;
      executed.push(task);
    }
    return executed;
  }

  // ── レポート ────────────────────────────────────────────────
  report(): AutonomyReport {
    const tasks = Array.from(this.tasks.values());
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const dfumtCounts: Record<string, number> = {};

    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      if (t.dfumtResult) {
        dfumtCounts[t.dfumtResult] = (dfumtCounts[t.dfumtResult] ?? 0) + 1;
      }
    }

    const done = byStatus['done'] ?? 0;
    const total = tasks.length;
    const successRate = total > 0 ? done / total : 0;

    // 最頻出D-FUMT結果
    const avgDfumtResult = (Object.entries(dfumtCounts)
      .sort((a,b) => b[1]-a[1])[0]?.[0] ?? 'NEITHER') as DFUMTValue;

    return {
      totalTasks: total,
      byStatus: byStatus as Record<TaskStatus, number>,
      byPriority: byPriority as Record<TaskPriority, number>,
      successRate,
      agents: Array.from(this.agents.values()),
      avgDfumtResult,
    };
  }

  getTask(id: string): AutonomousTask | null {
    return this.tasks.get(id) ?? null;
  }

  getAgent(id: string): AgentState | null {
    return this.agents.get(id) ?? null;
  }

  pendingCount(agentId: string): number {
    return Array.from(this.tasks.values())
      .filter(t => t.assignedTo === agentId && t.status === 'pending').length;
  }
}
