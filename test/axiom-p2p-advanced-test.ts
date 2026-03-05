import { AxiomAnonymousCache, type AnonymousAxiom } from '../src/axiom-os/axiom-anonymous-cache';
import { AxiomTrustScorer } from '../src/axiom-os/axiom-trust-scorer';
import { AxiomAsyncStore } from '../src/axiom-os/axiom-async-store';
import { AxiomSubnet } from '../src/axiom-os/axiom-subnet';
import { type SeedTheory } from '../src/axiom-os/seed-kernel';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== P2P応用 Step 3-C/D/E/F テスト ===\n');

// テスト用公理
const axiomA: SeedTheory = {
  id: 'a1', axiom: 'π×π⁻¹=1', category: 'zero_extension', keywords: ['ゼロπ', 'pi'],
};
const axiomB: SeedTheory = {
  id: 'a2', axiom: '四値論理', category: 'logic', keywords: ['四価論理', '龍樹'],
};
const axiomC: SeedTheory = {
  id: 'a3', axiom: 'Ω冪等性', category: 'computation', keywords: ['冪等性', 'omega'],
};
const axiomD: SeedTheory = {
  id: 'a4', axiom: '螺旋数', category: 'mathematics', keywords: ['螺旋数', 'phi'],
};
const axiomE: SeedTheory = {
  id: 'a5', axiom: '⊖ゼロ還元', category: 'zero_extension', keywords: ['縮約ゼロ'],
};

// ══════════════════════════════════════
// Step 3-C: AnonymousCache（10件）
// ══════════════════════════════════════
console.log('Step 3-C: Winny的匿名キャッシュ');

const cache = new AxiomAnonymousCache();

// テスト1: anonymize で匿名公理が生成される
{
  const anon = cache.anonymize(axiomA, 'Qm_test_cid_001');
  assert(anon.cid === 'Qm_test_cid_001', '1. anonymize: CID保持');
  assert(anon.encryptedSource.length === 64, '1. anonymize: 暗号化ソース64文字');
  assert(anon.relayCount === 0, '1. anonymize: relay初期0');
}

// テスト2: store でキャッシュに追加される
{
  const anon = cache.anonymize(axiomA, 'Qm_cid_A');
  cache.store(anon);
  assert(cache.stats().cacheSize === 1, '2. store: cacheSize=1');
}

// テスト3: get でアクセス数が増加
{
  const item = cache.get('Qm_cid_A');
  assert(item !== undefined, '3. get: 取得成功');
  assert(item!.accessCount === 1, '3. get: accessCount=1');
  cache.get('Qm_cid_A');
  assert(cache.get('Qm_cid_A')!.accessCount === 3, '3. get: accessCount増加');
}

// テスト4: 存在しないCID → undefined
{
  assert(cache.get('Qm_nonexistent') === undefined, '4. 存在しないCID→undefined');
}

// テスト5: store でrelayCountが+1される
{
  const anon = cache.anonymize(axiomB, 'Qm_cid_B');
  assert(anon.relayCount === 0, '5. anonymize直後: relay=0');
  cache.store(anon);
  const stored = cache.get('Qm_cid_B');
  assert(stored!.relayCount === 1, '5. store後: relay=1');
}

// テスト6: isAnonymous（しきい値未満）
{
  assert(!cache.isAnonymous('Qm_cid_B'), '6. relay=1: 匿名性未確立');
}

// テスト7: 複数中継で匿名性確立
{
  let anon = cache.anonymize(axiomC, 'Qm_cid_C');
  anon.relayCount = 2; // 既に2回中継済み
  cache.store(anon); // +1で3回 → しきい値到達
  assert(cache.isAnonymous('Qm_cid_C'), '7. relay=3: 匿名性確立');
}

// テスト8: getPopular
{
  // Aは3回アクセス済み
  const popular = cache.getPopular(2);
  assert(popular.length <= 2, '8. getPopular: 最大2件');
  assert(popular[0].accessCount >= popular[popular.length - 1].accessCount, '8. getPopular: 降順');
}

// テスト9: stats
{
  const stats = cache.stats();
  assert(stats.cacheSize >= 3, '9. stats: cacheSize >= 3');
  assert(stats.anonymousCount >= 1, '9. stats: anonymousCount >= 1');
  assert(stats.totalAccess > 0, '9. stats: totalAccess > 0');
}

// テスト10: 同じCIDでstoreすると上書き
{
  const anon1 = cache.anonymize(axiomD, 'Qm_cid_D');
  cache.store(anon1);
  const before = cache.stats().cacheSize;
  const anon2 = cache.anonymize(axiomD, 'Qm_cid_D');
  cache.store(anon2);
  assert(cache.stats().cacheSize === before, '10. 同CID store→上書き');
}

// ══════════════════════════════════════
// Step 3-D: TrustScorer（10件）
// ══════════════════════════════════════
console.log('\nStep 3-D: Share的信頼スコア');

const scorer = new AxiomTrustScorer();

