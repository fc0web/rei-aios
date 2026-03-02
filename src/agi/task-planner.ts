// ============================================================
// Rei-AIOS AGI Layer — Phase 1: Task Planner
// src/agi/task-planner.ts
//
// ユーザーの自然言語指示をサブタスクに自動分解する。
// 既存の converter.ts と同じ Claude API を利用。
// ============================================================

import {
  SubTask, TaskPlan, TaskType, PlannerResponse, AGIConfig, DEFAULT_AGI_CONFIG
} from './task-types';

/** タスク分解用のシステムプロンプト */
const PLANNER_SYSTEM_PROMPT = `あなたはRei-AIOSのタスク分解エンジンです。
ユーザーの指示を、実行可能なサブタスクに分解してください。

【タスクタイプ一覧】
- search: Web検索またはローカルファイル検索
- file_op: ファイルの読み書き・編集・コピー
- browser: ブラウザ操作（URL開く等）
- compute: 計算・データ処理・分析
- summarize: 情報の要約・整理・レポート作成
- code_gen: コード生成（Rei言語・TypeScript等）
- automation: PC自動化（クリック・キー入力・アプリ操作）
- excel: Excel操作（セル読み書き・書式設定）
- vision: 画面認識・スクリーンショット・OCR

【ルール】
1. サブタスクは最小単位に分解すること（1タスク=1アクション）
2. 依存関係がある場合はdependenciesに先行タスクIDを指定
3. 並行実行可能なタスクはdependenciesを空にする
4. idは "t1", "t2", "t3" の形式
5. 最大10個までに収める
6. 単純な指示（1ステップで完了するもの）は1個のタスクでよい

【出力形式】JSONのみ（説明文不要）
{
  "subtasks": [
    {
      "id": "t1",
      "type": "search",
      "description": "D-FUMTの最新動向を検索",
      "dependencies": []
    },
    {
      "id": "t2",
      "type": "summarize",
      "description": "検索結果を500文字以内で要約",
      "dependencies": ["t1"]
    }
  ]
}`;

/**
 * TaskPlanner — 自然言語をサブタスクに分解
 *
 * 既存の LLM インフラ（llm-manager.ts）を利用する設計。
 * llmCall は外部から注入するため、特定のLLMに依存しない。
 */
export class TaskPlanner {
  private config: AGIConfig;
  private llmCall: (system: string, message: string) => Promise<string>;

  /**
   * @param llmCall — LLM呼び出し関数。既存の converter.ts や llm-manager.ts の
   *                  API呼び出し部分をそのまま渡せる。
   *                  signature: (systemPrompt, userMessage) => responseText
   * @param config — AGI設定（省略時はデフォルト）
   */
  constructor(
    llmCall: (system: string, message: string) => Promise<string>,
    config?: Partial<AGIConfig>
  ) {
    this.llmCall = llmCall;
    this.config = { ...DEFAULT_AGI_CONFIG, ...config };
  }

  /**
   * ユーザーの指示をタスク計画に分解
   */
  async plan(userQuery: string): Promise<TaskPlan> {
    const planId = `plan_${Date.now()}`;

    // 単純な指示かどうかを判定（LLMを使わずに済むケース）
    const simplePlan = this.trySimplePlan(userQuery, planId);
    if (simplePlan) {
      return simplePlan;
    }

    // LLMにタスク分解を依頼
    try {
      const response = await this.llmCall(PLANNER_SYSTEM_PROMPT, userQuery);
      const parsed = this.parseResponse(response);

      if (!parsed || parsed.subtasks.length === 0) {
        // パース失敗時は単一タスクとして扱う
        return this.createSingleTaskPlan(planId, userQuery);
      }

      // サブタスク数の制限
      const limited = parsed.subtasks.slice(0, this.config.maxSubtasks);

      const subtasks: SubTask[] = limited.map(st => ({
        id: st.id,
        type: st.type,
        description: st.description,
        dependencies: st.dependencies,
        status: 'pending',
        retryCount: 0
      }));

      return {
        id: planId,
        originalQuery: userQuery,
        subtasks,
        createdAt: Date.now(),
        status: 'planning'
      };

    } catch (error) {
      console.error('[AGI Planner] LLM呼び出し失敗:', error);
      // フォールバック: 単一タスクとして扱う
      return this.createSingleTaskPlan(planId, userQuery);
    }
  }

  /**
   * LLM応答のJSON部分を抽出・パース
   */
  private parseResponse(raw: string): PlannerResponse | null {
    try {
      // ```json ... ``` で囲まれている場合に対応
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;

      // JSON部分を抽出（{ から最後の } まで）
      const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!braceMatch) return null;

      const parsed = JSON.parse(braceMatch[0]);

      // バリデーション
      if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) return null;

      const validTypes: TaskType[] = [
        'search', 'file_op', 'browser', 'compute',
        'summarize', 'code_gen', 'automation', 'excel', 'vision'
      ];

      // 不正なタスクタイプをフィルタリング
      parsed.subtasks = parsed.subtasks.filter((st: any) =>
        st.id && st.type && st.description &&
        validTypes.includes(st.type) &&
        Array.isArray(st.dependencies)
      );

      return parsed as PlannerResponse;
    } catch {
      return null;
    }
  }

  /**
   * 単純な指示をLLMなしで判定
   * （API呼び出しコストを削減）
   */
  private trySimplePlan(query: string, planId: string): TaskPlan | null {
    const q = query.trim();

    // パターンマッチで単純タスクを検出
    const patterns: { regex: RegExp; type: TaskType }[] = [
      // Excel操作
      { regex: /^excel[_\s]|セルに|エクセル/i, type: 'excel' },
      // スクリーンショット
      { regex: /スクリーンショット|キャプチャ|screen_capture/i, type: 'vision' },
      // ファイル操作
      { regex: /ファイルを(開|作成|コピー|削除|移動)/i, type: 'file_op' },
      // 単純なPC操作
      { regex: /^(click|クリック|type|入力|launch|起動)/i, type: 'automation' },
    ];

    for (const { regex, type } of patterns) {
      if (regex.test(q)) {
        return {
          id: planId,
          originalQuery: query,
          subtasks: [{
            id: 't1',
            type,
            description: query,
            dependencies: [],
            status: 'pending',
            retryCount: 0
          }],
          createdAt: Date.now(),
          status: 'planning'
        };
      }
    }

    return null; // パターンに該当しない → LLMに任せる
  }

  /**
   * フォールバック: 単一タスクのプランを生成
   */
  private createSingleTaskPlan(planId: string, query: string): TaskPlan {
    return {
      id: planId,
      originalQuery: query,
      subtasks: [{
        id: 't1',
        type: 'automation',
        description: query,
        dependencies: [],
        status: 'pending',
        retryCount: 0
      }],
      createdAt: Date.now(),
      status: 'planning'
    };
  }
}
