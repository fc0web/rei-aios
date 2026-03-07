/**
 * test-universal-philosophy.ts — 東西南北の哲学統合テスト
 * 実行: npx tsx test/manual/test-universal-philosophy.ts
 */
import { DependentOrigination } from '../../src/axiom-os/dependent-origination';
import { DFUMTConsistencyChecker } from '../../src/axiom-os/dfumt-consistency-checker';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  D-FUMT 普遍哲学統合テスト');
  console.log('  東洋・西洋・アフリカ・中南米・オセアニア・イスラム');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── 整合性チェック（全理論・全ペア）──────────────────
  const checker = new DFUMTConsistencyChecker();
  const report  = checker.checkAll();
  console.log('=== 全理論整合性チェック ===');
  console.log(checker.formatReport(report));

  // ── 縁起関係: 新哲学体系の相互依存を検証 ──────────
  const origination = new DependentOrigination();

  // 根源層
  origination.addAxiomNode('dfumt-zero-state',       'ZERO状態',          []);
  // 東洋層
  origination.addAxiomNode('dfumt-catuskoti',         '四値論理（龍樹）',  ['dfumt-zero-state']);
  origination.addAxiomNode('dfumt-flowing-value',     '流動値',            ['dfumt-zero-state']);
  origination.addAxiomNode('dfumt-anti-axiom',        '反公理',            ['dfumt-catuskoti']);
  // アフリカ層: ウブントゥは「関係性が存在を生成」→縁起と同構造
  origination.addAxiomNode('dfumt-ubuntu',            'ウブントゥ',        ['dfumt-catuskoti', 'dfumt-zero-state']);
  origination.addAxiomNode('dfumt-bantu-force',       'バントゥ生命力',    ['dfumt-flowing-value', 'dfumt-ubuntu']);
  // 中南米層: テオトルは「宇宙の自己変容」→AntiAxiomと同構造
  origination.addAxiomNode('dfumt-teotl',             'テオトル',          ['dfumt-anti-axiom', 'dfumt-flowing-value']);
  origination.addAxiomNode('dfumt-nepantla',          'ネパントラ',        ['dfumt-teotl', 'dfumt-catuskoti']);
  // オセアニア層: ドリームタイムは非線形時間→TemporalReasoningと同構造
  origination.addAxiomNode('dfumt-dreamtime',         'ドリームタイム',    ['dfumt-flowing-value']);
  origination.addAxiomNode('dfumt-whakapapa',         'ワカパパ',          ['dfumt-ubuntu', 'dfumt-dreamtime']);
  // イスラム層: ワフダは「存在一性」→unified-number-systemと同構造
  origination.addAxiomNode('dfumt-wahdat-al-wujud',   'ワフダ存在一性',    ['dfumt-zero-state']);
  origination.addAxiomNode('dfumt-barzakh',           'バルザフ中間世界',  ['dfumt-wahdat-al-wujud', 'dfumt-nepantla']);
  // 統合層: 全哲学体系の縁起的統合
  origination.addAxiomNode('dfumt-universal',         'D-FUMT普遍統合',    [
    'dfumt-catuskoti', 'dfumt-ubuntu', 'dfumt-teotl',
    'dfumt-dreamtime', 'dfumt-wahdat-al-wujud',
  ]);

  console.log('\n=== 哲学体系の縁起判定 ===\n');
  const nodes = [
    'dfumt-ubuntu', 'dfumt-bantu-force',
    'dfumt-teotl', 'dfumt-nepantla',
    'dfumt-dreamtime', 'dfumt-whakapapa',
    'dfumt-wahdat-al-wujud', 'dfumt-barzakh',
    'dfumt-universal',
  ];

  for (const id of nodes) {
    const result = origination.canArise(id);
    const symbol = result.logicValue === 'TRUE'    ? '⊤' :
                   result.logicValue === 'FALSE'   ? '⊥' :
                   result.logicValue === 'FLOWING' ? '～' :
                   result.logicValue === 'NEITHER' ? '⊠' :
                   result.logicValue === 'ZERO'    ? '〇' : '?';
    console.log(`[${symbol}] ${id.replace('dfumt-', '')}`);
    console.log(`     生起: ${result.canArise ? '✓' : '✗'}  理由: ${result.reason}`);
  }

  // ── 定理導出: 新カテゴリ同士の組み合わせ ─────────────
  console.log('\n=== 新カテゴリ間の定理導出 ===\n');
  console.log('ubuntu ∧ catuskoti → 関係性と四値論理の融合定理');
  console.log('dreamtime ∧ flowing-value → 非線形時間と流動値の統合');
  console.log('wahdat-al-wujud ∧ unified-number-system → 存在一性と統合数の対応');
  console.log('\n（TheoremDeriverは既存カテゴリのみ対応のため、上記は概念レベルの対応を示す）');

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  各哲学体系とD-FUMTの対応表');
  console.log('═══════════════════════════════════════════════════════');
  const table = [
    ['哲学体系',           'D-FUMT対応',                   '七価値'],
    ['ウブントゥ',         'DependentOrigination',         'FLOWING'],
    ['バントゥ生命力',     'FLOWING値',                    'FLOWING'],
    ['テオトル',           'AntiAxiomEngine（自己変容）',  'BOTH'],
    ['ネパントラ',         'BOTH値（中間状態）',            'BOTH'],
    ['ドリームタイム',     'TemporalReasoningEngine',      'FLOWING'],
    ['ワカパパ',           '縁起エンジン（系譜）',          'TRUE'],
    ['ワフダ存在一性',     'unified-number-system',        'TRUE'],
    ['バルザフ中間世界',   'NEITHER値（中間）',             'NEITHER'],
  ];
  for (const row of table) {
    console.log(`  ${row[0].padEnd(20)} → ${row[1].padEnd(30)} [${row[2]}]`);
  }
}

main().catch(console.error);
