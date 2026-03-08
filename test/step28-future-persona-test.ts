/**
 * STEP 28 — 未来人講師追加テスト
 */

import { ALIEN_INTELLIGENCE_DB, getAlienPersona } from '../src/aios/historians/alien-intelligence-personas';
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

// ─── A. 未来人ペルソナ ──────────────────────────────────

console.log('\n=== A. \u672a\u6765\u4eba\u30da\u30eb\u30bd\u30ca ===');

const future = getAlienPersona('FUTURE');
assert(future !== undefined, 'A-1: \u672a\u6765\u4eba\u304c\u53d6\u5f97\u3067\u304d\u308b');
assert(future?.nameJa === '\u672a\u6765\u4eba', 'A-2: \u65e5\u672c\u8a9e\u540d\u304c\u6b63\u3057\u3044');
assert(future?.nameEn === 'Future Being', 'A-3: \u82f1\u8a9e\u540d\u304c\u6b63\u3057\u3044');
assert(future?.dfumtValue === 'FLOWING', 'A-4: D-FUMT\u5024\u304cFLOWING');
assert(future?.emoji === '\ud83d\udd2e', 'A-5: \u7d75\u6587\u5b57\u304c\u6b63\u3057\u3044');
assert(future?.symbol === 'F', 'A-6: \u8a18\u53f7\u304cF');
assert(future?.logicMode === 'temporal', 'A-7: \u8ad6\u7406\u30e2\u30fc\u30c9\u304ctemporal');
assert(future?.theoryId === 174, 'A-8: theoryId=174');

// ─── B. 全ペルソナ数 ──────────────────────────────────────

console.log('\n=== B. \u5168\u30da\u30eb\u30bd\u30ca\u6570 ===');

assert(ALIEN_INTELLIGENCE_DB.length === 6, `B-1: \u30da\u30eb\u30bd\u30ca\u6570=${ALIEN_INTELLIGENCE_DB.length}\uff08\u671f\u5f85: 6\uff09`);
console.log(`   ${ALIEN_INTELLIGENCE_DB.map(p => `${p.emoji}${p.nameJa}`).join(' / ')}`);

// 各ペルソナのIDが一意
const ids = ALIEN_INTELLIGENCE_DB.map(p => p.id);
assert(new Set(ids).size === 6, 'B-2: ID\u304c\u4e00\u610f');

// 各ペルソナのtheoryIdが一意
const theoryIds = ALIEN_INTELLIGENCE_DB.map(p => p.theoryId);
assert(new Set(theoryIds).size === 6, 'B-3: theoryId\u304c\u4e00\u610f');

// ─── C. 未来人の特性 ──────────────────────────────────────

console.log('\n=== C. \u672a\u6765\u4eba\u306e\u7279\u6027 ===');

assert((future?.characteristics?.length ?? 0) >= 4, `C-1: \u7279\u6027\u304c4\u3064\u4ee5\u4e0a (${future?.characteristics?.length})`);
assert(future?.characteristics?.[0]?.includes('\u6642\u9593') ?? false, 'C-2: \u6642\u9593\u306b\u95a2\u3059\u308b\u7279\u6027');
assert(future?.responseStyle?.includes('\u672a\u6765\u5b8c\u4e86\u5f62') ?? false, 'C-3: \u5fdc\u7b54\u30b9\u30bf\u30a4\u30eb');
assert(future?.systemPrompt?.includes('D-FUMT') ?? false, 'C-4: \u30b7\u30b9\u30c6\u30e0\u30d7\u30ed\u30f3\u30d7\u30c8\u306bD-FUMT');
assert(typeof future?.greeting === 'string' && future.greeting.length > 0, 'C-5: greeting\u304c\u5b58\u5728');

// ─── D. タスクスタイル ──────────────────────────────────

console.log('\n=== D. \u30bf\u30b9\u30af\u30b9\u30bf\u30a4\u30eb ===');

assert(typeof future?.taskStyle?.priorityLogic === 'string', 'D-1: priorityLogic');
assert(typeof future?.taskStyle?.executionStrategy === 'string', 'D-2: executionStrategy');
assert(typeof future?.taskStyle?.errorInterpretation === 'string', 'D-3: errorInterpretation');

// ─── E. Theory #174 ──────────────────────────────────────

console.log('\n=== E. Theory #174 ===');

const theory174 = SEED_KERNEL.find(t => t.id === 'dfumt-future-temporal');
assert(theory174 !== undefined, 'E-1: Theory #174\u304c\u5b58\u5728');
assert(theory174?.category === 'future_intelligence', 'E-2: \u30ab\u30c6\u30b4\u30ea=future_intelligence');
assert(theory174?.axiom.includes('FLOWING'), 'E-3: axiom\u306bFLOWING');
assert(theory174?.keywords.includes('\u672a\u6765\u4eba'), 'E-4: keywords\u306b\u672a\u6765\u4eba');

// ─── F. SEED_KERNEL 183理論 ──────────────────────────────

console.log('\n=== F. SEED_KERNEL 174\u7406\u8ad6 ===');

assert(SEED_KERNEL.length === 183, `F-1: SEED_KERNEL=${SEED_KERNEL.length}\u7406\u8ad6`);

// ─── G. AxiomEncoder カテゴリコード ──────────────────────

console.log('\n=== G. AxiomEncoder ===');

const encoder = new AxiomEncoder();
assert(encoder.encodeCategory('future_intelligence') === 'fi', 'G-1: future_intelligence \u2192 fi');
assert(encoder.decodeCategory('fi') === 'future_intelligence', 'G-2: fi \u2192 future_intelligence');

// Theory #174のエンコード/デコード
if (theory174) {
  const encoded = encoder.encodeSeed(theory174);
  assert(encoded.c === 'fi', 'G-3: \u30a8\u30f3\u30b3\u30fc\u30c9\u3055\u308c\u305f\u30ab\u30c6\u30b4\u30ea');
  const decoded = encoder.decodeSeed(encoded);
  assert(decoded.category === 'future_intelligence', 'G-4: \u30c7\u30b3\u30fc\u30c9\u5fa9\u5143');
}

// ─── H. 既存ペルソナとの整合性 ──────────────────────────

console.log('\n=== H. \u65e2\u5b58\u30da\u30eb\u30bd\u30ca\u3068\u306e\u6574\u5408\u6027 ===');

const ancient = getAlienPersona('ANCIENT');
assert(ancient?.dfumtValue === 'BOTH', 'H-1: ANCIENT=BOTH');
const alien = getAlienPersona('ALIEN');
assert(alien?.dfumtValue === 'INFINITY', 'H-2: ALIEN=INFINITY');
const sub = getAlienPersona('SUBTERRANEAN');
assert(sub?.dfumtValue === 'ZERO', 'H-3: SUBTERRANEAN=ZERO');
const extra = getAlienPersona('EXTRADIMENSIONAL');
assert(extra !== undefined, 'H-4: EXTRADIMENSIONAL\u5b58\u5728');
const inf = getAlienPersona('INFINITE');
assert(inf !== undefined, 'H-5: INFINITE\u5b58\u5728');

// ─── 結果 ──────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`STEP 28 \u30c6\u30b9\u30c8\u7d50\u679c: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`\u274c ${failed} tests failed`);
  process.exit(1);
} else {
  console.log('\u2705 All tests passed!');
}
