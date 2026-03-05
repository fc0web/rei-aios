import { type SeedTheory } from './seed-kernel';

export type TrustLevel = '⊤' | '～' | '〇' | '⊥';

export interface NodeTrust {
  nodeId: string;
  score: number;        // 0.0〜1.0
  trustLevel: TrustLevel;
  contributions: number; // 貢献公理数
  violations: number;    // 違反回数
  lastSeen: number;
}

export class AxiomTrustScorer {
  private nodes = new Map<string, NodeTrust>();

  // ノードを初期登録
  register(nodeId: string): NodeTrust {
    const trust: NodeTrust = {
      nodeId,
      score: 0.5,       // 初期は中立（〇）
      trustLevel: '〇',
      contributions: 0,
      violations: 0,
      lastSeen: Date.now(),
    };
    this.nodes.set(nodeId, trust);
    return trust;
  }

  // 公理貢献でスコア上昇
  reward(nodeId: string, axiom: SeedTheory): void {
    const trust = this.getOrRegister(nodeId);
    trust.contributions++;
    // 高品質公理（confidence高）はボーナス
    const bonus = (axiom as any).confidence ?? 0.5;
    trust.score = Math.min(1.0, trust.score + 0.05 * bonus);
    trust.trustLevel = this.calcLevel(trust.score);
    trust.lastSeen = Date.now();
  }

  // 違反でスコア下降
  penalize(nodeId: string, reason: string): void {
    const trust = this.getOrRegister(nodeId);
    trust.violations++;
    trust.score = Math.max(0.0, trust.score - 0.2);
    trust.trustLevel = this.calcLevel(trust.score);
  }

  // 信頼できるノードか判定
  isTrusted(nodeId: string): boolean {
    const trust = this.nodes.get(nodeId);
    if (!trust) return false;
    return trust.trustLevel === '⊤' || trust.trustLevel === '～';
  }

  // 排除すべきノードか判定
  isBlacklisted(nodeId: string): boolean {
    const trust = this.nodes.get(nodeId);
    return trust?.trustLevel === '⊥';
  }

  // 七価論理レベル計算
  private calcLevel(score: number): TrustLevel {
    if (score >= 0.8) return '⊤';
    if (score >= 0.5) return '～';
    if (score >= 0.3) return '〇';
    return '⊥';
  }

  private getOrRegister(nodeId: string): NodeTrust {
    return this.nodes.get(nodeId) ?? this.register(nodeId);
  }

  getAll(): NodeTrust[] {
    return [...this.nodes.values()];
  }

  stats() {
    const all = this.getAll();
    return {
      total: all.length,
      trusted: all.filter(n => n.trustLevel === '⊤').length,
      flowing: all.filter(n => n.trustLevel === '～').length,
      unknown: all.filter(n => n.trustLevel === '〇').length,
      blacklisted: all.filter(n => n.trustLevel === '⊥').length,
    };
  }
}
