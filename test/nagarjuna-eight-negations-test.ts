/**
 * Nagarjuna Eight Negations Tests — 八不偈テスト（16件）
 * Phase 6k-nagarjuna: Theory #94 龍樹八不偈形式証明
 */

import { NagarjunaEngine } from '../src/axiom-os/nagarjuna-engine';
import { UniversalLogicEngine } from '../src/axiom-os/universal-logic-engine';
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

console.log('\n=== Nagarjuna Eight Negations Tests (16) ===\n');

const engine = new NagarjunaEngine();
const universal = new UniversalLogicEngine();
const hott = new HomotopyTypeEngine();

// ── 八不偈の個別テスト ──

test('不生（No Arising） → NEITHER', () => {
  assert(engine.nagarjunaNegation('arising') === 'NEITHER',
    `arising = ${engine.nagarjunaNegation('arising')}`);
});

test('不滅（No Ceasing） → NEITHER', () => {
  assert(engine.nagarjunaNegation('ceasing') === 'NEITHER',
    `ceasing = ${engine.nagarjunaNegation('ceasing')}`);
});

test('不常（No Permanence） → NEITHER', () => {
  assert(engine.nagarjunaNegation('permanence') === 'NEITHER',
    `permanence = ${engine.nagarjunaNegation('permanence')}`);
});

test('不断（No Annihilation） → NEITHER', () => {
  assert(engine.nagarjunaNegation('annihilation') === 'NEITHER',
    `annihilation = ${engine.nagarjunaNegation('annihilation')}`);
});

test('不一（No Identity） → NEITHER', () => {
  assert(engine.nagarjunaNegation('identity') === 'NEITHER',
    `identity = ${engine.nagarjunaNegation('identity')}`);
});

test('不異（No Difference） → NEITHER', () => {
  assert(engine.nagarjunaNegation('difference') === 'NEITHER',
    `difference = ${engine.nagarjunaNegation('difference')}`);
});

test('不来（No Coming） → NEITHER', () => {
  assert(engine.nagarjunaNegation('coming') === 'NEITHER',
    `coming = ${engine.nagarjunaNegation('coming')}`);
});

test('不出（No Going） → NEITHER', () => {
  assert(engine.nagarjunaNegation('going') === 'NEITHER',
    `going = ${engine.nagarjunaNegation('going')}`);
});

// ── 統合テスト ──

test('八不偈全体がNEITHERに収束', () => {
  const result = engine.verifyEightNegations();
  assert(result.allConvergeToNEITHER === true,
    'not all negations converge to NEITHER');
  assert(result.details.length === 8, `details count: ${result.details.length}`);
});

test('空性（śūnyatā）== NEITHER', () => {
  assert(engine.sunyata() === 'NEITHER', `sunyata = ${engine.sunyata()}`);
  const result = engine.verifyEightNegations();
  assert(result.sunyataEqualsNEITHER === true, 'sunyata != NEITHER');
});

test('縁起的生起 == FLOWING', () => {
  const d = engine.dependentOrigination(true);
  assert(d === 'FLOWING', `dependent_origination(true) = ${d}`);
});

test('文脈なし縁起 == ZERO', () => {
  const d = engine.dependentOrigination(false);
  assert(d === 'ZERO', `dependent_origination(false) = ${d}`);
});

test('不一 + 不異 = 両者ともNEITHER', () => {
  const notOne  = engine.nagarjunaNegation('identity');
  const notDiff = engine.nagarjunaNegation('difference');
  assert(notOne === 'NEITHER', `identity = ${notOne}`);
  assert(notDiff === 'NEITHER', `difference = ${notDiff}`);
  assert(notOne === notDiff, 'identity negation != difference negation');
});

test('HoTT経路との対応: 来の否定 + FALSE→ZERO経路', () => {
  // FALSE → ZERO 経路は HoTT で存在する（ZERO への収束）
  const falseToZero = hott.buildPath('FALSE', 'ZERO');
  assert(falseToZero.exists === true, 'path FALSE→ZERO should exist');
  // 実体的「来者」はNEITHER
  assert(engine.nagarjunaNegation('coming') === 'NEITHER',
    'coming negation != NEITHER');
  // HoTT の空経路も NEITHER
  assert(engine.verifyEmptyPathIsNEITHER() === true,
    'empty path should normalize to NEITHER');
});

test('catuskoti(neither) == śūnyatā', () => {
  const catuskotiNeither = universal.catuskotiToLogic7(3); // 非有非無
  assert(catuskotiNeither === engine.sunyata(),
    `catuskoti(neither)=${catuskotiNeither} != sunyata=${engine.sunyata()}`);
});

test('lukasiewicz統一: lukasiewicz(unknown) == śūnyatā', () => {
  const lukUnknown = universal.lukasiewiczToLogic7(1); // 不定
  assert(lukUnknown === engine.sunyata(),
    `lukasiewicz(unknown)=${lukUnknown} != sunyata=${engine.sunyata()}`);
});

// ── 結果 ──

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
