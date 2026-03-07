/**
 * Rei-AIOS STEP 27 — PaperFullTextFetcher
 * ar5ivから論文本文を取得し、D-FUMT関連箇所を抽出する。
 *
 * 設計原則:
 *   - オンデマンド取得（自動実行しない）
 *   - 本文は SQLite にTTL付きキャッシュ（24時間）
 *   - 永続保存しない（容量・汚染リスク防止）
 *   - D-FUMT関連段落を自動ハイライト
 */

import * as https from 'https';
import * as http from 'http';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import type { ArxivPaper } from './types';

// ─── 型定義 ──────────────────────────────────────────────────

export interface PaperSection {
  heading:   string;     // セクション見出し
  text:      string;     // セクション本文（最大2000文字）
  relevant:  boolean;    // D-FUMT関連かどうか
  keywords:  string[];   // マッチしたキーワード
}

export interface PaperFullText {
  arxivId:    string;
  title:      string;
  abstract:   string;
  sections:   PaperSection[];
  references: string[];        // 参考文献タイトル（最大20件）
  fetchedAt:  number;
  source:     'ar5iv' | 'abstract_only';
  charCount:  number;
}

export interface ExtractionResult {
  paper:          PaperFullText;
  dfumtSections:  PaperSection[];    // D-FUMT関連セクションのみ
  axiomCandidates: string[];         // 公理候補テキスト
  relevanceScore:  number;           // 0〜1
}

// ─── D-FUMTキーワード（抽出に使用）─────────────────────────

const DFUMT_KEYWORDS = [
  // 七価論理・四句分別
  'seven-valued', 'seven valued', 'catuskoti', 'catuṣkoṭi',
  'four-valued', 'paraconsistent', 'dialethism', 'many-valued logic',
  // 龍樹・空・縁起
  'nagarjuna', 'sunyata', 'emptiness', 'dependent origination',
  'pratityasamutpada', 'madhyamaka', 'neither true nor false',
  // 意識・IIT
  'consciousness', 'integrated information', 'phi', 'qualia',
  // 数学的概念
  'category theory', 'homotopy type theory', 'infinity groupoid',
  'spiral', 'zero', 'flowing', 'both', 'neither',
  // 量子・物理
  'quantum logic', 'superposition', 'non-distributive',
  // 言語・身体
  'language game', 'tacit knowledge', 'embodiment', 'wittgenstein',
];

// ─── HTMLパーサー（依存なし・軽量）──────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<math[\s\S]*?<\/math>/gi, '[数式]')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSections(html: string): PaperSection[] {
  const sections: PaperSection[] = [];

  // h2/h3タグでセクションを分割
  const sectionRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>([\s\S]*?)(?=<h[23]|$)/gi;
  let m: RegExpExecArray | null;

  while ((m = sectionRe.exec(html)) !== null) {
    const heading = stripHtml(m[1]).slice(0, 100);
    const rawText = stripHtml(m[2]).slice(0, 2000);

    // D-FUMTキーワードをチェック
    const lowerText = (heading + ' ' + rawText).toLowerCase();
    const matchedKw = DFUMT_KEYWORDS.filter(kw => lowerText.includes(kw.toLowerCase()));

    sections.push({
      heading,
      text:     rawText,
      relevant: matchedKw.length > 0,
      keywords: matchedKw,
    });
  }

  // セクションが取れない場合は段落単位で分割
  if (sections.length === 0) {
    const paraRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let paraM: RegExpExecArray | null;
    let idx = 0;

    while ((paraM = paraRe.exec(html)) !== null && idx < 30) {
      const text = stripHtml(paraM[1]).slice(0, 500);
      if (text.length < 50) continue;

      const lowerText = text.toLowerCase();
      const matchedKw = DFUMT_KEYWORDS.filter(kw => lowerText.includes(kw.toLowerCase()));

      sections.push({
        heading:  `段落 ${++idx}`,
        text,
        relevant: matchedKw.length > 0,
        keywords: matchedKw,
      });
    }
  }

  return sections;
}

function extractReferences(html: string): string[] {
  const refs: string[] = [];
  const refSection = html.match(/<[^>]+id="[^"]*(?:reference|bibliography)[^"]*"[^>]*>([\s\S]*?)$/i);
  if (!refSection) return refs;

  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  let count = 0;

  while ((m = liRe.exec(refSection[1])) !== null && count < 20) {
    const ref = stripHtml(m[1]).slice(0, 200);
    if (ref.length > 20) {
      refs.push(ref);
      count++;
    }
  }

  return refs;
}

// ─── HTTP取得（https/http両対応）────────────────────────────

function httpFetch(url: string, redirectCount = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('リダイレクト上限超過'));
      return;
    }

    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'ReiAIOS/1.0 (academic research; contact: fc0web)',
        'Accept': 'text/html',
      }
    }, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        resolve(httpFetch(res.headers.location, redirectCount + 1));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error(`タイムアウト: ${url}`));
    });
  });
}

// ─── PaperFullTextFetcher 本体 ────────────────────────────────

export class PaperFullTextFetcher {
  private db:  Database.Database;
  private log: (msg: string) => void;
  private readonly TTL_MS = 24 * 60 * 60 * 1000;

