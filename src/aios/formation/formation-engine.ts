/**
 * Rei AIOS — Formation Engine
 * Theme J: マルチエージェント フォーメーション（陣形）制御
 *
 * 複数LayerのAIエージェントが「役割分担して一つの目標に向かう」
 * フォーメーション（陣形）を定義・実行する。
 *
 * D-FUMT 中心-周囲パターン:
 *   中心 = フォーメーションの目標（ユーザーの意図）
 *   周囲 = 各エージェントの専門的役割
 *
 * 実装済みフォーメーション:
 *   ▲ Triangle  — 三角陣形（調査→分析→実行）
 *   ◆ Diamond   — 菱形陣形（深掘り探索・並列仮説検証）
 *   ∞ Infinite  — 無限陣形（自律進化ループ）
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { LayerManager, LayerInfo } from '../layer/layer-manager';
import { LayerBridgeHub } from '../wsl2/layer-bridge';
// formations は循環依存を避けるため遅延requireで読み込む

// ─── 型定義 ────────────────────────────────────────────

export type FormationType = 'triangle' | 'diamond' | 'infinite';

export interface FormationConfig {
  type: FormationType;
  /** フォーメーション固有のパラメータ */
  params?: Record<string, unknown>;
}

export interface FormationStep {
  /** どのLayerが実行するか */
  layerId: number;
  /** エージェントの役割ラベル */
  role: string;
  /** このステップで実行するタスク */
  task: string;
  /** 前のステップの結果を受け取るか */
  dependsOn?: number; // layerId
  /** 並列実行するか */
  parallel?: boolean;
}

export interface FormationPlan {
  type: FormationType;
  goal: string;
  steps: FormationStep[];
  /** Layerの情報転達方向の説明 */
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

  /**
   * ゴールからフォーメーションプランを生成する
   */
  abstract buildPlan(goal: string, availableLayers: LayerInfo[]): FormationPlan;
}

// ─── FormationEngine ──────────────────────────────────

export class FormationEngine extends EventEmitter {
  private layerManager: LayerManager;
  private bridge: LayerBridgeHub;
  private log: (msg: string) => void;
  private runHistory: FormationRunResult[] = [];
  private historyPath: string;
  private currentStatus: FormationStatus = 'idle';
  private cancelRequested = false;

  // フォーメーション実装の登録（遅延requireで循環依存を回避）
  private formations = new Map<FormationType, BaseFormation>();

