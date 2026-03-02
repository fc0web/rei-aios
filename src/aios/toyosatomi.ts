/**
 * Rei AIOS — 豊聡耳モード (Toyosatomi Mode)
 *
 * 聖徳太子の「十人の声を同時に聞く」故事にちなんだ複数AI同時比較システム。
 * 
 * 機能:
 *   - 複数AIへの同時並列問い合わせ（天秤AI相当）
 *   - 豊聡耳ジャッジ（Claude統合回答）
 *   - 役割分担モード（専門特化）
 *   - 表示数選択（2/4/6/10画面）
 *   - SSEストリーミング対応
 */

import { ILLMAdapter, LLMRequest, LLMResponse } from './llm-adapter';

// ─── 型定義 ──────────────────────────────────────────

export type ToyosatomiDisplayCount = 2 | 4 | 6 | 10;

export type ToyosatomiRole =
  | 'general'       // 汎用
  | 'critic'        // 批評・反論
  | 'creative'      // 創造・発散
  | 'logical'       // 論理・分析
  | 'practical'     // 実践・実装
  | 'philosophical'; // 哲学・抽象

export interface ToyosatomiAgent {
  providerId: string;
  providerName: string;
  model: string;
  role: ToyosatomiRole;
  adapter: ILLMAdapter;
}

export interface ToyosatomiPanelResult {
  agent: ToyosatomiAgent;
  response?: LLMResponse;
  streaming?: string;      // ストリーミング中の累積テキスト
  status: 'pending' | 'streaming' | 'done' | 'error';
  error?: string;
  latencyMs?: number;
}

export interface ToyosatomiJudgeResult {
  synthesis: string;       // Claude統合回答
  consensus: string;       // 各AIの合意点
  divergence: string;      // 相違点・対立意見
  recommendation: string;  // 最終推薦
  bestPanel?: string;      // 最も優れた回答のプロバイダーID
}

export interface ToyosatomiSession {
  id: string;
  prompt: string;
  displayCount: ToyosatomiDisplayCount;
  mode: 'comparison' | 'roles' | 'judge';
  panels: ToyosatomiPanelResult[];
  judge?: ToyosatomiJudgeResult;
  startedAt: Date;
  completedAt?: Date;
}

// ─── 役割別システムプロンプト ─────────────────────────

const ROLE_PROMPTS: Record<ToyosatomiRole, string> = {
  general: '',
  critic: 'あなたは批判的思考の専門家です。問題点・リスク・反論を積極的に指摘してください。建設的な批評を心がけてください。',
  creative: 'あなたは創造的思考の専門家です。斬新なアイデア・型破りな発想・可能性の拡張に特化して回答してください。',
  logical: 'あなたは論理分析の専門家です。段階的な推論・数学的厳密さ・因果関係の明確化に特化して回答してください。',
  practical: 'あなたは実践的実装の専門家です。具体的な手順・コード例・即実行可能な解決策に特化して回答してください。',
  philosophical: 'あなたは哲学的思考の専門家です。本質的な問い・概念の定義・存在論的視点から回答してください。',
};

// ─── 豊聡耳エンジン ───────────────────────────────────

export class ToyosatomiEngine {
  private judgeAdapter?: ILLMAdapter; // Claudeが統合役

  constructor(judgeAdapter?: ILLMAdapter) {
    this.judgeAdapter = judgeAdapter;
  }

  /**
   * 複数AIへ同時並列問い合わせ（コールバック方式でストリーミング対応）
   */
  async queryAll(
    agents: ToyosatomiAgent[],
    prompt: string,
    onPanel: (panel: ToyosatomiPanelResult) => void
  ): Promise<ToyosatomiPanelResult[]> {
    const panels: ToyosatomiPanelResult[] = agents.map(agent => ({
      agent,
      status: 'pending' as const,
    }));

    // 全エージェントに通知（pending状態）
    panels.forEach(p => onPanel(p));

    // 並列実行
    const promises = panels.map(async (panel, _idx) => {
      const start = Date.now();
      panel.status = 'streaming';
      onPanel({ ...panel });

      try {
        const rolePrompt = ROLE_PROMPTS[panel.agent.role];
        const request: LLMRequest = {
          messages: [{ role: 'user', content: prompt }],
          model: panel.agent.model,
          maxTokens: 4096,
          ...(rolePrompt ? { systemPrompt: rolePrompt } : {}),
        };

        const response = await panel.agent.adapter.complete(request);
        panel.response = response;
        panel.status = 'done';
        panel.latencyMs = Date.now() - start;
      } catch (err: any) {
        panel.status = 'error';
        panel.error = err?.message ?? 'Unknown error';
        panel.latencyMs = Date.now() - start;
      }

      onPanel({ ...panel });
      return panel;
    });

    return Promise.all(promises);
  }

