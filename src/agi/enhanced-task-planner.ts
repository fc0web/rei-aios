/**
 * EnhancedTaskPlanner — 長期計画エンジンの強化
 *
 * 既存 TaskPlanner を拡張し、多ステップ計画の
 * 七価論理による不確実性管理を実現する。
 *
 * 機能:
 *   1. 多ステップ計画の不確実性を七価論理で評価
 *   2. 計画の各ステップに確信度（七価）を付与
 *   3. 計画全体の実現可能性をAND合成で算出
 *   4. 条件分岐（BOTH: 矛盾許容、FLOWING: 動的再計画）
 *   5. 計画の自動修正（失敗ステップの再計画）
 */

import {
  SubTask, TaskPlan, TaskType, TaskStatus, AGIConfig, DEFAULT_AGI_CONFIG
} from './task-types';
import { type SevenLogicValue, and } from '../axiom-os/seven-logic';

// ── 型定義 ─────────────────────────────────────────────

export interface EnhancedSubTask extends SubTask {
  confidence:    SevenLogicValue;   // このステップの確信度
  riskLevel:     'low' | 'medium' | 'high';
  alternatives:  string[];          // 代替手段
}

export interface EnhancedTaskPlan extends TaskPlan {
  subtasks:      EnhancedSubTask[];
  overallConfidence: SevenLogicValue;
  feasibility:   number;            // 0.0〜1.0
  riskSummary:   string;
}

export interface PlanEvaluation {
  planId:        string;
  overallConfidence: SevenLogicValue;
  feasibility:   number;
  stepAnalysis:  StepAnalysis[];
  recommendations: string[];
}

export interface StepAnalysis {
  taskId:        string;
  confidence:    SevenLogicValue;
  risk:          'low' | 'medium' | 'high';
  reason:        string;
}

// ── 不確実性評価ルール ──────────────────────────────────

interface UncertaintyRule {
  type:        TaskType;
  defaultConf: SevenLogicValue;
  risk:        'low' | 'medium' | 'high';
  reason:      string;
}

const UNCERTAINTY_RULES: UncertaintyRule[] = [
  { type: 'compute',     defaultConf: 'TRUE',     risk: 'low',    reason: '計算は決定的で確実' },
  { type: 'file_op',     defaultConf: 'TRUE',     risk: 'low',    reason: 'ファイル操作は確実' },
  { type: 'code_gen',    defaultConf: 'FLOWING',  risk: 'medium', reason: 'コード生成は文脈依存' },
  { type: 'summarize',   defaultConf: 'FLOWING',  risk: 'medium', reason: '要約は解釈依存' },
  { type: 'search',      defaultConf: 'FLOWING',  risk: 'medium', reason: '検索結果は変動する' },
  { type: 'browser',     defaultConf: 'BOTH',     risk: 'high',   reason: 'Web操作は外部依存' },
  { type: 'automation',  defaultConf: 'BOTH',     risk: 'high',   reason: '自動化は環境依存' },
  { type: 'excel',       defaultConf: 'FLOWING',  risk: 'medium', reason: 'Excel操作は状態依存' },
  { type: 'vision',      defaultConf: 'BOTH',     risk: 'high',   reason: '画面認識は不確実' },
];

// ── EnhancedTaskPlanner ────────────────────────────────

export class EnhancedTaskPlanner {
  private config: AGIConfig;

  constructor(config?: Partial<AGIConfig>) {
    this.config = { ...DEFAULT_AGI_CONFIG, ...config };
  }

  /**
   * 既存のTaskPlanを七価論理で強化する
   */
  enhance(plan: TaskPlan): EnhancedTaskPlan {
    const enhancedTasks = plan.subtasks.map(task => this.enhanceTask(task, plan));

    // 全ステップの確信度をAND合成
    let overallConfidence: SevenLogicValue = enhancedTasks.length > 0
      ? enhancedTasks[0].confidence
      : 'ZERO';
    for (let i = 1; i < enhancedTasks.length; i++) {
      overallConfidence = and(overallConfidence, enhancedTasks[i].confidence);
    }

    const feasibility = this.calcFeasibility(enhancedTasks);
    const riskSummary = this.buildRiskSummary(enhancedTasks, overallConfidence, feasibility);

    return {
      ...plan,
      subtasks: enhancedTasks,
      overallConfidence,
      feasibility,
      riskSummary,
    };
  }

