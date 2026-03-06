/**
 * AxiomProposalQueue — 発見公理の隔離・提案キュー
 *
 * AxiomDiscoveryAgentが発見した外部知識を
 * SEED_KERNELに直接触れさせない「防疫層」。
 *
 * 承認前の候補は全て「種形式」(SeedTheory互換)で保存。
 * フルテキスト・論文全文は一切保存しない → データ膨張ゼロ。
 *
 * ライフサイクル:
 *   発見 → PENDING（隔離）
 *         ↓ 藤本さん+Claude承認
 *   APPROVED（rei-axiom-libraryへコミット可能）
 *         ↓ 却下
 *   REJECTED（削除 or アーカイブ）
 *         ↓ 修正依頼
 *   NEEDS_REVISION（修正待ち）
 *
 * データ容量:
 *   1提案 ≈ 300〜500バイト（種形式）
 *   1000件 ≈ 0.5MB
 */

import { type SevenLogicValue, toSymbol } from './seven-logic';
import { type SeedTheory } from './seed-kernel';

// ══════════════════════════════════════════════════════════════
// 型定義
// ══════════════════════════════════════════════════════════════

export type ProposalStatus =
  | 'PENDING'         // 隔離中（未審査）
  | 'APPROVED'        // 承認済み（SEED_KERNELへ統合可能）
  | 'REJECTED'        // 却下
  | 'NEEDS_REVISION'  // 修正依頼
  | 'EXPIRED';        // 期限切れ（30日以上放置）

/** 発見源の種別 */
export type DiscoverySource =
  | 'arxiv'           // arXiv論文
  | 'wikipedia'       // Wikipedia/Wikidata
  | 'github'          // GitHubリポジトリ
  | 'nostr'           // Nostr P2Pネットワーク
  | 'manual'          // 手動入力（藤本さん直接）
  | 'theory_evolution'; // TheoryEvolutionによる帰納

/** 公理候補（種形式 + メタデータ） */
export interface AxiomProposal {
  // ── 識別 ──
  id: string;                    // proposal-YYYYMMDD-NNNN
  status: ProposalStatus;

  // ── 種データ（SEED_KERNEL互換・軽量） ──
  seed: SeedTheory;              // axiom + category + keywords のみ

  // ── 発見メタデータ ──
  source: DiscoverySource;
  sourceUrl?: string;            // 参照URL（フルテキストは保存しない）
  sourceTitle?: string;          // 論文名/記事名（タイトルのみ）
  discoveredAt: number;          // Unix ms
  discoveryScore: number;        // D-FUMT関連度スコア (0.0-1.0)
  confidenceTag: SevenLogicValue; // 信頼度の七価論理表現

  // ── D-FUMT整合性評価 ──
  dfumtAlignment: {
    relatedTheoryIds: string[];  // SEED_KERNELの関連理論ID
    alignmentScore: number;      // 整合度 (0.0-1.0)
    alignmentNote: string;       // 整合性の説明（1行）
    isContradicting: boolean;    // 既存理論と矛盾するか
    contradictionNote?: string;  // 矛盾の内容
  };

  // ── レビュー記録 ──
  reviewNote?: string;           // 承認/却下の理由
  reviewedAt?: number;
  revisionRequest?: string;      // 修正依頼の内容
  expiresAt: number;             // 期限（discoveredAt + 30日）
}

/** キューの統計情報 */
export interface QueueStats {
  total: number;
  byStatus: Record<ProposalStatus, number>;
  bySource: Record<DiscoverySource, number>;
  avgAlignmentScore: number;
  oldestPendingDays: number;
}

// ══════════════════════════════════════════════════════════════
// AxiomProposalQueue 本体
// ══════════════════════════════════════════════════════════════

export class AxiomProposalQueue {
  private proposals: Map<string, AxiomProposal> = new Map();
  private counter = 0;

  // ══════════════════════════════════════════════════════════════
  // 投入（発見エージェントが使用）
  // ══════════════════════════════════════════════════════════════

