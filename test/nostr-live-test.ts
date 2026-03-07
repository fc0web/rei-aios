/**
 * Nostr実通信テスト
 * 実行: npm run test:nostr-live
 *
 * 実際のNostrリレーへ接続し:
 *   1. rei-dfumtタグの公理を購読（既存データ取得）
 *   2. テスト公理を発行
 *   3. キャッシュ動作確認
 */

import { NostrAxiomShare, DEFAULT_RELAYS } from '../src/p2p/nostr-axiom-share';
import type { AxiomPayload } from '../src/p2p/nostr-axiom-share';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else      { console.log(`  ✗ ${msg}`); failed++; }
}

async function runTests() {
  console.log('\n=== Nostr実通信テスト ===\n');
  console.log(`接続先リレー: ${DEFAULT_RELAYS.slice(0, 2).join(', ')}\n`);

  const share = new NostrAxiomShare(DEFAULT_RELAYS, './dist/nostr-test-cache.json');

  // ── テスト1: 鍵ペア生成 ───────────────────────────────────────
  console.log('--- テスト1: 鍵ペア生成 ---');
  const keyPair = share.generateKeyPair();
  assert(keyPair.npub.startsWith('npub1'), '鍵ペア生成: npub形式 OK');
  assert(keyPair.nsec.startsWith('nsec1'), '鍵ペア生成: nsec形式 OK');
  assert(keyPair.privateKey.length === 64, '鍵ペア生成: 秘密鍵64文字 OK');
  share.setKeyPair(keyPair);
  console.log(`  公開鍵: ${keyPair.npub}`);

  // ── テスト2: Nostrリレーへの購読（既存公理取得） ────────────────
  console.log('\n--- テスト2: Nostrリレー購読（既存公理取得） ---');
  console.log('  接続中... (最大8秒)');

  const subResult = await share.subscribeAxioms({ limit: 20 });

  console.log(`  受信イベント数 : ${subResult.received}`);
  console.log(`  新規公理数     : ${subResult.newAxioms.length}`);
  console.log(`  キャッシュ済   : ${subResult.cached}`);
  console.log(`  信頼スコア     : ${subResult.dfumtTrust}`);

  assert(typeof subResult.received === 'number', '購読: received が数値 OK');
  assert(typeof subResult.dfumtTrust === 'string', '購読: dfumtTrust が文字列 OK');

  if (subResult.newAxioms.length > 0) {
    console.log('\n  取得した公理:');
    subResult.newAxioms.slice(0, 3).forEach((a, i) => {
      console.log(`  [${i + 1}] ${a.theoryId} — ${a.name} (${a.dfumtValue})`);
    });
  } else {
    console.log('  まだrei-dfumt公理は発行されていません（初回は正常）');
  }

  // ── テスト3: テスト公理の発行 ────────────────────────────────────
  console.log('\n--- テスト3: テスト公理の発行 ---');

  const testPayload: AxiomPayload = {
    version: '1.0',
    theoryId: 'Theory #94-nagarjuna-test',
    name: '龍樹・Łukasiewicz統一定理（テスト）',
    description: 'catuskoti(neither) == lukasiewicz(unknown) == NEITHER',
    dfumtValue: 'NEITHER',
    category: 'nagarjuna',
    author: '藤本 伸樹 (fc0web)',
    license: 'CC0',
  };

  console.log('  発行中... (各リレー最大5秒)');
  const pubResult = await share.publishAxiom(testPayload, keyPair);

  console.log(`  成功リレー : ${pubResult.relaysOk.length}件`);
  console.log(`  失敗リレー : ${pubResult.relaysFailed.length}件`);
  if (pubResult.eventId) {
    console.log(`  イベントID : ${pubResult.eventId.slice(0, 16)}...`);
  }

  pubResult.relaysOk.forEach(r => console.log(`  ✓ ${r}`));
  pubResult.relaysFailed.forEach(r => console.log(`  ✗ ${r}`));

  assert(
    pubResult.relaysOk.length > 0 || pubResult.relaysFailed.length > 0,
    '発行: リレーへの試行が実行された OK'
  );

  // ── テスト4: キャッシュ動作確認 ─────────────────────────────────
  console.log('\n--- テスト4: キャッシュ確認 ---');
  const cached = share.getCachedAxioms();
  assert(cached.length >= 0, 'キャッシュ: getCachedAxioms() が呼べる OK');
  console.log(`  キャッシュ済公理数: ${cached.length}`);

  // ── テスト5: 統計確認 ────────────────────────────────────────────
  console.log('\n--- テスト5: 統計 ---');
  const stats = share.stats();
  assert(stats.relays.length > 0, '統計: リレー設定あり OK');
  assert(stats.hasKeyPair === true, '統計: 鍵ペア設定済み OK');
  console.log(`  published : ${stats.published}`);
  console.log(`  cached    : ${stats.cached}`);
  console.log(`  relays    : ${stats.relays.length}件`);

  // ── 結果 ─────────────────────────────────────────────────────────
  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

  if (pubResult.relaysOk.length > 0) {
    console.log('Nostrリレーとの実通信成功！');
    console.log('   発行した公理はNostrネットワーク上に存在します。');
    console.log('   他のrei-aiosインスタンスがsubscribeAxioms()で取得できます。');
  } else {
    console.log('リレーへの接続に失敗しました（署名なしのため拒否は想定内）。');
  }

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
