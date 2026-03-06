/**
 * Rei-AIOS Phase 7a — D-FUMT Seven-valued Task Manager (in-memory)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DFUMTTask, DFUMTTaskState, DFUMTStateTransition,
  DFUMTTaskEvaluation, DFUMT_STATE_TRANSITIONS, DFUMT_STATE_LABELS,
} from './dfumt-task-types';
import { AlienPersonaId } from '../aios/historians/alien-intelligence-personas';

export class DFUMTTaskManager {
  private tasks: Map<string, DFUMTTask> = new Map();

  createTask(params: Partial<DFUMTTask> & { title: string }): DFUMTTask {
    const now = new Date();
    const task: DFUMTTask = {
      id: uuidv4(),
      title: params.title,
      description: params.description,
      state: '\uff5e',
      personaId: params.personaId,
      depth: params.depth ?? 0,
      dimension: params.dimension ?? 3,
      period: params.period,
      probability: params.probability ?? 0.5,
      theoryRef: params.theoryRef,
      metadata: params.metadata,
      stateHistory: [],
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  transitionState(
    taskId: string,
    newState: DFUMTTaskState,
    reason?: string,
    personaId?: AlienPersonaId
  ): DFUMTTask {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const allowed = DFUMT_STATE_TRANSITIONS[task.state];
    if (!allowed.includes(newState)) {
      throw new Error(`Invalid transition: ${task.state} \u2192 ${newState}. Allowed: ${allowed.join(', ')}`);
    }

    const transition: DFUMTStateTransition = {
      from: task.state, to: newState, reason, personaId, timestamp: new Date(),
    };
    task.stateHistory.push(transition);
    task.state = newState;
    task.updatedAt = new Date();
    if (personaId) task.personaId = personaId;
    this.tasks.set(taskId, task);
    return task;
  }

  evaluateTask(taskId: string): DFUMTTaskEvaluation {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    return {
      taskId,
      state: task.state,
      personaEvaluation: {
        ANCIENT: `\u5468\u671f${task.period ?? 365}\u65e5\u306e\u87ba\u65cb\u306b\u304a\u3044\u3066\u3001\u3053\u306e\u30bf\u30b9\u30af\u306f${task.state === '\u22a4' ? '\u3053\u306e\u5468\u671f\u306b\u5b8c\u7d50\u3057\u305f' : '\u6b21\u306e\u5468\u671f\u3067\u5b8c\u7d50\u3059\u308b'}\u3002`,
        ALIEN: `\u89b3\u6e2c\u78ba\u7387${Math.round(task.probability * 100)}%\u3002\u3053\u306e\u5b87\u5b99\u3067\u306f${DFUMT_STATE_LABELS[task.state]}\uff08\u7ffb\u8a33\u7cbe\u5ea6:87%\uff09\u3002`,
        SUBTERRANEAN: `\u6df1\u5ea6${task.depth}\u3002${task.depth >= 7 ? '\u6838\u5fc3\u306b\u9054\u3057\u305f\u3002' : '\u307e\u3060\u6398\u308a\u4e0b\u3052\u304c\u5fc5\u8981\u3060\u3002'}`,
        EXTRADIMENSIONAL: `\u7b2c${task.dimension}\u6b21\u5143\u3067\u306e\u7d50\u679c: ${task.state}\u3002\u6700\u9069\u4e26\u884c\u4e16\u754c\u3067\u306e\u6210\u529f\u78ba\u7387: ${Math.round(task.probability * 100)}%\u3002`,
        INFINITE: `U = fix(U)\u3002\u30bf\u30b9\u30af\u3068\u8a55\u4fa1\u306f\u540c\u4e00\u3067\u3059\u3002`,
      },
      dimensionalAnalysis: {
        dimension4: task.state === '\u22a4' || task.state === 'Both',
        dimension5: task.probability > 0.7,
        dimensionN: task.state !== '\u22a5' && task.state !== '\u3007',
      },
      infiniteEvaluation: `\u30bf\u30b9\u30af\u300c${task.title}\u300d\u306f${DFUMT_STATE_LABELS[task.state]}\u306b\u3042\u308a\u307e\u3059\u3002U = fix(U)\u306e\u89b3\u70b9\u304b\u3089\u3001\u3053\u306e\u72b6\u614b\u306f\u3059\u3067\u306b\u5b8c\u7d50\u3057\u3066\u3044\u307e\u3059\u3002`,
    };
  }

  getAllTasks(): DFUMTTask[] { return Array.from(this.tasks.values()); }
  getTasksByState(state: DFUMTTaskState): DFUMTTask[] { return this.getAllTasks().filter(t => t.state === state); }
  getInProgressTasks(): DFUMTTask[] { return this.getTasksByState('\u221e'); }
  deleteTask(taskId: string): void { this.tasks.delete(taskId); }

  analyzeBothState(taskId: string): string {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.state !== 'Both') return `\u30bf\u30b9\u30af\u306fBoth\u72b6\u614b\u3067\u306f\u3042\u308a\u307e\u305b\u3093\uff08\u73fe\u5728: ${task.state}\uff09`;
    return `\u30bf\u30b9\u30af\u300c${task.title}\u300d\u306f\u77db\u76fe\u5171\u5b58\u72b6\u614b\uff08catuskoti\uff09\u3067\u3059\u3002\u5f37\u5236\u89e3\u6c7a\u3067\u306f\u306a\u304f\u3001\u3053\u306e\u77db\u76fe\u3092\u4fdd\u6301\u3057\u305f\u307e\u307e\u6b21\u306e\u30d5\u30a7\u30fc\u30ba\u3078\u79fb\u884c\u3059\u308b\u3053\u3068\u3092\u63a8\u5968\u3057\u307e\u3059\u3002`;
  }
}
