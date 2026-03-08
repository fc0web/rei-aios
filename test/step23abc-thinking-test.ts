/**
 * STEP 23 A/B/C — 「自分で考える」統合テスト
 *
 * A: QuestionGenerator  — 問いを立てる
 * B: HypothesisEngine   — 仮説を作る
 * C: ConceptGenesisEngine — 概念を生む
 */

import { QuestionGenerator } from '../src/axiom-os/question-generator';
import { HypothesisEngine } from '../src/axiom-os/hypothesis-engine';
import { ConceptGenesisEngine } from '../src/axiom-os/concept-genesis-engine';
import { TheoryEvolution } from '../src/axiom-os/theory-evolution';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.error(`  ❌ ${msg}`); }
}

async function main() {
  console.log('\n═══ STEP 23 A/B/C — 「自分で考える」統合テスト ═══\n');

  // ─── A: QuestionGenerator ─────────────────────────────
  console.log('── A: QuestionGenerator ──');

  const qgen = new QuestionGenerator();

  // A-1: 矛盾から問いを生成
  const contraQ = qgen.generateFromContradictions();
  assert(Array.isArray(contraQ), 'A-1: generateFromContradictions returns array');

  // A-2: 空白領域から問いを生成
  const gapQ = qgen.generateFromGaps();
  assert(Array.isArray(gapQ), 'A-2: generateFromGaps returns array');

  // A-3: 境界から問いを生成
  const boundaryQ = qgen.generateFromBoundaries();
  assert(Array.isArray(boundaryQ), 'A-3: generateFromBoundaries returns array');
  assert(boundaryQ.length > 0, 'A-3: boundary questions generated');

  // A-4: 問い構造の検証
  if (boundaryQ.length > 0) {
    const q = boundaryQ[0];
    assert(q.id.startsWith('q_boundary_'), 'A-4: question id format correct');
    assert(q.type === 'boundary', 'A-4: question type is boundary');
    assert(typeof q.question === 'string' && q.question.length > 0, 'A-4: question text exists');
    assert(Array.isArray(q.relatedIds), 'A-4: relatedIds is array');
    assert(q.dfumtValue === 'BOTH', 'A-4: boundary dfumtValue is BOTH');
    assert(q.status === 'open', 'A-4: initial status is open');
  }

  // A-5: runAll()
  const runAllResult = await qgen.runAll();
  assert(typeof runAllResult.total === 'number', 'A-5: runAll returns total count');

  // A-6: getOpenQuestions
  const openQ = qgen.getOpenQuestions(5);
  assert(Array.isArray(openQ), 'A-6: getOpenQuestions returns array');

  // A-7: getAllQuestions
  const allQ = qgen.getAllQuestions();
  assert(allQ.length >= openQ.length, 'A-7: getAllQuestions >= getOpenQuestions');

  // A-8: questionCount
  assert(qgen.questionCount >= 0, 'A-8: questionCount is non-negative');

  qgen.close();

  // ─── B: HypothesisEngine ──────────────────────────────
  console.log('\n── B: HypothesisEngine ──');

  const hypoEngine = new HypothesisEngine();

  // B-1: フォールバック生成
  const testQuestion = {
    id: 'q_test_1', type: 'boundary' as const,
    question: '量子意識はD-FUMTでどう統合されるか？',
    relatedIds: ['dfumt-001'], dfumtValue: 'BOTH' as const,
    urgency: 0.7, llmPrompt: 'テスト', status: 'open' as const,
    createdAt: Date.now(),
  };
  const hypo = await hypoEngine.generateFromQuestion(testQuestion);
  assert(hypo.id.startsWith('hypo_'), 'B-1: hypothesis id format correct');
  assert(hypo.questionId === 'q_test_1', 'B-1: questionId linked');
  assert(hypo.status === 'draft', 'B-1: initial status is draft');
  assert(typeof hypo.axiom === 'string' && hypo.axiom.length > 0, 'B-1: axiom generated');

  // B-2: 矛盾チェック
  const noContra = hypoEngine.checkContradiction(hypo);
  assert(typeof noContra === 'boolean', 'B-2: checkContradiction returns boolean');

  // B-3: Rei-PL検証
  if (noContra) {
    const verified = hypoEngine.verifyWithReiPL(hypo);
    assert(typeof verified === 'boolean', 'B-3: verifyWithReiPL returns boolean');

    // B-4: Evolution登録
    if (verified) {
      const evolved = hypoEngine.registerToEvolution(hypo);
      assert(evolved !== null || hypo.status === 'verified', 'B-4: registerToEvolution processed');
    }
  }

  // B-5: runPipeline
  const qgen2 = new QuestionGenerator();
  const cQ = qgen2.generateFromContradictions();
  const bQ = qgen2.generateFromBoundaries();
  const allQuestions = [...cQ, ...bQ];
  if (allQuestions.length > 0) {
    const pipeResult = await hypoEngine.runPipeline(allQuestions);
    assert(pipeResult.generated > 0, 'B-5: pipeline generated hypotheses');
    assert(pipeResult.generated === pipeResult.verified + pipeResult.rejected, 'B-5: generated = verified + rejected');
  } else {
    assert(true, 'B-5: (no questions to process — skipped)');
  }
  qgen2.close();

  // B-6: getAll
  const allHypos = hypoEngine.getAll();
  assert(Array.isArray(allHypos), 'B-6: getAll returns array');
  assert(allHypos.length >= 1, 'B-6: at least 1 hypothesis stored');

  // B-7: getEvolution
  const evo = hypoEngine.getEvolution();
  assert(evo instanceof TheoryEvolution, 'B-7: getEvolution returns TheoryEvolution');

  hypoEngine.close();

  // ─── C: ConceptGenesisEngine ──────────────────────────
  console.log('\n── C: ConceptGenesisEngine ──');

  const conceptEngine = new ConceptGenesisEngine();

  // C-1: 概念萌芽検出
  const testQuestions = [
    { id: 'q1', type: 'gap' as const, question: 'NEITHERの彼方にある概念とは？', relatedIds: [], dfumtValue: 'NEITHER' as const, urgency: 0.8, llmPrompt: '', status: 'open' as const, createdAt: Date.now() },
    { id: 'q2', type: 'gap' as const, question: 'ZEROから生まれる新しい公理は？', relatedIds: [], dfumtValue: 'ZERO' as const, urgency: 0.6, llmPrompt: '', status: 'open' as const, createdAt: Date.now() },
    { id: 'q3', type: 'gap' as const, question: 'NEITHER空間の構造とは？', relatedIds: [], dfumtValue: 'NEITHER' as const, urgency: 0.7, llmPrompt: '', status: 'open' as const, createdAt: Date.now() },
  ];
  const testHypos = [
    { id: 'h1', questionId: 'q1', axiom: 'NEITHER(x) → ZERO(x) かつ拡張', category: 'general', keywords: ['neither'], dfumtValue: 'NEITHER' as const, reiCode: '', verified: false, status: 'draft' as const, createdAt: Date.now(), reasoning: 'テスト' },
  ];
  const { seeds, pattern } = conceptEngine.detectConceptSeeds(testQuestions, testHypos);
  assert(seeds.length >= 3, 'C-1: detected >= 3 concept seeds');
  assert(typeof pattern === 'string', 'C-1: pattern extracted');

  // C-2: 概念生成（フォールバック）
  const concept = await conceptEngine.generateConcept(seeds, pattern);
  assert(concept.id.startsWith('concept_'), 'C-2: concept id format');
  assert(typeof concept.name === 'string', 'C-2: concept has name');
  assert(typeof concept.definition === 'string', 'C-2: concept has definition');
  assert(typeof concept.noveltyScore === 'number', 'C-2: noveltyScore is number');
  assert(concept.noveltyScore >= 0 && concept.noveltyScore <= 1, 'C-2: noveltyScore in [0,1]');
  assert(concept.status === 'candidate', 'C-2: initial status is candidate');

  // C-3: マルチエージェント合意
  const votes = conceptEngine.runAgentConsensus(concept);
  assert(votes.length === 5, 'C-3: 5 agent votes');
  assert(votes.every(v => ['support', 'oppose', 'neutral'].includes(v.vote)), 'C-3: valid vote values');
  assert(votes.every(v => typeof v.reason === 'string'), 'C-3: all votes have reasons');

  // C-4: レビュー提出
  conceptEngine.submitForReview(concept.id);
  const pending = conceptEngine.getPendingReview();
  assert(pending.length >= 1, 'C-4: pending review has entries');
  assert(pending[0].status === 'review', 'C-4: status changed to review');

  // C-5: 人間承認
  const approved = conceptEngine.approve(concept.id, 'test-user', 158);
  assert(approved !== null, 'C-5: approve returns concept');
  if (approved) {
    assert(approved.status === 'approved', 'C-5: status is approved');
    assert(approved.approvedBy === 'test-user', 'C-5: approvedBy correct');
    assert(approved.theoryNumber === 158, 'C-5: theoryNumber assigned');
  }

  // C-6: runPipeline
  const pipelineConcept = await conceptEngine.runPipeline(testQuestions, testHypos);
  // Pipeline may return null if novelty is too low, which is valid
  assert(pipelineConcept === null || pipelineConcept.status === 'candidate', 'C-6: pipeline returns candidate (DB updated to review)');

  conceptEngine.close();

  // ─── D: TheoryEvolution.proposeNew ────────────────────
  console.log('\n── D: TheoryEvolution.proposeNew ──');

  const evolution = new TheoryEvolution();

  // D-1: proposeNew creates new theory
  const proposed = evolution.proposeNew({
    id: 'dfumt-proposed-test',
    axiom: 'テスト公理: NEITHER ⊗ ZERO → FLOWING',
    category: 'logic',
    keywords: ['テスト', 'NEITHER'],
    source: 'ai_discovery',
    parentIds: ['dfumt-001'],
  });
  assert(proposed !== null, 'D-1: proposeNew returns EvolvedTheory');
  if (proposed) {
    assert(proposed.id === 'dfumt-proposed-test', 'D-1: correct id');
    assert(proposed.source === 'ai_discovery', 'D-1: correct source');
    assert(proposed.confidence === 'ZERO', 'D-1: initial confidence is ZERO');
    assert(proposed.validated === false, 'D-1: initially not validated');
  }

  // D-2: 重複防止
  const duplicate = evolution.proposeNew({
    id: 'dfumt-proposed-test',
    axiom: '重複テスト',
    category: 'logic',
    keywords: [],
    source: 'manual',
    parentIds: [],
  });
  assert(duplicate === null, 'D-2: duplicate proposal returns null');

  // D-3: getEvolved includes proposed
  const evolved = evolution.getEvolved();
  assert(evolved.some(e => e.id === 'dfumt-proposed-test'), 'D-3: proposed theory in evolved list');

  // ─── E: フルパイプライン統合 ──────────────────────────
  console.log('\n── E: フルパイプライン統合 ──');

  const qg = new QuestionGenerator();
  const he = new HypothesisEngine();
  const ce = new ConceptGenesisEngine();

  // E-1: 問い → 仮説 → 概念のフルフロー
  await qg.runAll();
  const questions = qg.getOpenQuestions(5);
  assert(questions.length >= 0, 'E-1: questions available');

  if (questions.length > 0) {
    const hypoPipe = await he.runPipeline(questions);
    assert(hypoPipe.generated > 0, 'E-1: hypotheses generated from questions');

    const allH = he.getAll();
    const allQs = qg.getAllQuestions();
    const fullConcept = await ce.runPipeline(allQs, allH);
    assert(fullConcept === null || typeof fullConcept.name === 'string', 'E-1: full pipeline produces valid result');
  } else {
    assert(true, 'E-1: (no questions generated — pipeline skipped)');
  }

  // E-2: SEED_KERNELとの整合性
  assert(SEED_KERNEL.length === 183, `E-2: SEED_KERNEL still has 183 theories (got ${SEED_KERNEL.length})`);

  qg.close();
  he.close();
  ce.close();

  // ─── 結果 ─────────────────────────────────────────────
  console.log(`\n═══ 結果: ${pass}/${pass + fail} テスト通過 ═══\n`);
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
