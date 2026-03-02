// ============================================================
// Rei-AIOS AGI Layer — Phase 2: Self-Repair Engine
// src/agi/self-repair.ts
//
// タスク失敗時に、単純リトライではなく：
//   1. エラー原因をLLMで分析
//   2. 代替アプローチを自動生成
//   3. 修正されたタスクで再実行
//
// D-FUMT理論の「拡散-収縮」パターンに基づく設計：
//   拡散 = 複数の修復候補を生成
//   収縮 = 最も成功率の高い候補を選択・実行
// ============================================================

import { SubTask, TaskPlan, TaskResult, TaskType } from './task-types';

/** 修復戦略の種類 */
export type RepairStrategy =
  | 'retry_same'       // 同一手法でリトライ（一時的エラー向け）
  | 'modify_params'    // パラメータ変更で再試行
  | 'alternative_type' // タスクタイプを変更（例: automation → code_gen）
  | 'decompose'        // さらに細かく分解
  | 'skip_with_fallback' // スキップして代替データで続行
  | 'escalate';        // 修復不能、ユーザーに委任

/** エラー分析の結果 */
export interface ErrorAnalysis {
  category: 'transient' | 'logic' | 'resource' | 'permission' | 'unknown';
  rootCause: string;
  strategies: RepairCandidate[];
  confidence: number;           // 0.0〜1.0 修復成功の確信度
}

/** 修復候補 */
export interface RepairCandidate {
  strategy: RepairStrategy;
  description: string;
  modifiedTask?: Partial<SubTask>;  // タスクの修正内容
  newSubtasks?: SubTask[];          // 分解の場合の新タスク群
  priority: number;                 // 1=最優先, 数値が大きいほど低優先
}

/** 修復実行の結果 */
export interface RepairResult {
  originalError: string;
  analysis: ErrorAnalysis;
  appliedStrategy: RepairStrategy;
  success: boolean;
  taskResult?: TaskResult;
  repairDuration: number;           // 修復にかかった時間(ms)
}

/** 修復履歴エントリ */
export interface RepairLogEntry {
  timestamp: number;
  planId: string;
  taskId: string;
  originalError: string;
  strategy: RepairStrategy;
  success: boolean;
  duration: number;
}

/** エラー分析用システムプロンプト */
const ERROR_ANALYSIS_PROMPT = `あなたはRei-AIOSの自己修復エンジンです。
タスク実行エラーを分析し、修復戦略を提案してください。

【エラーカテゴリ】
- transient: 一時的エラー（タイムアウト、接続失敗）→ リトライで解決可能
- logic: ロジックエラー（不正な操作、存在しないウィンドウ）→ アプローチ変更が必要
- resource: リソースエラー（ファイル不在、メモリ不足）→ 前提条件の確認が必要
- permission: 権限エラー（管理者権限、API制限）→ 代替手段が必要
- unknown: 不明 → 複数戦略を試す

【修復戦略】
- retry_same: 同じ方法でリトライ（transientエラー向け）
- modify_params: パラメータや説明文を修正してリトライ
- alternative_type: タスクタイプを変更（例: automation → code_gen）
- decompose: タスクをさらに細かいステップに分解
- skip_with_fallback: このタスクをスキップし、代替データで後続タスクを実行
- escalate: 自動修復不可能、ユーザーに確認を求める

【出力形式】JSONのみ
{
  "category": "logic",
  "rootCause": "メモ帳が起動していない状態でテキスト入力を試みた",
  "confidence": 0.8,
  "strategies": [
    {
      "strategy": "decompose",
      "description": "メモ帳の起動とテキスト入力を分離する",
      "priority": 1
    },
    {
      "strategy": "modify_params",
      "description": "launch('notepad')を先に実行するよう説明を修正",
      "priority": 2
    }
  ]
}`;

/**
 * SelfRepairEngine — タスク失敗時の自動修復
 */
export class SelfRepairEngine {
  private llmCall: (system: string, message: string) => Promise<string>;
  private maxRepairAttempts: number;
  private repairLog: RepairLogEntry[] = [];

