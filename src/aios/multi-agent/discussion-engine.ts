/**
 * Rei-AIOS — AI間議論エンジン (discussion-engine.ts)
 * Phase 1 実装
 *
 * 複数のAIエージェントが「提案→批評→調停→合意」のサイクルで
 * 議論を行い、Quad Logicに基づいた最終判断を生成する。
 *
 * 既存コードとの関係:
 *   - BaseAgent (agent.ts) を継承したDiscussionAgentを使用
 *   - AxiomBrancher (axiom-brancher.ts) で各回答を3軸分岐
 *   - LLMManager (llm-manager.ts) でプロバイダーを管理
 *   - PrivacyLogger (log-encryptor.ts) で議論ログを暗号化保存
 *
 * D-FUMT Quad Logic の四値:
 *   TRUE     = 確実に正しい → 即時採用
 *   FALSE    = 確実に誤り   → 除外
 *   UNCERTAIN = 要検証      → 追加ラウンドへ
 *   BOTH     = 文脈依存     → ユーザーに選択肢を提示
 */

import { EventEmitter } from 'events';
import { AxiomBrancher, BranchResult } from '../axiom-brancher';
import { ILLMAdapter, LLMMessage } from '../llm-adapter';
import { LLMManager } from '../llm-manager';

// ============================================================
// 型定義
// ============================================================

/** Quad Logic の四値 */
export type QuadValue = 'TRUE' | 'FALSE' | 'UNCERTAIN' | 'BOTH';

/** 議論の役割 */
export type DiscussionRole =
  | 'proposer'   // 提案者: 最初の回答を生成
  | 'critic'     // 批評者: 提案の弱点を指摘
  | 'mediator'   // 調停者: 対立を統合
  | 'judge';     // 判定者: Quad Logicで最終判断

/** 参加エージェントの設定 */
export interface DiscussionAgent {
  id: string;
  name: string;
  role: DiscussionRole;
  providerId: string;   // LLMManagerのプロバイダーID
  model?: string;
}

/** 議論セッションの設定 */
export interface DiscussionConfig {
  topic: string;                    // 議論するテーマ・質問
  agents: DiscussionAgent[];        // 参加エージェント（2〜4体推奨）
  maxRounds?: number;               // 最大ラウンド数（デフォルト: 3）
  convergenceThreshold?: number;    // 合意判定の閾値 0.0-1.0（デフォルト: 0.75）
  enablePrivacyLog?: boolean;       // プライバシーログ有効（デフォルト: true）
  timeoutMs?: number;               // タイムアウト（デフォルト: 60000ms）
}

/** 1発言の記録 */
export interface DiscussionStatement {
  round: number;
  agentId: string;
  agentName: string;
  role: DiscussionRole;
  content: string;
  timestamp: number;
  branches?: BranchResult;          // AxiomBrancherによる3軸分岐
  quadVote?: QuadValue;             // このエージェントの最終評価
}

/** 1ラウンドの結果 */
export interface DiscussionRound {
  roundNumber: number;
  statements: DiscussionStatement[];
  convergenceScore: number;         // 0.0-1.0 (1.0=完全合意)
  quadDistribution: Record<QuadValue, number>;
}

/** 議論全体の結果 */
export interface DiscussionResult {
  sessionId: string;
  topic: string;
  rounds: DiscussionRound[];
  finalVerdict: QuadValue;          // 最終的なQuad Logic判断
  consensus: string;                // 合意された内容
  dissent?: string;                 // 残存する異論（BOTHの場合）
  recommendation: string;           // ユーザーへの推奨アクション
  totalStatements: number;
  durationMs: number;
}

/** 議論の進行状況イベント */
export interface DiscussionProgressEvent {
  sessionId: string;
  round: number;
  maxRounds: number;
  latestStatement: DiscussionStatement;
  convergenceScore: number;
}

// ============================================================
// システムプロンプト生成
// ============================================================

