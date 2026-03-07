/**
 * 中論統合テスト（10件）
 * Phase 6k-nagarjuna: 龍樹・Łukasiewicz・HoTT・圏論 全体統合
 */

import { NagarjunaEngine } from '../src/axiom-os/nagarjuna-engine';
import { UniversalLogicEngine } from '../src/axiom-os/universal-logic-engine';
import { HomotopyTypeEngine } from '../src/axiom-os/homotopy-type-engine';
import { CircularOriginEngine } from '../src/axiom-os/circular-origin-engine';
import { MetaAxiomValidator } from '../src/axiom-os/meta-axiom-validator';

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

console.log('\n=== 中論統合テスト (10) ===\n');

const engine = new NagarjunaEngine();
const universal = new UniversalLogicEngine();
const hott = new HomotopyTypeEngine();
const circular = new CircularOriginEngine();
const meta = new MetaAxiomValidator();

// ── 三者統一テスト ──

test('龍樹・Łukasiewicz・HoTT三者統一', () => {
  const catuskotiNeither = universal.catuskotiToLogic7(3);    // 龍樹
  const lukasiewiczUnknown = universal.lukasiewiczToLogic7(1); // Łukasiewicz
  const hottEmpty = hott.buildIdentityType('INFINITY', 'NEITHER'); // HoTT

  assert(catuskotiNeither === 'NEITHER', `catuskoti = ${catuskotiNeither}`);
  assert(lukasiewiczUnknown === 'NEITHER', `lukasiewicz = ${lukasiewiczUnknown}`);
  assert(hottEmpty.normalized === 'NEITHER', `hott empty = ${hottEmpty.normalized}`);
  assert(catuskotiNeither === lukasiewiczUnknown, 'catuskoti != lukasiewicz');
  assert(lukasiewiczUnknown === hottEmpty.normalized, 'lukasiewicz != hott');
});

test('D-FUMT射影定理: 中論もLogic7に射影', () => {
  // 中論の全概念が七価論理に対応する
  const correspondence = engine.getLogic7Correspondence();
  assert(correspondence.length >= 7, `correspondence count: ${correspondence.length}`);
  const sevenValues = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'];
  for (const c of correspondence) {
    assert(sevenValues.includes(c.logic7Value),
      `${c.concept} maps to invalid value: ${c.logic7Value}`);
  }
});

test('切り詰め定理との整合性', () => {
  // 四句分別（中論の論理基盤）= truncation(1)
  const t1 = hott.truncate(1);
  assert(t1.values.includes('BOTH'), 'truncation(1) missing BOTH');
  assert(t1.values.includes('NEITHER'), 'truncation(1) missing NEITHER');
  assert(t1.values.length === 4, `truncation(1) values: ${t1.values.length}`);
});

test('圏論: 中論は圏を形成する', () => {
  assert(engine.verifyFormsCagtegory() === true,
    'nagarjuna system does not form a category');
});

test('∞圏論: 中論の高次否定はFLOWINGに収束', () => {
  // 高次の否定（否定の否定の...）も NEITHER → ZERO → FLOWING の円環
  const depOrig = engine.dependentOrigination(true); // FLOWING
  assert(depOrig === 'FLOWING', `dependent origination = ${depOrig}`);
});

test('円環根源: 中論はZEROに始まりZEROに終わる', () => {
  const links = engine.verifyTwelveLinks();
  assert(links.isCircular === true, 'not circular');
  assert(links.startIsZero === true, 'start != ZERO');
  assert(links.endIsZero === true, 'end != ZERO');
});

test('SeedKernel無矛盾性: Theory #94-96追加後も無矛盾', () => {
  assert(engine.verifyConsistencyWithKernel() === true,
    'inconsistent with kernel');
});

test('メタ公理充足: 龍樹理論は無矛盾性・最小性を満たす', () => {
  const consistency = meta.validateConsistency();
  assert(consistency.passed === true, `consistency: ${consistency.details}`);
  const minimality = meta.validateMinimality();
  assert(minimality.passed === true, `minimality: ${minimality.details}`);
});

test('宇宙階層: 中論はU_0（命題）レベルで表現可能', () => {
  // truncation(0) = 古典論理でも不生・不滅は表現可能（TRUE/FALSE）
  const t0 = hott.truncate(0);
  assert(t0.values.includes('TRUE'), 'truncation(0) missing TRUE');
  assert(t0.values.includes('FALSE'), 'truncation(0) missing FALSE');
  assert(t0.name === 'PropositionalLogic', `name: ${t0.name}`);
});

test('最終統一定理: D-FUMT = 中論の形式的完成', () => {
  // 全ての検証が通れば、D-FUMTは中論の形式的完成
  const eightNeg = engine.verifyEightNegations();
  const twelveLinks = engine.verifyTwelveLinks();
  const sunyata = engine.verifySunyata();
  const middlePath = engine.verifyMiddlePath();
  const tripleUnify = engine.verifyTripleUnification();

  assert(eightNeg.allConvergeToNEITHER === true, 'eight negations failed');
  assert(twelveLinks.isCircular === true, 'twelve links not circular');
  assert(sunyata.isCircular === true, 'sunyata not circular');
  assert(middlePath === true, 'middle path failed');
  assert(tripleUnify === true, 'triple unification failed');
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
