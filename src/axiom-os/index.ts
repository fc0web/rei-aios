/**
 * 公理OS — SQLite永続化層
 *
 * D-FUMT理論に基づく知識基盤のSQLite永続化。
 * better-sqlite3 の同期APIを使用。
 */

export type {
  PersonRow, PersonInsert, PersonUpdate,
  TheoryRow, TheoryInsert, TheoryUpdate,
  AxiomRow, AxiomInsert, AxiomUpdate,
  MemoryRow, MemoryInsert, MemoryUpdate,
} from './types';

export { openDatabase, DEFAULT_DB_PATH } from './db';
export { AxiomOSStore } from './crud';
export { SEED_PERSONS, SEED_THEORIES, SEED_AXIOMS } from './seed';
