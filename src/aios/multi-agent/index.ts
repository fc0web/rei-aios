/**
 * Rei-AIOS Multi-Agent — 統合エントリーポイント (index.ts)
 * テーマE: マルチエージェント並列化
 */

export * from './agent';
export * from './agents';
export * from './pool';
// Phase 1: AI間議論エンジン + プライバシーログ分離
export * from './discussion-engine';
export * from './log-encryptor';

import { AgentPool } from './pool';
import { ReiAgent, LLMAgent, OrchestratorAgent } from './agents';
import { BaseAgent, AgentTask, AgentTaskResult } from './agent';

export async function createAgentPool(): Promise<AgentPool> {
  return AgentPool.createDefault();
}

export async function runAgentTask(
  taskType: string,
  input: Record<string, unknown>,
) {
  const pool = await createAgentPool();
  const result = await pool.dispatch({
    type:        taskType,
    description: `Single task: ${taskType}`,
    input,
  });
  await pool.exitAll();
  return result;
}

export async function parallelAnalyze(
  query: string,
  vector?: number[],
) {
  const pool = await createAgentPool();
  const result = await pool.dispatch({
    type:        'parallel_analyze',
    description: `並列分析: ${query}`,
    input:       { query, vector },
  }, 'role-match');
  await pool.exitAll();
  return result;
}

export class MultiAgentShellBridge {
  private pool: AgentPool | null = null;

  async init(): Promise<void> {
    this.pool = await createAgentPool();
  }

  async addAgent(type: 'claude' | 'openai' | 'mock', apiKey?: string): Promise<void> {
    if (!this.pool) await this.init();
    const agent = new LLMAgent(type, { apiKey });
    await this.pool!.enter(agent);
  }

  async removeAgent(agentId: string): Promise<void> {
    await this.pool?.exit(agentId);
  }

  async chat(userMessage: string) {
    if (!this.pool) await this.init();
    const result = await this.pool!.dispatch({
      type:        'parallel_analyze',
      description: `チャット: ${userMessage}`,
      input:       { query: userMessage },
    });
    const parallelResults = (result?.output as Record<string, unknown>)?.parallelResults as unknown[] ?? [];
    const reiResult   = (parallelResults.find((r: unknown) => (r as Record<string,unknown>).source === 'rei')  as Record<string,unknown>)?.result as Record<string,unknown> | undefined;
    const llmResult   = (parallelResults.find((r: unknown) => (r as Record<string,unknown>).source === 'llm')  as Record<string,unknown>)?.result as Record<string,unknown> | undefined;
    const reiOutput  = (reiResult?.output  as Record<string, unknown>) ?? {};
    const llmOutput  = (llmResult?.output  as Record<string, unknown>) ?? {};
    const branches = (reiOutput?.branches as Record<string, string>) ?? {};
    return {
      axiomBranches: {
        logical:   branches.logical   ?? '[論理] D-FUMT公理で分析中...',
        practical: branches.practical ?? '[実用] Automatorタスクへ変換中...',
        critical:  branches.critical  ?? '[批判] 公理的検証中...',
      },
      llmResponse: (llmOutput?.response as string) ?? '(LLM未接続)',
    };
  }

  getAgentStatuses() { return this.pool?.getAgentSummaries() ?? []; }
  getStats()         { return this.pool?.getStats() ?? null; }
}

export const multiAgentBridge = new MultiAgentShellBridge();
