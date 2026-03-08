/**
 * STEP 30 — PhilosophyFormalizationEngine テスト
 * 哲学テキスト→七価分類→公理候補→構造的同型→Reiコード
 */

import {
  PhilosophyFormalizationEngine,
  PHILOSOPHY_PATTERNS,
} from '../src/axiom-os/philosophy-formalization-engine';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';
import { AxiomEncoder } from '../src/axiom-os/axiom-encoder';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) {
    console.log(`  \u2705 ${name}`);
    passed++;
  } else {
    console.log(`  \u274c ${name}`);
    failed++;
  }
}

const engine = new PhilosophyFormalizationEngine(':memory:');

// ─── A. パターン辞書 ──────────────────────────────────────

console.log('\n=== A. パターン辞書 ===');

assert(PHILOSOPHY_PATTERNS.length >= 30, `A-1: パターン数=${PHILOSOPHY_PATTERNS.length}件`);

const domains = new Set(PHILOSOPHY_PATTERNS.map(p => p.logic7));
assert(domains.size >= 5, `A-2: Logic7値のバリエーション=${domains.size}種`);

// ─── B. 龍樹の空を形式化 ──────────────────────────────────

console.log('\n=== B. 龍樹の空 ===');

const r1 = engine.formalize('空と縁起について。すべては固有の実体を持たない。');
assert(r1.detectedPatterns.length >= 2, `B-1: パターン検出=${r1.detectedPatterns.length}件`);
assert(r1.detectedPatterns.some(p => p.keyword === '空'), 'B-2: 空を検出');
assert(r1.detectedPatterns.some(p => p.keyword === '縁起'), 'B-3: 縁起を検出');
assert(r1.primaryLogic7 === 'NEITHER' || r1.primaryLogic7 === 'FLOWING', `B-4: Logic7=${r1.primaryLogic7}`);
assert(r1.axiomCandidates.length >= 2, `B-5: 公理候補=${r1.axiomCandidates.length}件`);
assert(r1.confidence >= 0.7, `B-6: 信頼度=${(r1.confidence * 100).toFixed(0)}%`);

// ─── C. ヘーゲルの弁証法 ──────────────────────────────────

console.log('\n=== C. ヘーゲル弁証法 ===');

const r2 = engine.formalize('弁証法とアウフヘーベンの思想。テーゼとアンチテーゼの矛盾が統合される。');
assert(r2.primaryLogic7 === 'BOTH', `C-1: Logic7=${r2.primaryLogic7}`);
assert(r2.detectedPatterns.some(p => p.keyword === '弁証法'), 'C-2: 弁証法を検出');
assert(r2.detectedPatterns.some(p => p.keyword === 'アウフヘーベン'), 'C-3: アウフヘーベンを検出');

// ─── D. 老子の道 ──────────────────────────────────────────

console.log('\n=== D. 老子の道 ===');

const r3 = engine.formalize('道は語ることができない。無為自然の道。');
assert(r3.detectedPatterns.some(p => p.keyword === '道'), 'D-1: 道を検出');
assert(r3.detectedPatterns.some(p => p.keyword === '無為'), 'D-2: 無為を検出');
assert(r3.detectedPatterns.some(p => p.keyword === '自然'), 'D-3: 自然を検出');

// ─── E. 量子力学 ──────────────────────────────────────────

console.log('\n=== E. 量子力学 ===');

const r4 = engine.formalize('量子の重ね合わせと不確定性。観測前は複数の状態が共存する。');
assert(r4.detectedPatterns.some(p => p.keyword === '重ね合わせ'), 'E-1: 重ね合わせを検出');
assert(r4.detectedPatterns.some(p => p.keyword === '不確定性'), 'E-2: 不確定性を検出');
assert(r4.primaryLogic7 === 'BOTH' || r4.primaryLogic7 === 'NEITHER', `E-3: Logic7=${r4.primaryLogic7}`);

// ─── F. 構造的同型検出 ────────────────────────────────────

console.log('\n=== F. 構造的同型 ===');

const r5 = engine.formalize('龍樹の空と縁起、そして弁証法とアウフヘーベン。');
assert(r5.isomorphisms.length >= 1, `F-1: 同型検出=${r5.isomorphisms.length}件`);

// 龍樹-圏論の同型
const catIso = r5.isomorphisms.find(i =>
  i.domainA.includes('龍樹') || i.domainB.includes('圏論')
);
assert(catIso !== undefined, 'F-2: 龍樹-圏論の同型を検出');

// ヘーゲル-コホモロジーの同型
const hegelIso = r5.isomorphisms.find(i =>
  i.domainA.includes('ヘーゲル') || i.domainB.includes('コホモロジー')
);
assert(hegelIso !== undefined, 'F-3: ヘーゲル-コホモロジーの同型を検出');

