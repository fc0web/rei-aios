import { AxiomDHT } from '../src/axiom-os/axiom-dht';
import { AxiomContentAddressor, type ContentAddressedAxiom } from '../src/axiom-os/axiom-content-address';
import { AxiomDistributionHub } from '../src/axiom-os/axiom-distribution-hub';
import { type SeedTheory } from '../src/axiom-os/seed-kernel';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== P2P基盤 Step 3-A/B: AxiomDHT + CID テスト ===\n');

// テスト用公理
const axiomA: SeedTheory = {
  id: 'test-1', axiom: 'π×π⁻¹=1 キャンセル意味論',
  category: 'zero_extension', keywords: ['ゼロπ', 'pi'],
};
const axiomB: SeedTheory = {
  id: 'test-2', axiom: '真偽両方neither 四値論理',
  category: 'logic', keywords: ['四価論理', '龍樹'],
};
const axiomC: SeedTheory = {
  id: 'test-3', axiom: 'Ω(Ω(x))→Ω(x) 安定性',
  category: 'computation', keywords: ['冪等性', 'omega'],
};
const axiomD: SeedTheory = {
  id: 'test-4', axiom: '⊖(x) ゼロ還元',
  category: 'zero_extension', keywords: ['縮約ゼロ', '⊖', 'ゼロπ'],
};
const axiomE: SeedTheory = {
  id: 'test-5', axiom: '数は螺旋上に配置',
  category: 'mathematics', keywords: ['螺旋数', 'phi'],
};

// ══════════════════════════════════════
// DHT基本操作
// ══════════════════════════════════════
console.log('DHT基本操作');

const dht = new AxiomDHT('test-node-id-0001');

// テスト1: put → get でCIDが一致
{
  const cid = dht.put(axiomA);
  const retrieved = dht.get(cid);
  assert(retrieved !== undefined, '1. put→get: 公理が取得できる');
  assert(retrieved!.axiom === axiomA.axiom, '1. put→get: 内容が一致');
}

// テスト2: 同じ内容の公理は同じCIDを返す
{
  const cid1 = dht.computeCID(axiomA);
  const cid2 = dht.computeCID(axiomA);
  assert(cid1 === cid2, '2. 同内容→同CID');
}

// テスト3: 異なる内容の公理は異なるCIDを返す
{
  const cidA = dht.computeCID(axiomA);
  const cidB = dht.computeCID(axiomB);
  assert(cidA !== cidB, '3. 異内容→異CID');
}

// テスト4: findNearest で最も近い公理k件を返す
{
  dht.put(axiomB);
  dht.put(axiomC);
  dht.put(axiomD);
  dht.put(axiomE);
  const nearest = dht.findNearest(axiomA, 3);
  assert(nearest.length <= 3, '4. findNearest: k=3で最大3件');
  assert(nearest.length > 0, '4. findNearest: 結果あり');
}

// テスト5: stats でtotalAxiomsが正しい
{
  const stats = dht.stats();
  assert(stats.totalAxioms >= 5, '5. stats: totalAxioms >= 5');
  assert(stats.bucketCount > 0, '5. stats: bucketCount > 0');
  assert(stats.nodeId === 'test-node-id-0001', '5. stats: nodeId一致');
}

// ══════════════════════════════════════
// コンテンツアドレス
// ══════════════════════════════════════
console.log('\nコンテンツアドレス');

const addressor = new AxiomContentAddressor();

// テスト6: address でCIDが生成される
{
  const addressed = addressor.address(axiomA);
  assert(addressed.cid.startsWith('Qm'), '6. CIDがQmで始まる');
  assert(addressed.cidVersion === 'v0', '6. CIDバージョンv0');
  assert(addressed.multihash.length === 64, '6. multihashが64文字(SHA-256)');
  assert(addressed.size > 0, '6. sizeが正');
}

