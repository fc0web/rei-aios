import { AxiomHashChain } from '../src/axiom-os/axiom-hash-chain';
import { AxiomSmartContract } from '../src/axiom-os/axiom-smart-contract';
import { AxiomTokenEconomy, TOKEN_PARAMS } from '../src/axiom-os/axiom-token-economy';
import { SEED_KERNEL, type SeedTheory } from '../src/axiom-os/seed-kernel';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

console.log('=== STEP 4: ブロックチェーン技術テスト ===\n');

const axiomA: SeedTheory = { id: 'test-a', axiom: 'π×π⁻¹=1 キャンセル意味論', category: 'zero_extension', keywords: ['ゼロπ', 'pi'] };
const axiomB: SeedTheory = { id: 'test-b', axiom: '真偽両方neither 四値論理', category: 'logic', keywords: ['四価論理', '龍樹', 'belnap'] };
const axiomC: SeedTheory = { id: 'test-c', axiom: 'Ω(Ω(x))→Ω(x) 安定性', category: 'computation', keywords: ['冪等性', 'omega'] };
const axiomEmpty: SeedTheory = { id: 'bad-empty', axiom: '   ', category: 'logic', keywords: ['test'] };
const axiomNoKw: SeedTheory = { id: 'bad-nokw', axiom: '何かの公理', category: 'logic', keywords: [] };
const axiomBadCat: SeedTheory = { id: 'bad-cat', axiom: '何かの公理', category: 'unknown_category', keywords: ['test'] };

// ─── 4-A: AxiomHashChain ───
console.log('── 4-A: AxiomHashChain ──');
{
  const chain = new AxiomHashChain();

  assert(chain.length() === 0, '1. 初期チェーン長は0');
  assert(chain.validate().valid === true, '2. 空チェーンは有効');

  const block0 = chain.append(axiomA, 'node-001');
  assert(block0.index === 0, '3. 最初のブロックindex=0');
  assert(block0.axiomId === 'test-a', '4. axiomIdが正しく記録');
  assert(block0.registeredBy === 'node-001', '5. registeredByが記録');
  assert(block0.previousHash === '0'.repeat(64), '6. genesis previousHash');
  assert(typeof block0.blockHash === 'string' && block0.blockHash.length === 64, '7. blockHashは64文字hex');

  const block1 = chain.append(axiomB, 'node-002');
  assert(block1.index === 1, '8. 2番目のブロックindex=1');
  assert(block1.previousHash === block0.blockHash, '9. previousHashが前ブロックのblockHash');

  const result = chain.validate();
  assert(result.valid === true, '10. 正常チェーンの検証がPASS');
  assert(result.totalBlocks === 2, '11. totalBlocks=2');

  // 改ざん検知
  const chain2 = new AxiomHashChain();
  chain2.append(axiomA);
  chain2.append(axiomB);
  (chain2 as any).chain[0].axiomHash = 'tampered_hash_value_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  const tampered = chain2.validate();
  assert(tampered.valid === false, '12. 改ざん検知: validateがfalse');
  assert(tampered.brokenAt === 0, '13. 改ざん位置がindex=0');

  const found = chain.findByAxiomId('test-a');
  assert(found !== undefined, '14. findByAxiomId: 存在する公理が見つかる');
  assert(found!.axiomId === 'test-a', '15. findByAxiomId: 正しいブロックが返る');
  assert(chain.findByAxiomId('not-exist') === undefined, '16. 存在しない公理はundefined');

  assert(chain.verifyAxiom(axiomA) === true, '17. verifyAxiom: 正しい公理はtrue');
  const tampered2: SeedTheory = { ...axiomA, axiom: '改ざんされた公理' };
  assert(chain.verifyAxiom(tampered2) === false, '18. verifyAxiom: 改ざん公理はfalse');

  const chain3 = new AxiomHashChain();
  const blocks = chain3.appendAll([axiomA, axiomB, axiomC]);
  assert(blocks.length === 3, '19. appendAll: 3ブロック追加');
  assert(chain3.validate().valid === true, '20. appendAll後のチェーンが有効');

  const chain4 = new AxiomHashChain();
  SEED_KERNEL.slice(0, 10).forEach(s => chain4.append(s));
  assert(chain4.length() === 10, '21. SEED_KERNEL 10件のチェーン長');
  assert(chain4.validate().valid === true, '22. SEED_KERNEL チェーンが有効');

  const hash1 = chain.computeAxiomHash(axiomA);
  const hash2 = chain.computeAxiomHash({ ...axiomA, id: 'different-id' });
  assert(hash1 === hash2, '23. 内容が同じならaxiomHashが一致（IDは無視）');

  const latest = chain.getLatestBlock();
  assert(latest?.index === 1, '24. getLatestBlock: 最後のブロックが返る');
}

