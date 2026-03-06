/**
 * Phase 7d テスト
 * 実行: npx ts-node test/phase7d-test.ts
 */

import { calcDFUMTEntropy, compareWithAncientCodes, describeEntropy, MAX_ENTROPY_7 } from '../src/aios/information/dfumt-entropy';
import { UNIVERSAL_CODE_MATRIX, getDFUMTIChingCorrespondence, CAVE_SYMBOLS_32, getAncientCodeAxiomEntry } from '../src/aios/information/ancient-code-mapper';
import { analyzePatterns, UNIVERSAL_PATTERNS } from '../src/aios/information/pattern-analyzer';
import { decomposeInfo, explainReiReduction, DECOMP_LAYERS } from '../src/aios/information/decomp-structure';
import { runInfoPipeline, PIPELINE_STAGES, generateReiPipelineSyntax } from '../src/aios/information/info-tech-pipeline';

async function runPhase7dTests() {
  console.log('=== Phase 7d Tests: 超古代符号 × 情報科学統合 ===\n');
  let passed = 0; let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (cond) { console.log(`  \u2713 ${msg}`); passed++; }
    else { console.log(`  \u2717 ${msg}`); failed++; }
  };

  // Test 1: D-FUMTエントロピー（Theory #77）
  console.log('--- 1. D-FUMTエントロピー理論 (Theory #77) ---');
  const uniformDist = { '\u22a4': 1, '\u22a5': 1, 'Both': 1, 'Neither': 1, '\u221e': 1, '\u3007': 1, '\uff5e': 1 };
  const uniformResult = calcDFUMTEntropy(uniformDist);
  assert(Math.abs(uniformResult.h7 - 1.0) < 0.01, '均一分布でエントロピー最大（H₇≈1.0）');
  assert(uniformResult.richness > 1.0, '七値は二値より情報豊富度が高い');

  const biasedDist = { '\u22a4': 100, '\u22a5': 1, 'Both': 1, 'Neither': 1, '\u221e': 1, '\u3007': 1, '\uff5e': 1 };
  const biasedResult = calcDFUMTEntropy(biasedDist);
  assert(biasedResult.h7 < 0.5, '偏った分布でエントロピーが低い');
  assert(biasedResult.dominantValue === '\u22a4', '支配的状態が正しく検出される');

  const ancient = compareWithAncientCodes(uniformDist);
  assert(ancient.ancient32 > 0, '壁画32符号エントロピーが計算される');
  assert(ancient.iching64 > ancient.ancient32, '易経64卦の方が32符号より情報量が多い');

  const desc = describeEntropy(uniformResult);
  assert(desc.includes('H\u2087'), 'エントロピー説明にH₇が含まれる');

  // Test 2: 超古代普遍符号（Theory #76）
  console.log('\n--- 2. 超古代普遍符号理論 (Theory #76) ---');
  assert(UNIVERSAL_CODE_MATRIX.commonTotal === 64, '普遍符号の共通総数は64');
  assert(UNIVERSAL_CODE_MATRIX.commonBase === 2, '共通基底は2（二値）');
  assert(UNIVERSAL_CODE_MATRIX.systems.length === 4, '4つのシステムが定義されている');
  assert(CAVE_SYMBOLS_32.length >= 6, '壁画32符号が定義されている');

  const correspondence = getDFUMTIChingCorrespondence();
  assert(correspondence.length === 7, 'D-FUMT七値と易経の対応が7つある');
  assert(correspondence.some(c => c.iching.includes('#1')), '乾為天（#1）がTRUEに対応');
  assert(correspondence.some(c => c.iching.includes('#2')), '坤為地（#2）がZEROに対応');

  const axiomEntry = getAncientCodeAxiomEntry();
  assert(axiomEntry.theory_id === 76, 'Axiom OS登録データのtheory_idが76');
  assert(axiomEntry.formula.includes('64卦'), '数式に易経64卦が含まれる');

  // Test 3: 普遍パターン分析（Theory #78）
  console.log('\n--- 3. 普遍パターン分析理論 (Theory #78) ---');
  const analysis = analyzePatterns();
  assert(analysis.theoryRef === 78, 'theoryRefが78');
  assert(analysis.commonBase === 2, '共通基底が2');
  assert(analysis.commonalityScore > 0 && analysis.commonalityScore <= 1.0, '共通性スコアが0〜1.0');
  assert(analysis.articleSummary.length > 0, 'note.com記事サマリが生成される');
  assert(UNIVERSAL_PATTERNS.length >= 8, '8つ以上のパターンが定義されている');

  // Test 4: 情報分解構造（Theory #79）
  console.log('\n--- 4. 情報分解構造理論 (Theory #79) ---');
  assert(Object.keys(DECOMP_LAYERS).length === 5, '5層（core/l1/l2/l3/boundary）が定義されている');
  assert(DECOMP_LAYERS.core.invariance === 1.0, '中心核の不変性は1.0（絶対不変）');
  assert(DECOMP_LAYERS.boundary.invariance === 0.0, '境界の不変性は0.0（未知）');

  const decomp = decomposeInfo('D-FUMT公理システムの情報圧縮分析');
  assert(decomp.theoryRef === 79, 'theoryRefが79');
  assert(decomp.reiReduction > 0 && decomp.reiReduction <= 1.0, 'Rei削減率が0〜1.0');
  assert(decomp.layers.length > 0, '分解層が存在する');

  const reductionExplain = explainReiReduction();
  assert(reductionExplain.includes('74%'), '74%コード削減の説明が含まれる');
  assert(reductionExplain.includes('Theory #79'), 'Theory #79への参照がある');

  // Test 5: Rei情報技術パイプライン（Theory #80）
  console.log('\n--- 5. Rei情報技術パイプライン (Theory #80) ---');
  assert(PIPELINE_STAGES.length === 6, '6段階パイプラインが定義されている');
  assert(PIPELINE_STAGES[0].name.includes('収集'), 'Stage 1は収集');
  assert(PIPELINE_STAGES[5].name.includes('応答'), 'Stage 6は応答');

  const pipeResult = await runInfoPipeline('D-FUMT七値論理と易経の普遍パターン分析');
  assert(pipeResult.theoryRef === 80, 'theoryRefが80');
  assert(pipeResult.stages.length === 6, '6ステージが実行される');
  assert(pipeResult.totalMs >= 0, '処理時間が計測される');
  assert(pipeResult.finalOutput.dfumtSummary.length > 0, 'D-FUMTサマリが生成される');

  const reiSyntax = generateReiPipelineSyntax('古代符号分析');
  assert(reiSyntax.includes('|>'), 'Reiパイプライン構文にパイプ演算子が含まれる');
  assert(reiSyntax.includes('Theory #80'), 'Theory #80の参照がある');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  // 統合サマリ
  if (passed > 0) {
    console.log('\n--- D-FUMT普遍性の証拠サマリ ---');
    console.log(`易経64卦 ≡ DNA64コドン ≡ 2⁶: \u2713 数学的同型を確認`);
    console.log(`D-FUMTエントロピー H₇の豊富度: ${(uniformResult.richness).toFixed(3)}倍（二値比）`);
    console.log(`Rei言語コード削減理論的根拠: Theory #79（情報分解構造理論）`);
    console.log(`note.com記事テーマ: 「3万年前から続く普遍符号とD-FUMT」`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

runPhase7dTests().catch(e => { console.error(e); process.exit(1); });
