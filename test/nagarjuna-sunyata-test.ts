/**
 * Dependent Origination and Sunyata Tests — 縁起・空性テスト（14件）
 * Phase 6k-nagarjuna: Theory #95 縁起円環論 + Theory #96 二諦論
 */

import { NagarjunaEngine } from '../src/axiom-os/nagarjuna-engine';
import { CircularOriginEngine } from '../src/axiom-os/circular-origin-engine';
import { HomotopyTypeEngine } from '../src/axiom-os/homotopy-type-engine';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

console.log('\n=== Dependent Origination and Sunyata Tests (14) ===\n');

const engine = new NagarjunaEngine();
const circular = new CircularOriginEngine();
const hott = new HomotopyTypeEngine();

// ── 十二縁起テスト ──

test('十二縁起の円環確認', () => {
  const result = engine.verifyTwelveLinks();
  assert(result.isCircular === true, 'twelve links not circular');
});

test('十二縁起: 始点ZERO（無明）', () => {
  const chain = engine.buildTwelveLinksChain();
  assert(chain[0].value === 'ZERO', `first = ${chain[0].value}`);
  assert(chain[0].japanese === '無明', `first name = ${chain[0].japanese}`);
});

test('十二縁起: 終点ZERO（老死）', () => {
  const chain = engine.buildTwelveLinksChain();
  assert(chain[11].value === 'ZERO', `last = ${chain[11].value}`);
  assert(chain[11].japanese === '老死', `last name = ${chain[11].japanese}`);
});

test('十二縁起: 中間はFLOWING', () => {
  const result = engine.verifyTwelveLinks();
  assert(result.middleAllFlowing === true, 'not all middle links are FLOWING');
  const chain = engine.buildTwelveLinksChain();
  for (let i = 1; i < 11; i++) {
    assert(chain[i].value === 'FLOWING',
      `link ${i} (${chain[i].japanese}) = ${chain[i].value}`);
  }
});

// ── 空性テスト ──

test('空の空 = ZERO', () => {
  assert(engine.emptinessOfEmptiness() === 'ZERO',
    `emptiness_of_emptiness = ${engine.emptinessOfEmptiness()}`);
});

test('空性とCircularOriginEngineの同型', () => {
  // 空性の円環: NEITHER → ZERO（空の空）→ 発生 → 還元 → ZERO
  const sunyataResult = engine.verifySunyata();
  assert(sunyataResult.isCircular === true, 'sunyata not circular');
  assert(circular.verifySelfIdentity() === true, 'ZERO self-identity failed');
});

test('中道 = 七価論理全体', () => {
  assert(engine.verifyMiddlePath() === true,
    'middle path does not cover all seven values');
});

// ── 二諦論テスト ──

test('真諦（TRUE領域）vs 俗諦（FALSE領域）', () => {
  const tt = engine.twoTruths();
  assert(tt.paramartha.domain === 'TRUE', `paramartha = ${tt.paramartha.domain}`);
  assert(tt.samvrti.domain === 'FALSE', `samvrti = ${tt.samvrti.domain}`);
});

test('二諦の関係 = FLOWING', () => {
  const tt = engine.twoTruths();
  assert(tt.relation === 'FLOWING', `relation = ${tt.relation}`);
});

test('究極真理 = NEITHER', () => {
  const tt = engine.twoTruths();
  assert(tt.ultimateTruth === 'NEITHER', `ultimate = ${tt.ultimateTruth}`);
});

// ── 空性と縁起の統一 ──

test('縁起 == 空性（第二十四章18偈）', () => {
  // 空性(NEITHER)と縁起(FLOWING)は経路で繋がる
  // ZERO → FLOWING は CircularOriginEngine の円環
  const sunyata = engine.sunyata(); // NEITHER
  const depOrig = engine.dependentOrigination(true); // FLOWING
  assert(sunyata !== depOrig, 'sunyata and dependent origination should differ');
  // しかし両者はZEROを通じて円環する
  assert(engine.emptinessOfEmptiness() === 'ZERO',
    'emptiness does not reduce to ZERO');
});

test('単価性: FALSE→ZERO経路が存在し、縁起円環を支える', () => {
  // FALSE → ZERO の経路は HoTT の flowing pair に定義
  const falseToZero = hott.buildPath('FALSE', 'ZERO');
  assert(falseToZero.exists === true, 'path FALSE→ZERO should exist');
  // 単価性: 同型な論理体系は等しい
  const uv = hott.verifyUnivalence('Logic7', 'Logic7');
  assert(uv.univalent === true, 'univalence should hold');
});

test('ウィトゲンシュタイン沈黙 = 空の空', () => {
  assert(circular.isIneffable() === true, 'not ineffable');
  assert(engine.emptinessOfEmptiness() === 'ZERO', 'emptiness != ZERO');
  const root = circular.getRootPrinciple();
  assert(root.logic7Value === 'ZERO', `root = ${root.logic7Value}`);
});

test('ゲーデル限界 = 空性の自己言及不能', () => {
  const sunyataResult = engine.verifySunyata();
  assert(sunyataResult.godelLimit === true, 'no godel limit');
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
