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

// ContradictionDetector
export { ContradictionDetector } from './contradiction-detector';
export type { ContradictionEntry, ContradictionKind, ResolutionStrategy, ResolutionResult } from './contradiction-detector';

// Theory Evolution
export { TheoryEvolution } from './theory-evolution';
export type { EvolvedTheory, TheorySource, TheoryUsageLog } from './theory-evolution';

// Seed Transfer Protocol
export { SeedTransferProtocol } from './seed-transfer';
export type { SeedPackage, PackageMetadata, ImportResult, ConflictEntry, DeltaInfo } from './seed-transfer';

// Explainability Engine
export { ExplainabilityEngine } from './explainability-engine';
export type { ReasoningStep, AxiomChain, ExplanationReport } from './explainability-engine';

// Temporal Reasoning Engine
export { TemporalReasoningEngine } from './temporal-reasoning';
export type { TemporalSnapshot, TemporalPrediction, TemporalTrack, TimeAxis } from './temporal-reasoning';

// Axiom ACL
export { AxiomACL } from './axiom-acl';
export type { AclRule, AclDecision, AuditEntry } from './axiom-acl';

// Formula Axiomizer
export { FormulaAxiomizer } from './formula-axiomizer';
export type { AxiomizerResult, AxiomMatch } from './formula-axiomizer';

// Local Axiom LLM
export { LocalAxiomLLM } from './local-axiom-llm';
export type { AxiomLLMResponse, LocalLLMConfig } from './local-axiom-llm';

// Consensus Engine
export { ConsensusEngine } from './consensus-engine';
export type { InstanceVote, ConsensusRound, ConsensusResult } from './consensus-engine';

// Cognitive Load Meter
export { CognitiveLoadMeter } from './cognitive-load-meter';
export type { LoadSnapshot, LoadAlert, LoadSession } from './cognitive-load-meter';
