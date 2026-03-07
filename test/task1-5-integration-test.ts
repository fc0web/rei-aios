/**
 * Rei-AIOS Task 1〜5 統合テスト
 *
 * Task 1: AIOSMemory SQLiteバックエンド
 * Task 2: AxiomCandidateExtractor + AxiomAutoLearner
 * Task 3: SevenValueClassifier
 * Task 4: ReiPLAxiomGenerator
 * Task 5: QuantumLogicEngine + SEED_KERNEL #99-#101
 */

import { AIOSMemory } from '../src/memory/aios-memory';
import { AxiomCandidateExtractor } from '../src/axiom-os/axiom-candidate-extractor';
import { SevenValueClassifier } from '../src/logic/seven-value-classifier';
import { ReiPLAxiomGenerator } from '../src/axiom-os/rei-pl-axiom-generator';
import {
  QuantumLogicEngine,
  SuperpositionAxiom,
  ProjectionMeasurementAxiom,
  QuantumNonDistributivity,
} from '../src/axiom-os/quantum-logic-engine';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';
import type { ArxivPaper } from '../src/aios/knowledge/types';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  FAIL  ${name}: ${e.message}`);
  }
}

function assert(cond: boolean, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

console.log('\n=== Task 1〜5 統合テスト ===\n');

// ══════════════════════════════════════════════════════════
// Task 1: AIOSMemory SQLiteバックエンド
// ══════════════════════════════════════════════════════════
console.log('--- Task 1: AIOSMemory SQLite ---');

const memory = new AIOSMemory(':memory:');

test('remember: 記憶保存', () => {
  const entry = memory.remember('agent-1', 'axiom', '龍樹の空性', {
    confidence: 'NEITHER',
    tags: ['龍樹', '空性'],
  });
  assert(entry.id.startsWith('mem_'), 'ID should start with mem_');
  assert(entry.agentId === 'agent-1');
  assert(entry.confidence === 'NEITHER');
});

test('recall: 記憶想起', () => {
  const results = memory.recall({ agentId: 'agent-1' });
  assert(results.length === 1, `expected 1, got ${results.length}`);
  assert(results[0].content === '龍樹の空性');
});

test('update: 確信度更新', () => {
  const entries = memory.recall({ agentId: 'agent-1' });
  const updated = memory.update(entries[0].id, { confidence: 'TRUE' });
  assert(updated !== null);
  assert(updated!.confidence === 'TRUE');
});

test('forget: 記憶忘却', () => {
  const entries = memory.recall({ agentId: 'agent-1' });
  assert(memory.forget(entries[0].id) === true);
  assert(memory.size === 0, `expected 0, got ${memory.size}`);
});

test('stats: 統計', () => {
  memory.remember('a', 'semantic', 'test1', { confidence: 'TRUE' });
  memory.remember('a', 'axiom', 'test2', { confidence: 'BOTH' });
  const s = memory.stats();
  assert(s.totalEntries === 2);
  assert(s.byKind['semantic'] === 1);
  assert(s.byKind['axiom'] === 1);
});

test('buildContext: コンテキスト生成', () => {
  const ctx = memory.buildContext('a');
  assert(ctx.includes('aの記憶コンテキスト'));
});

test('size: getter', () => {
  assert(memory.size === 2);
});

test('close: DBクローズ', () => {
  memory.close();
});

// ══════════════════════════════════════════════════════════
// Task 2: AxiomCandidateExtractor
// ══════════════════════════════════════════════════════════
console.log('\n--- Task 2: AxiomCandidateExtractor ---');

const extractor = new AxiomCandidateExtractor();

const mockPapers: ArxivPaper[] = [
  {
    id: '2401.00001', title: 'Quantum Logic and Consciousness',
    summary: 'We study quantum consciousness and the relationship between theorem and axiom in formal logic systems.',
    authors: [], published: '2024-01-01', updated: '2024-01-01',
    categories: ['math.LO'], link: '', dfumtVector: [],
  },
  {
    id: '2401.00002', title: 'Simple Linear Algebra',
    summary: 'Basic matrix operations for engineers.',
    authors: [], published: '2024-01-01', updated: '2024-01-01',
    categories: ['math.LA'], link: '', dfumtVector: [],
  },
  {
    id: '2401.00003', title: 'Paraconsistent Logic and Buddhist Philosophy',
    summary: 'We explore the connection between paraconsistent logic, emptiness, and formal ontology in category theory.',
    authors: [], published: '2024-01-01', updated: '2024-01-01',
    categories: ['math.LO'], link: '', dfumtVector: [],
  },
];

test('extract: 論文から公理候補抽出', () => {
  const candidates = extractor.extract(mockPapers, 0.2);
  assert(candidates.length >= 1, `expected >= 1, got ${candidates.length}`);
  // 最初の論文はquantum+consciousness+axiom+logic → 高スコア
  const first = candidates[0];
  assert(first.sourceId === '2401.00001' || first.sourceId === '2401.00003',
    `top candidate should be paper 1 or 3, got ${first.sourceId}`);
  assert(first.confidence > 0, 'confidence should be > 0');
  assert(first.keywords.length > 0, 'keywords should not be empty');
});

test('extract: 低関連度論文はフィルタされる', () => {
  const candidates = extractor.extract(mockPapers, 0.5);
  const hasSimple = candidates.some(c => c.sourceId === '2401.00002');
  assert(!hasSimple, 'Simple Linear Algebra should be filtered out');
});

test('extract: dfumtValue が有効', () => {
  const candidates = extractor.extract(mockPapers, 0.1);
  const valid = ['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING'];
  for (const c of candidates) {
    assert(valid.includes(c.dfumtValue), `Invalid dfumtValue: ${c.dfumtValue}`);
  }
});

// ══════════════════════════════════════════════════════════
// Task 3: SevenValueClassifier
// ══════════════════════════════════════════════════════════
console.log('\n--- Task 3: SevenValueClassifier ---');

const classifier = new SevenValueClassifier();

const classifierCases: [string, string][] = [
  ['空は実体を持たない',         'NEITHER'],
  ['意識は情報統合である',        'BOTH'],
  ['量子は重ね合わせ状態にある',  'BOTH'],
  ['この定理は証明済みである',    'TRUE'],
  ['状態は未定義である',         'ZERO'],
  ['真理は時間とともに変化する',  'FLOWING'],
  ['それは普遍的に無限展開する',  'INFINITY'],
];

for (const [text, expected] of classifierCases) {
  test(`classify: "${text}" → ${expected}`, () => {
    const result = classifier.classify(text);
    assert(result.value === expected,
      `Expected ${expected}, got ${result.value} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
  });
}

