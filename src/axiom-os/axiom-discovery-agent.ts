/**
 * AxiomDiscoveryAgent — 自律公理発見エージェント
 *
 * 「発見するが決めない」原則:
 *   - 外部知識を自律探索・スコアリング
 *   - SEED_KERNELには絶対に触れない
 *   - 全ての発見はAxiomProposalQueueへ（隔離）
 *   - 藤本さん + Claude の承認なしに統合しない
 *
 * データ容量の制御:
 *   フルテキスト・論文PDFは保存しない
 *   タイトル + URL + 種データ のみ保存（≈500バイト/件）
 *   作業キャッシュは TTL付き（24時間で自動削除）
 *   定期実行間隔は最短24時間（API負荷・容量の制御）
 *
 * 探索対象:
 *   arxiv     : 東洋哲学・仏教論理・量子基礎論・意識数学
 *   wikipedia : 哲学概念・数学定理・思想史
 *   github    : 形式論理・型理論・証明支援系
 *   nostr     : D-FUMT関連の既存ノード（nostr-axiom-share.ts連携）
 */

import { type SeedTheory, SEED_KERNEL } from './seed-kernel';
import { type SevenLogicValue } from './seven-logic';
import { AxiomProposalQueue, type AxiomProposal, type DiscoverySource } from './axiom-proposal-queue';

// ══════════════════════════════════════════════════════════════
// 型定義
// ══════════════════════════════════════════════════════════════

export interface DiscoveryConfig {
  /** 最小スコア閾値（これ未満はキューに入れない） */
  minScore: number;               // default: 0.4
  /** 1回の探索で追加する最大件数 */
  maxPerRun: number;              // default: 10
  /** 探索間隔（ミリ秒、最短24時間） */
  intervalMs: number;             // default: 86400000
  /** 有効な探索ソース */
  enabledSources: DiscoverySource[];
  /** D-FUMTキーワード（スコアリング基準） */
  dfumtKeywords: string[];
}

export const DEFAULT_CONFIG: DiscoveryConfig = {
  minScore: 0.25,          // 0.4 → 0.25（より多く候補を拾う）
  maxPerRun: 10,
  intervalMs: 24 * 60 * 60 * 1000, // 24時間
  enabledSources: ['arxiv', 'wikipedia', 'github'],
  dfumtKeywords: [
    // ── D-FUMT 固有（最高優先）──
    'seven-valued logic', 'seven valued logic', '七値論理',
    'catuskoti', 'catuṣkoṭi', '四値論理', '四句否定',
    'nagarjuna', '龍樹', '中論', 'mulamadhyamakakarika',
    'dependent origination', 'pratityasamutpada', '縁起',
    'sunyata', 'emptiness', '空', 'madhyamaka',
    'paraconsistent logic', 'dialethism', 'Graham Priest',
    // ── 東洋哲学 ──
    'buddhist logic', '仏教論理', 'nyaya', 'dharmakirti',
    'taoism', '道教', 'zen', '禅', 'confucianism', '儒教',
    // ── 西洋哲学・論理 ──
    'intuitionistic logic', 'constructive mathematics',
    'process philosophy', 'whitehead', 'peirce', 'pragmatism',
    'phenomenology', 'husserl', 'heidegger',
    // ── 数学・物理 ──
    'many-valued logic', 'fuzzy logic',
    'quantum logic', 'topos theory', 'category theory',
    'information integration', 'IIT', 'phi consciousness',
    'spiral number', 'fractal dimension', 'strange attractor',
    // ── 意識・AI ──
    'consciousness mathematics', 'integrated information',
    'self-organization', 'dissipative structure', 'prigogine',
    'strange loop', 'hofstadter', 'godel incompleteness',
    // ── 情報科学との接点（新規追加）──
    'axiom system', 'formal proof', 'proof assistant',
    'type theory', 'dependent type', 'homotopy type theory',
    'compression theory', 'kolmogorov complexity',
    'minimum description length',
  ],
};