function buildSystemPrompt(role: DiscussionRole, topic: string, round: number): string {
  const roleGuides: Record<DiscussionRole, string> = {
    proposer: `あなたは「提案者」として、以下のテーマについて最も合理的な初期回答を提案してください。
テーマ: ${topic}
ラウンド${round}: 論拠を明確に示し、3〜5の要点でまとめること。`,

    critic: `あなたは「批評者」として、提案された回答の弱点・盲点・リスクを指摘してください。
テーマ: ${topic}
ラウンド${round}: 単なる否定ではなく、建設的な改善点を2〜3点示すこと。`,

    mediator: `あなたは「調停者」として、提案と批評を統合した改善案を示してください。
テーマ: ${topic}
ラウンド${round}: 対立する意見の共通点を見つけ、より高い水準の回答を構築すること。`,

    judge: `あなたは「判定者」として、議論全体を評価し最終判断を下してください。
テーマ: ${topic}
ラウンド${round}: 以下のQuad Logicで判定すること。
  TRUE: 議論の結論が確実に正しい
  FALSE: 議論の結論が明らかに誤り
  UNCERTAIN: さらなる情報・検証が必要
  BOTH: 文脈・条件によって答えが変わる（選択肢を提示）
判定後、判定理由と推奨アクションを示すこと。`,
  };

  return `[Rei-AIOS AI議論エンジン]\n${roleGuides[role]}\n\n回答は簡潔に（200〜400字）。日本語で答えること。`;
}

function buildUserPrompt(
  role: DiscussionRole,
  topic: string,
  history: DiscussionStatement[],
): string {
  if (history.length === 0) {
    return `テーマ「${topic}」について、あなたの役割に従って回答してください。`;
  }

  const historyText = history
    .slice(-6) // 直近6発言を文脈として渡す
    .map(s => `[${s.agentName}（${s.role}）ラウンド${s.round}]\n${s.content}`)
    .join('\n\n---\n\n');

  return `## これまでの議論\n\n${historyText}\n\n---\n\n上記の議論を踏まえ、あなたの役割（${role}）として回答してください。`;
}

// ============================================================
// Quad Logic 評価
// ============================================================

function parseQuadVote(response: string): QuadValue {
  const upper = response.toUpperCase();
  if (upper.includes('TRUE') || upper.includes('確実') || upper.includes('正しい')) {
    if (upper.includes('FALSE') || upper.includes('BOTH')) return 'BOTH';
    return 'TRUE';
  }
  if (upper.includes('FALSE') || upper.includes('誤り') || upper.includes('不正解')) {
    return 'FALSE';
  }
  if (upper.includes('BOTH') || upper.includes('文脈') || upper.includes('条件によ')) {
    return 'BOTH';
  }
  return 'UNCERTAIN';
}

function calcConvergenceScore(statements: DiscussionStatement[]): number {
  if (statements.length < 2) return 0;

  const votes = statements
    .filter(s => s.quadVote)
    .map(s => s.quadVote as QuadValue);

  if (votes.length === 0) return 0;

  // 最多票の割合をスコアとする
  const counts: Record<string, number> = {};
  for (const v of votes) counts[v] = (counts[v] || 0) + 1;
  const maxCount = Math.max(...Object.values(counts));
  return maxCount / votes.length;
}

function calcQuadDistribution(statements: DiscussionStatement[]): Record<QuadValue, number> {
  const dist: Record<QuadValue, number> = { TRUE: 0, FALSE: 0, UNCERTAIN: 0, BOTH: 0 };
  for (const s of statements) {
    if (s.quadVote) dist[s.quadVote]++;
  }
  return dist;
}

function determineFinalVerdict(rounds: DiscussionRound[]): QuadValue {
  const allStatements = rounds.flatMap(r => r.statements);
  const dist = calcQuadDistribution(allStatements);
  const maxVal = (Object.entries(dist) as [QuadValue, number][])
    .sort((a, b) => b[1] - a[1])[0];
  return maxVal[0];
}

// ============================================================
// DiscussionEngine クラス
// ============================================================

export class DiscussionEngine extends EventEmitter {
  private brancher = new AxiomBrancher();
  private llmManager: LLMManager;

