// ============================================================
// Rei-AIOS AGI Layer — Phase 2: Arbitrage Reasoning
// src/agi/arbitrage-reasoning.ts
//
// HFT/アービトラージの概念をAI推論に応用：
//   - 同一タスクに対して複数の推論パス（アプローチ）を並列生成
//   - 各パスの品質・信頼性・速度を評価
//   - 最良の結果を選択（裁定取引のように「最良価格」を取る）
//
// D-FUMT理論との対応：
//   拡散(0→π) = 複数のアプローチを並列展開
//   収縮(π→0) = 最適解に収束
//   中心-周囲 = メイン戦略を中心に、代替戦略を周囲に配置
// ============================================================

import { SubTask, TaskResult, TaskType } from './task-types';

/** 推論パス（1つのアプローチ） */
export interface ReasoningPath {
  id: string;
  approach: string;            // アプローチの説明
  prompt: string;              // LLMに送るプロンプト
  taskType?: TaskType;         // 使用するタスクタイプ（省略時は元タスクと同じ）
  weight: number;              // 重み（0.0〜1.0、高いほど優先）
}

/** 推論パスの実行結果 */
export interface PathResult {
  pathId: string;
  approach: string;
  result: string;
  score: number;               // 品質スコア（0.0〜1.0）
  latency: number;             // 実行時間(ms)
  error?: string;
}

/** Arbitrage判定の結果 */
export interface ArbitrageResult {
  selectedPath: PathResult;
  allPaths: PathResult[];
  reasoning: string;           // 選択理由
  totalLatency: number;
  spreadScore: number;         // パス間の品質差（大きいほどアービトラージ価値大）
}

/** Arbitrage設定 */
export interface ArbitrageConfig {
  maxPaths: number;            // 最大同時推論パス数
  timeoutMs: number;           // 各パスのタイムアウト
  minPaths: number;            // 最低成功パス数（これ未満なら失敗扱い）
  qualityThreshold: number;    // 最低品質スコア
  enableParallel: boolean;     // 並列実行の有効化
}

export const DEFAULT_ARBITRAGE_CONFIG: ArbitrageConfig = {
  maxPaths: 3,
  timeoutMs: 20000,
  minPaths: 1,
  qualityThreshold: 0.3,
  enableParallel: true,
};

/** パス生成用プロンプト */
const PATH_GENERATION_PROMPT = `あなたはRei-AIOSのマルチパス推論エンジンです。
与えられたタスクに対して、複数の異なるアプローチを提案してください。

【ルール】
1. 各アプローチは独立して実行可能であること
2. アプローチ同士は異なる戦略を取ること（同じ方法の言い換えは不要）
3. 各アプローチにweight（確信度0.0〜1.0）を付与
4. 最大3つまで

【出力形式】JSONのみ
{
  "paths": [
    {
      "id": "p1",
      "approach": "直接的なPC操作",
      "prompt": "メモ帳を起動してHelloと入力するReiスクリプトを生成",
      "weight": 0.9
    },
    {
      "id": "p2",
      "approach": "クリップボード経由",
      "prompt": "クリップボードにテキストを設定し、メモ帳にペーストするスクリプトを生成",
      "weight": 0.7
    }
  ]
}`;

/** 品質評価用プロンプト */
const QUALITY_EVAL_PROMPT = `与えられた回答の品質を0.0〜1.0で評価してください。

【評価基準】
- 正確性: 技術的に正しいか (40%)
- 完全性: 必要な情報が含まれているか (30%)
- 実行可能性: 実際に実行できるか (30%)

【出力形式】JSONのみ
{ "score": 0.85, "reason": "技術的に正確だが一部の手順が省略されている" }`;

/**
 * ArbitrageReasoning — 複数パス並列推論＋最良選択
 */
export class ArbitrageReasoning {
  private llmCall: (system: string, message: string) => Promise<string>;
  private config: ArbitrageConfig;
  private history: ArbitrageResult[] = [];

  constructor(
    llmCall: (system: string, message: string) => Promise<string>,
    config?: Partial<ArbitrageConfig>
  ) {
    this.llmCall = llmCall;
    this.config = { ...DEFAULT_ARBITRAGE_CONFIG, ...config };
  }

  /**
   * タスクに対して複数の推論パスを生成
   */
  async generatePaths(task: SubTask, context?: string): Promise<ReasoningPath[]> {
    try {
      const input = context
        ? `タスク: ${task.description}\nコンテキスト: ${context}`
        : `タスク: ${task.description}\nタスクタイプ: ${task.type}`;

      const response = await this.llmCall(PATH_GENERATION_PROMPT, input);
      const paths = this.parsePaths(response);

      if (paths && paths.length > 0) {
        return paths.slice(0, this.config.maxPaths);
      }
    } catch (e) {
      console.error('[Arbitrage] パス生成失敗:', e);
    }

    // フォールバック: デフォルトパスを返す
    return this.defaultPaths(task);
  }

