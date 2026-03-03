/**
 * D-FUMT 七価論理 — テスト
 *
 * Usage: npx tsx test/seven-logic-test.ts
 */

import { AxiomOSStore } from '../src/axiom-os';
import {
  SEVEN_VALUES, SYMBOL_MAP,
  not, and, or, collapse, lift,
  toSymbol, fromSymbol,
  isFourValued, isExtended, isDefinite,
  checkDeMorgan, checkIdempotent,
} from '../src/axiom-os/seven-logic';
import type { SevenLogicValue, FourLogicValue } from '../src/axiom-os/seven-logic';

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

function eq(a: SevenLogicValue, b: SevenLogicValue, label: string) {
  assert(a === b, `${label}: expected ${b}, got ${a}`);
}

function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  D-FUMT Seven-Valued Logic — Test Suite  ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log();

  // ── Seed確認 ──
  console.log('── theories seed (七価論理3理論) ──');

  test('dfumt-infinity-value exists in DB', () => {
    const store = new AxiomOSStore(':memory:', { seed: true });
    const t = store.getTheoryById('dfumt-infinity-value');
    assert(t !== undefined, 'not found');
    assert(t!.name.includes('無限値'), `name: ${t!.name}`);
    assert(t!.category === 'logic', `category: ${t!.category}`);
    assert(t!.constant_ref === 'infinity', `constant_ref: ${t!.constant_ref}`);
    store.close();
  });

  test('dfumt-zero-state exists in DB', () => {
    const store = new AxiomOSStore(':memory:', { seed: true });
    const t = store.getTheoryById('dfumt-zero-state');
    assert(t !== undefined, 'not found');
    assert(t!.name.includes('ゼロ状態'), `name: ${t!.name}`);
    assert(t!.axiom.includes('〇'), 'axiom should contain 〇');
    store.close();
  });

  test('dfumt-flowing-value exists in DB', () => {
    const store = new AxiomOSStore(':memory:', { seed: true });
    const t = store.getTheoryById('dfumt-flowing-value');
    assert(t !== undefined, 'not found');
    assert(t!.name.includes('流動値'), `name: ${t!.name}`);
    assert(t!.axiom.includes('～'), 'axiom should contain ～');
    store.close();
  });

  test('total theories: 15', () => {
    const store = new AxiomOSStore(':memory:', { seed: true });
    const all = store.getAllTheories();
    assert(all.length === 15, `Expected 15, got ${all.length}`);
    store.close();
  });

  // ── 型・分類 ──
  console.log();
  console.log('── 型・分類 ──');

  test('SEVEN_VALUES has 7 elements', () => {
    assert(SEVEN_VALUES.length === 7, `length: ${SEVEN_VALUES.length}`);
  });

  test('isFourValued / isExtended', () => {
    assert(isFourValued('TRUE'), 'TRUE is four-valued');
    assert(isFourValued('FALSE'), 'FALSE is four-valued');
    assert(isFourValued('BOTH'), 'BOTH is four-valued');
    assert(isFourValued('NEITHER'), 'NEITHER is four-valued');
    assert(!isFourValued('INFINITY' as any), 'INFINITY is not four-valued');
    assert(isExtended('INFINITY'), 'INFINITY is extended');
    assert(isExtended('ZERO'), 'ZERO is extended');
    assert(isExtended('FLOWING'), 'FLOWING is extended');
    assert(!isExtended('TRUE' as any), 'TRUE is not extended');
  });

  test('isDefinite', () => {
    assert(isDefinite('TRUE'), 'TRUE is definite');
    assert(isDefinite('FALSE'), 'FALSE is definite');
    assert(!isDefinite('BOTH'), 'BOTH is not definite');
    assert(!isDefinite('INFINITY'), 'INFINITY is not definite');
  });

  // ── 記号変換 ──
  console.log();
  console.log('── 記号変換 ──');

  test('toSymbol / fromSymbol roundtrip', () => {
    for (const v of SEVEN_VALUES) {
      const sym = toSymbol(v);
      const back = fromSymbol(sym);
      assert(back === v, `roundtrip failed for ${v}: ${sym} → ${back}`);
    }
  });

  test('fromSymbol accepts aliases', () => {
    eq(fromSymbol('true')!, 'TRUE', 'true');
    eq(fromSymbol('false')!, 'FALSE', 'false');
    eq(fromSymbol('both')!, 'BOTH', 'both');
    eq(fromSymbol('~')!, 'FLOWING', '~');
    eq(fromSymbol('○')!, 'ZERO', '○');
    eq(fromSymbol('infinity')!, 'INFINITY', 'infinity');
  });

  // ── NOT ──
  console.log();
  console.log('── NOT (否定) ──');

  test('NOT: classical values', () => {
    eq(not('TRUE'), 'FALSE', 'NOT(⊤)');
    eq(not('FALSE'), 'TRUE', 'NOT(⊥)');
  });

  test('NOT: Belnap values are fixed points', () => {
    eq(not('BOTH'), 'BOTH', 'NOT(B)');
    eq(not('NEITHER'), 'NEITHER', 'NOT(N)');
  });

  test('NOT: extended values are fixed points', () => {
    eq(not('INFINITY'), 'INFINITY', 'NOT(∞)');
    eq(not('ZERO'), 'ZERO', 'NOT(〇)');
    eq(not('FLOWING'), 'FLOWING', 'NOT(～)');
  });

  test('NOT: double negation ── NOT(NOT(x)) = x', () => {
    for (const v of SEVEN_VALUES) {
      eq(not(not(v)), v, `NOT(NOT(${v}))`);
    }
  });

  // ── AND ──
  console.log();
  console.log('── AND (論理積) ──');

  test('AND: classical truth table', () => {
    eq(and('TRUE', 'TRUE'), 'TRUE', '⊤∧⊤');
    eq(and('TRUE', 'FALSE'), 'FALSE', '⊤∧⊥');
    eq(and('FALSE', 'TRUE'), 'FALSE', '⊥∧⊤');
    eq(and('FALSE', 'FALSE'), 'FALSE', '⊥∧⊥');
  });

  test('AND: ⊤ is identity element', () => {
    for (const v of SEVEN_VALUES) {
      if (v === 'ZERO') continue; // 〇 absorbs everything
      eq(and('TRUE', v), v, `⊤∧${v}`);
    }
  });

  test('AND: 〇 absorbs everything', () => {
    for (const v of SEVEN_VALUES) {
      eq(and('ZERO', v), 'ZERO', `〇∧${v}`);
      eq(and(v, 'ZERO'), 'ZERO', `${v}∧〇`);
    }
  });

  test('AND: Belnap four-valued compatibility', () => {
    eq(and('BOTH', 'BOTH'), 'BOTH', 'B∧B');
    eq(and('BOTH', 'FALSE'), 'FALSE', 'B∧⊥');
    eq(and('NEITHER', 'NEITHER'), 'NEITHER', 'N∧N');
    eq(and('NEITHER', 'FALSE'), 'FALSE', 'N∧⊥');
    eq(and('BOTH', 'NEITHER'), 'FALSE', 'B∧N');
  });

  test('AND: commutativity', () => {
    for (const a of SEVEN_VALUES) {
      for (const b of SEVEN_VALUES) {
        eq(and(a, b), and(b, a), `${a}∧${b} vs ${b}∧${a}`);
      }
    }
  });

  // ── OR ──
  console.log();
  console.log('── OR (論理和) ──');

  test('OR: classical truth table', () => {
    eq(or('TRUE', 'TRUE'), 'TRUE', '⊤∨⊤');
    eq(or('TRUE', 'FALSE'), 'TRUE', '⊤∨⊥');
    eq(or('FALSE', 'TRUE'), 'TRUE', '⊥∨⊤');
    eq(or('FALSE', 'FALSE'), 'FALSE', '⊥∨⊥');
  });

  test('OR: ⊥ is identity element', () => {
    for (const v of SEVEN_VALUES) {
      if (v === 'ZERO') continue; // 〇 absorbs everything
      eq(or('FALSE', v), v, `⊥∨${v}`);
    }
  });

  test('OR: 〇 absorbs everything', () => {
    for (const v of SEVEN_VALUES) {
      eq(or('ZERO', v), 'ZERO', `〇∨${v}`);
      eq(or(v, 'ZERO'), 'ZERO', `${v}∨〇`);
    }
  });

  test('OR: commutativity', () => {
    for (const a of SEVEN_VALUES) {
      for (const b of SEVEN_VALUES) {
        eq(or(a, b), or(b, a), `${a}∨${b} vs ${b}∨${a}`);
      }
    }
  });

  // ── 冪等性 ──
  console.log();
  console.log('── 冪等性・代数的性質 ──');

  test('idempotent: AND(x,x)=x and OR(x,x)=x for all values', () => {
    for (const v of SEVEN_VALUES) {
      assert(checkIdempotent(v), `idempotent failed for ${v}`);
    }
  });

  test('De Morgan: NOT(a∧b) = NOT(a)∨NOT(b) for four-valued', () => {
    const four: FourLogicValue[] = ['TRUE', 'FALSE', 'BOTH', 'NEITHER'];
    for (const a of four) {
      for (const b of four) {
        assert(checkDeMorgan(a, b), `De Morgan failed for ${a}, ${b}`);
      }
    }
  });

  // ── Collapse / Lift ──
  console.log();
  console.log('── collapse / lift ──');

  test('collapse: four-valued identity', () => {
    eq(collapse('TRUE'), 'TRUE', 'collapse(⊤)');
    eq(collapse('FALSE'), 'FALSE', 'collapse(⊥)');
    eq(collapse('BOTH'), 'BOTH', 'collapse(B)');
    eq(collapse('NEITHER'), 'NEITHER', 'collapse(N)');
  });

  test('collapse: extended → four-valued projection', () => {
    eq(collapse('INFINITY'), 'NEITHER', 'collapse(∞)');
    eq(collapse('ZERO'), 'NEITHER', 'collapse(〇)');
    eq(collapse('FLOWING'), 'BOTH', 'collapse(～)');
  });

  test('lift: four → seven (identity injection)', () => {
    const four: FourLogicValue[] = ['TRUE', 'FALSE', 'BOTH', 'NEITHER'];
    for (const v of four) {
      eq(lift(v), v, `lift(${v})`);
    }
  });

  test('roundtrip: collapse(lift(x)) = x for four-valued', () => {
    const four: FourLogicValue[] = ['TRUE', 'FALSE', 'BOTH', 'NEITHER'];
    for (const v of four) {
      eq(collapse(lift(v)), v, `collapse(lift(${v}))`);
    }
  });

  // ── Summary ──
  console.log();
  console.log('═'.repeat(42));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(42));

  process.exit(failed > 0 ? 1 : 0);
}

main();
