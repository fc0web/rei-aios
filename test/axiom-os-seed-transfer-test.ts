import { SeedTransferProtocol } from '../src/axiom-os/seed-transfer';
import { SEED_KERNEL } from '../src/axiom-os/seed-kernel';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function assertEq<T>(a: T, b: T, m?: string) {
  if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`);
}

console.log('\n=== SeedTransferProtocol Tests ===\n');

const stp = new SeedTransferProtocol('test-source');

// ── エクスポート ──
test('エクスポート: SeedPackageが生成される', () => {
  const pkg = stp.export({ description: 'test' });
  assertEq(pkg.protocol, 'STP-1', 'protocol');
  assert(pkg.checksum.length === 64, `checksum length=${pkg.checksum.length}`);
  assert(pkg.compressed.length > 0, 'compressed should not be empty');
  assertEq(pkg.metadata.source, 'test-source', 'source');
  assertEq(pkg.metadata.theoryCount, SEED_KERNEL.length, 'theoryCount');
});

test('エクスポート: バージョン指定', () => {
  const pkg = stp.export({ version: '2.0.0' });
  assertEq(pkg.version, '2.0.0', 'version');
});

test('エクスポート: タグ指定', () => {
  const pkg = stp.export({ tags: ['dfumt', 'test'] });
  assert(pkg.metadata.tags?.includes('dfumt'), 'tags');
});

// ── チェックサム ──
test('チェックサム: 同じデータは同じchecksum', () => {
  const pkg1 = stp.export();
  const pkg2 = stp.export();
  assertEq(pkg1.checksum, pkg2.checksum, 'Same data should have same checksum');
});

// ── シリアライズ/デシリアライズ ──
test('serialize/deserialize ラウンドトリップ', () => {
  const pkg = stp.export();
  const json = stp.serialize(pkg);
  const restored = stp.deserialize(json);
  assertEq(restored.checksum, pkg.checksum, 'checksum should match');
  assertEq(restored.protocol, 'STP-1', 'protocol');
});

// ── インポート ──
test('インポート: 全理論を正常にインポート', () => {
  const pkg = stp.export();
  const result = stp.import(pkg);
  assert(result.success, `import failed: ${result.error}`);
  assertEq(result.theoryCount, SEED_KERNEL.length, 'theoryCount');
  assertEq(result.checksum, pkg.checksum, 'checksum');
});

test('インポート: 新理論はnewTheoriesに入る', () => {
  const newTheory = {
    id: 'dfumt-transfer-test',
    axiom: 'transfer test axiom',
    category: 'general' as const,
    keywords: ['test'],
  };
  const pkg = stp.export({ theories: [...SEED_KERNEL, newTheory] });
  const result = stp.import(pkg);
  assert(result.success, 'Should succeed');
  assert(result.newTheories.some(t => t.id === 'dfumt-transfer-test'), 'new theory detected');
});

test('インポート: チェックサム改ざん検出', () => {
  const pkg = stp.export();
  const tampered = { ...pkg, checksum: 'invalid-checksum' };
  const result = stp.import(tampered);
  assert(!result.success, 'Should fail on tampered checksum');
  assert(result.error?.includes('Checksum'), `error=${result.error}`);
});

test('インポート: 不明プロトコルを拒否', () => {
  const pkg = stp.export();
  const invalid = { ...pkg, protocol: 'STP-99' as any };
  const result = stp.import(invalid);
  assert(!result.success, 'Should reject unknown protocol');
});

// ── 差分転送 ──
test('差分エクスポート: deltaInfoが含まれる', () => {
  const base = stp.export();
  const added = { id: 'dfumt-delta-test', axiom: 'delta', category: 'general' as const, keywords: [] };
  const delta = stp.exportDelta(base, [...SEED_KERNEL, added]);
  assert(delta.delta !== undefined, 'delta info should exist');
  assert(delta.delta!.addedIds.includes('dfumt-delta-test'), 'added id in delta');
});

test('差分エクスポート: 変更なしは空のdelta', () => {
  const base = stp.export();
  const delta = stp.exportDelta(base, SEED_KERNEL);
  assertEq(delta.delta!.addedIds.length, 0, 'no added');
  assertEq(delta.delta!.removedIds.length, 0, 'no removed');
});

// ── inspect ──
test('inspect: パッケージ概要が返る', () => {
  const pkg = stp.export({ version: '1.2.3' });
  const info = stp.inspect(pkg);
  assertEq(info.version, '1.2.3', 'version');
  assertEq(info.theories, SEED_KERNEL.length, 'theories');
  assert(info.size > 0, 'size > 0');
  assert(info.checksumShort.length === 12, 'checksum short');
  assert(!info.isDelta, 'not a delta');
});

test('inspect: delta判定', () => {
  const base = stp.export();
  const delta = stp.exportDelta(base, SEED_KERNEL);
  const info = stp.inspect(delta);
  assert(info.isDelta, 'should be delta');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