test('classifyBatch: バッチ処理', () => {
  const results = classifier.classifyBatch(['空は実体を持たない', '定理は真である']);
  assert(results.length === 2);
  assert(results[0].value === 'NEITHER');
  assert(results[1].value === 'TRUE');
});

test('describe: 説明文', () => {
  const desc = SevenValueClassifier.describe('NEITHER');
  assert(desc.includes('龍樹'), 'NEITHER description should mention 龍樹');
});

// ══════════════════════════════════════════════════════════
// Task 4: ReiPLAxiomGenerator
// ══════════════════════════════════════════════════════════
console.log('\n--- Task 4: ReiPLAxiomGenerator ---');

const generator = new ReiPLAxiomGenerator();

test('generate: logic理論のコード生成', () => {
  const logicTheory = SEED_KERNEL.find(t => t.category === 'logic');
  assert(logicTheory !== undefined, 'logic theory should exist');
  const code = generator.generate(logicTheory!);
  assert(code.reiCode.length > 0, 'code should not be empty');
  assert(code.template === 'logic', `template should be logic, got ${code.template}`);
  assert(code.reiCode.includes('logic7'), 'should contain logic7');
});

test('generate: mathematics理論のコード生成', () => {
  const mathTheory = SEED_KERNEL.find(t => t.category === 'mathematics');
  assert(mathTheory !== undefined, 'math theory should exist');
  const code = generator.generate(mathTheory!);
  assert(code.reiCode.includes('i64'), 'math code should use i64');
});

test('generate: quantum理論のコード生成', () => {
  const qTheory = SEED_KERNEL.find(t => t.category === 'quantum');
  assert(qTheory !== undefined, 'quantum theory should exist');
  const code = generator.generate(qTheory!);
  assert(code.reiCode.includes('BOTH'), 'quantum code should mention BOTH');
});

