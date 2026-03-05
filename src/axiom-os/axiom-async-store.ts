import { type SeedTheory } from './seed-kernel';

export interface PendingAxiom {
  id: string;
  axiom: SeedTheory;
  cid: string;
  submittedAt: number;
  synced: boolean;
  retryCount: number;
}

export class AxiomAsyncStore {
  private pending = new Map<string, PendingAxiom>();
  private synced = new Map<string, PendingAxiom>();
  private readonly MAX_RETRY = 5;

  // オフラインで公理を投稿（すぐには同期しない）
  submit(axiom: SeedTheory, cid: string): PendingAxiom {
    const entry: PendingAxiom = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      axiom,
      cid,
      submittedAt: Date.now(),
      synced: false,
      retryCount: 0,
    };
    this.pending.set(entry.id, entry);
    return entry;
  }

  // 同期実行（オンライン時に呼ぶ）
  sync(handler: (axiom: SeedTheory) => Promise<boolean>): Promise<number> {
    let syncedCount = 0;
    const promises = [...this.pending.values()].map(async (entry) => {
      if (entry.retryCount >= this.MAX_RETRY) return;
      try {
        const ok = await handler(entry.axiom);
        if (ok) {
          entry.synced = true;
          this.synced.set(entry.id, entry);
          this.pending.delete(entry.id);
          syncedCount++;
        } else {
          entry.retryCount++;
        }
      } catch {
        entry.retryCount++;
      }
    });
    return Promise.all(promises).then(() => syncedCount);
  }

  getPending(): PendingAxiom[] {
    return [...this.pending.values()];
  }

  getSynced(): PendingAxiom[] {
    return [...this.synced.values()];
  }

  stats() {
    return {
      pendingCount: this.pending.size,
      syncedCount: this.synced.size,
      failedCount: [...this.pending.values()]
        .filter(e => e.retryCount >= this.MAX_RETRY).length,
    };
  }
}
