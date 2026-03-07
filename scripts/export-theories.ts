/**
 * Rei-AIOS — theories.json エクスポーター
 *
 * 実行: npm run export:theories
 * 出力: theories.json (リポジトリルート)
 *
 * GitHubにpushすれば以下のURLで誰でも取得可能:
 * https://raw.githubusercontent.com/fc0web/rei-aios/main/theories.json
 */

import { writeFileSync } from 'fs';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';
import type { SeedTheory } from '../src/axiom-os/seed-kernel';
import { EXTENDED_THEORIES } from '../src/axiom-os/seed-kernel-extended';
import type { ExtendedTheory } from '../src/axiom-os/seed-kernel-extended';

// ─── 出力型定義 ──────────────────────────────────────────────

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

// ─── 変換処理 ────────────────────────────────────────────────

function convertSeedTheory(t: SeedTheory): TheoryEntry {
  return {
    id: t.id,
    axiom: t.axiom,
    category: t.category,
    keywords: t.keywords,
    source: 'seed',
  };
}

function convertExtendedTheory(t: ExtendedTheory): TheoryEntry {
  return {
    id: `dfumt-extended-${t.id}`,
    numericId: t.id,
    name: t.name,
    axiom: t.description,
    category: t.category,
    keywords: [t.category, ...(t.formula ? [t.formula.slice(0, 20)] : [])],
    dfumtValue: t.dfumtValue,
    description: t.description,
    formula: t.formula,
    relatedIds: t.relatedIds,
    source: 'extended',
  };
}

// ─── メイン処理 ──────────────────────────────────────────────

function main() {
  const seedEntries = SEED_KERNEL.map(convertSeedTheory);
  const extendedEntries = EXTENDED_THEORIES.map(convertExtendedTheory);
  const allTheories = [...seedEntries, ...extendedEntries];

  const categories = [...new Set(allTheories.map(t => t.category))].sort();

  const manifest: TheoriesManifest = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    repository: 'https://github.com/fc0web/rei-aios',
    license: 'CC0',
    author: '藤本 伸樹 (Nobuki Fujimoto) — fc0web',
    stats: {
      totalTheories: allTheories.length,
      seedTheories: seedEntries.length,
      extendedTheories: extendedEntries.length,
      categories,
    },
    theories: allTheories,
  };

  const outputPath = './theories.json';
  writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('theories.json を生成しました');
  console.log(`   総理論数   : ${manifest.stats.totalTheories}`);
  console.log(`   Seed理論   : ${manifest.stats.seedTheories}`);
  console.log(`   Extended理論: ${manifest.stats.extendedTheories}`);
  console.log(`   カテゴリ数  : ${categories.length}`);
  console.log('');
  console.log('git push 後に以下のURLで取得可能:');
  console.log('   https://raw.githubusercontent.com/fc0web/rei-aios/main/theories.json');
}

main();