  /**
   * 計画を詳細に評価する
   */
  evaluate(plan: TaskPlan): PlanEvaluation {
    const enhanced = this.enhance(plan);
    const stepAnalysis = enhanced.subtasks.map(task => ({
      taskId: task.id,
      confidence: task.confidence,
      risk: task.riskLevel,
      reason: this.getUncertaintyReason(task.type),
    }));

    const recommendations = this.generateRecommendations(enhanced);

    return {
      planId: plan.id,
      overallConfidence: enhanced.overallConfidence,
      feasibility: enhanced.feasibility,
      stepAnalysis,
      recommendations,
    };
  }

  /**
   * 失敗したステップに基づいて計画を修正する
   */
  replan(plan: EnhancedTaskPlan, failedTaskIds: string[]): EnhancedTaskPlan {
    const updatedTasks = plan.subtasks.map(task => {
      if (failedTaskIds.includes(task.id)) {
        return {
          ...task,
          confidence: 'FALSE' as SevenLogicValue,
          status: 'failed' as TaskStatus,
          riskLevel: 'high' as const,
          alternatives: this.generateAlternatives(task),
        };
      }
      // 失敗タスクに依存するタスクもFLOWINGに
      if (task.dependencies.some(dep => failedTaskIds.includes(dep))) {
        return {
          ...task,
          confidence: 'FLOWING' as SevenLogicValue,
          riskLevel: 'high' as const,
        };
      }
      return task;
    });

    // 全体を再評価
    let overallConfidence: SevenLogicValue = updatedTasks[0]?.confidence ?? 'ZERO';
    for (let i = 1; i < updatedTasks.length; i++) {
      overallConfidence = and(overallConfidence, updatedTasks[i].confidence);
    }

    return {
      ...plan,
      subtasks: updatedTasks,
      overallConfidence,
      feasibility: this.calcFeasibility(updatedTasks),
      riskSummary: this.buildRiskSummary(updatedTasks, overallConfidence, this.calcFeasibility(updatedTasks)),
    };
  }

  /**
   * 自然言語の計画記述から直接 EnhancedTaskPlan を生成
   * （LLM不要のパターンマッチ版）
   */
  planFromDescription(description: string): EnhancedTaskPlan {
    const steps = this.parseSteps(description);
    const subtasks: EnhancedSubTask[] = steps.map((step, i) => {
      const type = this.inferType(step);
      const rule = UNCERTAINTY_RULES.find(r => r.type === type) ?? UNCERTAINTY_RULES[0];
      return {
        id: `t${i + 1}`,
        type,
        description: step,
        dependencies: i > 0 ? [`t${i}`] : [],
        status: 'pending' as TaskStatus,
        retryCount: 0,
        confidence: rule.defaultConf,
        riskLevel: rule.risk,
        alternatives: [],
      };
    });

    let overallConfidence: SevenLogicValue = subtasks.length > 0 ? subtasks[0].confidence : 'ZERO';
    for (let i = 1; i < subtasks.length; i++) {
      overallConfidence = and(overallConfidence, subtasks[i].confidence);
    }
    const feasibility = this.calcFeasibility(subtasks);

    return {
      id: `plan_${Date.now()}`,
      originalQuery: description,
      subtasks,
      createdAt: Date.now(),
      status: 'planning',
      overallConfidence,
      feasibility,
      riskSummary: this.buildRiskSummary(subtasks, overallConfidence, feasibility),
    };
  }

  // ── プライベートメソッド ──

  private enhanceTask(task: SubTask, plan: TaskPlan): EnhancedSubTask {
    const rule = UNCERTAINTY_RULES.find(r => r.type === task.type)
      ?? { defaultConf: 'FLOWING' as SevenLogicValue, risk: 'medium' as const, reason: '未知のタスクタイプ' };

    // 依存関係の数で確信度を調整
    let confidence = rule.defaultConf;
    if (task.dependencies.length > 2) {
      confidence = 'FLOWING'; // 多依存は不確実
    }

    // 失敗済みタスクは FALSE
    if (task.status === 'failed') confidence = 'FALSE';
    if (task.status === 'done') confidence = 'TRUE';

    return {
      ...task,
      confidence,
      riskLevel: rule.risk,
      alternatives: [],
    };
  }