  /**
   * 複数パスを並列（または逐次）実行し、最良の結果を選択
   */
  async execute(
    task: SubTask,
    paths: ReasoningPath[],
    executeFn?: (path: ReasoningPath) => Promise<string>
  ): Promise<ArbitrageResult> {
    const totalStart = Date.now();

    // 実行関数（デフォルトはLLM直接呼び出し）
    const runPath = executeFn || (async (path: ReasoningPath) => {
      return await this.llmCall(
        `以下のアプローチで回答してください: ${path.approach}`,
        path.prompt
      );
    });

    // パスを実行
    let pathResults: PathResult[];

    if (this.config.enableParallel) {
      // 並列実行
      pathResults = await this.executeParallel(paths, runPath);
    } else {
      // 逐次実行
      pathResults = await this.executeSequential(paths, runPath);
    }

    // エラーのみのパスを除外
    const validResults = pathResults.filter(r => !r.error);

    if (validResults.length < this.config.minPaths) {
      // 成功パスが足りない場合、エラー含めて最良を返す
      const best = pathResults.sort((a, b) => b.score - a.score)[0];
      return {
        selectedPath: best || {
          pathId: 'fallback',
          approach: 'フォールバック',
          result: '',
          score: 0,
          latency: 0,
          error: '全パスが失敗'
        },
        allPaths: pathResults,
        reasoning: '十分な成功パスが得られませんでした',
        totalLatency: Date.now() - totalStart,
        spreadScore: 0,
      };
    }

    // 品質スコアでソート
    validResults.sort((a, b) => b.score - a.score);

    // スプレッド計算（最高スコアと最低スコアの差）
    const spreadScore = validResults.length > 1
      ? validResults[0].score - validResults[validResults.length - 1].score
      : 0;

    const selected = validResults[0];

    // 選択理由の生成
    const reasoning = this.buildReasoning(selected, validResults);

    const result: ArbitrageResult = {
      selectedPath: selected,
      allPaths: pathResults,
      reasoning,
      totalLatency: Date.now() - totalStart,
      spreadScore,
    };

    this.history.push(result);
    return result;
  }

  /**
   * 簡易実行: パス生成→実行→選択 を一気に行う
   */
  async reason(task: SubTask, context?: string): Promise<ArbitrageResult> {
    const paths = await this.generatePaths(task, context);
    return await this.execute(task, paths);
  }

  /**
   * 並列実行
   */
  private async executeParallel(
    paths: ReasoningPath[],
    runFn: (path: ReasoningPath) => Promise<string>
  ): Promise<PathResult[]> {
    const promises = paths.map(async (path): Promise<PathResult> => {
      const start = Date.now();
      try {
        const result = await this.withTimeout(runFn(path), this.config.timeoutMs);
        const score = await this.evaluateQuality(path, result);
        return {
          pathId: path.id,
          approach: path.approach,
          result,
          score: score * path.weight,
          latency: Date.now() - start,
        };
      } catch (e: any) {
        return {
          pathId: path.id,
          approach: path.approach,
          result: '',
          score: 0,
          latency: Date.now() - start,
          error: e.message || String(e),
        };
      }
    });

    return await Promise.all(promises);
  }

  /**
   * 逐次実行（API制限がある場合）
   */
  private async executeSequential(
    paths: ReasoningPath[],
    runFn: (path: ReasoningPath) => Promise<string>
  ): Promise<PathResult[]> {
    const results: PathResult[] = [];

    for (const path of paths) {
      const start = Date.now();
      try {
        const result = await this.withTimeout(runFn(path), this.config.timeoutMs);
        const score = await this.evaluateQuality(path, result);
        results.push({
          pathId: path.id,
          approach: path.approach,
          result,
          score: score * path.weight,
          latency: Date.now() - start,
        });
      } catch (e: any) {
        results.push({
          pathId: path.id,
          approach: path.approach,
          result: '',
          score: 0,
          latency: Date.now() - start,
          error: e.message || String(e),
        });
      }
    }

    return results;
  }

