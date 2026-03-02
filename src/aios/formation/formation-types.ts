/**
 * Rei AIOS — Formation Types
 * 循環インポートを避けるため、型定義とBaseFormationをここに集約する。
 *
 * formation-engine.ts が formations/*.ts をインポートし、
 * formations/*.ts が BaseFormation をインポートするため、
 * BaseFormation をこの独立ファイルに置くことで循環を解消する。
 */

import { LayerInfo } from '../layer/layer-manager';

// ─── 型定義 ────────────────────────────────────────────

export type FormationType = 'triangle' | 'diamond' | 'infinite';

export interface FormationConfig {
  type: FormationType;
  params?: Record<string, unknown>;
}

export interface FormationStep {
  layerId: number;
  role: string;
  task: string;
  dependsOn?: number;
  parallel?: boolean;
}

export interface FormationPlan {
  type: FormationType;
  goal: string;
  steps: FormationStep[];
  coordination: string;
}

export interface FormationRunResult {
  formationId: string;
  type: FormationType;
  goal: string;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  stepResults: Array<{
    layerId: number;
    role: string;
    task: string;
    output?: string;
    success: boolean;
    durationMs: number;
    error?: string;
  }>;
  summary?: string;
}

export type FormationStatus =
  | 'idle'
  | 'planning'
  | 'running'
  | 'complete'
  | 'failed'
  | 'cancelled';

// ─── 抽象基底: BaseFormation ───────────────────────────

export abstract class BaseFormation {
  abstract readonly type: FormationType;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly minLayers: number;

  abstract buildPlan(goal: string, availableLayers: LayerInfo[]): FormationPlan;
}
