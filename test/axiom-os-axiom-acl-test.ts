import { AxiomACL } from '../src/axiom-os/axiom-acl';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function assertEq<T>(a: T, b: T, m?: string) {
  if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`); }

console.log('\n=== AxiomACL Tests ===\n');

const acl = new AxiomACL();

// ── ルール追加 ──
test('addRule: ルールが追加される', () => {
  const rule = acl.addRule({
    axiomId: 'dfumt-catuskoti',
    subject: 'user-alice',
    resource: 'kernel',
    action: 'read',
    permission: 'TRUE',
    priority: 10,
    irreversible: false,
  });
  assert(rule.id.startsWith('acl-'), `id=${rule.id}`);
  assertEq(rule.permission, 'TRUE', 'permission');
});

// ── 許可評価 ──
test('evaluate: マッチするルールがあれば評価される', () => {
  const d = acl.evaluate('user-alice', 'kernel', 'read');
  assertEq(d.decision, 'TRUE', 'should be TRUE');
  assert(d.appliedRules.length > 0, 'should have rules');
  assert(d.reasoning.length > 0, 'should have reasoning');
});

test('evaluate: ルールなしはNEITHER', () => {
  const d = acl.evaluate('user-unknown', 'secret', 'write');
  assertEq(d.decision, 'NEITHER', 'no rule → NEITHER');
});

test('isGranted: TRUE → 許可', () => {
  assert(acl.isGranted('user-alice', 'kernel', 'read'), 'TRUE should be granted');
});

test('isGranted: NEITHER → 拒否', () => {
  assert(!acl.isGranted('user-nobody', 'top-secret', 'delete'), 'NEITHER should be denied');
});

// ── 拒否ルール ──
test('evaluate: FALSE ルールは拒否', () => {
  acl.addRule({
    axiomId: 'dfumt-zero-state',
    subject: 'user-bob',
    resource: 'kernel',
    action: 'delete',
    permission: 'FALSE',
    priority: 5,
    irreversible: false,
  });
  const d = acl.evaluate('user-bob', 'kernel', 'delete');
  assertEq(d.decision, 'FALSE', 'should be FALSE');
  assert(!acl.isGranted('user-bob', 'kernel', 'delete'), 'denied');
});

// ── ワイルドカード ──
test('ワイルドカード subject=* が全ユーザーにマッチ', () => {
  acl.addRule({
    axiomId: 'dfumt-catuskoti',
    subject: '*',
    resource: 'public',
    action: 'read',
    permission: 'TRUE',
    priority: 1,
    irreversible: false,
  });
  assert(acl.isGranted('anyone', 'public', 'read'), 'wildcard should match');
  assert(acl.isGranted('user-alice', 'public', 'read'), 'wildcard matches alice');
});

// ── 不可逆ルール ──
test('addIrreversibleRule: 不可逆ルールは常に拒否', () => {
  acl.addIrreversibleRule('*', 'seed-kernel', 'delete');
  const d = acl.evaluate('root', 'seed-kernel', 'delete');
  assertEq(d.decision, 'FALSE', 'irreversible → FALSE');
  assert(!acl.isGranted('root', 'seed-kernel', 'delete'), 'even root denied');
});

test('removeRule: 不可逆ルールは削除不可', () => {
  const rule = acl.addIrreversibleRule('*', 'protected', 'reset');
  const result = acl.removeRule(rule.id);
  assert(!result, 'irreversible rule should not be removable');
  assert(acl.getRule(rule.id) !== undefined, 'rule should still exist');
});

test('removeRule: 通常ルールは削除可能', () => {
  const rule = acl.addRule({
    axiomId: 'dfumt-catuskoti',
    subject: 'temp-user',
    resource: 'temp',
    action: 'read',
    permission: 'TRUE',
    priority: 1,
    irreversible: false,
  });
  const result = acl.removeRule(rule.id);
  assert(result, 'should be removable');
  assert(acl.getRule(rule.id) === undefined, 'rule should be gone');
});

// ── 公理違反チェック ──
test('checkAxiomViolation: 不可逆公理へのdelete違反を検出', () => {
  const r = acl.checkAxiomViolation('delete', 'dfumt-idempotency');
  assert(r.violated, 'should detect violation');
  assertEq(r.decision, 'FALSE', 'violation → FALSE');
});

test('checkAxiomViolation: 通常操作は違反しない', () => {
  const r = acl.checkAxiomViolation('read', 'dfumt-catuskoti');
  assert(!r.violated, 'read should not violate');
});

// ── 監査ログ ──
test('監査ログが記録される', () => {
  const before = acl.getAuditLog().length;
  acl.evaluate('user-alice', 'kernel', 'read');
  const after = acl.getAuditLog().length;
  assert(after > before, 'audit log should grow');
});

test('監査ログにauditIdが含まれる', () => {
  const d = acl.evaluate('user-alice', 'public', 'read');
  assert(d.auditId.startsWith('audit-'), `auditId=${d.auditId}`);
  const log = acl.getAuditLog();
  assert(log.some(e => e.id === d.auditId), 'audit entry should exist');
});

// ── summarize ──
test('summarize: 構造が正しい', () => {
  const s = acl.summarize();
  assert(s.totalRules > 0, 'has rules');
  assert(s.irreversibleRules > 0, 'has irreversible');
  assert(s.auditEntries > 0, 'has audit');
  assert(s.grantRate >= 0 && s.grantRate <= 1, 'grantRate in range');
});

// ── 有効期限 ──
test('期限切れルールは適用されない', () => {
  acl.addRule({
    axiomId: 'dfumt-catuskoti',
    subject: 'expired-user',
    resource: 'temp-resource',
    action: 'read',
    permission: 'TRUE',
    priority: 10,
    irreversible: false,
    expiresAt: Date.now() - 1000, // 過去
  });
  const d = acl.evaluate('expired-user', 'temp-resource', 'read');
  assertEq(d.decision, 'NEITHER', 'expired rule should not apply');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
