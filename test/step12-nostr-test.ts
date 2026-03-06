import {
  NostrAxiomShare,
  DEFAULT_RELAYS,
  generateNostrPanel,
  type AxiomPayload,
} from '../src/p2p/nostr-axiom-share';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

async function main() {
  console.log('\n=== STEP 12: Nostr公理共有テスト ===\n');

  const nostr = new NostrAxiomShare(DEFAULT_RELAYS, ':memory:');

  // ─── 1. 鍵ペア生成テスト ─────────────────────────────────────
  console.log('【1. 鍵ペア生成】');
  const keyPair = nostr.generateKeyPair();
  assert(keyPair.privateKey.length === 64, '秘密鍵が64文字hex');
  assert(keyPair.publicKey.length === 64, '公開鍵が64文字hex');
  assert(keyPair.npub.startsWith('npub1'), 'npubがnpub1で始まる');
  assert(keyPair.nsec.startsWith('nsec1'), 'nsecがnsec1で始まる');
  console.log(`    npub: ${keyPair.npub.slice(0,20)}...`);

  nostr.setKeyPair(keyPair);

  // ─── 2. イベントID計算テスト ─────────────────────────────────
  console.log('\n【2. イベントID計算】');
  const eventId = await nostr.calcEventId({
    pubkey: keyPair.publicKey,
    created_at: 1700000000,
    kind: 30078,
    tags: [['d', 'Theory #101'], ['t', 'rei-dfumt']],
    content: '{"test": true}',
  });
  assert(eventId.length === 64, `イベントIDが64文字: ${eventId.slice(0,16)}...`);

  // ─── 3. 公理発行テスト（ネットワーク不要） ────────────────────
  console.log('\n【3. 公理発行テスト（ローカルキャッシュ）】');
  const payload: AxiomPayload = {
    version: '1.0',
    theoryId: 'Theory #101',
    name: '意識の自己参照公理',
    description: '意識はそれ自身を観察できる唯一の存在である。D-FUMT BOTHで表現される。',
    dfumtValue: 'BOTH',
    category: 'consciousness',
    author: '藤本伸樹',
    license: 'CC0',
  };

  const result = await nostr.publishAxiom(payload, keyPair);
  assert(!!result.eventId, 'イベントIDが生成される');
  assert(result.eventId!.length === 64, 'イベントIDが64文字');
  // ネットワークなし環境ではリレー失敗は許容
  assert(Array.isArray(result.relaysOk), 'リレー成功リストが配列');
  assert(Array.isArray(result.relaysFailed), 'リレー失敗リストが配列');
  console.log(`    イベントID: ${result.eventId!.slice(0,16)}...`);
  console.log(`    リレー: ${result.relaysOk.length}成功 / ${result.relaysFailed.length}失敗`);

  // ─── 4. 複数公理の発行テスト ─────────────────────────────────
  console.log('\n【4. 複数公理の発行】');
  const payloads: AxiomPayload[] = [
    {
      version: '1.0',
      theoryId: 'Theory #102',
      name: '螺旋数論の拡張',
      description: '黄金比と螺旋の数学的関係をD-FUMTで記述する',
      dfumtValue: 'INFINITY',
      category: 'mathematics',
      author: '藤本伸樹',
      license: 'CC0',
    },
    {
      version: '1.0',
      theoryId: 'Theory #103',
      name: '縁起の圧縮定理',
      description: '縁起ネットワークは公理列として最小記述できる',
      dfumtValue: 'FLOWING',
      category: 'compression',
      author: '藤本伸樹',
      license: 'CC0',
    },
  ];

  for (const p of payloads) {
    const r = await nostr.publishAxiom(p, keyPair);
    assert(!!r.eventId, `${p.theoryId} のイベントIDが生成される`);
  }

  // ─── 5. キャッシュ取得テスト ─────────────────────────────────
  console.log('\n【5. キャッシュからの公理取得】');
  const cached = nostr.getCachedAxioms();
  assert(cached.length >= 3, `キャッシュに3件以上: ${cached.length}件`);

  const cachedConsciousness = nostr.getCachedAxioms('consciousness');
  assert(cachedConsciousness.length >= 1,
    `意識カテゴリが1件以上: ${cachedConsciousness.length}件`);

  // ─── 6. 購読テスト（ネットワーク不要・空結果） ────────────────
  console.log('\n【6. 公理購読テスト（Node.js環境）】');
  const subResult = await nostr.subscribeAxioms({ limit: 10 });
  assert(typeof subResult.received === 'number', '受信数が数値');
  assert(Array.isArray(subResult.newAxioms), '新規公理が配列');
  assert(['TRUE','FALSE','BOTH','NEITHER','INFINITY','ZERO','FLOWING']
    .includes(subResult.dfumtTrust), `D-FUMT信頼性が有効: ${subResult.dfumtTrust}`);
  console.log(`    受信: ${subResult.received}件 / 新規: ${subResult.newAxioms.length}件`);
  console.log(`    D-FUMT信頼性: ${subResult.dfumtTrust}`);

  // ─── 7. 統計テスト ───────────────────────────────────────────
  console.log('\n【7. 統計情報】');
  const stats = nostr.stats();
  assert(stats.published >= 3, `発行数3以上: ${stats.published}件`);
  assert(stats.relays.length === DEFAULT_RELAYS.length,
    `リレー数: ${stats.relays.length}件`);
  assert(stats.hasKeyPair === true, '鍵ペアが設定されている');
  console.log(`    発行済み: ${stats.published}件`);
  console.log(`    キャッシュ: ${stats.cached}件`);
  console.log(`    リレー: ${stats.relays.length}件`);

  // ─── 8. WebUIパネル生成テスト ────────────────────────────────
  console.log('\n【8. WebUIパネル生成】');
  const panel = generateNostrPanel(DEFAULT_RELAYS);
  assert(panel.includes('panel-nostr'), 'パネルIDが存在する');
  assert(panel.includes('publishAxiom'), '発行関数が存在する');
  assert(panel.includes('subscribeAxioms'), '購読関数が存在する');
  assert(panel.includes('generateNostrKey'), '鍵生成関数が存在する');
  assert(panel.includes('rei-dfumt'), 'Nostrタグが存在する');
  assert(panel.includes('NOSTR_DFUMT_COLORS'), 'D-FUMT色定義が存在する');
  assert(DEFAULT_RELAYS.every(r => panel.includes(r.replace('wss://', ''))),
    'すべてのリレーが表示される');
  console.log(`    パネルサイズ: ${panel.length}文字`);

  // ─── 9. D-FUMT信頼性評価テスト ───────────────────────────────
  console.log('\n【9. D-FUMT信頼性評価ロジック確認】');
  // 内部メソッドを間接的に確認
  const nostr2 = new NostrAxiomShare([], ':memory:');
  const s0 = await nostr2.subscribeAxioms({ limit: 0 });
  assert(s0.dfumtTrust === 'ZERO' || s0.dfumtTrust === 'NEITHER',
    `取得0件はZERO/NEITHER: ${s0.dfumtTrust}`);

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`結果: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
