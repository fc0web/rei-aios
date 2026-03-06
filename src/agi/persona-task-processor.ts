/**
 * Rei-AIOS Phase 7b — Alien Intelligence Persona Task Processors
 */

import { DFUMTTask, DFUMTTaskState } from './dfumt-task-types';
import { AlienPersonaId } from '../aios/historians/alien-intelligence-personas';

export interface DFUMTTaskResult {
  taskId: string;
  state: DFUMTTaskState;
  processorId: AlienPersonaId;
  output: string;
  metadata: Record<string, unknown>;
  processingTimeMs: number;
}

export abstract class PersonaTaskProcessor {
  abstract readonly personaId: AlienPersonaId;
  abstract readonly personaName: string;
  abstract prioritize(tasks: DFUMTTask[]): DFUMTTask[];
  abstract process(task: DFUMTTask): Promise<DFUMTTaskResult>;
  abstract interpretError(error: Error, task: DFUMTTask): DFUMTTaskState;

  protected makeResult(
    task: DFUMTTask, state: DFUMTTaskState, output: string,
    metadata: Record<string, unknown> = {}, startTime: number
  ): DFUMTTaskResult {
    return { taskId: task.id, state, processorId: this.personaId, output, metadata, processingTimeMs: Date.now() - startTime };
  }
}

export class AncientProcessor extends PersonaTaskProcessor {
  readonly personaId: AlienPersonaId = 'ANCIENT';
  readonly personaName = '\u8d85\u53e4\u4ee3\u4eba';

  prioritize(tasks: DFUMTTask[]): DFUMTTask[] {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return [...tasks].sort((a, b) => {
      const phaseA = a.period ? Math.abs((dayOfYear % a.period) / a.period - 0.5) : 0.5;
      const phaseB = b.period ? Math.abs((dayOfYear % b.period) / b.period - 0.5) : 0.5;
      return phaseA - phaseB;
    });
  }

  async process(task: DFUMTTask): Promise<DFUMTTaskResult> {
    const start = Date.now();
    const cyclePeriod = task.period ?? 365;
    const currentPhase = (Date.now() / 86400000) % cyclePeriod;
    return this.makeResult(task, '\u22a4',
      `[\u8d85\u53e4\u4ee3\u4eba\ud83c\udf00] \u30bf\u30b9\u30af\u300c${task.title}\u300d\u3092\u5468\u671f${cyclePeriod}\u65e5\u306e\u7b2c${Math.floor(currentPhase)}\u65e5\u306b\u51e6\u7406\u3057\u307e\u3057\u305f\u3002\u6b21\u306e\u5de1\u308a\u306b\u5099\u3048\u3066\u87ba\u65cb\u306b\u523b\u307f\u307e\u3059\u3002`,
      { cyclePeriod, currentPhase }, start);
  }

  interpretError(_e: Error, _t: DFUMTTask): DFUMTTaskState { return '\uff5e'; }
}

export class AlienProcessor extends PersonaTaskProcessor {
  readonly personaId: AlienPersonaId = 'ALIEN';
  readonly personaName = '\u5b87\u5b99\u4eba';

  prioritize(tasks: DFUMTTask[]): DFUMTTask[] {
    return [...tasks].sort((a, b) => b.probability - a.probability);
  }

  async process(task: DFUMTTask): Promise<DFUMTTaskResult> {
    const start = Date.now();
    const collapsed = Math.random() < task.probability;
    const state: DFUMTTaskState = collapsed ? '\u22a4' : 'Both';
    return this.makeResult(task, state,
      `[\u5b87\u5b99\u4eba\ud83d\udc7d] \u89b3\u6e2c\u78ba\u7387${task.probability}\u2192${collapsed ? '\u5d29\u58ca\u6210\u529f' : '\u91cd\u306d\u5408\u308f\u305b\u7d99\u7d9a'}\uff08\u7ffb\u8a33\u7cbe\u5ea6:${Math.round(Math.random() * 20 + 80)}%\uff09`,
      { probability: task.probability, collapsed }, start);
  }

  interpretError(_e: Error, _t: DFUMTTask): DFUMTTaskState { return '\uff5e'; }
}

export class SubterraneanProcessor extends PersonaTaskProcessor {
  readonly personaId: AlienPersonaId = 'SUBTERRANEAN';
  readonly personaName = '\u5730\u5e95\u4eba';