  constructor(llmManager: LLMManager) {
    super();
    this.llmManager = llmManager;
  }

  /**
   * 議論セッションを開始する
   * エージェントが順番に発言し、Quad Logicで合意形成を行う
   */
  async run(config: DiscussionConfig): Promise<DiscussionResult> {
    const sessionId = `disc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startTime = Date.now();
    const maxRounds = config.maxRounds ?? 3;
    const threshold = config.convergenceThreshold ?? 0.75;
    const timeout = config.timeoutMs ?? 60_000;

    const rounds: DiscussionRound[] = [];
    const allStatements: DiscussionStatement[] = [];
    let converged = false;

    this.emit('sessionStart', { sessionId, topic: config.topic, agents: config.agents });

    for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
      if (Date.now() - startTime > timeout) {
        this.emit('timeout', { sessionId, round: roundNum });
        break;
      }

      const roundStatements: DiscussionStatement[] = [];

      // 各エージェントが発言（役割順: proposer → critic → mediator → judge）
      const orderedAgents = [...config.agents].sort(
        (a, b) => roleOrder(a.role) - roleOrder(b.role),
      );

      for (const agent of orderedAgents) {
        const statement = await this.getStatement(
          agent, config.topic, allStatements, roundNum,
        );

        roundStatements.push(statement);
        allStatements.push(statement);

        const progressEvent: DiscussionProgressEvent = {
          sessionId,
          round: roundNum,
          maxRounds,
          latestStatement: statement,
          convergenceScore: calcConvergenceScore(allStatements),
        };
        this.emit('statement', progressEvent);
      }

      const convergenceScore = calcConvergenceScore(allStatements);
      const round: DiscussionRound = {
        roundNumber: roundNum,
        statements: roundStatements,
        convergenceScore,
        quadDistribution: calcQuadDistribution(allStatements),
      };
      rounds.push(round);

      this.emit('roundComplete', { sessionId, round });

      if (convergenceScore >= threshold) {
        converged = true;
        break;
      }
    }

    // 最終判断を構築
    const finalVerdict = determineFinalVerdict(rounds);
    const judgeStatements = allStatements.filter(s => s.role === 'judge');
    const mediatorStatements = allStatements.filter(s => s.role === 'mediator');

    const consensus = mediatorStatements.length > 0
      ? mediatorStatements[mediatorStatements.length - 1].content
      : allStatements[allStatements.length - 1].content;

    const dissent = finalVerdict === 'BOTH'
      ? judgeStatements[judgeStatements.length - 1]?.content
      : undefined;

    const recommendation = buildRecommendation(finalVerdict, converged);

    const result: DiscussionResult = {
      sessionId,
      topic: config.topic,
      rounds,
      finalVerdict,
      consensus,
      dissent,
      recommendation,
      totalStatements: allStatements.length,
      durationMs: Date.now() - startTime,
    };

    this.emit('sessionComplete', result);
    return result;
  }

  // ----------------------------------------------------------
  // プライベートメソッド
  // ----------------------------------------------------------

  private async getStatement(
    agent: DiscussionAgent,
    topic: string,
    history: DiscussionStatement[],
    round: number,
  ): Promise<DiscussionStatement> {
    const adapter = this.llmManager.getAdapter(agent.providerId);

    const systemPrompt = buildSystemPrompt(agent.role, topic, round);
    const userPrompt = buildUserPrompt(agent.role, topic, history);

    let content = '（LLM未接続: モックレスポンス）';

    if (adapter) {
      try {
        const messages: LLMMessage[] = [{ role: 'user', content: userPrompt }];
        const response = await adapter.complete({ messages, systemPrompt, maxTokens: 512 });
        content = response.content;
      } catch (err) {
        content = `[エラー: ${String(err)}]`;
      }
    } else {
      // LLM未接続時のモック（開発・テスト用）
      content = mockResponse(agent.role, topic, round);
    }

    // AxiomBrancherで3軸分岐を生成（judgeのみ）
    const branches = agent.role === 'judge'
      ? this.brancher.branch(topic, content)
      : undefined;

    // Quad Logicの投票を抽出
    const quadVote = agent.role === 'judge' ? parseQuadVote(content) : undefined;

    return {
      round,
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      content,
      timestamp: Date.now(),
      branches,
      quadVote,
    };
  }
}

// ============================================================
// ユーティリティ
// ============================================================

function roleOrder(role: DiscussionRole): number {
  return { proposer: 0, critic: 1, mediator: 2, judge: 3 }[role] ?? 99;
}

function buildRecommendation(verdict: QuadValue, converged: boolean): string {
  if (!converged) {
    return '議論が収束しませんでした。追加情報の収集またはラウンド数の増加を推奨します。';
  }
  switch (verdict) {
    case 'TRUE':
      return '議論の結論に高い確信があります。この方向で実装・実行を進めてください。';
    case 'FALSE':
      return '現在の方向性には問題があります。前提条件の見直しを推奨します。';
    case 'UNCERTAIN':
      return '追加の情報収集または専門家への相談を推奨します。';
    case 'BOTH':
      return '状況によって最適解が異なります。下記の選択肢から条件に合うものを選んでください。';
  }
}

function mockResponse(role: DiscussionRole, topic: string, round: number): string {
  const mocks: Record<DiscussionRole, string> = {
    proposer:  `[モック・提案者 R${round}] 「${topic}」に関して、主要な観点は3点あります。①効率性、②安全性、③拡張性です。これらを総合的に考慮した実装を提案します。`,
    critic:    `[モック・批評者 R${round}] 提案の弱点として、①コスト試算が不明確、②移行期間の考慮不足、③障害時の復旧手順が未定義です。これらの補完が必要です。`,
    mediator:  `[モック・調停者 R${round}] 提案と批評を統合すると、段階的な実装アプローチが最適です。Phase1でコア機能、Phase2でコスト最適化、Phase3でフルスケールを推奨します。`,
    judge:     `[モック・判定者 R${round}] Quad Logic判定: UNCERTAIN。現時点では十分な情報があるが、実環境でのテスト結果待ちです。追加ラウンドまたは実証実験を推奨します。`,
  };
  return mocks[role];
}

// ============================================================
// クイックスタート関数
// ============================================================

/**
 * 最小構成（2エージェント）で議論を開始
 * LLMManagerが未設定の場合はモックで動作
 */
export async function quickDiscussion(
  topic: string,
  llmManager: LLMManager,
  providerIds: { proposer: string; critic: string },
): Promise<DiscussionResult> {
  const engine = new DiscussionEngine(llmManager);

  const config: DiscussionConfig = {
    topic,
    agents: [
      { id: 'a1', name: '提案AI', role: 'proposer', providerId: providerIds.proposer },
      { id: 'a2', name: '批評AI', role: 'critic',   providerId: providerIds.critic   },
      { id: 'a3', name: '判定AI', role: 'judge',    providerId: providerIds.proposer },
    ],
    maxRounds: 2,
    convergenceThreshold: 0.67,
  };

  return engine.run(config);
}

/**
 * フル構成（4エージェント）での本格議論
 */
export async function fullDiscussion(
  topic: string,
  llmManager: LLMManager,
  providerIds: {
    proposer: string;
    critic: string;
    mediator: string;
    judge: string;
  },
): Promise<DiscussionResult> {
  const engine = new DiscussionEngine(llmManager);

  const config: DiscussionConfig = {
    topic,
    agents: [
      { id: 'a1', name: '提案AI',  role: 'proposer', providerId: providerIds.proposer },
      { id: 'a2', name: '批評AI',  role: 'critic',   providerId: providerIds.critic   },
      { id: 'a3', name: '調停AI',  role: 'mediator', providerId: providerIds.mediator },
      { id: 'a4', name: '判定AI',  role: 'judge',    providerId: providerIds.judge    },
    ],
    maxRounds: 3,
    convergenceThreshold: 0.75,
    enablePrivacyLog: true,
  };

  return engine.run(config);
}
