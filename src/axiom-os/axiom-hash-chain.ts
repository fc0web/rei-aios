import { createHash } from 'crypto';
import type { SeedTheory } from './seed-kernel';

export interface AxiomBlock {
  index: number;
  axiomId: string;
  axiomHash: string;      // SHA-256(公理の正規化JSON)
  previousHash: string;   // 前ブロックのblockHash
  blockHash: string;      // SHA-256(index+axiomHash+previousHash+timestamp)
  timestamp: number;
  registeredBy: string;   // ノードID または 'local'
}

export interface ChainValidationResult {
  valid: boolean;
  totalBlocks: number;
  brokenAt?: number;      // 改ざん検知したindex
  reason?: string;
}

export class AxiomHashChain {
  private chain: AxiomBlock[] = [];
  private readonly GENESIS_HASH =
    '0000000000000000000000000000000000000000000000000000000000000000';

  private sha256(data: string): string {
    return createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /** 公理の内容からaxiomHashを生成（IDや日時を除外し内容のみでハッシュ） */
  computeAxiomHash(axiom: SeedTheory): string {
    const core = JSON.stringify({
      axiom: axiom.axiom.trim(),
      category: axiom.category,
      keywords: [...axiom.keywords].sort(),
    });
    return this.sha256(core);
  }

  /** 新しい公理をチェーンに追加 */
  append(axiom: SeedTheory, registeredBy: string = 'local'): AxiomBlock {
    const index = this.chain.length;
    const previousHash =
      index === 0 ? this.GENESIS_HASH : this.chain[index - 1].blockHash;
    const axiomHash = this.computeAxiomHash(axiom);
    const timestamp = Date.now();
    const blockHash = this.sha256(
      `${index}${axiomHash}${previousHash}${timestamp}`
    );
    const block: AxiomBlock = {
      index, axiomId: axiom.id, axiomHash,
      previousHash, blockHash, timestamp, registeredBy,
    };
    this.chain.push(block);
    return block;
  }

  /** 複数公理を一括追加 */
  appendAll(axioms: SeedTheory[], registeredBy: string = 'local'): AxiomBlock[] {
    return axioms.map(a => this.append(a, registeredBy));
  }

  /** チェーン全体の整合性を検証 */
  validate(): ChainValidationResult {
    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];
      const expectedPrev =
        i === 0 ? this.GENESIS_HASH : this.chain[i - 1].blockHash;
      if (block.previousHash !== expectedPrev) {
        return { valid: false, totalBlocks: this.chain.length,
          brokenAt: i, reason: `index ${i}: previousHashが一致しない` };
      }
      const recomputed = this.sha256(
        `${block.index}${block.axiomHash}${block.previousHash}${block.timestamp}`
      );
      if (recomputed !== block.blockHash) {
        return { valid: false, totalBlocks: this.chain.length,
          brokenAt: i, reason: `index ${i}: blockHashが改ざんされている` };
      }
    }
    return { valid: true, totalBlocks: this.chain.length };
  }

  /** 公理IDからブロックを検索 */
  findByAxiomId(axiomId: string): AxiomBlock | undefined {
    return this.chain.find(b => b.axiomId === axiomId);
  }

  /** 公理が改ざんされていないかを個別検証 */
  verifyAxiom(axiom: SeedTheory): boolean {
    const block = this.findByAxiomId(axiom.id);
    if (!block) return false;
    return block.axiomHash === this.computeAxiomHash(axiom);
  }

  getChain(): AxiomBlock[] { return [...this.chain]; }
  getLatestBlock(): AxiomBlock | undefined { return this.chain[this.chain.length - 1]; }
  length(): number { return this.chain.length; }
}