// テスト11: register で初期状態
{
  const trust = scorer.register('node-01');
  assert(trust.score === 0.5, '11. register: 初期score=0.5');
  assert(trust.trustLevel === '〇', '11. register: 初期level=〇');
  assert(trust.contributions === 0, '11. register: contributions=0');
}

// テスト12: reward でスコア上昇
{
  scorer.reward('node-01', axiomA);
  const all = scorer.getAll();
  const n = all.find(n => n.nodeId === 'node-01')!;
  assert(n.score > 0.5, '12. reward: スコア上昇');
  assert(n.contributions === 1, '12. reward: contributions=1');
}

// テスト13: 複数reward で⊤到達
{
  for (let i = 0; i < 20; i++) {
    scorer.reward('node-01', { ...axiomA, confidence: 1.0 } as any);
  }
  const all = scorer.getAll();
  const n = all.find(n => n.nodeId === 'node-01')!;
  assert(n.trustLevel === '⊤', '13. 多数reward→⊤');
}

// テスト14: isTrusted
{
  assert(scorer.isTrusted('node-01'), '14. isTrusted: ⊤ノード→true');
  assert(!scorer.isTrusted('unknown-node'), '14. isTrusted: 未登録→false');
}

// テスト15: penalize でスコア下降
{
  scorer.register('node-bad');
  scorer.penalize('node-bad', '不正公理');
  const all = scorer.getAll();
  const n = all.find(n => n.nodeId === 'node-bad')!;
  assert(n.score < 0.5, '15. penalize: スコア下降');
  assert(n.violations === 1, '15. penalize: violations=1');
}

// テスト16: 複数penalize で⊥到達
{
  scorer.penalize('node-bad', '再犯');
  scorer.penalize('node-bad', '三犯');
  assert(scorer.isBlacklisted('node-bad'), '16. 複数penalize→⊥(blacklisted)');
}

// テスト17: isBlacklisted
{
  assert(!scorer.isBlacklisted('node-01'), '17. isBlacklisted: ⊤ノード→false');
  assert(scorer.isBlacklisted('node-bad'), '17. isBlacklisted: ⊥ノード→true');
}

// テスト18: 未登録ノードへのreward → 自動登録
{
  scorer.reward('auto-node', axiomB);
  assert(scorer.isTrusted('auto-node'), '18. 未登録reward→自動登録+信頼');
}

// テスト19: stats
{
  const stats = scorer.stats();
  assert(stats.total >= 3, '19. stats: total >= 3');
  assert(stats.trusted >= 1, '19. stats: trusted >= 1');
  assert(stats.blacklisted >= 1, '19. stats: blacklisted >= 1');
}

// テスト20: score上限1.0を超えない
{
  for (let i = 0; i < 100; i++) scorer.reward('node-01', axiomA);
  const all = scorer.getAll();
  const n = all.find(n => n.nodeId === 'node-01')!;
  assert(n.score <= 1.0, '20. score上限1.0');
}