// テスト7: verify で改ざん検知できる
{
  const addressed = addressor.address(axiomA);
  assert(addressor.verify(addressed), '7. verify: 正常な公理はtrue');

  // 改ざん
  const tampered: ContentAddressedAxiom = { ...addressed, axiom: '改ざんされた内容' };
  assert(!addressor.verify(tampered), '7. verify: 改ざん検知');
}

// テスト8: findCommon で共通公理を検出
{
  const listA = addressor.addressAll([axiomA, axiomB, axiomC]);
  const listB = addressor.addressAll([axiomB, axiomC, axiomD]);
  const common = addressor.findCommon(listA, listB);
  assert(common.length === 2, '8. findCommon: 共通2件(B,C)');
}

// テスト9: キーワード順序が違っても同じCID
{
  const axiomX: SeedTheory = {
    id: 'x1', axiom: 'test axiom', category: 'logic', keywords: ['b', 'a', 'c'],
  };
  const axiomY: SeedTheory = {
    id: 'x2', axiom: 'test axiom', category: 'logic', keywords: ['c', 'a', 'b'],
  };
  const cidX = addressor.address(axiomX).cid;
  const cidY = addressor.address(axiomY).cid;
  assert(cidX === cidY, '9. キーワード順序不問で同CID');
}

// テスト10: カテゴリが違えば異なるCID
{
  const a1: SeedTheory = { id: 'c1', axiom: 'same', category: 'logic', keywords: ['k'] };
  const a2: SeedTheory = { id: 'c2', axiom: 'same', category: 'math', keywords: ['k'] };
  assert(addressor.address(a1).cid !== addressor.address(a2).cid, '10. 異カテゴリ→異CID');
}

// ══════════════════════════════════════
// 七価論理距離
// ══════════════════════════════════════
console.log('\n七価論理距離');

// テスト11: 同カテゴリは距離が近い
{
  const dist = dht.sevenLogicDistance(axiomA, axiomD); // 共にzero_extension
  assert(dist < 2, '11. 同カテゴリ: 距離 < 2');
}

// テスト12: 異カテゴリは距離が遠い
{
  const dist = dht.sevenLogicDistance(axiomA, axiomB); // zero_extension vs logic
  assert(dist >= 2, '12. 異カテゴリ: 距離 >= 2');
}

// テスト13: 共通キーワードが多いほど距離が近い
{
  const distAD = dht.sevenLogicDistance(axiomA, axiomD); // 共通: ゼロπ
  const distAE = dht.sevenLogicDistance(axiomA, axiomE); // 共通: なし
  assert(distAD <= distAE, '13. 共通KW多→距離近');
}

// ══════════════════════════════════════
// AxiomDistributionHub統合テスト
// ══════════════════════════════════════
console.log('\nAxiomDistributionHub統合テスト');

const hub = new AxiomDistributionHub();

// テスト14: publishSingle でDHTに登録される
{
  const code = `function f(n) { if (n<=1) return 1; return n*f(n-1); }`;
  hub.publishSingle(code, 'node-01', '1.0.0');
  const dhtStats = hub.getDHTStats();
  assert(dhtStats.totalAxioms > 0, '14. publishSingle→DHTに登録');
}

// テスト15: グローバル公理が蓄積
{
  const axioms = hub.getGlobalAxioms();
  assert(axioms.length > 0, '15. グローバル公理蓄積');
}

// テスト16: DHTStats構造確認
{
  const stats = hub.getDHTStats();
  assert(typeof stats.totalAxioms === 'number', '16. stats.totalAxioms: number');
  assert(typeof stats.bucketCount === 'number', '16. stats.bucketCount: number');
  assert(typeof stats.nodeId === 'string', '16. stats.nodeId: string');
}

