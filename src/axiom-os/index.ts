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

// 七価論理
export {
  SEVEN_VALUES, SYMBOL_MAP, SYMBOL_REVERSE,
  not, and, or, collapse, lift,
  toSymbol, fromSymbol,
  isFourValued, isExtended, isDefinite,
  checkDeMorgan, checkIdempotent,
} from './seven-logic';
export type { SevenLogicValue, FourLogicValue, ExtendedLogicValue } from './seven-logic';

// Seed Kernel（種から再生成）
export { SEED_KERNEL } from './seed-kernel';
export type { SeedTheory } from './seed-kernel';
export { TheoryGenerator } from './theory-generator';

// Axiom Encoder & Compressed Kernel（さらなる圧縮層）
export { AxiomEncoder } from './axiom-encoder';
export type { EncodedSeed } from './axiom-encoder';
export { COMPRESSED_KERNEL, CompressedKernel } from './compressed-kernel';
