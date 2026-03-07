/**
 * Rei-AIOS STEP 12-B — GitHubAxiomFetcher
 *
 * GitHub Raw URLからD-FUMT公理を取得するクライアント。
 * 認証不要・Nostr不要・本番環境不要。
 *
 * 使い方:
 *   const fetcher = new GitHubAxiomFetcher();
 *   const result = await fetcher.fetchAll();
 *   console.log(result.theories.length);
 *
 * カスタムリポジトリ:
 *   const fetcher = new GitHubAxiomFetcher({
 *     owner: 'your-org',
 *     repo: 'your-fork',
 *     branch: 'main',
 *   });
 */

// ─── 型定義 ──────────────────────────────────────────────────

export interface TheoryEntry {
  id: string;
  numericId?: number;
  name?: string;
  axiom: string;
  category: string;
  keywords: string[];
  dfumtValue?: string;
  description?: string;
  formula?: string;
  relatedIds?: number[];
  source: 'seed' | 'extended';
}

export interface TheoriesManifest {
  version: string;
  exportedAt: string;
  repository: string;
  license: string;
  author: string;
  stats: {
    totalTheories: number;
    seedTheories: number;
    extendedTheories: number;
    categories: string[];
  };
  theories: TheoryEntry[];
}

export interface FetchOptions {
  owner?: string;
  repo?: string;
  branch?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export interface FetchResult {
  success: boolean;
  manifest?: TheoriesManifest;
  theories: TheoryEntry[];
  fromCache: boolean;
  fetchedAt: string;
  error?: string;
  url: string;
}

export interface SearchResult {
  theories: TheoryEntry[];
  query: string;
  totalFound: number;
}

// ─── キャッシュ ───────────────────────────────────────────────

interface CacheEntry {
  manifest: TheoriesManifest;
  cachedAt: number;
}

// ─── メインクラス ─────────────────────────────────────────────

export class GitHubAxiomFetcher {
  private readonly owner: string;
  private readonly repo: string;
  private readonly branch: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private cache: CacheEntry | null = null;

  constructor(options: FetchOptions = {}) {
    this.owner = options.owner ?? 'fc0web';
    this.repo = options.repo ?? 'rei-aios';
    this.branch = options.branch ?? 'main';
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.cacheTtlMs = options.cacheTtlMs ?? 60 * 60 * 1000; // 1時間
  }

  // ── Raw URL ──────────────────────────────────────────────────
  get rawUrl(): string {
    return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/theories.json`;
  }

  // ── 全理論取得 ────────────────────────────────────────────────
  async fetchAll(): Promise<FetchResult> {
    // キャッシュ確認
    if (this.cache && Date.now() - this.cache.cachedAt < this.cacheTtlMs) {
      return {
        success: true,
        manifest: this.cache.manifest,
        theories: this.cache.manifest.theories,
        fromCache: true,
        fetchedAt: new Date(this.cache.cachedAt).toISOString(),
        url: this.rawUrl,
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(this.rawUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const manifest: TheoriesManifest = await response.json();

      // キャッシュに保存
      this.cache = { manifest, cachedAt: Date.now() };

      return {
        success: true,
        manifest,
        theories: manifest.theories,
        fromCache: false,
        fetchedAt: new Date().toISOString(),
        url: this.rawUrl,
      };
    } catch (error) {
      return {
        success: false,
        theories: [],
        fromCache: false,
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        url: this.rawUrl,
      };
    }
  }

  // ── カテゴリで絞り込み ────────────────────────────────────────
  async fetchByCategory(category: string): Promise<SearchResult> {
    const result = await this.fetchAll();
    const theories = result.theories.filter(t => t.category === category);
    return { theories, query: category, totalFound: theories.length };
  }

  // ── キーワード検索 ────────────────────────────────────────────
  async search(query: string): Promise<SearchResult> {
    const result = await this.fetchAll();
    const q = query.toLowerCase();
    const theories = result.theories.filter(t =>
      t.axiom.toLowerCase().includes(q) ||
      t.keywords.some(k => k.toLowerCase().includes(q)) ||
      (t.name?.toLowerCase().includes(q)) ||
      (t.description?.toLowerCase().includes(q))
    );
    return { theories, query, totalFound: theories.length };
  }

  // ── 七価論理値で絞り込み ──────────────────────────────────────
  async fetchByDfumtValue(value: string): Promise<SearchResult> {
    const result = await this.fetchAll();
    const theories = result.theories.filter(t => t.dfumtValue === value);
    return { theories, query: value, totalFound: theories.length };
  }

  // ── IDで単体取得 ──────────────────────────────────────────────
  async fetchById(id: string): Promise<TheoryEntry | null> {
    const result = await this.fetchAll();
    return result.theories.find(t => t.id === id) ?? null;
  }

  // ── 統計情報 ──────────────────────────────────────────────────
  async getStats(): Promise<TheoriesManifest['stats'] | null> {
    const result = await this.fetchAll();
    return result.manifest?.stats ?? null;
  }

  // ── キャッシュクリア ──────────────────────────────────────────
  clearCache(): void {
    this.cache = null;
  }
}

// ─── シングルトン（デフォルト設定で即使用可能） ──────────────────

export const defaultFetcher = new GitHubAxiomFetcher();