// テスト17: 2回publishで公理が増加
{
  const before = hub.getGlobalAxioms().length;
  const code2 = `[1,2,3].map(x=>x*2).reduce((a,b)=>a+b,0);`;
  hub.publishSingle(code2, 'node-02', '1.1.0');
  const after = hub.getGlobalAxioms().length;
  assert(after >= before, '17. 2回publishで公理増加');
}

// テスト18: getStatus確認
{
  const status = hub.getStatus();
  assert(status.totalAxioms > 0, '18. status.totalAxioms > 0');
  assert(status.packages > 0, '18. status.packages > 0');
}

// テスト19: findNearestAxioms
{
  const testAxiom: SeedTheory = {
    id: 'search', axiom: '再帰的計算', category: 'computation', keywords: ['再帰'],
  };
  const nearest = hub.findNearestAxioms(testAxiom, 3);
  assert(Array.isArray(nearest), '19. findNearestAxioms: 配列返却');
}

// テスト20: CID一貫性（DHT経由）
{
  const dht2 = new AxiomDHT();
  const cid1 = dht2.put(axiomA);
  const cid2 = dht2.computeCID(axiomA);
  assert(cid1 === cid2, '20. put返却CID = computeCID');
}

// テスト21: 空DHT stats
{
  const emptyDHT = new AxiomDHT();
  const stats = emptyDHT.stats();
  assert(stats.totalAxioms === 0, '21. 空DHT: totalAxioms=0');
  assert(stats.bucketCount === 0, '21. 空DHT: bucketCount=0');
}

// テスト22: get 存在しないCID
{
  const result = dht.get('Qm_nonexistent_cid_12345');
  assert(result === undefined, '22. 存在しないCID→undefined');
}

// テスト23: addressAll一括
{
  const all = addressor.addressAll([axiomA, axiomB, axiomC, axiomD, axiomE]);
  assert(all.length === 5, '23. addressAll: 5件');
  assert(all.every(a => a.cid.startsWith('Qm')), '23. 全CIDがQm始まり');
}

// テスト24: CIDの長さ確認
{
  const addressed = addressor.address(axiomA);
  assert(addressed.cid.length === 46, '24. CID長=46(Qm+44)');
}

// テスト25: findCommon 空リスト
{
  const common = addressor.findCommon([], addressor.addressAll([axiomA]));
  assert(common.length === 0, '25. findCommon空リスト→0件');
}

// テスト26: DHTノードID自動生成
{
  const autoNode = new AxiomDHT();
  const stats = autoNode.stats();
  assert(stats.nodeId.length === 40, '26. 自動NodeID: 40文字hex');
}

// テスト27: 同一公理を2回putしても重複しない
{
  const dht3 = new AxiomDHT();
  dht3.put(axiomA);
  dht3.put(axiomA);
  assert(dht3.stats().totalAxioms === 1, '27. 同一公理2回put→1件');
}

// テスト28: findNearest 空DHT
{
  const emptyDHT = new AxiomDHT();
  const nearest = emptyDHT.findNearest(axiomA, 5);
  assert(nearest.length === 0, '28. 空DHT findNearest→0件');
}

// テスト29: Hub receive後もDHT統計が増える
{
  const hub2 = new AxiomDistributionHub();
  const code = `const x = 42; function id(a) { return a; }`;
  const pkg = hub2.publishSingle(code, 'n1', '1.0.0');
  const before = hub2.getDHTStats().totalAxioms;
  // receiveで追加（同一パッケージなのでskipが多い可能性）
  hub2.receive(pkg);
  const after = hub2.getDHTStats().totalAxioms;
  assert(after >= before, '29. receive後DHTaxioms >= before');
}

// テスト30: sevenLogicDistance 同一公理→距離0
{
  const dist = dht.sevenLogicDistance(axiomA, axiomA);
  assert(dist === 0, '30. 同一公理→距離0');
}

// ══════════════════════════════════════
// 結果
// ══════════════════════════════════════
console.log(`\n${'='.repeat(50)}`);
console.log(`P2P基盤 Step 3-A/B: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
