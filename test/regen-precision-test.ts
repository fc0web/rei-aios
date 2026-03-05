/**
 * 再生成精度向上テスト — source忠実度・TypeScript検証・ラウンドトリップ
 */
import * as fs   from 'fs';
import * as path from 'path';
import * as os   from 'os';
import { CodeAxiomExtractor } from '../src/axiom-os/code-axiom-extractor';
import { ReiRegenerator, type RegenerationResult } from '../src/cli/rei-regenerate';
import { verifyFile, verifyDirectory } from '../src/cli/rei-verify';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== 再生成精度向上テスト ===\n');

const regenerator = new ReiRegenerator();
const extractor = new CodeAxiomExtractor();

// テスト用の一時ディレクトリ
const tmpBase = path.join(os.tmpdir(), `rei-regen-test-${Date.now()}`);
let tmpCount = 0;
function tmpDir(): string {
  const d = path.join(tmpBase, `t${tmpCount++}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// ─── テスト1: source忠実度 — sourceフィールドが再生成コードに含まれること ──
{
  const axioms = [{
    id: 'cae-loop-test1',
    axiom: '∀x∈S: f(x) — 反復構造 [for]',
    category: 'computation',
    keywords: ['iteration', 'loop'],
    source: 'for (const item of items) { process(item); }',
  }];
  const dir = tmpDir();
  const result = regenerator.regenerate(axioms, dir);
  const content = fs.readFileSync(path.join(dir, 'computation.generated.ts'), 'utf-8');
  assert(content.includes('source-fidelity'), 'テスト1: sourceフィールドがsource-fidelityタグ付きで再生成');
  assert(content.includes('for (const item of items)'), 'テスト1: 元コード断片が含まれる');
}

// ─── テスト2: 汎用テンプレートフォールバック ─────────────────────
{
  const axioms = [{
    id: 'cae-branch-test2',
    axiom: 'P∨¬P — 分岐構造',
    category: 'logic',
    keywords: [],
  }];
  const dir = tmpDir();
  const result = regenerator.regenerate(axioms, dir);
  assert(result.templateCount === 1, 'テスト2: sourceなし・keywordsなしで汎用テンプレート使用');
}

// ─── テスト3: fidelityScore計算 ──────────────────────────────
{
  const axioms = [
    { id: 'cae-loop-t3a', axiom: 'a', category: 'c', keywords: ['k'], source: 'const x = items.map(i => i)' },
    { id: 'cae-branch-t3b', axiom: 'b', category: 'c', keywords: ['k2'] },
    { id: 'cae-guard-t3c', axiom: 'c', category: 'c', keywords: [] },
  ];
  const dir = tmpDir();
  const result = regenerator.regenerate(axioms, dir);
  // source: 1件(1.0), semi: 1件(0.5), template: 1件(0.0) → (1.0+0.5)/3 = 0.5
  assert(Math.abs(result.fidelityScore - 0.5) < 0.01, `テスト3: fidelityScore=0.5: ${result.fidelityScore.toFixed(2)}`);
}

// ─── テスト4: 実ファイルラウンドトリップ ─────────────────────────
{
  const testFile = path.join(__dirname, '..', 'src', 'axiom-os', 'code-axiom-extractor.ts');
  const code = fs.readFileSync(testFile, 'utf-8');
  const extracted = extractor.extract(code);

  // patternsからsource付き拡張公理を作成
  const extendedAxioms = extracted.patterns.map((p, i) => ({
    ...extracted.seedTheories[i],
    source: p.source,
  }));

  const dir = tmpDir();
  const result = regenerator.regenerate(extendedAxioms, dir);
  assert(result.fidelityScore > 0.3, `テスト4: 忠実度スコア>30%: ${(result.fidelityScore * 100).toFixed(1)}%`);
  assert(result.sourceFidelityCount > 0, `テスト4: source直接使用>0: ${result.sourceFidelityCount}件`);
}

// ─── テスト5: TypeScript構文チェック — 生成コードにfunctionが含まれること ──
{
  const axioms = [
    { id: 'cae-loop-t5', axiom: 'test', category: 'computation', keywords: ['iter'] },
  ];
  const dir = tmpDir();
  regenerator.regenerate(axioms, dir);
  const content = fs.readFileSync(path.join(dir, 'computation.generated.ts'), 'utf-8');
  assert(content.includes('function'), 'テスト5: 生成コードにfunctionが含まれる');
}

// ─── テスト6: keywords → 関数名推定 ────────────────────────────
{
  const axioms = [
    { id: 'cae-transform-t6', axiom: 'test', category: 'expansion', keywords: ['myFunc', 'test'] },
  ];
  const dir = tmpDir();
  regenerator.regenerate(axioms, dir);
  const content = fs.readFileSync(path.join(dir, 'expansion.generated.ts'), 'utf-8');
  assert(content.includes('myFunc'), 'テスト6: keywordsの最初の要素が関数名になる');
}

// ─── テスト7: カテゴリ別出力 ─────────────────────────────────
{
  const axioms = [
    { id: 'cae-loop-t7a', axiom: 'a', category: 'computation', keywords: ['k'] },
    { id: 'cae-branch-t7b', axiom: 'b', category: 'logic', keywords: ['k'] },
  ];
  const dir = tmpDir();
  regenerator.regenerate(axioms, dir);
  assert(fs.existsSync(path.join(dir, 'computation.generated.ts')), 'テスト7: computationカテゴリは別ファイル');
  assert(fs.existsSync(path.join(dir, 'logic.generated.ts')), 'テスト7: logicカテゴリは別ファイル');
}

// ─── テスト8: 展開率 ─────────────────────────────────────────
{
  const axioms = Array.from({ length: 10 }, (_, i) => ({
    id: `cae-loop-t8-${i}`,
    axiom: `axiom-${i}`,
    category: 'computation',
    keywords: ['k'],
  }));
  const dir = tmpDir();
  const result = regenerator.regenerate(axioms, dir);
  assert(result.totalBytes > 0, `テスト8: 再生成後のバイト数>0: ${result.totalBytes}`);
}

// ─── テスト9: 忠実度スコア範囲 ───────────────────────────────
{
  const axioms = [
    { id: 'cae-loop-t9', axiom: 'a', category: 'c', keywords: ['k'], source: 'const data = [1,2,3]' },
  ];
  const dir = tmpDir();
  const result = regenerator.regenerate(axioms, dir);
  assert(result.fidelityScore >= 0.0 && result.fidelityScore <= 1.0, `テスト9: スコア0.0〜1.0: ${result.fidelityScore}`);
}

// ─── テスト10: source長さ制限（5文字未満はフォールバック）──────────
{
  const axioms = [
    { id: 'cae-branch-t10', axiom: 'short', category: 'logic', keywords: ['k'], source: 'if' },
  ];
  const dir = tmpDir();
  const result = regenerator.regenerate(axioms, dir);
  assert(result.sourceFidelityCount === 0, 'テスト10: 5文字未満のsourceはsource-fidelity不使用');
  assert(result.semiFidelityCount === 1, 'テスト10: keywordsでsemi-fidelityにフォールバック');
}

// ─── テスト11〜20: 各patternKindのsource-fidelityテスト ──────────
const kindTests: Array<{ kind: string; source: string }> = [
  { kind: 'loop',      source: 'for (let i = 0; i < n; i++) { process(i); }' },
  { kind: 'recursion', source: 'function fib(n) { return n <= 1 ? n : fib(n-1) + fib(n-2); }' },
  { kind: 'branch',    source: 'if (condition) { doA(); } else { doB(); }' },
  { kind: 'transform', source: 'const mapped = items.map(x => transform(x));' },
  { kind: 'reduce',    source: 'const total = items.reduce((acc, x) => acc + x, 0);' },
  { kind: 'compose',   source: 'const pipeline = compose(parseInput, validate, execute);' },
  { kind: 'guard',     source: 'if (!isValid(x)) throw new Error("invalid");' },
  { kind: 'constant',  source: 'const MAX_RETRY = 3; const TIMEOUT = 5000;' },
  { kind: 'class',     source: 'class MyService extends BaseService implements IService {}' },
  { kind: 'async',     source: 'async function fetchData(url) { return await fetch(url); }' },
];

for (let i = 0; i < kindTests.length; i++) {
  const { kind, source } = kindTests[i];
  const axioms = [{
    id: `cae-${kind}-t${11 + i}`,
    axiom: `テスト公理 [${kind}]`,
    category: 'test',
    keywords: [`${kind}_fn`],
    source,
  }];
  const dir = tmpDir();
  const result = regenerator.regenerate(axioms, dir);
  const content = fs.readFileSync(path.join(dir, 'test.generated.ts'), 'utf-8');
  assert(
    content.includes('[再生成:source-fidelity]'),
    `テスト${11 + i}: ${kind} — source-fidelityタグ付き`
  );
}

// ─── テスト21: verifyFile が正常に動作すること ──────────────────
{
  const axioms = [
    { id: 'cae-loop-t21', axiom: 'test', category: 'computation', keywords: ['iter'], source: 'const arr = [1,2,3].map(x => x * 2);' },
  ];
  const dir = tmpDir();
  regenerator.regenerate(axioms, dir);
  const vResult = verifyFile(path.join(dir, 'computation.generated.ts'));
  assert(vResult.syntaxErrors === 0, 'テスト21: verifyFile構文エラー0件');
  assert(vResult.sourceFidelityCount === 1, 'テスト21: verifyFileがsource-fidelityタグを検出');
}

// ─── テスト22: verifyDirectory サマリー ─────────────────────────
{
  const axioms = [
    { id: 'cae-loop-t22a', axiom: 'a', category: 'computation', keywords: ['k'], source: 'const arr = items.filter(x => x > 0)' },
    { id: 'cae-branch-t22b', axiom: 'b', category: 'logic', keywords: ['check'] },
  ];
  const dir = tmpDir();
  regenerator.regenerate(axioms, dir);
  const { summary } = verifyDirectory(dir);
  assert(summary.totalFiles > 0, 'テスト22: verifyDirectory ファイル数>0');
  assert(summary.fidelityScore > 0, `テスト22: verifyDirectory 忠実度スコア>0: ${summary.fidelityScore.toFixed(2)}`);
}

// ─── クリーンアップ ──────────────────────────────────────────
try {
  fs.rmSync(tmpBase, { recursive: true, force: true });
} catch { /* ignore */ }

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