// ─── 4-B: AxiomSmartContract ───
console.log('\n── 4-B: AxiomSmartContract ──');
{
  const sc = new AxiomSmartContract();

  const preOk = sc.checkPre(axiomA);
  assert(preOk.status === 'PASS', '25. 正常公理のpre checkがPASS');

  const postOk = sc.checkPost(axiomA, 'a'.repeat(64));
  assert(postOk.status === 'PASS', '26. 正常公理のpost checkがPASS');

  const invOk = sc.checkInvariant([axiomA, axiomB, axiomC]);
  assert(invOk.status === 'PASS', '27. 正常公理リストのinvariantがPASS');

  const preEmpty = sc.checkPre(axiomEmpty);
  assert(preEmpty.status === 'FAIL', '28. 空axiomのpre checkがFAIL');
  assert((preEmpty as any).violated.includes('non-empty-axiom'), '29. non-empty-axiom違反が検出');

  const preNoKw = sc.checkPre(axiomNoKw);
  assert(preNoKw.status === 'FAIL', '30. キーワードなしのpre checkがFAIL');
  assert((preNoKw as any).violated.includes('has-keywords'), '31. has-keywords違反が検出');

  const preBadCat = sc.checkPre(axiomBadCat);
  assert(preBadCat.status === 'FAIL', '32. 不正カテゴリのpre checkがFAIL');

  const dupAxioms: SeedTheory[] = [axiomA, { ...axiomB, id: 'test-a' }];
  const invDup = sc.checkInvariant(dupAxioms);
  assert(invDup.status === 'FAIL', '33. 重複IDのinvariantがFAIL');
  assert((invDup as any).violated.includes('unique-id'), '34. unique-id違反が検出');

  const sevenResults = sc.evaluateSevenLogic(axiomA);
  assert(sevenResults.has('valid-category'), '35. valid-category契約に七価論理評価がある');
  assert(sevenResults.get('valid-category') === 'TRUE', '36. 既知カテゴリはTRUE');

  const sevenBadCat = sc.evaluateSevenLogic(axiomBadCat);
  assert(sevenBadCat.get('valid-category') === 'FLOWING', '37. 未知カテゴリはFLOWING');

  const sevenOneKw = sc.evaluateSevenLogic({ ...axiomA, keywords: ['one'] });
  assert(sevenOneKw.get('has-keywords') === 'FLOWING', '38. キーワード1つはFLOWING');

  const sevenMultiKw = sc.evaluateSevenLogic(axiomB);
  assert(sevenMultiKw.get('has-keywords') === 'TRUE', '39. キーワード3つ以上はTRUE');

  assert(sc.getViolationCount() > 0, '40. 違反ログが記録されている');

  sc.register({
    id: 'custom-prefix',
    description: '公理IDはdfumt-またはtest-で始まる',
    pre: (a) => a.id.startsWith('dfumt-') || a.id.startsWith('test-'),
    post: (_a, _h) => true,
    invariant: (_axioms) => true,
  });
  const preCustom = sc.checkPre(axiomA);
  assert(preCustom.status === 'PASS', '41. カスタム契約: test-プレフィクスはPASS');

  let allPass = true;
  for (const s of SEED_KERNEL.slice(0, 15)) {
    const r = sc.checkPre(s);
    if (r.status === 'FAIL') { allPass = false; break; }
  }
  assert(allPass, '42. SEED_KERNEL先頭15件が標準契約をPASS');
}

