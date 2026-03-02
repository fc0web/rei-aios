/**
 * Rei-AIOS テーマI — OeisFetcher
 * OEIS (On-Line Encyclopedia of Integer Sequences) の
 * 無料JSONエンドポイントを使って数列を取得する。
 *
 * API: https://oeis.org/search?q=...&fmt=json
 * 登録不要・無料
 */

import * as https from 'https';
import { OeisSequence, OeisSearchOptions, OeisState } from './types';

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ReiAIOS/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (res.headers.location) { resolve(httpGet(res.headers.location)); return; }
      }
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('OEIS API タイムアウト')); });
  });
}

/** 数列の先頭値をD-FUMTエンジン入力ベクトルに正規化 */
function makeDfumtVector(values: number[]): number[] {
  const v = values.slice(0, 8);
  if (v.length === 0) return [0];
  const max = Math.max(...v.map(Math.abs), 1);
  return v.map(x => x / max);
}

export class OeisFetcher {
  private lastFetchTime = 0;
  private readonly MIN_INTERVAL_MS = 2000;

  async search(opts: OeisSearchOptions): Promise<OeisSequence[]> {
    const now = Date.now();
    const wait = this.MIN_INTERVAL_MS - (now - this.lastFetchTime);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this.lastFetchTime = Date.now();

    const { query, maxResults = 6 } = opts;
    const url = `https://oeis.org/search?q=${encodeURIComponent(query)}&fmt=json&start=0`;

    const raw = await httpGet(url);

    let json: any;
    try { json = JSON.parse(raw); }
    catch { throw new Error('OEIS レスポンスのパースに失敗しました'); }

    const results = json.results ?? [];
    return results.slice(0, maxResults).map((r: any) => {
      const rawValues: string = r.data ?? '';
      const values = rawValues.split(',').map(Number).filter(v => !isNaN(v));
      return {
        id:      `A${String(r.number).padStart(6, '0')}`,
        name:    r.name   ?? '(名前なし)',
        values:  values.slice(0, 20),
        formula: (r.formula ?? []).slice(0, 2).join(' | ') || undefined,
        comment: (r.comment ?? []).slice(0, 1).join('') || undefined,
        offset:  Number((r.offset ?? '0').split(',')[0]) || 0,
        dfumtVector: makeDfumtVector(values),
      } as OeisSequence;
    });
  }

  /** D-FUMT関連プリセット数列 */
  async fetchPreset(
    preset: 'fibonacci' | 'primes' | 'pi-digits' | 'phi-continued' | 'factorial',
  ): Promise<OeisSequence[]> {
    const queries: Record<string, string> = {
      'fibonacci':      'Fibonacci',
      'primes':         'prime numbers',
      'pi-digits':      'decimal expansion of Pi',
      'phi-continued':  'continued fraction golden ratio',
      'factorial':      'factorial',
    };
    return this.search({ query: queries[preset], maxResults: 4 });
  }

  /** IDで直接取得 例: 'A000045' */
  async fetchById(id: string): Promise<OeisSequence | null> {
    const num = id.replace(/^A/, '');
    const url = `https://oeis.org/search?q=id:A${num}&fmt=json`;
    const now = Date.now();
    const wait = this.MIN_INTERVAL_MS - (now - this.lastFetchTime);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this.lastFetchTime = Date.now();
    const raw = await httpGet(url);
    try {
      const json = JSON.parse(raw);
      const r = json.results?.[0];
      if (!r) return null;
      const values = (r.data ?? '').split(',').map(Number).filter((v: number) => !isNaN(v));
      return {
        id:      `A${String(r.number).padStart(6, '0')}`,
        name:    r.name ?? '(名前なし)',
        values:  values.slice(0, 20),
        formula: (r.formula ?? []).slice(0, 2).join(' | ') || undefined,
        comment: (r.comment ?? []).slice(0, 1).join('') || undefined,
        offset:  Number((r.offset ?? '0').split(',')[0]) || 0,
        dfumtVector: makeDfumtVector(values),
      };
    } catch { return null; }
  }
}

export function makeDefaultOeisState(): OeisState {
  return { sequences: [], query: '', fetchedAt: 0, isLoading: false };
}
