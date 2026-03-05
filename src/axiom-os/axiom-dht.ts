import { createHash } from 'crypto';
import { type SeedTheory } from './seed-kernel';

// ノードID（160ビット = SHA-1相当）
export type NodeId = string; // hex文字列

// DHT上のバケット（Kademlia的）
export interface KBucket {
  nodeId: NodeId;
  axioms: Map<string, SeedTheory>; // axiomId → SeedTheory
  lastSeen: number;
}

export class AxiomDHT {
  private buckets: Map<string, KBucket> = new Map();
  private localNodeId: NodeId;

  constructor(nodeId?: string) {
    this.localNodeId = nodeId ?? this.generateNodeId();
  }

  // 公理をDHTに登録
  put(axiom: SeedTheory): string {
    const cid = this.computeCID(axiom);
    // 最も近いバケットを探して登録
    const bucket = this.findOrCreateBucket(cid);
    bucket.axioms.set(cid, axiom);
    return cid;
  }

  // CIDで公理を検索
  get(cid: string): SeedTheory | undefined {
    for (const bucket of this.buckets.values()) {
      if (bucket.axioms.has(cid)) {
        return bucket.axioms.get(cid);
      }
    }
    return undefined;
  }

  // 七価論理的距離で近傍公理を検索
  findNearest(axiom: SeedTheory, k: number = 5): SeedTheory[] {
    const allAxioms: Array<{ axiom: SeedTheory; distance: number }> = [];
    for (const bucket of this.buckets.values()) {
      for (const a of bucket.axioms.values()) {
        allAxioms.push({
          axiom: a,
          distance: this.sevenLogicDistance(axiom, a)
        });
      }
    }
    return allAxioms
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k)
      .map(x => x.axiom);
  }

  // IPFS式CID生成（SHA-256ベース）
  computeCID(axiom: SeedTheory): string {
    const content = JSON.stringify({
      axiom: axiom.axiom,
      keywords: axiom.keywords.sort(),
      category: axiom.category,
    });
    return 'Qm' + createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 44); // CIDv0風
  }

  // 七価論理距離（カテゴリ・タグの差異を数値化）
  sevenLogicDistance(a: SeedTheory, b: SeedTheory): number {
    let distance = 0;
    // カテゴリが違えば距離+2
    if (a.category !== b.category) distance += 2;
    // 七価論理タグが違えば距離+1
    if ((a as any).sevenLogicTag !== (b as any).sevenLogicTag) distance += 1;
    // 共通キーワードが多いほど距離-1
    const commonKeywords = a.keywords.filter(k => b.keywords.includes(k));
    distance -= commonKeywords.length * 0.5;
    return Math.max(0, distance);
  }

  private generateNodeId(): NodeId {
    return createHash('sha256')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex')
      .substring(0, 40);
  }

  private findOrCreateBucket(cid: string): KBucket {
    const bucketKey = cid.substring(0, 4); // 先頭4文字でバケット分類
    if (!this.buckets.has(bucketKey)) {
      this.buckets.set(bucketKey, {
        nodeId: bucketKey,
        axioms: new Map(),
        lastSeen: Date.now(),
      });
    }
    return this.buckets.get(bucketKey)!;
  }

  // 統計情報
  stats(): { totalAxioms: number; bucketCount: number; nodeId: NodeId } {
    let total = 0;
    for (const b of this.buckets.values()) total += b.axioms.size;
    return {
      totalAxioms: total,
      bucketCount: this.buckets.size,
      nodeId: this.localNodeId,
    };
  }
}
