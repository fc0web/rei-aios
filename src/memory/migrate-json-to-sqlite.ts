/**
 * AIOSMemory JSON → SQLite マイグレーション
 * 使用方法: npx tsx src/memory/migrate-json-to-sqlite.ts
 */
import * as fs from 'fs';
import { AIOSMemory } from './aios-memory';

const JSON_PATH   = './dist/aios-memory.json';
const SQLITE_PATH = './dist/aios-memory.db';

if (!fs.existsSync(JSON_PATH)) {
  console.log('JSONファイルなし。マイグレーション不要。');
  process.exit(0);
}

const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) as [string, any][];
const mem = new AIOSMemory(SQLITE_PATH);
let count = 0;

for (const [, entry] of raw) {
  mem.remember(entry.agentId, entry.kind, entry.content, {
    confidence: entry.confidence,
    tags:       entry.tags,
    relatedIds: entry.relatedIds,
  });
  count++;
}

console.log(`マイグレーション完了: ${count}件 → ${SQLITE_PATH}`);
mem.close();