  /**
   * 結果の品質評価
   */
  private async evaluateQuality(path: ReasoningPath, result: string): Promise<number> {
    // 空結果は低スコア
    if (!result || result.trim().length === 0) return 0.1;

    // 短すぎる結果も低スコア
    if (result.trim().length < 10) return 0.2;

    try {
      const evalInput = `アプローチ: ${path.approach}\n回答:\n${result.substring(0, 1000)}`;
      const evalResponse = await this.llmCall(QUALITY_EVAL_PROMPT, evalInput);

      const scoreMatch = evalResponse.match(/"score"\s*:\s*([\d.]+)/);
      if (scoreMatch) {
        const score = parseFloat(scoreMatch[1]);
        return Math.min(1.0, Math.max(0.0, score));
      }
    } catch {
      // 評価失敗時はヒューリスティック
    }

    // ヒューリスティック評価
    return this.heuristicScore(result);
  }

  /**
   * ヒューリスティック品質スコア（LLM評価のフォールバック）
   */
  private heuristicScore(result: string): number {
    let score = 0.5;

    // 長さによるボーナス（適度な長さが高評価）
    const len = result.trim().length;
    if (len >= 50 && len <= 2000) score += 0.1;
    if (len >= 100 && len <= 1000) score += 0.1;

    // コードブロックの存在（コード生成タスクに有用）
    if (result.includes('```') || result.includes('click(') || result.includes('launch(')) {
      score += 0.1;
    }

    // JSON構造の存在（構造化出力に有用）
    if (result.includes('{') && result.includes('}')) {
      score += 0.05;
    }

    // エラーメッセージの存在はマイナス
    if (result.toLowerCase().includes('error') || result.includes('エラー')) {
      score -= 0.2;
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * デフォルトの推論パス生成（LLMパス生成失敗時のフォールバック）
   */
  private defaultPaths(task: SubTask): ReasoningPath[] {
    return [
      {
        id: 'p_direct',
        approach: '直接実行',
        prompt: task.description,
        weight: 0.9,
      },
      {
        id: 'p_step_by_step',
        approach: 'ステップバイステップ',
        prompt: `以下のタスクをステップバイステップで実行してください:\n${task.description}`,
        weight: 0.7,
      },
      {
        id: 'p_alternative',
        approach: '代替アプローチ',
        prompt: `以下のタスクを別の方法で達成してください:\n${task.description}`,
        weight: 0.5,
      },
    ];
  }

  /**
   * 選択理由の生成
   */
  private buildReasoning(selected: PathResult, allResults: PathResult[]): string {
    const lines: string[] = [];
    lines.push(`選択: "${selected.approach}" (スコア: ${selected.score.toFixed(2)}, ${selected.latency}ms)`);

    if (allResults.length > 1) {
      lines.push(`比較:`);
      for (const r of allResults) {
        const marker = r.pathId === selected.pathId ? '→' : '  ';
        lines.push(`${marker} ${r.approach}: ${r.score.toFixed(2)} (${r.latency}ms)${r.error ? ` [ERROR: ${r.error}]` : ''}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * タイムアウト付きPromise
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`タイムアウト (${ms}ms)`)), ms);
      promise
        .then(val => { clearTimeout(timer); resolve(val); })
        .catch(err => { clearTimeout(timer); reject(err); });
    });
  }

  /**
   * LLM応答からパスをパース
   */
  private parsePaths(raw: string): ReasoningPath[] | null {
    try {
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;
      const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!braceMatch) return null;

      const parsed = JSON.parse(braceMatch[0]);
      if (!parsed.paths || !Array.isArray(parsed.paths)) return null;

      return parsed.paths
        .filter((p: any) => p.id && p.approach && p.prompt)
        .map((p: any) => ({
          id: p.id,
          approach: p.approach,
          prompt: p.prompt,
          taskType: p.taskType,
          weight: typeof p.weight === 'number' ? p.weight : 0.5,
        }));
    } catch {
      return null;
    }
  }

  /** 履歴取得 */
  getHistory(): ArbitrageResult[] {
    return [...this.history];
  }

  /** 統計 */
  getStats(): {
    totalExecutions: number;
    avgSpread: number;
    avgPathCount: number;
    avgLatency: number;
  } {
    const total = this.history.length;
    if (total === 0) return { totalExecutions: 0, avgSpread: 0, avgPathCount: 0, avgLatency: 0 };

    const avgSpread = this.history.reduce((s, r) => s + r.spreadScore, 0) / total;
    const avgPaths = this.history.reduce((s, r) => s + r.allPaths.length, 0) / total;
    const avgLatency = this.history.reduce((s, r) => s + r.totalLatency, 0) / total;

    return { totalExecutions: total, avgSpread, avgPathCount: avgPaths, avgLatency };
  }
}