  constructor(
    llmCall: (system: string, message: string) => Promise<string>,
    maxRepairAttempts: number = 3
  ) {
    this.llmCall = llmCall;
    this.maxRepairAttempts = maxRepairAttempts;
  }

  /**
   * エラーを分析し、修復戦略を提案
   */
  async analyze(
    task: SubTask,
    error: string,
    plan: TaskPlan,
    previousResults: Map<string, TaskResult>
  ): Promise<ErrorAnalysis> {
    // コンテキスト情報を構築
    const context = this.buildErrorContext(task, error, plan, previousResults);

    try {
      const response = await this.llmCall(ERROR_ANALYSIS_PROMPT, context);
      const analysis = this.parseAnalysis(response);

      if (analysis) {
        return analysis;
      }
    } catch (e) {
      console.error('[SelfRepair] LLM分析失敗:', e);
    }

    // LLM分析失敗時のフォールバック
    return this.heuristicAnalysis(task, error);
  }

  /**
   * 修復戦略を適用してタスクを修正
   */
  applyStrategy(
    task: SubTask,
    candidate: RepairCandidate
  ): { modifiedTask: SubTask; newTasks?: SubTask[] } {
    switch (candidate.strategy) {
      case 'retry_same':
        // タスクをそのまま返す（リトライ）
        return {
          modifiedTask: {
            ...task,
            status: 'pending',
            error: undefined,
            retryCount: task.retryCount + 1,
          }
        };

      case 'modify_params':
        // 説明文やパラメータを修正
        return {
          modifiedTask: {
            ...task,
            ...candidate.modifiedTask,
            status: 'pending',
            error: undefined,
            retryCount: task.retryCount + 1,
          }
        };

      case 'alternative_type':
        // タスクタイプを変更
        return {
          modifiedTask: {
            ...task,
            type: candidate.modifiedTask?.type || task.type,
            description: candidate.modifiedTask?.description || task.description,
            status: 'pending',
            error: undefined,
            retryCount: 0, // 別タイプなのでリセット
          }
        };

      case 'decompose':
        // サブタスクを分解
        if (candidate.newSubtasks && candidate.newSubtasks.length > 0) {
          return {
            modifiedTask: { ...task, status: 'skipped' },
            newTasks: candidate.newSubtasks
          };
        }
        // 分解データがない場合はリトライにフォールバック
        return {
          modifiedTask: { ...task, status: 'pending', retryCount: task.retryCount + 1 }
        };

      case 'skip_with_fallback':
        // スキップ（後続タスクにフォールバックデータを提供）
        return {
          modifiedTask: {
            ...task,
            status: 'done',
            result: { fallback: true, message: candidate.description }
          }
        };

      case 'escalate':
      default:
        // 修復不能、失敗のまま
        return {
          modifiedTask: {
            ...task,
            status: 'failed',
            error: `自動修復不可: ${candidate.description}`
          }
        };
    }
  }

  /**
   * 修復サイクル全体を実行
   * analyze → select best strategy → apply → return
   */
  async repair(
    task: SubTask,
    error: string,
    plan: TaskPlan,
    previousResults: Map<string, TaskResult>
  ): Promise<RepairResult> {
    const start = Date.now();

    // 修復回数チェック
    if (task.retryCount >= this.maxRepairAttempts) {
      const analysis: ErrorAnalysis = {
        category: 'unknown',
        rootCause: `最大修復回数(${this.maxRepairAttempts})到達`,
        strategies: [{
          strategy: 'escalate',
          description: '修復回数上限に達しました',
          priority: 1
        }],
        confidence: 0
      };

      this.logRepair(plan.id, task.id, error, 'escalate', false, Date.now() - start);

      return {
        originalError: error,
        analysis,
        appliedStrategy: 'escalate',
        success: false,
        repairDuration: Date.now() - start
      };
    }

    // エラー分析
    const analysis = await this.analyze(task, error, plan, previousResults);

    // 最優先の戦略を選択
    const bestStrategy = analysis.strategies
      .sort((a, b) => a.priority - b.priority)[0];

    if (!bestStrategy || bestStrategy.strategy === 'escalate') {
      this.logRepair(plan.id, task.id, error, 'escalate', false, Date.now() - start);
      return {
        originalError: error,
        analysis,
        appliedStrategy: 'escalate',
        success: false,
        repairDuration: Date.now() - start
      };
    }

    // 戦略を適用
    const { modifiedTask, newTasks } = this.applyStrategy(task, bestStrategy);

    // タスクを更新
    Object.assign(task, modifiedTask);

    const success = (bestStrategy.strategy as string) !== 'escalate';
    this.logRepair(plan.id, task.id, error, bestStrategy.strategy, success, Date.now() - start);

    return {
      originalError: error,
      analysis,
      appliedStrategy: bestStrategy.strategy,
      success,
      repairDuration: Date.now() - start
    };
  }

