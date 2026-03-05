#!/usr/bin/env node
/**
 * rei-regenerate — 公理の種からコード構造を再生成（精度向上版）
 * 使い方:
 *   npx tsx src/cli/rei-regenerate.ts axiom-seed-self.json --output regenerated/
 */

import * as fs   from 'fs';
import * as path from 'path';
import { type SeedTheory } from '../axiom-os/seed-kernel';

// ─── 再生成結果 ──────────────────────────────────────────────

export interface RegenerationResult {
  totalAxioms: number;
  sourceFidelityCount: number;   // source直接使用の数
  semiFidelityCount: number;     // keywords活用の数
  templateCount: number;         // 汎用テンプレートの数
  fidelityScore: number;         // 0.0〜1.0
  outputDir: string;
  totalBytes: number;
  seedBytes: number;
  expansionRatio: number;
}

// ─── 拡張SeedTheory（source付き）──────────────────────────────

interface ExtendedSeedTheory extends SeedTheory {
  source?: string;
}

// ─── 汎用テンプレート（第3優先）───────────────────────────────

const AXIOM_TO_CODE: Record<string, (axiom: SeedTheory) => string> = {
  loop: (a) => `// [再生成:template] ${a.axiom}
function processAll<T>(items: T[], fn: (item: T) => T): T[] {
  return items.map(fn);
}`,
  recursion: (a) => `// [再生成:template] ${a.axiom}
function recursive<T>(value: T, base: (v: T) => boolean, step: (v: T) => T): T {
  if (base(value)) return value;
  return recursive(step(value), base, step);
}`,
  branch: (a) => `// [再生成:template] ${a.axiom}
function branch<T>(condition: boolean, onTrue: T, onFalse: T): T {
  return condition ? onTrue : onFalse;
}`,
  transform: (a) => `// [再生成:template] ${a.axiom}
function transform<A, B>(input: A, fn: (a: A) => B): B {
  return fn(input);
}`,
  reduce: (a) => `// [再生成:template] ${a.axiom}
function converge<T>(items: T[], reducer: (acc: T, item: T) => T, initial: T): T {
  return items.reduce(reducer, initial);
}`,
  compose: (a) => `// [再生成:template] ${a.axiom}
function compose<A, B, C>(f: (a: A) => B, g: (b: B) => C): (a: A) => C {
  return (a: A) => g(f(a));
}`,
  guard: (a) => `// [再生成:template] ${a.axiom}
function guard<T>(value: T, predicate: (v: T) => boolean, msg: string): T {
  if (!predicate(value)) throw new Error(\`Guard failed: \${msg}\`);
  return value;
}`,
  constant: (a) => `// [再生成:template] ${a.axiom}
const CONSTANT = Object.freeze({
  // ${a.keywords.join(', ')}
} as const);`,
  class: (a) => `// [再生成:template] ${a.axiom}
interface Structure {
  // ${a.keywords.join(', ')}
  [key: string]: unknown;
}`,
  async: (a) => `// [再生成:template] ${a.axiom}
async function asyncProcess<T>(fn: () => Promise<T>): Promise<T> {
  return await fn();
}`,
  error: (a) => `// [再生成:template] ${a.axiom}
function safeExecute<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: Error } {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}`,
  module: (a) => `// [再生成:template] ${a.axiom}
export * from './index';`,
  collection: (a) => `// [再生成:template] ${a.axiom}
function collect<T>(items: T[], fn: (item: T) => T): T[] {
  return items.map(fn);
}`,
  math: (a) => `// [再生成:template] ${a.axiom}
function compute(x: number): number {
  return x;
}`,
  string: (a) => `// [再生成:template] ${a.axiom}
function processText(s: string): string {
  return s;
}`,
  object: (a) => `// [再生成:template] ${a.axiom}
function processObject(obj: Record<string, unknown>): Record<string, unknown> {
  return { ...obj };
}`,
  state: (a) => `// [再生成:template] ${a.axiom}
function transition<S, A>(state: S, action: A, reducer: (s: S, a: A) => S): S {
  return reducer(state, action);
}`,
  debug: (a) => `// [再生成:template] ${a.axiom}
function observe<T>(label: string, value: T): T {
  return value;
}`,
  compare: (a) => `// [再生成:template] ${a.axiom}
function isEqual<T>(a: T, b: T): boolean {
  return a === b;
}`,
  cast: (a) => `// [再生成:template] ${a.axiom}
function cast<A, B>(value: A): B {
  return value as unknown as B;
}`,
};

