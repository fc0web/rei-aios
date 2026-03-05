import { createHash, randomBytes } from 'crypto';
import { type SeedTheory } from './seed-kernel';

export interface AnonymousAxiom {
  cid: string;
  encryptedSource: string;  // 抽出者情報を隠す
  relayCount: number;       // 中継回数
  cachedAt: number;         // キャッシュ時刻
  accessCount: number;      // アクセス頻度
  axiom: SeedTheory;
}

export class AxiomAnonymousCache {
  private cache = new Map<string, AnonymousAxiom>();
  private readonly MAX_CACHE = 1000;
  private readonly RELAY_THRESHOLD = 3; // 3回中継で匿名性確立

  // 公理を匿名化してキャッシュ
  anonymize(axiom: SeedTheory, cid: string): AnonymousAxiom {
    const anonId = randomBytes(16).toString('hex');
    return {
      cid,
      encryptedSource: createHash('sha256')
        .update(anonId + cid)
        .digest('hex'),
      relayCount: 0,
      cachedAt: Date.now(),
      accessCount: 0,
      axiom,
    };
  }

  // キャッシュに追加
  store(anon: AnonymousAxiom): void {
    if (this.cache.size >= this.MAX_CACHE) {
      this.evictLeastAccessed();
    }
    this.cache.set(anon.cid, { ...anon, relayCount: anon.relayCount + 1 });
  }

  // アクセス頻度の高い公理を取得（拡散候補）
  getPopular(k: number = 10): AnonymousAxiom[] {
    return [...this.cache.values()]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, k);
  }

  // CIDで取得（アクセス数増加）
  get(cid: string): AnonymousAxiom | undefined {
    const item = this.cache.get(cid);
    if (item) {
      item.accessCount++;
    }
    return item;
  }

  // 匿名性確立済みか（中継回数がしきい値以上）
  isAnonymous(cid: string): boolean {
    const item = this.cache.get(cid);
    return (item?.relayCount ?? 0) >= this.RELAY_THRESHOLD;
  }

  // LRU的な削除
  private evictLeastAccessed(): void {
    let minAccess = Infinity;
    let minCid = '';
    for (const [cid, item] of this.cache) {
      if (item.accessCount < minAccess) {
        minAccess = item.accessCount;
        minCid = cid;
      }
    }
    if (minCid) this.cache.delete(minCid);
  }

  stats() {
    return {
      cacheSize: this.cache.size,
      anonymousCount: [...this.cache.values()]
        .filter(a => a.relayCount >= this.RELAY_THRESHOLD).length,
      totalAccess: [...this.cache.values()]
        .reduce((s, a) => s + a.accessCount, 0),
    };
  }
}