  /**
   * エラーコンテキストの構築（LLM入力用）
   */
  private buildErrorContext(
    task: SubTask,
    error: string,
    plan: TaskPlan,
    previousResults: Map<string, TaskResult>
  ): string {
    const lines: string[] = [];
    lines.push(`【失敗したタスク】`);
    lines.push(`  ID: ${task.id}`);
    lines.push(`  タイプ: ${task.type}`);
    lines.push(`  説明: ${task.description}`);
    lines.push(`  リトライ回数: ${task.retryCount}`);
    lines.push(`  エラー: ${error}`);
    lines.push(``);
    lines.push(`【プラン全体】`);
    lines.push(`  元の指示: ${plan.originalQuery}`);
    lines.push(`  サブタスク数: ${plan.subtasks.length}`);
    lines.push(``);

    // 先行タスクの結果
    if (task.dependencies.length > 0) {
      lines.push(`【依存タスクの結果】`);
      for (const depId of task.dependencies) {
        const depResult = previousResults.get(depId);
        if (depResult) {
          lines.push(`  ${depId}: ${depResult.success ? '成功' : '失敗'} - ${
            typeof depResult.data === 'string'
              ? depResult.data.substring(0, 200)
              : JSON.stringify(depResult.data)?.substring(0, 200) || '(データなし)'
          }`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * LLM応答の解析
   */
  private parseAnalysis(raw: string): ErrorAnalysis | null {
    try {
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;
      const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!braceMatch) return null;

      const parsed = JSON.parse(braceMatch[0]);

      if (!parsed.category || !parsed.strategies || !Array.isArray(parsed.strategies)) {
        return null;
      }

      return {
        category: parsed.category,
        rootCause: parsed.rootCause || '不明',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        strategies: parsed.strategies.map((s: any) => ({
          strategy: s.strategy || 'retry_same',
          description: s.description || '',
          priority: typeof s.priority === 'number' ? s.priority : 99,
          modifiedTask: s.modifiedTask,
          newSubtasks: s.newSubtasks,
        }))
      };
    } catch {
      return null;
    }
  }

  /**
   * LLM不使用のヒューリスティック分析（フォールバック）
   */
  private heuristicAnalysis(task: SubTask, error: string): ErrorAnalysis {
    const errLower = error.toLowerCase();

    // タイムアウト → リトライ
    if (errLower.includes('timeout') || errLower.includes('タイムアウト')) {
      return {
        category: 'transient',
        rootCause: 'タイムアウト',
        confidence: 0.7,
        strategies: [
          { strategy: 'retry_same', description: 'タイムアウト: リトライで解決可能性あり', priority: 1 },
          { strategy: 'modify_params', description: 'タイムアウト時間の延長', priority: 2 },
        ]
      };
    }

    // 接続エラー → リトライ
    if (errLower.includes('econnrefused') || errLower.includes('network') || errLower.includes('接続')) {
      return {
        category: 'transient',
        rootCause: '接続エラー',
        confidence: 0.6,
        strategies: [
          { strategy: 'retry_same', description: 'ネットワーク一時的障害の可能性', priority: 1 },
          { strategy: 'skip_with_fallback', description: 'オフラインフォールバック', priority: 2 },
        ]
      };
    }

    // ウィンドウ/プロセス関連 → 分解
    if (errLower.includes('window') || errLower.includes('ウィンドウ') || errLower.includes('プロセス')) {
      return {
        category: 'logic',
        rootCause: '対象ウィンドウが見つからない',
        confidence: 0.6,
        strategies: [
          { strategy: 'decompose', description: 'アプリ起動とウィンドウ操作を分離', priority: 1 },
          { strategy: 'modify_params', description: 'ウィンドウ名の修正', priority: 2 },
        ]
      };
    }

    // ファイル関連 → リソースエラー
    if (errLower.includes('enoent') || errLower.includes('ファイル') || errLower.includes('not found')) {
      return {
        category: 'resource',
        rootCause: 'ファイルが見つからない',
        confidence: 0.7,
        strategies: [
          { strategy: 'modify_params', description: 'ファイルパスの修正', priority: 1 },
          { strategy: 'skip_with_fallback', description: 'ファイル不在のまま続行', priority: 2 },
        ]
      };
    }

    // ハンドラ未登録 → タイプ変更
    if (errLower.includes('ハンドラ未登録') || errLower.includes('handler')) {
      return {
        category: 'logic',
        rootCause: 'タスクタイプに対応するハンドラがない',
        confidence: 0.8,
        strategies: [
          { strategy: 'alternative_type', description: '汎用タイプ(automation)に変更', priority: 1 },
          { strategy: 'escalate', description: 'ハンドラの追加が必要', priority: 2 },
        ]
      };
    }

    // 権限系
    if (errLower.includes('permission') || errLower.includes('denied') || errLower.includes('権限')) {
      return {
        category: 'permission',
        rootCause: '権限不足',
        confidence: 0.5,
        strategies: [
          { strategy: 'alternative_type', description: '別のアプローチで回避', priority: 1 },
          { strategy: 'escalate', description: 'ユーザーに管理者権限実行を依頼', priority: 2 },
        ]
      };
    }

    // 判定不能
    return {
      category: 'unknown',
      rootCause: error.substring(0, 200),
      confidence: 0.3,
      strategies: [
        { strategy: 'retry_same', description: '原因不明: リトライを試行', priority: 1 },
        { strategy: 'modify_params', description: 'タスク説明を具体化してリトライ', priority: 2 },
        { strategy: 'escalate', description: 'ユーザーに確認', priority: 3 },
      ]
    };
  }

  /**
   * 修復ログ記録
   */
  private logRepair(
    planId: string, taskId: string, error: string,
    strategy: RepairStrategy, success: boolean, duration: number
  ): void {
    this.repairLog.push({
      timestamp: Date.now(), planId, taskId,
      originalError: error, strategy, success, duration
    });
  }

  /** 修復ログ取得 */
  getRepairLog(): RepairLogEntry[] {
    return [...this.repairLog];
  }

  /** 修復統計 */
  getStats(): {
    totalRepairs: number;
    successRate: number;
    byStrategy: Record<RepairStrategy, { count: number; successCount: number }>;
  } {
    const stats: Record<RepairStrategy, { count: number; successCount: number }> = {
      retry_same: { count: 0, successCount: 0 },
      modify_params: { count: 0, successCount: 0 },
      alternative_type: { count: 0, successCount: 0 },
      decompose: { count: 0, successCount: 0 },
      skip_with_fallback: { count: 0, successCount: 0 },
      escalate: { count: 0, successCount: 0 },
    };

    for (const entry of this.repairLog) {
      const s = stats[entry.strategy];
      if (s) {
        s.count++;
        if (entry.success) s.successCount++;
      }
    }

    const total = this.repairLog.length;
    const successCount = this.repairLog.filter(e => e.success).length;

    return {
      totalRepairs: total,
      successRate: total > 0 ? successCount / total : 0,
      byStrategy: stats
    };
  }
}