// ══════════════════════════════════════
// Step 3-E: AsyncStore（10件）
// ══════════════════════════════════════
// async部分をIIFEでラップ
async function runAsyncTests() {

console.log('\nStep 3-E: PerfectDark的非同期蓄積');

const store = new AxiomAsyncStore();

// テスト21: submit でpendingに追加
{
  const entry = store.submit(axiomA, 'Qm_cid_A');
  assert(entry.synced === false, '21. submit: synced=false');
  assert(entry.retryCount === 0, '21. submit: retryCount=0');
  assert(entry.id.startsWith('pending-'), '21. submit: ID形式');
}

// テスト22: getPending
{
  store.submit(axiomB, 'Qm_cid_B');
  const pending = store.getPending();
  assert(pending.length === 2, '22. getPending: 2件');
}

// テスト23: sync 成功
{
  const count = await store.sync(async () => true);
  assert(count === 2, '23. sync成功: 2件同期');
  assert(store.getPending().length === 0, '23. sync後: pending=0');
}

// テスト24: getSynced
{
  const synced = store.getSynced();
  assert(synced.length === 2, '24. getSynced: 2件');
  assert(synced[0].synced === true, '24. getSynced: synced=true');
}

// テスト25: sync 失敗→retryCount増加
{
  store.submit(axiomC, 'Qm_cid_C');
  await store.sync(async () => false);
  const pending = store.getPending();
  assert(pending.length === 1, '25. sync失敗: pendingに残る');
  assert(pending[0].retryCount === 1, '25. sync失敗: retryCount=1');
}

// テスト26: MAX_RETRY超過で同期スキップ
{
  for (let i = 0; i < 5; i++) await store.sync(async () => false);
  const pending = store.getPending();
  assert(pending[0].retryCount >= 5, '26. MAX_RETRY到達');
  const count = await store.sync(async () => true);
  assert(count === 0, '26. MAX_RETRY超過→スキップ');
}

// テスト27: stats
{
  const stats = store.stats();
  assert(stats.syncedCount === 2, '27. stats: syncedCount=2');
  assert(stats.failedCount >= 1, '27. stats: failedCount >= 1');
}

// テスト28: 新規submit後のstats
{
  const store2 = new AxiomAsyncStore();
  store2.submit(axiomD, 'Qm_D');
  store2.submit(axiomE, 'Qm_E');
  assert(store2.stats().pendingCount === 2, '28. 新store: pendingCount=2');
  assert(store2.stats().syncedCount === 0, '28. 新store: syncedCount=0');
}

// テスト29: sync例外→retryCount増加
{
  const store3 = new AxiomAsyncStore();
  store3.submit(axiomA, 'Qm_err');
  await store3.sync(async () => { throw new Error('network'); });
  assert(store3.getPending()[0].retryCount === 1, '29. 例外→retryCount+1');
}

// テスト30: 空storeのsync
{
  const store4 = new AxiomAsyncStore();
  const count = await store4.sync(async () => true);
  assert(count === 0, '30. 空store sync→0');
}

// ══════════════════════════════════════
// Step 3-F: Subnet（10件）
// ══════════════════════════════════════
console.log('\nStep 3-F: Cabos的サブネット');

const subnet = new AxiomSubnet();

const compAxioms: SeedTheory[] = [
  { id: 'c1', axiom: '再帰', category: 'computation', keywords: ['再帰'] },
  { id: 'c2', axiom: '冪等', category: 'computation', keywords: ['冪等'] },
];
const logicAxioms: SeedTheory[] = [
  { id: 'l1', axiom: '四値', category: 'logic', keywords: ['四価'] },
  { id: 'l2', axiom: '含意', category: 'logic', keywords: ['含意'] },
];
const mathAxioms: SeedTheory[] = [
  { id: 'm1', axiom: '螺旋', category: 'mathematics', keywords: ['螺旋'] },
];

// テスト31: join でノード登録
{
  const node = subnet.join('node-comp-1', compAxioms);
  assert(node.nodeId === 'node-comp-1', '31. join: nodeId');
  assert(node.categories.includes('computation'), '31. join: computation含む');
  assert(node.axiomCount === 2, '31. join: axiomCount=2');
}

// テスト32: 複数ノード登録
{
  subnet.join('node-logic-1', logicAxioms);
  subnet.join('node-math-1', mathAxioms);
  assert(subnet.stats().totalNodes === 3, '32. 3ノード登録');
}

// テスト33: findPeers 同カテゴリ
{
  subnet.join('node-comp-2', compAxioms);
  const peers = subnet.findPeers('node-comp-1', 'computation');
  assert(peers.length >= 1, '33. findPeers: computation同士');
  assert(peers.some(p => p.nodeId === 'node-comp-2'), '33. findPeers: comp-2発見');
}

// テスト34: findPeers 自分は含まない
{
  const peers = subnet.findPeers('node-comp-1', 'computation');
  assert(!peers.some(p => p.nodeId === 'node-comp-1'), '34. findPeers: 自分除外');
}

// テスト35: findByCategory
{
  const compNodes = subnet.findByCategory('computation');
  assert(compNodes.length >= 2, '35. findByCategory computation >= 2');
}

// テスト36: findByCategory 空カテゴリ
{
  const empty = subnet.findByCategory('expansion');
  assert(empty.length === 0, '36. findByCategory expansion→0');
}

// テスト37: autoConnect 双方向接続
{
  const node1 = subnet.join('node-comp-3', compAxioms);
  // node-comp-3は他のcompノードと自動接続されるはず
  assert(node1.connectedPeers.length > 0, '37. autoConnect: peers接続');
}

// テスト38: stats サブネットサイズ
{
  const stats = subnet.stats();
  assert(stats.totalNodes >= 5, '38. stats: totalNodes >= 5');
  assert((stats.subnetSizes as any)['computation'] >= 3, '38. stats: computation >= 3');
}

// テスト39: 混合カテゴリノード
{
  const mixedAxioms: SeedTheory[] = [
    { id: 'mx1', axiom: 'a', category: 'computation', keywords: [] },
    { id: 'mx2', axiom: 'b', category: 'logic', keywords: [] },
    { id: 'mx3', axiom: 'c', category: 'mathematics', keywords: [] },
  ];
  const node = subnet.join('node-mixed', mixedAxioms);
  assert(node.categories.length >= 2, '39. 混合ノード: 複数カテゴリ');
}

// テスト40: findPeers k制限
{
  for (let i = 0; i < 10; i++) {
    subnet.join(`node-comp-extra-${i}`, compAxioms);
  }
  const peers = subnet.findPeers('node-comp-1', 'computation', 3);
  assert(peers.length <= 3, '40. findPeers k=3制限');
}

} // end runAsyncTests

// ══════════════════════════════════════
// 結果
// ══════════════════════════════════════
runAsyncTests().then(() => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`P2P応用 Step 3-C/D/E/F: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
