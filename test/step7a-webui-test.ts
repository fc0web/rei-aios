import { generateAxiomOsWebUI } from '../src/ui/axiom-os-webui';
import * as fs from 'fs';
import * as path from 'path';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('\n=== STEP 7-A: Axiom OS WebUI テスト ===\n');

// ─── 1. デフォルトWebUI生成 ──────────────────────────────────
console.log('【1. WebUI生成テスト】');
const html = generateAxiomOsWebUI();

assert(html.includes('<!DOCTYPE html>'), 'HTML文書として正しい');
assert(html.includes('AXIOM OS'), 'AXIOM OSタイトルが含まれる');
assert(html.includes('D-FUMT'), 'D-FUMTが含まれる');
assert(html.includes('REI\\x04'), 'LLMZipのマジックバイトが含まれる');
assert(html.includes('ibushi-gin') || html.includes('#1a1a1e'), 'ibushi-ginデザインが適用されている');
assert(html.includes('七価論理'), '七価論理の記述がある');

// ─── 2. ペルソナの存在確認 ─────────────────────────────────
console.log('\n【2. ペルソナ確認】');
const personaNames = ['龍樹', '釈迦牟尼', '道元', 'ソクラテス', 'ウィトゲンシュタイン', '老子'];
for (const name of personaNames) {
  assert(html.includes(name), `ペルソナ「${name}」が存在する`);
}

// ─── 3. 公理ブラウザの確認 ────────────────────────────────
console.log('\n【3. 公理ブラウザ確認】');
assert(html.includes('Theory #1'),  'Theory #1が存在する');
assert(html.includes('Theory #67'), 'Theory #67（RCT）が存在する');
assert(html.includes('Theory #75'), 'Theory #75（SEED_KERNEL）が存在する');
assert(html.includes('catuṣkoṭi') || html.includes('catuskoti'), '四値論理の記述がある');

// ─── 4. 圧縮ベンチマークの確認 ──────────────────────────────
console.log('\n【4. 圧縮ベンチマーク確認】');
assert(html.includes('33.6'), 'HybridCompressor圧縮率33.6%');
assert(html.includes('47.0'), 'LLMZip圧縮率47.0%');
assert(html.includes('41.0'), 'RCT圧縮率41.0%');

// ─── 5. タブナビゲーションの確認 ─────────────────────────
console.log('\n【5. タブナビゲーション確認】');
assert(html.includes('歴史人物チャット'), 'チャットタブが存在する');
assert(html.includes('公理ブラウザ'), '公理ブラウザタブが存在する');
assert(html.includes('圧縮ベンチマーク'), 'ベンチマークタブが存在する');

// ─── 6. カスタムオプションテスト ─────────────────────────
console.log('\n【6. カスタムオプションテスト】');
const customHtml = generateAxiomOsWebUI({
  personas: [
    { id: 'test', name: 'テスト人物', era: 'テスト時代', logic: 'FLOWING', logicDisplay: '～',
      responses: ['テスト応答'] }
  ],
  theories: [
    { num: 99, title: 'テスト理論', description: 'テスト用の理論' }
  ],
});
assert(customHtml.includes('テスト人物'), 'カスタムペルソナが反映される');
assert(customHtml.includes('Theory #99'), 'カスタム理論が反映される');

// ─── 7. HTMLファイル出力 ──────────────────────────────────
console.log('\n【7. HTMLファイル保存】');
const outDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'axiom-os.html');
fs.writeFileSync(outPath, html, 'utf8');

assert(fs.existsSync(outPath), 'axiom-os.html が dist/に保存された');
const savedSize = fs.statSync(outPath).size;
assert(savedSize > 5000, `HTMLサイズが5KB以上: ${savedSize}bytes`);
console.log(`    保存: dist/axiom-os.html (${savedSize} bytes)`);

console.log(`\n結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