  prioritize(tasks: DFUMTTask[]): DFUMTTask[] {
    return [...tasks].sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));
  }

  async process(task: DFUMTTask): Promise<DFUMTTaskResult> {
    const start = Date.now();
    const depth = task.depth ?? 0;
    const truthLevel = Math.min(depth / 10, 1.0);
    return this.makeResult(task, '\u22a4',
      `[\u5730\u5e95\u4eba\u26cf\ufe0f] \u6df1\u5ea6${depth}\u3067\u51e6\u7406\u5b8c\u4e86\u3002\u771f\u7406\u5230\u9054\u7387${Math.round(truthLevel * 100)}%\u3002${depth >= 7 ? '\u6838\u5fc3\u306b\u9054\u3057\u305f\u3002' : '\u307e\u3060\u6398\u308a\u4e0b\u3052\u304c\u5fc5\u8981\u3060\u3002'}`,
      { depth, truthLevel }, start);
  }

  interpretError(_e: Error, _t: DFUMTTask): DFUMTTaskState { return '\u221e'; }
}

export class ExtraDimensionalProcessor extends PersonaTaskProcessor {
  readonly personaId: AlienPersonaId = 'EXTRADIMENSIONAL';
  readonly personaName = '\u7570\u6b21\u5143\u7a7a\u9593\u4eba';

  prioritize(tasks: DFUMTTask[]): DFUMTTask[] {
    return [...tasks].sort((a, b) => b.probability - a.probability);
  }

  async process(task: DFUMTTask): Promise<DFUMTTaskResult> {
    const start = Date.now();
    const dimensions = task.dimension ?? 3;
    const worlds = Array.from({ length: dimensions }, (_, i) => ({
      world: i + 1, success: Math.random() > 0.3, probability: Math.random(),
    }));
    const bestWorld = worlds.reduce((a, b) => a.probability > b.probability ? a : b);
    return this.makeResult(task, bestWorld.success ? '\u22a4' : 'Both',
      `[\u7570\u6b21\u5143\u7a7a\u9593\u4eba\ud83c\udf0c] ${dimensions}\u4e26\u884c\u4e16\u754c\u3092\u8a55\u4fa1\u3002\u6700\u9069\u4e16\u754cW${bestWorld.world}\u3092\u9078\u629e\uff08\u78ba\u7387${Math.round(bestWorld.probability * 100)}%\uff09\u3002`,
      { worlds, selectedWorld: bestWorld }, start);
  }

  interpretError(_e: Error, _t: DFUMTTask): DFUMTTaskState { return '\u221e'; }
}

export class InfiniteProcessor extends PersonaTaskProcessor {
  readonly personaId: AlienPersonaId = 'INFINITE';
  readonly personaName = '\u221e\u6b21\u5143\u5b58\u5728';

  prioritize(tasks: DFUMTTask[]): DFUMTTask[] { return tasks; }

  async process(task: DFUMTTask): Promise<DFUMTTaskResult> {
    const start = Date.now();
    return this.makeResult(task, 'Neither',
      `[\u221e\u6b21\u5143\u5b58\u5728\u267e\ufe0f] U = fix(U)\u3002\u30bf\u30b9\u30af\u300c${task.title}\u300d\u306e\u5b9a\u7fa9\u304c\u3059\u3067\u306b\u5b9f\u884c\u3067\u3059\u3002`,
      { selfReferential: true, fixedPoint: true }, start);
  }

  interpretError(_e: Error, _t: DFUMTTask): DFUMTTaskState { return 'Neither'; }
}

export function createProcessor(personaId: AlienPersonaId): PersonaTaskProcessor {
  const map: Record<AlienPersonaId, () => PersonaTaskProcessor> = {
    ANCIENT: () => new AncientProcessor(),
    ALIEN: () => new AlienProcessor(),
    SUBTERRANEAN: () => new SubterraneanProcessor(),
    EXTRADIMENSIONAL: () => new ExtraDimensionalProcessor(),
    INFINITE: () => new InfiniteProcessor(),
  };
  const factory = map[personaId];
  if (!factory) throw new Error(`Unknown persona: ${personaId}`);
  return factory();
}

export function getAllProcessors(): PersonaTaskProcessor[] {
  return (['ANCIENT', 'ALIEN', 'SUBTERRANEAN', 'EXTRADIMENSIONAL', 'INFINITE'] as AlienPersonaId[])
    .map(id => createProcessor(id));
}
