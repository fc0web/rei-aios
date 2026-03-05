#!/usr/bin/env node
/**
 * rei-regenerate — 公理の種からコード構造を再生成
 * 使い方:
 *   npx tsx src/cli/rei-regenerate.ts axiom-seed-self.json --output regenerated/
 */

import * as fs   from 'fs';
import * as path from 'path';
import { type SeedTheory } from '../axiom-os/seed-kernel';

// 公理→コードテンプレートのマッピング
const AXIOM_TO_CODE: Record<string, (axiom: SeedTheory) => string> = {
  loop: (a) => `
// [再生成] ${a.axiom}
function processAll<T>(items: T[], fn: (item: T) => T): T[] {
  return items.map(fn);
}`,

  recursion: (a) => `
// [再生成] ${a.axiom}
function recursive<T>(value: T, base: (v: T) => boolean, step: (v: T) => T): T {
  if (base(value)) return value;
  return recursive(step(value), base, step);
}`,

  branch: (a) => `
// [再生成] ${a.axiom}
function branch<T>(condition: boolean, onTrue: T, onFalse: T): T {
  return condition ? onTrue : onFalse;
}`,

  transform: (a) => `
// [再生成] ${a.axiom}
function transform<A, B>(input: A, fn: (a: A) => B): B {
  return fn(input);
}`,

  reduce: (a) => `
// [再生成] ${a.axiom}
function converge<T>(items: T[], reducer: (acc: T, item: T) => T, initial: T): T {
  return items.reduce(reducer, initial);
}`,

  compose: (a) => `
// [再生成] ${a.axiom}
function compose<A, B, C>(f: (a: A) => B, g: (b: B) => C): (a: A) => C {
  return (a: A) => g(f(a));
}`,

  guard: (a) => `
// [再生成] ${a.axiom}
function guard<T>(value: T, predicate: (v: T) => boolean, msg: string): T {
  if (!predicate(value)) throw new Error(\`Guard failed: \${msg}\`);
  return value;
}`,

  constant: (a) => `
// [再生成] ${a.axiom}
const CONSTANT = Object.freeze({
  // ${a.keywords.join(', ')}
} as const);`,

  class: (a) => `
// [再生成] ${a.axiom}
interface Structure {
  // ${a.keywords.join(', ')}
  [key: string]: unknown;
}`,

  async: (a) => `
// [再生成] ${a.axiom}
async function asyncProcess<T>(fn: () => Promise<T>): Promise<T> {
  return await fn();
}`,

  error: (a) => `
// [再生成] ${a.axiom}
function safeExecute<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: Error } {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}`,

  module: (a) => `
// [再生成] ${a.axiom}
export * from './index';`,
};

function getKindFromAxiom(axiom: SeedTheory): string {
  const id = axiom.id; // cae-loop-xxx 形式
  const parts = id.split('-');
  return parts[1] ?? 'constant';
}

function main() {
  const args = process.argv.slice(2);
  const seedFile = args.find(a => !a.startsWith('--'));
  const outputDir = (() => {
    const idx = args.indexOf('--output');
    return idx >= 0 ? args[idx + 1] : 'regenerated';
  })();

  if (!seedFile || !fs.existsSync(seedFile)) {
    console.log('使い方: rei-regenerate.ts <seed.json> --output <dir>');
    console.log('例: rei-regenerate.ts axiom-seed-self.json --output regenerated/');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  rei-regenerate — 種からコード構造を再生成                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 種を読み込む
  const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
  const axioms: SeedTheory[] = Array.isArray(seedData)
    ? seedData
    : (seedData.axioms ?? []);

  console.log(`種ファイル: ${seedFile}`);
  console.log(`公理数: ${axioms.length}\n`);

  // 出力ディレクトリ作成
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // カテゴリ別に分類
  const byCategory = new Map<string, SeedTheory[]>();
  for (const axiom of axioms) {
    const cat = axiom.category ?? 'general';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(axiom);
  }

  let totalGenerated = 0;
  let totalBytes = 0;

  // カテゴリ別にファイル生成
  for (const [category, catAxioms] of byCategory) {
    const lines: string[] = [
      `/**`,
      ` * 再生成コード — カテゴリ: ${category}`,
      ` * 公理数: ${catAxioms.length}`,
      ` * 生成日時: ${new Date().toISOString()}`,
      ` * このファイルは rei-regenerate により自動生成されました`,
      ` */`,
      '',
    ];

    for (const axiom of catAxioms) {
      const kind = getKindFromAxiom(axiom);
      const generator = AXIOM_TO_CODE[kind] ?? AXIOM_TO_CODE['constant'];
      lines.push(generator(axiom));
      lines.push('');
      totalGenerated++;
    }

    const content = lines.join('\n');
    const outFile = path.join(outputDir, `${category}.generated.ts`);
    fs.writeFileSync(outFile, content, 'utf-8');
    const size = Buffer.byteLength(content, 'utf8');
    totalBytes += size;
    console.log(`  ${outFile} (${catAxioms.length}関数, ${size} bytes)`);
  }

  // インデックスファイル生成
  const indexLines = [
    `// 再生成インデックス — ${new Date().toISOString()}`,
    `// 種ファイル: ${seedFile}`,
    `// 公理数: ${axioms.length} → 関数数: ${totalGenerated}`,
    '',
    ...([...byCategory.keys()].map(cat => `export * from './${cat}.generated';`)),
  ];
  const indexContent = indexLines.join('\n');
  fs.writeFileSync(path.join(outputDir, 'index.ts'), indexContent, 'utf-8');

  // 検証: 元の種サイズ vs 再生成サイズ
  const seedSize = fs.statSync(seedFile).size;
  const expansionRatio = (totalBytes / seedSize) * 100;

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  再生成結果                                                ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  入力（種）サイズ  : ${String(seedSize).padStart(10)} bytes                    ║`);
  console.log(`║  出力（再生成）    : ${String(totalBytes).padStart(10)} bytes                    ║`);
  console.log(`║  展開率           : ${expansionRatio.toFixed(1).padStart(9)} %                    ║`);
  console.log(`║  生成関数数        : ${String(totalGenerated).padStart(10)}                        ║`);
  console.log(`║  生成ファイル数    : ${String(byCategory.size + 1).padStart(10)}                        ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n再生成完了: ${outputDir}/`);
}

main();