  constructor(opts: {
    dbPath?: string;
    log?:   (msg: string) => void;
  } = {}) {
    const dbPath = opts.dbPath ?? ':memory:';
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    this.db  = new Database(dbPath);
    this.log = opts.log ?? (() => {});
    this._initSchema();
    this._cleanExpired();
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS paper_cache (
        arxivId    TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        data       TEXT NOT NULL,
        fetchedAt  INTEGER NOT NULL,
        expiresAt  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_expires ON paper_cache(expiresAt);
    `);
  }

  // ─── メイン: 論文本文を取得 ──────────────────────────────

  async fetch(arxivId: string, title = ''): Promise<PaperFullText> {
    const cached = this._loadCache(arxivId);
    if (cached) {
      this.log(`[Paper] キャッシュヒット: ${arxivId}`);
      return cached;
    }

    this.log(`[Paper] ar5iv取得開始: ${arxivId}`);

    try {
      const url = `https://ar5iv.org/html/${arxivId}`;
      const html = await httpFetch(url);

      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const fetchedTitle = titleMatch ? stripHtml(titleMatch[1]).replace(/\[.*?\]/g, '').trim() : title;

      const abstractMatch = html.match(/<(?:div|section)[^>]*class="[^"]*abstract[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i);
      const abstract = abstractMatch ? stripHtml(abstractMatch[1]).slice(0, 1000) : '';

      const sections   = extractSections(html);
      const references = extractReferences(html);

      const paper: PaperFullText = {
        arxivId,
        title:     fetchedTitle,
        abstract,
        sections,
        references,
        fetchedAt: Date.now(),
        source:    'ar5iv',
        charCount: sections.reduce((s, sec) => s + sec.text.length, 0),
      };

      this._saveCache(arxivId, paper);
      this.log(`[Paper] 取得完了: ${fetchedTitle.slice(0, 50)} (${sections.length}セクション, ${paper.charCount}文字)`);
      return paper;

    } catch (err: any) {
      this.log(`[Paper] ar5iv失敗（${err.message}）→ アブストラクトのみ`);
      return {
        arxivId,
        title,
        abstract:   '取得失敗',
        sections:   [],
        references: [],
        fetchedAt:  Date.now(),
        source:     'abstract_only',
        charCount:  0,
      };
    }
  }

  // ─── ArxivPaperオブジェクトから直接取得 ─────────────────

  async fetchFromArxivPaper(paper: ArxivPaper): Promise<ExtractionResult> {
    const fullText = await this.fetch(paper.id, paper.title);
    return this._extractDFUMT(fullText);
  }

  // ─── D-FUMT関連箇所の抽出 ───────────────────────────────

  private _extractDFUMT(paper: PaperFullText): ExtractionResult {
    const dfumtSections = paper.sections.filter(s => s.relevant);

    const axiomCandidates: string[] = [];
    const axiomPatterns = [
      /([^。.]{10,60}(?:は|が|を)[^。.]{5,40}(?:である|とする|定義する|示す))/g,
      /([^。.]{5,30}(?:≡|≜|:=|⊢)[^。.]{5,40})/g,
      /([A-Z][^.]{10,60}(?:iff|if and only if|is equivalent to)[^.]{5,40})/gi,
      /([^。.]{5,30}(?:NEITHER|BOTH|FLOWING|ZERO|INFINITY)[^。.]{5,40})/gi,
    ];

    for (const section of dfumtSections) {
      for (const pattern of axiomPatterns) {
        pattern.lastIndex = 0;
        const matches = section.text.match(pattern);
        if (matches) {
          axiomCandidates.push(...matches.slice(0, 2).map(m => m.trim()));
        }
      }
    }

    const totalKeywords = paper.sections.flatMap(s => s.keywords).length;
    const relevanceScore = Math.min(1, totalKeywords / 10);

    return {
      paper,
      dfumtSections,
      axiomCandidates: [...new Set(axiomCandidates)].slice(0, 10),
      relevanceScore,
    };
  }

  // ─── キャッシュ管理 ─────────────────────────────────────

  private _saveCache(arxivId: string, paper: PaperFullText): void {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO paper_cache (arxivId, title, data, fetchedAt, expiresAt)
        VALUES (@arxivId, @title, @data, @fetchedAt, @expiresAt)
      `).run({
        arxivId,
        title:     paper.title,
        data:      JSON.stringify(paper),
        fetchedAt: paper.fetchedAt,
        expiresAt: paper.fetchedAt + this.TTL_MS,
      });
    } catch (err: any) {
      this.log(`[Paper] キャッシュ保存失敗: ${err.message}`);
    }
  }

  private _loadCache(arxivId: string): PaperFullText | null {
    try {
      const row = this.db.prepare(
        'SELECT data FROM paper_cache WHERE arxivId = @arxivId AND expiresAt > @now'
      ).get({ arxivId, now: Date.now() }) as any;
      return row ? JSON.parse(row.data) : null;
    } catch { return null; }
  }

  private _cleanExpired(): void {
    const result = this.db.prepare('DELETE FROM paper_cache WHERE expiresAt <= @now').run({ now: Date.now() });
    if (result.changes > 0) this.log(`[Paper] 期限切れキャッシュ削除: ${result.changes}件`);
  }

  getCacheCount(): number {
    return (this.db.prepare('SELECT COUNT(*) as cnt FROM paper_cache WHERE expiresAt > @now').get({ now: Date.now() }) as any).cnt;
  }

  close(): void { this.db.close(); }
}