  private _initFormations(): void {
    if (this.formations.size > 0) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { TriangleFormation } = require('./formations/triangle');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DiamondFormation }  = require('./formations/diamond');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { InfiniteFormation } = require('./formations/infinite');
    this.formations.set('triangle', new TriangleFormation());
    this.formations.set('diamond',  new DiamondFormation());
    this.formations.set('infinite', new InfiniteFormation());
  }

  constructor(
    layerManager: LayerManager,
    dataDir: string,
    log?: (msg: string) => void
  ) {
    super();
    this.layerManager = layerManager;
    this.bridge = layerManager.getBridge();
    this.log = log || ((msg) => console.log(`[FormationEngine] ${msg}`));
    this.historyPath = path.join(dataDir, 'formation-history.json');
    this.loadHistory();
  }

  // ─── フォーメーション実行 ──────────────────────────

  /**
   * フォーメーションを実行する。
   *
   * @param goal     ユーザーの目標（自然言語）
   * @param config   フォーメーション設定
   */
  async run(goal: string, config: FormationConfig): Promise<FormationRunResult> {
    this._initFormations();
    const formation = this.formations.get(config.type);
    if (!formation) {
      throw new Error(`Unknown formation type: ${config.type}`);
    }

    // 必要Layer数の確認・起動
    const allLayers = this.layerManager.getAllLayerInfo();
    const activeLayers = allLayers.filter(l =>
      l.status === 'active' || l.status === 'running'
    );

    if (activeLayers.length < formation.minLayers) {
      this.log(`Need ${formation.minLayers} layers, activating...`);
      for (let id = activeLayers.length + 1; id <= formation.minLayers; id++) {
        await this.layerManager.activateLayer(id);
      }
    }

    const plan = formation.buildPlan(goal, this.layerManager.getAllLayerInfo());
    const formationId = `formation-${Date.now()}`;
    const startedAt = new Date().toISOString();

    this.cancelRequested = false;
    this.setStatus('running');

    this.log(`\n${'═'.repeat(50)}`);
    this.log(`Formation: ${formation.name} [${formationId}]`);
    this.log(`Goal: "${goal}"`);
    this.log(`Coordination: ${plan.coordination}`);
    this.log(`${'═'.repeat(50)}\n`);

    this.emit('formation:start', { formationId, type: config.type, goal, plan });

    const result: FormationRunResult = {
      formationId,
      type: config.type,
      goal,
      startedAt,
      finishedAt: '',
      success: false,
      stepResults: [],
    };

    // コンテキスト（前ステップの結果を次ステップに渡す）
    const stepOutputs = new Map<number, string>();

    try {
      // ステップを実行（dependsOn考慮）
      const pendingSteps = [...plan.steps];

      while (pendingSteps.length > 0 && !this.cancelRequested) {
        // 並列実行可能なステップをまとめる
        const readySteps: FormationStep[] = [];
        const notReady: FormationStep[] = [];

        for (const step of pendingSteps) {
          const depReady = step.dependsOn === undefined
            || stepOutputs.has(step.dependsOn);
          if (depReady) readySteps.push(step);
          else notReady.push(step);
        }

        if (readySteps.length === 0 && notReady.length > 0) {
          throw new Error('Circular dependency in formation steps');
        }

        // 並列ステップは同時実行
        const parallelGroup = readySteps.filter((s, i) => i === 0 || s.parallel);
        const remaining = readySteps.filter((s, i) => i !== 0 && !s.parallel);

        pendingSteps.length = 0;
        pendingSteps.push(...remaining, ...notReady);

        const stepPromises = parallelGroup.map(step =>
          this.executeStep(step, stepOutputs, config.params)
        );

        const stepResults = await Promise.all(stepPromises);

        for (const stepResult of stepResults) {
          result.stepResults.push(stepResult);
          if (stepResult.output) {
            stepOutputs.set(stepResult.layerId, stepResult.output);
          }
          this.emit('step:complete', stepResult);
        }
      }

      if (this.cancelRequested) {
        this.setStatus('cancelled');
        result.success = false;
        result.summary = 'Formation cancelled by user';
      } else {
        result.success = result.stepResults.every(s => s.success);
        result.summary = this.buildSummary(result);
        this.setStatus(result.success ? 'complete' : 'failed');
      }
    } catch (err: any) {
      result.success = false;
      result.summary = `Formation failed: ${err.message}`;
      this.setStatus('failed');
      this.log(`Formation error: ${err.message}`);
    }

    result.finishedAt = new Date().toISOString();
    this.addHistory(result);
    this.emit('formation:complete', result);

    this.log(`Formation ${result.success ? '✅ complete' : '❌ failed'}: ${result.summary}`);
    return result;
  }

  cancel(): void {
    this.cancelRequested = true;
    this.log('Formation cancel requested');
    this.emit('formation:cancel');
  }

  // ─── 個別ステップ実行 ────────────────────────────

  private async executeStep(
    step: FormationStep,
    prevOutputs: Map<number, string>,
    params?: Record<string, unknown>
  ): Promise<FormationRunResult['stepResults'][0]> {
    const startTime = Date.now();

    this.log(`▶ Layer ${step.layerId} [${step.role}]: ${step.task}`);
    this.emit('step:start', { layerId: step.layerId, role: step.role, task: step.task });

    // 前ステップの出力をコンテキストとして構築
    let context = '';
    if (step.dependsOn !== undefined && prevOutputs.has(step.dependsOn)) {
      context = `[Layer ${step.dependsOn}の出力]\n${prevOutputs.get(step.dependsOn)}\n\n`;
    }

    try {
      // LayerManagerにタスクを割り当て
      const taskId = this.layerManager.assignTask(
        step.layerId,
        `[${step.role}として] ${step.task}`,
        context
      );

      // タスク完了を待機（簡易：イベント待ち）
      const output = await this.waitForTaskResult(step.layerId, taskId, params);

      this.layerManager.recordTaskComplete(step.layerId, taskId, true);
      this.log(`  ✅ Layer ${step.layerId} complete (${Date.now() - startTime}ms)`);

      return {
        layerId: step.layerId,
        role: step.role,
        task: step.task,
        output,
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.log(`  ❌ Layer ${step.layerId} failed: ${err.message}`);
      return {
        layerId: step.layerId,
        role: step.role,
        task: step.task,
        success: false,
        durationMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  /**
   * タスク結果を待機する（ブリッジのメッセージ経由）
   * タイムアウト: 5分
   */
  private waitForTaskResult(
    layerId: number,
    taskId: string,
    _params?: Record<string, unknown>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.bridge.removeListener('message', handler);
        // タイムアウト時は処理継続（次のステップへ）
        resolve(`[Layer ${layerId}: タスク実行中 - タイムアウトのため次ステップへ]`);
      }, 5 * 60 * 1000);

      const handler = (msg: any) => {
        if (
          msg.fromLayer === layerId &&
          msg.type === 'task:result' &&
          (msg.payload as any)?.taskId === taskId
        ) {
          clearTimeout(timeout);
          this.bridge.removeListener('message', handler);
          const payload = msg.payload as any;
          if (payload.success) {
            resolve(payload.output || `Layer ${layerId} task complete`);
          } else {
            reject(new Error(payload.error || 'Task failed'));
          }
        }
      };

      this.bridge.on('message', handler);

      // キャンセル監視
      const cancelCheck = setInterval(() => {
        if (this.cancelRequested) {
          clearTimeout(timeout);
          clearInterval(cancelCheck);
          this.bridge.removeListener('message', handler);
          reject(new Error('Cancelled'));
        }
      }, 500);
    });
  }

  // ─── フォーメーション情報 ─────────────────────────

  listFormations(): Array<{
    type: FormationType;
    name: string;
    description: string;
    minLayers: number;
  }> {
    this._initFormations();
    return Array.from(this.formations.values()).map(f => ({
      type: f.type,
      name: f.name,
      description: f.description,
      minLayers: f.minLayers,
    }));
  }

  getStatus(): FormationStatus {
    return this.currentStatus;
  }

  getHistory(limit = 10): FormationRunResult[] {
    return this.runHistory.slice(-limit);
  }

  // ─── 内部ユーティリティ ────────────────────────────

  private setStatus(status: FormationStatus): void {
    this.currentStatus = status;
    this.emit('status-changed', status);
  }

  private buildSummary(result: FormationRunResult): string {
    const success = result.stepResults.filter(s => s.success).length;
    const total = result.stepResults.length;
    return `${success}/${total}ステップ完了 (${Math.round(
      result.stepResults.reduce((s, r) => s + r.durationMs, 0) / 1000
    )}秒)`;
  }

  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyPath)) {
        this.runHistory = JSON.parse(fs.readFileSync(this.historyPath, 'utf-8'));
      }
    } catch { this.runHistory = []; }
  }

  private addHistory(result: FormationRunResult): void {
    this.runHistory.push(result);
    if (this.runHistory.length > 50) this.runHistory = this.runHistory.slice(-50);
    try {
      fs.writeFileSync(this.historyPath, JSON.stringify(this.runHistory, null, 2));
    } catch { /* ignore */ }
  }
}