  private calcFeasibility(tasks: EnhancedSubTask[]): number {
    if (tasks.length === 0) return 0;
    const scores: Record<SevenLogicValue, number> = {
      TRUE: 1.0, FLOWING: 0.7, BOTH: 0.5, NEITHER: 0.3,
      INFINITY: 0.2, ZERO: 0.0, FALSE: 0.0,
    };
    const total = tasks.reduce((sum, t) => sum + scores[t.confidence], 0);
    return total / tasks.length;
  }

  private getUncertaintyReason(type: TaskType): string {
    return UNCERTAINTY_RULES.find(r => r.type === type)?.reason ?? '不確実性評価なし';
  }

  private generateAlternatives(task: EnhancedSubTask): string[] {
    const alts: string[] = [];
    if (task.type === 'search') alts.push('別の検索エンジンを使用', 'ローカルキャッシュを参照');
    if (task.type === 'browser') alts.push('APIを直接呼び出し', 'キャッシュされたデータを使用');
    if (task.type === 'automation') alts.push('手動操作に切り替え', 'コマンドラインで代替');
    if (task.type === 'vision') alts.push('テキストベースの判定に切り替え');
    if (alts.length === 0) alts.push('タスクをスキップ', 'リトライ');
    return alts;
  }

  private generateRecommendations(plan: EnhancedTaskPlan): string[] {
    const recs: string[] = [];
    const highRisk = plan.subtasks.filter(t => t.riskLevel === 'high');
    if (highRisk.length > 0) {
      recs.push(`高リスクタスク ${highRisk.length}件: ${highRisk.map(t => t.id).join(', ')}`);
    }
    if (plan.feasibility < 0.5) {
      recs.push('全体の実現可能性が50%未満: 計画の簡素化を推奨');
    }
    if (plan.overallConfidence === 'FALSE' || plan.overallConfidence === 'ZERO') {
      recs.push('計画の再構築が必要: 前提条件を見直してください');
    }
    if (plan.subtasks.length > 7) {
      recs.push('ステップ数が多い: 並列実行可能なタスクの特定を推奨');
    }
    if (recs.length === 0) recs.push('計画は適切です');
    return recs;
  }

  private buildRiskSummary(
    tasks: EnhancedSubTask[],
    overall: SevenLogicValue,
    feasibility: number,
  ): string {
    const high = tasks.filter(t => t.riskLevel === 'high').length;
    const medium = tasks.filter(t => t.riskLevel === 'medium').length;
    const low = tasks.filter(t => t.riskLevel === 'low').length;
    return `リスク評価: 高${high} 中${medium} 低${low} | ` +
      `全体確信度: ${overall} | 実現可能性: ${(feasibility * 100).toFixed(0)}%`;
  }

  private parseSteps(description: string): string[] {
    // 番号付きリスト or 改行区切りを解析
    const numbered = description.match(/\d+[.、）]\s*(.+)/g);
    if (numbered && numbered.length > 1) {
      return numbered.map(s => s.replace(/^\d+[.、）]\s*/, '').trim());
    }
    // 句点区切り
    const sentences = description.split(/[。\n]/).filter(s => s.trim().length > 0);
    return sentences.length > 1 ? sentences.map(s => s.trim()) : [description.trim()];
  }

  private inferType(step: string): TaskType {
    const s = step.toLowerCase();
    if (/検索|search|調べ|探/.test(s)) return 'search';
    if (/ファイル|file|保存|読み込み|書き/.test(s)) return 'file_op';
    if (/ブラウザ|url|web|開く|アクセス/.test(s)) return 'browser';
    if (/計算|compute|分析|数値|集計/.test(s)) return 'compute';
    if (/要約|summarize|まとめ|レポート|整理/.test(s)) return 'summarize';
    if (/コード|code|生成|プログラム|実装/.test(s)) return 'code_gen';
    if (/クリック|入力|操作|自動化/.test(s)) return 'automation';
    if (/excel|エクセル|セル|シート/.test(s)) return 'excel';
    if (/画面|スクリーン|認識|ocr/.test(s)) return 'vision';
    return 'compute'; // デフォルト
  }
}
