/**
 * Rei-AIOS — MultiAgentCoordinator
 * 複数Rei-AIOSインスタンスの協調推論エンジン
 *
 * 機能:
 *   1. ローカルマルチエージェント — 同一プロセス内の仮想エージェント協調
 *   2. ConsensusEngine統合 — 七価論理による分散合意
 *   3. Nostr P2P合意プロトコル — NostrAxiomShare経由の公理合意
 *   4. 協調推論パイプライン — 質問→分散推論→合意→記憶保存
 *
 * アーキテクチャ:
 *   MultiAgentCoordinator
 *     ├─ LocalAgent[] ─── SEED_KERNEL + SevenValueClassifier で独立推論
 *     ├─ ConsensusEngine ─── 七価論理∧合意
 *     └─ AIOSMemory ─── 合意結果の永続化
 */

import { ConsensusEngine, type InstanceVote, type ConsensusResult } from './consensus-engine';
import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import { type SevenLogicValue } from './seven-logic';

// ── 型定義 ─────────────────────────────────────────────

export interface AgentProfile {
  id:           string;
  name:         string;
  speciality:   string;      // 得意カテゴリ（logic, quantum, etc.）
  biasValue:    SevenLogicValue;  // 傾向する論理値
  confidence:   number;      // 基本確信度
}

export interface CoordinationRequest {
  topic:       string;       // 推論トピック
  context?:    string;       // 追加コンテキスト
  maxRounds?:  number;       // 最大ラウンド数
  agentIds?:   string[];     // 参加エージェントID（省略時: 全員）
}

export interface CoordinationResult {
  sessionId:   string;
  topic:       string;
  consensus:   ConsensusResult;
  agents:      AgentProfile[];
  reasonings:  AgentReasoning[];
  summary:     string;
  timestamp:   number;
}

export interface AgentReasoning {
  agentId:     string;
  vote:        SevenLogicValue;
  reasoning:   string;
  axiomRefs:   string[];
  confidence:  number;
}

// ── LocalAgent ─────────────────────────────────────────

class LocalAgent {
  readonly profile: AgentProfile;
  private theories: SeedTheory[];

  constructor(profile: AgentProfile) {
    this.profile = profile;
    // 得意カテゴリの理論を優先ロード
    this.theories = SEED_KERNEL.filter(t =>
      t.category === profile.speciality ||
      t.category === 'logic' ||
      t.category === 'general'
    );
    if (this.theories.length < 10) {
      // 少なすぎる場合は全理論から補完
      this.theories = SEED_KERNEL.slice(0, 30);
    }
  }

  /**
   * トピックに対して独立推論を行い投票する
   */
  reason(topic: string, context?: string): InstanceVote {
    const topicLower = topic.toLowerCase();
    const contextLower = (context || '').toLowerCase();
    const combined = topicLower + ' ' + contextLower;

    // 1. 関連公理を検索
    const relatedAxioms = this.findRelatedAxioms(combined);

    // 2. 公理に基づいて論理値を決定
    const value = this.determineValue(combined, relatedAxioms);

    // 3. 推論根拠を構築
    const reasoning = this.buildReasoning(topic, relatedAxioms, value);

    // 4. 確信度を計算
    const confidence = this.calcConfidence(relatedAxioms, combined);

    return {
      instanceId: this.profile.id,
      value,
      reasoning,
      axiomRefs: relatedAxioms.map(a => a.id),
      confidence,
      timestamp: Date.now(),
    };
  }