/** 探索の1件の候補（軽量、キャッシュ用） */
interface RawCandidate {
  title: string;
  url: string;
  abstract: string;   // 200文字以内に切り詰める（フルテキスト不要）
  source: DiscoverySource;
  fetchedAt: number;
}

/** 発見レポート */
export interface DiscoveryReport {
  runAt: number;
  duration: number;
  found: number;
  queued: number;
  skipped: number;
  details: Array<{
    title: string;
    source: DiscoverySource;
    score: number;
    confidenceTag: SevenLogicValue;
    queued: boolean;
    skipReason?: string;
  }>;
}

// ══════════════════════════════════════════════════════════════
// D-FUMT スコアリングエンジン
// ══════════════════════════════════════════════════════════════

/**
 * テキストのD-FUMT関連度を計算する
 * フルテキストは不要、タイトル+アブストのみで十分
 */
function calcDFUMTScore(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  let weightedScore = 0;

  // 高重みキーワード（D-FUMTの核心）
  const coreKeywords = [
    'catuskoti', '四値論理', 'nagarjuna', '龍樹',
    'paraconsistent', 'dialethism', 'many-valued logic',
    'dependent origination', '縁起', 'IIT', 'consciousness mathematics',
  ];

  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      hits++;
      const weight = coreKeywords.includes(kw) ? 2.0 : 1.0;
      weightedScore += weight;
    }
  }

  // ヒット数と重みの組み合わせで正規化
  const maxPossible = keywords.length * 1.5;
  return Math.min(1.0, weightedScore / Math.max(maxPossible * 0.1, 3));
}

/**
 * 発見したテキストからSeedTheoryを生成する
 * LLMは使わず、キーワードベースで種を構築
 */
function extractSeed(candidate: RawCandidate, keywords: string[]): SeedTheory {
  const text = `${candidate.title} ${candidate.abstract}`;
  const lower = text.toLowerCase();

  // カテゴリ推定
  const categoryMap: Array<[RegExp, string]> = [
    [/logic|論理|catuskoti|many.valued/i, 'logic'],
    [/consciousness|意識|IIT|awareness/i, 'consciousness'],
    [/quantum|量子/i, 'quantum'],
    [/category theory|topos|functor/i, 'mathematics'],
    [/buddhist|仏教|zen|禅|tao|道/i, 'eastern-philosophy'],
    [/process|whitehead|becoming/i, 'western-philosophy'],
    [/compression|entropy|information/i, 'computation'],
    [/spiral|fractal|dimension/i, 'number-system'],
  ];

  let category = 'general';
  for (const [pattern, cat] of categoryMap) {
    if (pattern.test(text)) { category = cat; break; }
  }

  // キーワード抽出（ヒットしたD-FUMTキーワード）
  const foundKeywords = keywords.filter(kw => lower.includes(kw.toLowerCase())).slice(0, 5);

  // 公理の種を生成（タイトルから圧縮）
  const shortTitle = candidate.title.slice(0, 60);
  const axiom = `[${candidate.source}] ${shortTitle}`;

  return {
    id: `discovered-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    axiom,
    category,
    keywords: foundKeywords,
  };
}

/**
 * D-FUMT整合性を評価する
 * 既存SEED_KERNELと照合してalignmentを計算
 */
function evalDFUMTAlignment(seed: SeedTheory): AxiomProposal['dfumtAlignment'] {
  const relatedIds: string[] = [];
  let maxAlignment = 0;

  for (const existing of SEED_KERNEL) {
    // キーワード重複でマッチング
    const overlap = seed.keywords.filter(kw =>
      existing.keywords.some(ek =>
        ek.toLowerCase().includes(kw.toLowerCase()) ||
        kw.toLowerCase().includes(ek.toLowerCase())
      )
    ).length;
    const score = overlap / Math.max(seed.keywords.length, 1);

    if (score > 0.3) relatedIds.push(existing.id);
    if (score > maxAlignment) maxAlignment = score;
  }

  // 既存理論と全く同じなら矛盾ではなく重複
  const isContradicting = false; // 自動検出は困難、レビュー時に判断
  const alignmentScore = Math.min(0.9, maxAlignment); // 1.0未満に制限（重複回避）

  const note = relatedIds.length > 0
    ? `関連理論: ${relatedIds.slice(0, 3).join(', ')}`
    : 'SEED_KERNELとの直接的な関連なし（新領域の可能性）';

  return {
    relatedTheoryIds: relatedIds.slice(0, 5),
    alignmentScore,
    alignmentNote: note,
    isContradicting,
  };
}

// ══════════════════════════════════════════════════════════════
// 探索アダプター（外部API接続層）
// ══════════════════════════════════════════════════════════════

/**
 * arXiv APIから候補を取得
 * 軽量APIレスポンス（summary 200文字以内）
 */
async function fetchArxiv(keywords: string[], maxResults = 5): Promise<RawCandidate[]> {
  const query = keywords.slice(0, 3).join('+AND+');
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${maxResults}&sortBy=relevance`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Rei-AIOS-DiscoveryAgent/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const candidates: RawCandidate[] = [];

    // 簡易XMLパース（DOMParserなし）
    const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? [];
    for (const entry of entries.slice(0, maxResults)) {
      const title   = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '';
      const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() ?? '';
      const id      = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() ?? '';

      if (!title || !id) continue;
      candidates.push({
        title: title.replace(/\s+/g, ' ').slice(0, 100),
        url: id,
        abstract: summary.replace(/\s+/g, ' ').slice(0, 200), // 200文字で切り詰め
        source: 'arxiv',
        fetchedAt: Date.now(),
      });
    }
    return candidates;
  } catch {
    return [];
  }
}