// ─── セミ忠実テンプレート（第2優先）─────────────────────────────

function generateSemiTemplate(kind: string, funcName: string, keywords: string[], axiom: SeedTheory): string {
  const safeName = funcName.replace(/[^a-zA-Z0-9_]/g, '') || 'process';
  const comment = `// [再生成:semi-fidelity] ${axiom.axiom}`;

  switch (kind) {
    case 'loop':
      return `${comment}\nfunction ${safeName}<T>(items: T[]): T[] {\n  return items.map(x => x);\n}`;
    case 'branch':
      return `${comment}\nfunction ${safeName}(cond: boolean): string {\n  return cond ? '${keywords[1] ?? 'yes'}' : '${keywords[2] ?? 'no'}';\n}`;
    case 'transform':
      return `${comment}\nfunction ${safeName}<A, B>(input: A, fn: (a: A) => B): B {\n  return fn(input);\n}`;
    case 'reduce':
      return `${comment}\nfunction ${safeName}<T>(items: T[], init: T, fn: (a: T, b: T) => T): T {\n  return items.reduce(fn, init);\n}`;
    case 'compose':
      return `${comment}\nfunction ${safeName}<A, B>(value: A, fn: (a: A) => B): B {\n  return fn(value);\n}`;
    case 'guard':
      return `${comment}\nfunction ${safeName}<T>(value: T, check: (v: T) => boolean): T {\n  if (!check(value)) throw new Error('${safeName} failed');\n  return value;\n}`;
    case 'async':
      return `${comment}\nasync function ${safeName}<T>(fn: () => Promise<T>): Promise<T> {\n  return await fn();\n}`;
    case 'error':
      return `${comment}\nfunction ${safeName}<T>(fn: () => T): T | null {\n  try { return fn(); } catch { return null; }\n}`;
    case 'class':
      return `${comment}\ninterface ${safeName.charAt(0).toUpperCase() + safeName.slice(1)} {\n  [key: string]: unknown;\n}`;
    case 'module':
      return `${comment}\nexport const ${safeName} = {} as const;`;
    default:
      return `${comment}\nconst ${safeName} = undefined; // ${keywords.join(', ')}`;
  }
}

// ─── ユーティリティ ──────────────────────────────────────────

function getKindFromAxiom(axiom: SeedTheory): string {
  const parts = axiom.id.split('-');
  return parts[1] ?? 'constant';
}

// ─── 2段階生成関数 ────────────────────────────────────────────

function generateFromAxiom(axiom: ExtendedSeedTheory): { code: string; fidelity: 'source' | 'semi' | 'template' } {
  // 第1優先: source直接使用（5文字以上）
  const src = axiom.source;
  if (src && src.length >= 5) {
    return {
      code: `// [再生成:source-fidelity] ${axiom.axiom}\n${src}`,
      fidelity: 'source',
    };
  }

  // 第2優先: keywordsを使ったセミ忠実テンプレート
  const keywords = axiom.keywords ?? [];
  if (keywords.length > 0) {
    const funcName = keywords[0].replace(/[^a-zA-Z0-9_]/g, '') || 'process';
    const kind = getKindFromAxiom(axiom);
    return {
      code: generateSemiTemplate(kind, funcName, keywords, axiom),
      fidelity: 'semi',
    };
  }

  // 第3優先: 汎用テンプレート
  const kind = getKindFromAxiom(axiom);
  const generator = AXIOM_TO_CODE[kind] ?? AXIOM_TO_CODE['constant'];
  return { code: generator(axiom), fidelity: 'template' };
}

// ─── ReiRegenerator クラス（テストから利用可能）─────────────────