// ─── 4-C: AxiomTokenEconomy ───
console.log('\n── 4-C: AxiomTokenEconomy ──');
{
  const economy = new AxiomTokenEconomy();
  const chain = new AxiomHashChain();

  assert(economy.getBalance('node-001') === 0, '43. 未登録ノードの残高は0');

  const acc = economy.register('node-001');
  assert(acc.nodeId === 'node-001', '44. register: nodeIdが正しい');
  assert(acc.balance === 0, '45. 初期残高は0');

  const block = chain.append(axiomA, 'node-001');
  const tx1 = economy.rewardContribution('node-001', axiomA, block);
  assert(tx1.reason === 'MINT_AXIOM_CONTRIBUTION', '46. 貢献報酬のreasonが正しい');
  assert(economy.getBalance('node-001') === TOKEN_PARAMS.BASE_CONTRIBUTION, '47. 基本報酬がbalanceに加算');

  const block2 = chain.append(axiomB, 'node-001');
  const tx2 = economy.rewardContribution('node-001', axiomB, block2);
  const expectedBonus = TOKEN_PARAMS.BASE_CONTRIBUTION * TOKEN_PARAMS.HIGH_CONFIDENCE_MULTIPLIER;
  assert(tx2.amount === expectedBonus, '48. キーワード3以上はボーナス倍率が適用');

  const tx3 = economy.rewardValidation('node-002');
  assert(tx3.amount === TOKEN_PARAMS.VALIDATION_REWARD, '49. 検証報酬の金額が正しい');
  assert(economy.getBalance('node-002') === TOKEN_PARAMS.VALIDATION_REWARD, '50. 検証報酬がbalanceに加算');

  const tx4 = economy.rewardCommonAxiom('node-001', 'common-axiom-001');
  assert(tx4.amount === TOKEN_PARAMS.COMMON_AXIOM_BONUS, '51. 共通公理ボーナスの金額が正しい');
  assert(tx4.reason === 'MINT_COMMON_AXIOM_BONUS', '52. 共通公理ボーナスのreasonが正しい');

  const balanceBefore = economy.getBalance('node-001');
  const txPenalty = economy.penalize('node-001', 'bad-axiom-id');
  assert(txPenalty.reason === 'BURN_CONTRACT_VIOLATION', '53. ペナルティのreasonが正しい');
  assert(economy.getBalance('node-001') < balanceBefore, '54. ペナルティでbalanceが減少');

  economy.register('poor-node');
  economy.penalize('poor-node');
  assert(economy.getBalance('poor-node') >= 0, '55. 残高はマイナスにならない');

  const txs = economy.getTransactions();
  assert(txs.length >= 5, '56. 取引履歴が記録されている');

  const lb = economy.getLeaderboard(3);
  assert(lb.length <= 3, '57. リーダーボード上位3件');
  assert(lb[0].totalEarned >= (lb[1]?.totalEarned ?? 0), '58. リーダーボードが降順');

  assert(economy.getTotalMinted() > 0, '59. 総発行量が0より大きい');

  const acc2 = economy.getAccount('node-001');
  assert(acc2!.contributions === 2, '60. 公理2件の貢献数が正しい');
}

// ─── 統合テスト: Chain + Contract + Token ───
console.log('\n── 統合テスト: Chain + Contract + Token ──');
{
  const chain = new AxiomHashChain();
  const sc = new AxiomSmartContract();
  const economy = new AxiomTokenEconomy();
  const NODE = 'integration-node';

  let totalRegistered = 0;
  for (const axiom of SEED_KERNEL.slice(0, 5)) {
    const preResult = sc.checkPre(axiom);
    if (preResult.status !== 'PASS') continue;
    const block = chain.append(axiom, NODE);
    const postResult = sc.checkPost(axiom, block.blockHash);
    if (postResult.status !== 'PASS') continue;
    economy.rewardContribution(NODE, axiom, block);
    totalRegistered++;
  }

  assert(totalRegistered === 5, '61. 正常公理5件が全て登録');
  assert(chain.validate().valid === true, '62. 統合後チェーンが有効');
  assert(economy.getBalance(NODE) > 0, '63. 正常フローでトークンが付与');

  const preResult = sc.checkPre(axiomEmpty);
  const chainLengthBefore = chain.length();
  if (preResult.status === 'FAIL') {
    economy.penalize(NODE, axiomEmpty.id);
  }
  assert(chain.length() === chainLengthBefore, '64. 不正公理はチェーンに追加されない');

  const allAxioms = chain.getChain()
    .map(b => SEED_KERNEL.find(s => s.id === b.axiomId)!)
    .filter(Boolean);
  const invResult = sc.checkInvariant(allAxioms);
  assert(invResult.status === 'PASS', '65. 統合後の不変条件がPASS');
}

console.log(`\n結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