test('generateBatch: バッチ生成', () => {
  const batch = generator.generateBatch(SEED_KERNEL.slice(0, 5));
  assert(batch.length === 5, `expected 5, got ${batch.length}`);
  for (const code of batch) {
    assert(code.reiCode.length > 0, 'each code should not be empty');
  }
});

test('generateModule: モジュール生成', () => {
  const mod = generator.generateModule(SEED_KERNEL.slice(0, 3), 'test_module');
  assert(mod.includes('test_module'), 'module should contain name');
  assert(mod.includes('D-FUMT'), 'module should mention D-FUMT');
});

// ══════════════════════════════════════════════════════════
// Task 5: QuantumLogicEngine + SEED_KERNEL #99-#101
// ══════════════════════════════════════════════════════════
console.log('\n--- Task 5: QuantumLogicEngine ---');

const engine = new QuantumLogicEngine();

test('Theory #99: |0> → FALSE', () => {
  assert(engine.toDFUMT(QuantumLogicEngine.ZERO_STATE) === 'FALSE');
});

test('Theory #99: |1> → TRUE', () => {
  assert(engine.toDFUMT(QuantumLogicEngine.ONE_STATE) === 'TRUE');
});

test('Theory #99: |+> → BOTH (重ね合わせ)', () => {
  const plusState = SuperpositionAxiom.hadamard(QuantumLogicEngine.ZERO_STATE);
  assert(engine.toDFUMT(plusState) === 'BOTH', `expected BOTH, got ${engine.toDFUMT(plusState)}`);
});

test('Theory #99: isSuperposition', () => {
  assert(SuperpositionAxiom.isSuperposition(QuantumLogicEngine.PLUS_STATE) === true);
  assert(SuperpositionAxiom.isSuperposition(QuantumLogicEngine.ZERO_STATE) === false);
});

test('Theory #100: 射影測定 → FLOWING', () => {
  const result = ProjectionMeasurementAxiom.measure(QuantumLogicEngine.PLUS_STATE, 0.3);
  assert(result.dfumtAfter === 'FLOWING');
  assert(result.outcome === 0 || result.outcome === 1);
});

test('Theory #100: expectationZ', () => {
  const ez = ProjectionMeasurementAxiom.expectationZ(QuantumLogicEngine.ZERO_STATE);
  assert(Math.abs(ez - 1.0) < 0.01, `expected ~1.0, got ${ez}`);
});

test('Theory #101: quantumAnd(TRUE, FALSE) → NEITHER', () => {
  assert(QuantumNonDistributivity.quantumAnd('TRUE', 'FALSE') === 'NEITHER');
});

test('Theory #101: demonstrateNonDistributivity', () => {
  const demo = QuantumNonDistributivity.demonstrateNonDistributivity();
  assert(demo.dfumtValue === 'NEITHER');
});

test('fromDFUMT: 全7値の量子状態変換', () => {
  const values: DFUMTValues[] = ['TRUE', 'FALSE', 'BOTH', 'NEITHER', 'INFINITY', 'ZERO', 'FLOWING'];
  for (const v of values) {
    const state = engine.fromDFUMT(v);
    assert(state !== undefined, `fromDFUMT(${v}) should not be undefined`);
    assert(state.label !== undefined, `fromDFUMT(${v}).label should exist`);
  }
});
type DFUMTValues = 'TRUE' | 'FALSE' | 'BOTH' | 'NEITHER' | 'INFINITY' | 'ZERO' | 'FLOWING';

test('getSeedKernelEntries: 3件', () => {
  const entries = QuantumLogicEngine.getSeedKernelEntries();
  assert(entries.length === 3, `expected 3, got ${entries.length}`);
});

// ── SEED_KERNEL確認 ──
console.log('\n--- SEED_KERNEL確認 ---');

test('SEED_KERNEL: 量子論理3理論が含まれる', () => {
  const ids = ['dfumt-quantum-superposition', 'dfumt-quantum-measurement', 'dfumt-quantum-non-distributivity'];
  for (const id of ids) {
    assert(SEED_KERNEL.some(t => t.id === id), `${id} should be in SEED_KERNEL`);
  }
});

test(`SEED_KERNEL: 総理論数 173 (149+3+3)`, () => {
  assert(SEED_KERNEL.length === 173, `expected 173, got ${SEED_KERNEL.length}`);
});

// ── 結果 ──
console.log(`\n=== 結果: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
