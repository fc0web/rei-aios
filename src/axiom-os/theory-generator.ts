/**
 * TheoryGenerator — 種（SeedTheory）からフルの TheoryRow を再生成する
 *
 * seed-kernel.ts の最小データ（axiom + category + keywords）から
 * name・description を自動生成し、TheoryRow 互換オブジェクトを返す。
 */

import { SEED_KERNEL, type SeedTheory } from './seed-kernel';
import type { TheoryRow } from './types';

/** キーワードから constant_ref を推定する */
function inferConstantRef(keywords: string[]): string | null {
  const joined = keywords.join(' ').toLowerCase();
  if (joined.includes('pi') || joined.includes('π')) return 'pi';
  if (joined.includes('phi') || joined.includes('φ')) return 'phi';
  if (joined.includes('infinity') || joined.includes('∞')) return 'infinity';
  if (joined.includes('omega') || joined.includes('Ω')) return 'omega';
  return null;
}

/** 種IDから短縮名を生成する（dfumt-xxx → xxx をタイトルケースに） */
function generateName(seed: SeedTheory): string {
  const kw = seed.keywords[0] ?? seed.id.replace('dfumt-', '');
  return `${kw}（${seed.axiom.slice(0, 20).replace(/[,、]/g, '')}…）`;
}

/** 種からdescriptionを生成する */
function generateDescription(seed: SeedTheory): string {
  return `D-FUMT理論 [${seed.category}]: ${seed.axiom}。キーワード: ${seed.keywords.join('・')}`;
}

export class TheoryGenerator {
  private readonly seeds: SeedTheory[];
  private readonly seedMap: Map<string, SeedTheory>;

  constructor(seeds: SeedTheory[] = SEED_KERNEL) {
    this.seeds = seeds;
    this.seedMap = new Map(seeds.map(s => [s.id, s]));
  }

  /** 種IDからフルの理論データを再生成する */
  generate(seedId: string): TheoryRow {
    const seed = this.seedMap.get(seedId);
    if (!seed) throw new Error(`Seed not found: ${seedId}`);

    return {
      id: seed.id,
      name: generateName(seed),
      axiom: seed.axiom,
      description: generateDescription(seed),
      category: seed.category,
      constant_ref: inferConstantRef(seed.keywords),
      created_at: new Date().toISOString(),
    };
  }

  /** 全種から全理論を再生成する */
  generateAll(): TheoryRow[] {
    return this.seeds.map(s => this.generate(s.id));
  }

  /** 全種データをJSON文字列に圧縮（最小化） */
  compress(): string {
    return JSON.stringify(this.seeds);
  }

  /** 圧縮データから種を復元する */
  decompress(compressed: string): SeedTheory[] {
    return JSON.parse(compressed) as SeedTheory[];
  }

  /** 種サイズ vs フルサイズの比較レポート */
  sizeReport(): { seedSize: number; fullSize: number; ratio: number } {
    const seedSize = Buffer.byteLength(this.compress(), 'utf-8');
    const fullData = this.generateAll();
    const fullSize = Buffer.byteLength(JSON.stringify(fullData), 'utf-8');
    return {
      seedSize,
      fullSize,
      ratio: seedSize / fullSize,
    };
  }
}