  /**
   * 発見した公理候補をキューに追加する。
   * SEED_KERNELには一切触れない。
   */
  enqueue(params: {
    seed: SeedTheory;
    source: DiscoverySource;
    sourceUrl?: string;
    sourceTitle?: string;
    discoveryScore: number;
    dfumtAlignment: AxiomProposal['dfumtAlignment'];
  }): AxiomProposal {
    const now = Date.now();
    const date = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
    const id = `proposal-${date}-${String(++this.counter).padStart(4, '0')}`;

    // 信頼度を七価論理で表現
    const confidenceTag = this.scoreToLogic(params.discoveryScore, params.dfumtAlignment);

    const proposal: AxiomProposal = {
      id,
      status: 'PENDING',
      seed: { ...params.seed, id: params.seed.id || id },
      source: params.source,
      sourceUrl: params.sourceUrl,
      sourceTitle: params.sourceTitle,
      discoveredAt: now,
      discoveryScore: params.discoveryScore,
      confidenceTag,
      dfumtAlignment: params.dfumtAlignment,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30日
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  // ══════════════════════════════════════════════════════════════
  // レビュー操作（藤本さん + Claude が使用）
  // ══════════════════════════════════════════════════════════════

  /** 承認 → SEED_KERNEL統合の準備完了 */
  approve(id: string, note?: string): AxiomProposal | null {
    const p = this.proposals.get(id);
    if (!p || p.status !== 'PENDING' && p.status !== 'NEEDS_REVISION') return null;
    p.status = 'APPROVED';
    p.reviewNote = note ?? '承認';
    p.reviewedAt = Date.now();
    return p;
  }

  /** 却下 */
  reject(id: string, reason: string): AxiomProposal | null {
    const p = this.proposals.get(id);
    if (!p || p.status === 'APPROVED') return null;
    p.status = 'REJECTED';
    p.reviewNote = reason;
    p.reviewedAt = Date.now();
    return p;
  }

  /** 修正依頼 */
  requestRevision(id: string, request: string): AxiomProposal | null {
    const p = this.proposals.get(id);
    if (!p || p.status !== 'PENDING') return null;
    p.status = 'NEEDS_REVISION';
    p.revisionRequest = request;
    p.reviewedAt = Date.now();
    return p;
  }

  /** 修正して再提出 */
  revise(id: string, revisedSeed: Partial<SeedTheory>): AxiomProposal | null {
    const p = this.proposals.get(id);
    if (!p || p.status !== 'NEEDS_REVISION') return null;
    p.seed = { ...p.seed, ...revisedSeed };
    p.status = 'PENDING';
    p.revisionRequest = undefined;
    return p;
  }

  // ══════════════════════════════════════════════════════════════
  // 照会
  // ══════════════════════════════════════════════════════════════

  getPending(): AxiomProposal[] {
    this.expireOld();
    return [...this.proposals.values()].filter(p => p.status === 'PENDING');
  }

  getApproved(): AxiomProposal[] {
    return [...this.proposals.values()].filter(p => p.status === 'APPROVED');
  }

  getByStatus(status: ProposalStatus): AxiomProposal[] {
    return [...this.proposals.values()].filter(p => p.status === status);
  }

  getById(id: string): AxiomProposal | undefined {
    return this.proposals.get(id);
  }

  /**
   * 承認済みをSEED_KERNEL互換の種形式でエクスポート。
   * これをrei-axiom-libraryにコミットする。
   */
  exportApprovedSeeds(): SeedTheory[] {
    return this.getApproved().map(p => p.seed);
  }

  /** キュー統計 */
  stats(): QueueStats {
    this.expireOld();
    const all = [...this.proposals.values()];
    const byStatus = {
      PENDING: 0, APPROVED: 0, REJECTED: 0,
      NEEDS_REVISION: 0, EXPIRED: 0,
    };
    const bySource: Record<DiscoverySource, number> = {
      arxiv: 0, wikipedia: 0, github: 0,
      nostr: 0, manual: 0, theory_evolution: 0,
    };
    let totalAlignment = 0;
    let oldestPending = Date.now();

    for (const p of all) {
      byStatus[p.status]++;
      bySource[p.source]++;
      totalAlignment += p.dfumtAlignment.alignmentScore;
      if (p.status === 'PENDING' && p.discoveredAt < oldestPending) {
        oldestPending = p.discoveredAt;
      }
    }

    return {
      total: all.length,
      byStatus,
      bySource,
      avgAlignmentScore: all.length > 0 ? totalAlignment / all.length : 0,
      oldestPendingDays: byStatus.PENDING > 0
        ? (Date.now() - oldestPending) / (1000 * 60 * 60 * 24)
        : 0,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // 内部ヘルパー
  // ══════════════════════════════════════════════════════════════

  private expireOld(): void {
    const now = Date.now();
    for (const p of this.proposals.values()) {
      if (p.status === 'PENDING' && p.expiresAt < now) {
        p.status = 'EXPIRED';
      }
    }
  }

  /**
   * 発見スコア + D-FUMT整合度 → SevenLogicValue
   *
   *   整合高 + スコア高              → TRUE     : 統合推奨
   *   整合高 + スコア中              → FLOWING  : 要確認
   *   矛盾あり                       → BOTH     : 慎重審査
   *   整合スコア不明                 → NEITHER  : 情報不足
   *   スコア低                       → FALSE    : 統合不推奨
   *   整合スコア極高 + 既存と完全一致 → INFINITY : 重複候補
   */
  private scoreToLogic(score: number, alignment: AxiomProposal['dfumtAlignment']): SevenLogicValue {
    if (alignment.isContradicting)          return 'BOTH';
    if (alignment.alignmentScore > 0.95)    return 'INFINITY'; // 重複可能性
    if (score > 0.75 && alignment.alignmentScore > 0.6) return 'TRUE';
    if (score > 0.5  && alignment.alignmentScore > 0.4) return 'FLOWING';
    if (alignment.alignmentScore < 0.2)     return 'NEITHER';
    if (score < 0.3)                        return 'FALSE';
    return 'FLOWING';
  }
}