// ─── G. Reiコード生成 ────────────────────────────────────

console.log('\n=== G. Reiコード ===');

assert(r1.reiCode.includes('Logic7'), 'G-1: ReiコードにLogic7');
assert(r1.reiCode.includes('axiom'), 'G-2: Reiコードにaxiom');
assert(r1.reiCode.includes('theory'), 'G-3: Reiコードにtheory');

// ─── H. SEED_KERNEL照合 ──────────────────────────────────

console.log('\n=== H. SEED_KERNEL照合 ===');

assert(r1.relatedTheories.length >= 2, `H-1: 関連理論=${r1.relatedTheories.length}件`);
assert(r1.relatedTheories.includes('dependent-origination'), 'H-2: dependent-origination');

// ─── I. カスタムパターン ──────────────────────────────────

console.log('\n=== I. カスタムパターン ===');

engine.addCustomPattern({
  keyword: 'D-FUMT',
  logic7: 'FLOWING',
  mathStructure: '次元藤本普遍数学理論: 全哲学・数学の統一的記述体系',
  description: 'すべての思想と数学を七価論理で統合する。',
});
const r6 = engine.formalize('D-FUMTと七価論理による哲学の数式化。');
assert(r6.detectedPatterns.some(p => p.keyword === 'D-FUMT'), 'I-1: カスタムパターン検出');

// ─── J. レポート生成 ──────────────────────────────────────

console.log('\n=== J. レポート生成 ===');

const report = engine.generateReport(r1);
assert(report.includes('Logic7'), 'J-1: レポートにLogic7');
assert(report.includes('公理候補'), 'J-2: レポートに公理候補');
assert(report.includes('Reiコード'), 'J-3: レポートにReiコード');
assert(report.includes('SEED_KERNEL'), 'J-4: レポートにSEED_KERNEL');

// ─── K. ゲーデル・ウィトゲンシュタイン同型 ────────────────

console.log('\n=== K. ゲーデル同型 ===');

const r7 = engine.formalize('不完全性定理と言語の限界。語り得ぬものについては沈黙せよ。');
const goedelIso = r7.isomorphisms.find(i =>
  i.explanation.includes('ゲーデル') || i.domainA.includes('ゲーデル')
);
assert(goedelIso !== undefined, 'K-1: ゲーデル・ウィトゲンシュタイン同型');

// ─── L. インド哲学 ────────────────────────────────────────

console.log('\n=== L. インド哲学 ===');

const r8 = engine.formalize('ブラフマンとアートマンの関係。無限のブラフマンの中に自己が存在する。');
assert(r8.detectedPatterns.some(p => p.keyword === 'ブラフマン'), 'L-1: ブラフマン検出');
assert(r8.detectedPatterns.some(p => p.keyword === 'アートマン'), 'L-2: アートマン検出');
assert(r8.detectedPatterns.some(p => p.keyword === '無限'), 'L-3: 無限検出');

// ─── M. パターンなしのテキスト ──────────────────────────

console.log('\n=== M. パターンなし ===');

const r9 = engine.formalize('今日は良い天気ですね。');
assert(r9.detectedPatterns.length === 0, `M-1: パターンなし=${r9.detectedPatterns.length}件`);
assert(r9.primaryLogic7 === 'FLOWING', `M-2: デフォルトFLOWING`);
assert(r9.confidence <= 0.4, `M-3: 低信頼度=${(r9.confidence*100).toFixed(0)}%`);

// ─── N. SEED_KERNEL 183理論 ──────────────────────────────

console.log('\n=== N. SEED_KERNEL 183理論 ===');

assert(SEED_KERNEL.length === 183, `N-1: SEED_KERNEL=${SEED_KERNEL.length}理論`);

const newTheories = [
  'dfumt-philosophy-math-isomorphism',
  'dfumt-language-mathematics-gap',
  'dfumt-flowing-formalization',
];
for (const id of newTheories) {
  assert(SEED_KERNEL.find(s => s.id === id) !== undefined, `N: ${id}`);
}

// ─── O. AxiomEncoder ────────────────────────────────────

console.log('\n=== O. AxiomEncoder ===');

const encoder = new AxiomEncoder();
assert(encoder.encodeCategory('philosophy_formalization') === 'pf', 'O-1: philosophy_formalization → pf');
assert(encoder.decodeCategory('pf') === 'philosophy_formalization', 'O-2: pf → philosophy_formalization');

// ─── 結果 ──────────────────────────────────────────────────

engine.close();

console.log(`\n${'='.repeat(50)}`);
console.log(`STEP 30 テスト結果: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`\u274c ${failed} tests failed`);
  process.exit(1);
} else {
  console.log('\u2705 All tests passed!');
}