  /**
   * 豊聡耳ジャッジ: Claudeが各AI回答を統合して最終見解を生成
   */
  async judge(
    prompt: string,
    panels: ToyosatomiPanelResult[]
  ): Promise<ToyosatomiJudgeResult> {
    if (!this.judgeAdapter) {
      throw new Error('Judgeアダプタが未設定です（Claude APIキーが必要）');
    }

    const successPanels = panels.filter(p => p.status === 'done' && p.response);
    if (successPanels.length === 0) {
      throw new Error('ジャッジ可能な回答がありません');
    }

    const panelSummaries = successPanels
      .map((p, i) => {
        const role = p.agent.role !== 'general' ? ` [${p.agent.role}モード]` : '';
        return `## AI ${i + 1}: ${p.agent.providerName} (${p.agent.model})${role}\n${p.response!.content}`;
      })
      .join('\n\n---\n\n');

    const judgePrompt = `以下は「${prompt}」という質問に対する複数のAIの回答です。

${panelSummaries}

---

上記の回答を統合分析して、以下の形式でJSON回答してください：

{
  "synthesis": "各回答を統合した総合見解（300字以内）",
  "consensus": "各AIが共通して述べている点",
  "divergence": "意見が分かれている点・対立する視点",
  "recommendation": "最終的な推薦・結論（実践的アドバイス含む）",
  "bestPanel": "最も優れた回答を提供したプロバイダーID（例: claude, openai, gemini）"
}`;

    const response = await this.judgeAdapter.complete({
      messages: [{ role: 'user', content: judgePrompt }],
      systemPrompt: 'あなたは複数のAI回答を公正に分析する審判者です。各回答の優劣・共通点・相違点を客観的に評価し、統合された知見を提供してください。必ずJSON形式で回答してください。',
      maxTokens: 2048,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ToyosatomiJudgeResult;
      }
    } catch {
      // JSONパース失敗時はそのまま返す
    }

    // フォールバック
    return {
      synthesis: response.content,
      consensus: '',
      divergence: '',
      recommendation: '',
    };
  }

  /**
   * 完全な豊聡耳セッション実行（比較→ジャッジまで）
   */
  async runSession(
    agents: ToyosatomiAgent[],
    prompt: string,
    displayCount: ToyosatomiDisplayCount,
    mode: ToyosatomiSession['mode'],
    onProgress: (session: Partial<ToyosatomiSession>) => void
  ): Promise<ToyosatomiSession> {
    const session: ToyosatomiSession = {
      id: `toyosatomi-${Date.now()}`,
      prompt,
      displayCount,
      mode,
      panels: [],
      startedAt: new Date(),
    };

    // 表示数に合わせてエージェントを絞る
    const activeAgents = agents.slice(0, displayCount);

    // 並列問い合わせ
    const panels = await this.queryAll(activeAgents, prompt, (panel) => {
      const idx = session.panels.findIndex(
        p => p.agent.providerId === panel.agent.providerId
      );
      if (idx >= 0) {
        session.panels[idx] = panel;
      } else {
        session.panels.push(panel);
      }
      onProgress({ panels: [...session.panels] });
    });

    session.panels = panels;

    // ジャッジモードの場合
    if (mode === 'judge' && this.judgeAdapter) {
      try {
        const judge = await this.judge(prompt, panels);
        session.judge = judge;
        onProgress({ judge });
      } catch (err) {
        console.error('Toyosatomi judge error:', err);
      }
    }

    session.completedAt = new Date();
    onProgress(session);

    return session;
  }
}

// ─── プリセット設定ヘルパー ──────────────────────────

/**
 * 役割分担モード用のエージェント配置
 * 将棋・チェスの「布陣」イメージ
 */
export function createRoleFormation(
  availableAdapters: Map<string, { adapter: ILLMAdapter; model: string; name: string }>,
  displayCount: ToyosatomiDisplayCount
): ToyosatomiAgent[] {
  const roles: ToyosatomiRole[] = ['logical', 'creative', 'critic', 'practical', 'philosophical', 'general'];
  const providerIds = Array.from(availableAdapters.keys()).slice(0, displayCount);

  return providerIds.map((id, i) => {
    const info = availableAdapters.get(id)!;
    return {
      providerId: id,
      providerName: info.name,
      model: info.model,
      role: roles[i % roles.length],
      adapter: info.adapter,
    };
  });
}

/**
 * 比較モード用エージェント（全員同じ役割・汎用）
 */
export function createComparisonFormation(
  availableAdapters: Map<string, { adapter: ILLMAdapter; model: string; name: string }>,
  displayCount: ToyosatomiDisplayCount
): ToyosatomiAgent[] {
  const providerIds = Array.from(availableAdapters.keys()).slice(0, displayCount);

  return providerIds.map(id => {
    const info = availableAdapters.get(id)!;
    return {
      providerId: id,
      providerName: info.name,
      model: info.model,
      role: 'general' as ToyosatomiRole,
      adapter: info.adapter,
    };
  });
}

// ─── エクスポート ────────────────────────────────────
export default ToyosatomiEngine;
