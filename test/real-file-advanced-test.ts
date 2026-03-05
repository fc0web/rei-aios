import * as fs   from 'fs';
import * as path from 'path';
import { CodeAxiomExtractor } from '../src/axiom-os/code-axiom-extractor';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== 実ファイル発展テスト（20種パターン）===\n');

const extractor = new CodeAxiomExtractor();

// パターン拡張テスト
const testCode = `
import { something } from './module';
class MyService implements IService {
  private state: string = 'initial';
  async fetchData(url: string): Promise<string> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('failed');
      return res.json();
    } catch (e) {
      console.error('Error:', e);
      return '';
    }
  }
  transform(items: string[]): string[] {
    return items
      .map(x => x.toUpperCase())
      .filter(x => x.length > 0)
      .reduce((acc, x) => acc + x, '');
  }
}
const PI = Math.PI;
const isEqual = (a: unknown, b: unknown) => a === b;
`;

const result = extractor.extract(testCode);
const kinds = result.patterns.map((p: any) => p.kind);

// 新規パターン検出テスト
assert(kinds.includes('class')  || kinds.includes('module'),  '新種: class/module検出');
assert(kinds.includes('async')  || kinds.includes('error'),   '新種: async/error検出');
assert(kinds.includes('string') || kinds.includes('math'),    '新種: string/math検出');
assert(kinds.includes('compare')|| kinds.includes('object'),  '新種: compare/object検出');
assert(result.patterns.length > 8, `パターン数が8種超: ${result.patterns.length}種`);

// 実ファイルでの計測
const AXIOM_OS_DIR = path.join(__dirname, '..', 'src', 'axiom-os');
const files = fs.readdirSync(AXIOM_OS_DIR).filter(f => f.endsWith('.ts'));
let totalPatterns = 0;
let totalFiles = 0;

for (const f of files) {
  const code = fs.readFileSync(path.join(AXIOM_OS_DIR, f), 'utf-8');
  const r = extractor.extract(code);
  totalPatterns += r.patterns.length;
  totalFiles++;
}

assert(totalFiles > 0, `実ファイル処理: ${totalFiles}件`);
console.log(`  実ファイル総パターン数（拡張後）: ${totalPatterns}`);
assert(totalPatterns > 66, `拡張後パターン数が66超（以前より増加）: ${totalPatterns}`);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