export class ReiRegenerator {
  regenerate(axioms: ExtendedSeedTheory[], outputDir: string): RegenerationResult {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // カテゴリ別に分類
    const byCategory = new Map<string, ExtendedSeedTheory[]>();
    for (const axiom of axioms) {
      const cat = axiom.category ?? 'general';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(axiom);
    }

    let sourceFidelityCount = 0;
    let semiFidelityCount = 0;
    let templateCount = 0;
    let totalBytes = 0;

    for (const [category, catAxioms] of byCategory) {
      const lines: string[] = [
        `/**`,
        ` * 再生成コード — カテゴリ: ${category}`,
        ` * 公理数: ${catAxioms.length}`,
        ` * このファイルは rei-regenerate により自動生成されました`,
        ` */`,
        '',
      ];

      for (const axiom of catAxioms) {
        const { code, fidelity } = generateFromAxiom(axiom);
        lines.push(code);
        lines.push('');
        if (fidelity === 'source') sourceFidelityCount++;
        else if (fidelity === 'semi') semiFidelityCount++;
        else templateCount++;
      }

      const content = lines.join('\n');
      const outFile = path.join(outputDir, `${category}.generated.ts`);
      fs.writeFileSync(outFile, content, 'utf-8');
      totalBytes += Buffer.byteLength(content, 'utf8');
    }

    // インデックスファイル
    const indexLines = [
      `// 再生成インデックス`,
      `// 公理数: ${axioms.length}`,
      '',
      ...([...byCategory.keys()].map(cat => `export * from './${cat}.generated';`)),
    ];
    fs.writeFileSync(path.join(outputDir, 'index.ts'), indexLines.join('\n'), 'utf-8');

    const totalAxioms = axioms.length;
    const fidelityScore = totalAxioms > 0
      ? (sourceFidelityCount * 1.0 + semiFidelityCount * 0.5) / totalAxioms
      : 0;

    return {
      totalAxioms,
      sourceFidelityCount,
      semiFidelityCount,
      templateCount,
      fidelityScore,
      outputDir,
      totalBytes,
      seedBytes: 0,
      expansionRatio: 0,
    };
  }
}

// ─── CLI メイン ───────────────────────────────────────────────

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
  console.log('║  rei-regenerate — 種からコード構造を再生成（精度向上版）     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
  const axioms: ExtendedSeedTheory[] = Array.isArray(seedData)
    ? seedData
    : (seedData.axioms ?? []);

  console.log(`種ファイル: ${seedFile}`);
  console.log(`公理数: ${axioms.length}\n`);

  const regenerator = new ReiRegenerator();
  const result = regenerator.regenerate(axioms, outputDir);

  const seedSize = fs.statSync(seedFile).size;
  result.seedBytes = seedSize;
  result.expansionRatio = seedSize > 0 ? (result.totalBytes / seedSize) * 100 : 0;

  // カテゴリ別ファイル一覧
  const genFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.generated.ts'));
  for (const f of genFiles) {
    const size = fs.statSync(path.join(outputDir, f)).size;
    console.log(`  ${path.join(outputDir, f)} (${size} bytes)`);
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  再生成結果（精度向上版）                                   ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  入力（種）サイズ  : ${String(seedSize).padStart(10)} bytes                    ║`);
  console.log(`║  出力（再生成）    : ${String(result.totalBytes).padStart(10)} bytes                    ║`);
  console.log(`║  展開率           : ${result.expansionRatio.toFixed(1).padStart(9)} %                    ║`);
  console.log(`║  忠実度スコア      : ${(result.fidelityScore * 100).toFixed(1).padStart(8)} %                         ║`);
  console.log(`║    source直接使用  : ${String(result.sourceFidelityCount).padStart(10)} 件                      ║`);
  console.log(`║    semi忠実       : ${String(result.semiFidelityCount).padStart(10)} 件                      ║`);
  console.log(`║    汎用テンプレート : ${String(result.templateCount).padStart(10)} 件                      ║`);
  console.log(`║  生成ファイル数    : ${String(genFiles.length + 1).padStart(10)}                        ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n再生成完了: ${outputDir}/`);
}

// CLIとして直接実行された場合のみmain()を呼ぶ
if (require.main === module) {
  main();
}
