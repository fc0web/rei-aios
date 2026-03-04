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

const CATEGORY_LABEL: Record<string, string> = {
  'zero_extension':  'ゼロ・π拡張理論',
  'logic':           '論理体系理論',
  'computation':     '計算構造理論',
  'mathematics':     '数学基盤理論',
  'consciousness':   '意識数学理論',
  'general':         '汎用基盤理論',
  'number-system':   '数体系理論',
  'expansion':       '拡張・縮小理論',
  'ai-integration':  'AI統合理論',
  'unified':         '統合・応用理論',
  'projection':      '空間投影理論',
  'cosmic':          '宇宙・因果理論',
};

/** 七価論理タグを推定する */
function inferSevenLogicTag(seed: SeedTheory): string {
  const text = seed.axiom + ' ' + seed.keywords.join(' ');
  if (text.includes('∞') || text.includes('infinity')) return '[∞]';
  if (text.includes('〇') || text.includes('未観測') || text.includes('潜在')) return '[〇]';
  if (text.includes('～') || text.includes('流動') || text.includes('変化')) return '[～]';
  if (text.includes('両方') || text.includes('矛盾') || text.includes('B')) return '[B]';
  if (text.includes('neither') || text.includes('N')) return '[N]';
  return '[⊤]';
}

/** カテゴリラベル + 七価論理タグ + キーワードで名前を生成 */
function generateName(seed: SeedTheory): string {
  const label = CATEGORY_LABEL[seed.category] ?? seed.category;
  const tag = inferSevenLogicTag(seed);
  const kw = seed.keywords[0] ?? seed.id.replace('dfumt-', '');
  return `${label} ${tag} ${kw}`;
}

/** カテゴリラベル + 公理 + キーワードで説明を生成 */
function generateDescription(seed: SeedTheory): string {
  const label = CATEGORY_LABEL[seed.category] ?? seed.category;
  const tag = inferSevenLogicTag(seed);
  return `${label} ${tag}: ${seed.axiom}。関連概念: ${seed.keywords.join('・')}`;
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
