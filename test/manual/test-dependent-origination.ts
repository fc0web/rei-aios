/**
 * test-dependent-origination.ts — 縁起論エンジン 手動テスト
 * 実行: npx tsx test/manual/test-dependent-origination.ts
 */
import { DependentOrigination } from '../../src/axiom-os/dependent-origination';
import { NagarjunaProof }        from '../../src/axiom-os/nagarjuna-proof';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  縁起論エンジン x D-FUMT 七価論理');
  console.log('  pratītyasamutpāda — 相互依存によって生起するもの');
  console.log('═══════════════════════════════════════════════════════\n');

  // Step 1: 龍樹の証明を再確認
  const prover = new NagarjunaProof();
  const proof  = await prover.prove();
  console.log(`[前提] 龍樹の中論 結論: ${proof.conclusion} (${proof.isProven ? '証明済み' : '未証明'})`);
  console.log(`      四不生 → 独立自性なし → 縁起のみが存在する\n`);

  // Step 2: D-FUMT公理の縁起ネットワークを構築
  const engine = new DependentOrigination();

  // 根拠層（依存なし = 独立自性 → 四不生により FALSE）
  engine.addAxiomNode('void',               '根源的ZERO',     []);
  // 一次層
  engine.addAxiomNode('dfumt-zero-state',   'ZERO状態',       ['void']);
  engine.addAxiomNode('dfumt-flowing-value','流動値',         ['dfumt-zero-state']);
  // 論理層
  engine.addAxiomNode('dfumt-catuskoti',    '四値論理',       ['dfumt-flowing-value', 'dfumt-zero-state']);
  engine.addAxiomNode('dfumt-infinity-value','無限値',        ['dfumt-catuskoti']);
  // メタ認知層
  engine.addAxiomNode('dfumt-narcissus',    '自己認識',       ['dfumt-catuskoti', 'dfumt-infinity-value']);
  engine.addAxiomNode('dfumt-anti-axiom',   '反公理',         ['dfumt-catuskoti']);
  engine.addAxiomNode('dfumt-moira',        '終了条件',       ['dfumt-catuskoti', 'dfumt-flowing-value']);
  // 最上位
  engine.addAxiomNode('nagarjuna-sunyata',  '空（śūnyatā）',  ['dfumt-catuskoti', 'dfumt-narcissus', 'dfumt-anti-axiom', 'dfumt-moira']);

  // Step 3: 各ノードの縁起判定
  console.log('=== 各公理の縁起判定 ===\n');
  const nodes = ['void', 'dfumt-zero-state', 'dfumt-catuskoti', 'dfumt-narcissus', 'nagarjuna-sunyata'];
  for (const id of nodes) {
    const result = engine.canArise(id);
    const symbol = result.logicValue === 'TRUE' ? '⊤' :
                   result.logicValue === 'FALSE' ? '⊥' :
                   result.logicValue === 'NEITHER' ? '⊠' :
                   result.logicValue === 'BOTH' ? '⊕' :
                   result.logicValue === 'FLOWING' ? '～' :
                   result.logicValue === 'ZERO' ? '〇' : '∞';
    console.log(`[${symbol}] ${id}`);
    console.log(`     生起: ${result.canArise ? 'できる' : 'できない'}  深さ: ${result.dependencyDepth}`);
    console.log(`     理由: ${result.reason}`);
    console.log();
  }

  // Step 4: 全体マップ
  const map = engine.mapAll();
  console.log('=== 縁起マップ 全体評価 ===');
  console.log(map.summary);
  console.log(`全体状態: ${map.overallHealth}`);
}

main().catch(console.error);