/**
 * Wikipedia APIから候補を取得
 * 検索結果のタイトル + snippet のみ（本文保存なし）
 */
async function fetchWikipedia(keywords: string[], maxResults = 5): Promise<RawCandidate[]> {
  const query = keywords.slice(0, 2).join(' ');
  const url = `https://en.wikipedia.org/api/rest_v1/page/search/page?q=${encodeURIComponent(query)}&limit=${maxResults}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Rei-AIOS-DiscoveryAgent/1.0 (https://github.com/fc0web/rei-aios)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json() as { pages?: Array<{ title: string; excerpt?: string; key: string }> };
    return (data.pages ?? []).slice(0, maxResults).map(p => ({
      title: p.title,
      url: `https://en.wikipedia.org/wiki/${p.key}`,
      abstract: (p.excerpt ?? '').replace(/<[^>]+>/g, '').slice(0, 200),
      source: 'wikipedia' as DiscoverySource,
      fetchedAt: Date.now(),
    }));
  } catch {
    return [];
  }
}

/**
 * GitHub Searchから候補を取得
 * リポジトリのname + description のみ
 */
async function fetchGitHub(keywords: string[], maxResults = 5): Promise<RawCandidate[]> {
  const query = keywords.slice(0, 2).join('+');
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+topic:logic+topic:philosophy&sort=stars&per_page=${maxResults}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Rei-AIOS-DiscoveryAgent/1.0',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json() as { items?: Array<{ full_name: string; description?: string; html_url: string }> };
    return (data.items ?? []).slice(0, maxResults).map(r => ({
      title: r.full_name,
      url: r.html_url,
      abstract: (r.description ?? '').slice(0, 200),
      source: 'github' as DiscoverySource,
      fetchedAt: Date.now(),
    }));
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// AxiomDiscoveryAgent 本体
// ══════════════════════════════════════════════════════════════

export class AxiomDiscoveryAgent {
  private config: DiscoveryConfig;
  private queue: AxiomProposalQueue;
  private lastRunAt = 0;
  private isRunning = false;

  constructor(queue: AxiomProposalQueue, config: Partial<DiscoveryConfig> = {}) {
    this.queue = queue;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 探索を1回実行する。
   * 前回実行からintervalMs未満なら早期リターン（連続実行防止）。
   */
  async discover(forceRun = false): Promise<DiscoveryReport> {
    const now = Date.now();

    if (!forceRun && now - this.lastRunAt < this.config.intervalMs) {
      const waitHours = ((this.config.intervalMs - (now - this.lastRunAt)) / 3600000).toFixed(1);
      return this.emptyReport(now, `次の探索まで ${waitHours} 時間`);
    }

    if (this.isRunning) {
      return this.emptyReport(now, '探索実行中（重複防止）');
    }

    this.isRunning = true;
    this.lastRunAt = now;
    const start = Date.now();
    const report: DiscoveryReport = {
      runAt: now,
      duration: 0,
      found: 0,
      queued: 0,
      skipped: 0,
      details: [],
    };

    try {
      // 探索クエリ（D-FUMTキーワードをランダムサンプリング）
      const queryKeywords = this.sampleKeywords(5);
      const candidates: RawCandidate[] = [];

      // 有効なソースから並行取得
      const fetches: Promise<RawCandidate[]>[] = [];
      if (this.config.enabledSources.includes('arxiv')) {
        fetches.push(fetchArxiv(queryKeywords, Math.ceil(this.config.maxPerRun / 2)));
      }
      if (this.config.enabledSources.includes('wikipedia')) {
        fetches.push(fetchWikipedia(queryKeywords, Math.ceil(this.config.maxPerRun / 3)));
      }
      if (this.config.enabledSources.includes('github')) {
        fetches.push(fetchGitHub(queryKeywords, Math.ceil(this.config.maxPerRun / 4)));
      }

      const results = await Promise.allSettled(fetches);
      for (const r of results) {
        if (r.status === 'fulfilled') candidates.push(...r.value);
      }

      report.found = candidates.length;

      // スコアリングとキュー投入
      for (const candidate of candidates.slice(0, this.config.maxPerRun)) {
        const text = `${candidate.title} ${candidate.abstract}`;
        const score = calcDFUMTScore(text, this.config.dfumtKeywords);

        if (score < this.config.minScore) {
          report.skipped++;
          report.details.push({
            title: candidate.title,
            source: candidate.source,
            score,
            confidenceTag: 'FALSE',
            queued: false,
            skipReason: `スコア不足 (${score.toFixed(2)} < ${this.config.minScore})`,
          });
          continue;
        }

        const seed = extractSeed(candidate, this.config.dfumtKeywords);
        const alignment = evalDFUMTAlignment(seed);
        const proposal = this.queue.enqueue({
          seed,
          source: candidate.source,
          sourceUrl: candidate.url,
          sourceTitle: candidate.title,
          discoveryScore: score,
          dfumtAlignment: alignment,
        });

        report.queued++;
        report.details.push({
          title: candidate.title,
          source: candidate.source,
          score,
          confidenceTag: proposal.confidenceTag,
          queued: true,
        });
      }
    } finally {
      this.isRunning = false;
      report.duration = Date.now() - start;
    }

    return report;
  }

  /**
   * D-FUMTキーワードをランダムサンプリング（探索の多様性確保）
   */
  private sampleKeywords(n: number): string[] {
    const shuffled = [...this.config.dfumtKeywords].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  private emptyReport(now: number, _reason: string): DiscoveryReport {
    return { runAt: now, duration: 0, found: 0, queued: 0, skipped: 0, details: [] };
  }

  /** 次回実行までの待機時間（ミリ秒） */
  getNextRunIn(): number {
    return Math.max(0, this.config.intervalMs - (Date.now() - this.lastRunAt));
  }
}