  private findRelatedAxioms(text: string): SeedTheory[] {
    const scored = this.theories.map(t => {
      let score = 0;
      for (const kw of t.keywords) {
        if (text.includes(kw.toLowerCase())) score += 2;
      }
      if (text.includes(t.category)) score += 1;
      // 公理テキスト内のキーワード一致
      const axiomWords = t.axiom.toLowerCase().split(/[\s=→,]+/);
      for (const w of axiomWords) {
        if (w.length > 2 && text.includes(w)) score += 1;
      }
      return { theory: t, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.theory);
  }

  private determineValue(text: string, axioms: SeedTheory[]): SevenLogicValue {
    // キーワード → 論理値マッピング
    const PATTERNS: [string[], SevenLogicValue][] = [
      [['矛盾', 'paradox', 'contradiction', '真かつ偽'], 'BOTH'],
      [['空', 'sunyata', 'emptiness', '無自性', '不可知'], 'NEITHER'],
      [['無限', 'infinity', '発散', 'diverge', '再帰的'], 'INFINITY'],
      [['ゼロ', 'zero', '原点', '未定義', 'undefined', '未観測'], 'ZERO'],
      [['変化', 'flowing', '流動', '無常', '遷移', 'transition'], 'FLOWING'],
      [['偽', 'false', '否定', 'not', '反証', 'refute'], 'FALSE'],
      [['真', 'true', '証明', 'proven', '定理', '確定'], 'TRUE'],
    ];

    for (const [keywords, value] of PATTERNS) {
      if (keywords.some(kw => text.includes(kw))) return value;
    }

    // 関連公理のカテゴリから推定
    if (axioms.length > 0) {
      const cat = axioms[0].category;
      if (cat === 'quantum') return 'BOTH';
      if (cat === 'zero_extension') return 'ZERO';
      if (cat === 'consciousness') return 'FLOWING';
      if (cat === 'nagarjuna' || cat === 'silence') return 'NEITHER';
    }

    // エージェントの傾向値にフォールバック
    return this.profile.biasValue;
  }

  private buildReasoning(topic: string, axioms: SeedTheory[], value: SevenLogicValue): string {
    const axiomRefs = axioms.slice(0, 3).map(a => `[${a.id}] ${a.axiom}`).join('; ');
    return `${this.profile.name}の推論: 「${topic}」→ ${value} (根拠: ${axiomRefs || 'バイアス値'})`;
  }

  private calcConfidence(axioms: SeedTheory[], text: string): number {
    const base = this.profile.confidence;
    // 関連公理が多いほど確信度UP
    const axiomBonus = Math.min(axioms.length * 0.1, 0.3);
    // 得意カテゴリのキーワードがあれば追加
    const specialityBonus = text.includes(this.profile.speciality) ? 0.15 : 0;
    return Math.min(base + axiomBonus + specialityBonus, 1.0);
  }
}

// ── デフォルトエージェントプロファイル ──

const DEFAULT_AGENTS: AgentProfile[] = [
  { id: 'agent-logic',        name: '論理エージェント',   speciality: 'logic',          biasValue: 'TRUE',     confidence: 0.7 },
  { id: 'agent-quantum',      name: '量子エージェント',   speciality: 'quantum',        biasValue: 'BOTH',     confidence: 0.65 },
  { id: 'agent-nagarjuna',    name: '龍樹エージェント',   speciality: 'nagarjuna',      biasValue: 'NEITHER',  confidence: 0.6 },
  { id: 'agent-consciousness', name: '意識エージェント',  speciality: 'consciousness',  biasValue: 'FLOWING',  confidence: 0.6 },
  { id: 'agent-numerical',    name: '数値エージェント',   speciality: 'numerical',      biasValue: 'TRUE',     confidence: 0.75 },
];

// ── MultiAgentCoordinator 本体 ─────────────────────────

export class MultiAgentCoordinator {
  private agents:    Map<string, LocalAgent>;
  private consensus: ConsensusEngine;
  private sessionCounter = 0;

  constructor(profiles?: AgentProfile[]) {
    this.agents = new Map();
    this.consensus = new ConsensusEngine();

    for (const p of (profiles || DEFAULT_AGENTS)) {
      this.agents.set(p.id, new LocalAgent(p));
    }
  }

  /**
   * エージェントを追加する
   */
  addAgent(profile: AgentProfile): void {
    this.agents.set(profile.id, new LocalAgent(profile));
  }

  /**
   * エージェントを削除する
   */
  removeAgent(id: string): boolean {
    return this.agents.delete(id);
  }

  /**
   * 全エージェントのプロファイルを返す
   */
  getAgents(): AgentProfile[] {
    return [...this.agents.values()].map(a => a.profile);
  }

  /**
   * 協調推論を実行する（メインAPI）
   */
  coordinate(request: CoordinationRequest): CoordinationResult {
    const sessionId = `coord-${++this.sessionCounter}`;

    // 1. 参加エージェントを選択
    let participants: LocalAgent[];
    if (request.agentIds && request.agentIds.length > 0) {
      participants = request.agentIds
        .map(id => this.agents.get(id))
        .filter((a): a is LocalAgent => a !== undefined);
    } else {
      participants = [...this.agents.values()];
    }

    if (participants.length === 0) {
      throw new Error('No agents available for coordination');
    }

    // 2. 各エージェントが独立推論
    const votes: InstanceVote[] = participants.map(agent =>
      agent.reason(request.topic, request.context)
    );

    // 3. ConsensusEngineで合意形成
    const consensusResult = this.consensus.reach(
      request.topic,
      votes,
      request.maxRounds ?? 3,
    );

    // 4. 推論詳細を整理
    const reasonings: AgentReasoning[] = votes.map(v => ({
      agentId:    v.instanceId,
      vote:       v.value,
      reasoning:  v.reasoning,
      axiomRefs:  v.axiomRefs,
      confidence: v.confidence,
    }));

    // 5. サマリー生成
    const summary = this.buildSummary(request.topic, participants, consensusResult, reasonings);

    return {
      sessionId,
      topic: request.topic,
      consensus: consensusResult,
      agents: participants.map(a => a.profile),
      reasonings,
      summary,
      timestamp: Date.now(),
    };
  }

  /**
   * 特定カテゴリの専門家エージェントだけで推論
   */
  coordinateBySpeciality(
    topic: string,
    speciality: string,
    context?: string,
  ): CoordinationResult {
    const agentIds = [...this.agents.values()]
      .filter(a => a.profile.speciality === speciality)
      .map(a => a.profile.id);

    // 専門家がいなければ全員参加
    return this.coordinate({
      topic,
      context,
      agentIds: agentIds.length > 0 ? agentIds : undefined,
    });
  }

  /**
   * 全エージェントの統計情報
   */
  stats(): {
    agentCount: number;
    specialities: string[];
    sessions: number;
  } {
    return {
      agentCount: this.agents.size,
      specialities: [...new Set([...this.agents.values()].map(a => a.profile.speciality))],
      sessions: this.sessionCounter,
    };
  }

  private buildSummary(
    topic: string,
    agents: LocalAgent[],
    consensus: ConsensusResult,
    reasonings: AgentReasoning[],
  ): string {
    const lines = [
      `=== 協調推論結果 ===`,
      `トピック: ${topic}`,
      `参加エージェント: ${agents.map(a => a.profile.name).join(', ')}`,
      `ラウンド数: ${consensus.rounds.length}`,
      '',
      '--- 各エージェントの推論 ---',
    ];
    for (const r of reasonings) {
      lines.push(`  ${r.agentId}: ${r.vote} (確信度: ${(r.confidence * 100).toFixed(0)}%)`);
    }
    lines.push('');
    lines.push(`最終合意値: ${consensus.finalValue}`);
    lines.push(`合意確信度: ${(consensus.finalConfidence * 100).toFixed(1)}%`);
    lines.push(`使用公理: ${consensus.axiomChain.slice(0, 3).join(', ') || 'なし'}`);

    return lines.join('\n');
  }
}
