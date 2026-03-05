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

// Code Axiom Extractor
export { CodeAxiomExtractor } from './code-axiom-extractor';
export type { CodePattern, ExtractionResult } from './code-axiom-extractor';

// Distributed Axiom Pipeline
export { DistributedAxiomPipeline } from './distributed-axiom-pipeline';
export type { AxiomNode, PipelineResult } from './distributed-axiom-pipeline';

// Axiom Distribution Hub
export { AxiomDistributionHub } from './axiom-distribution-hub';
export type { HubStatus } from './axiom-distribution-hub';

// Rei-PL Self Axiomizer
export { ReiPLSelfAxiomizer } from './rei-pl-self-axiomizer';
export type { SelfAxiomResult } from './rei-pl-self-axiomizer';

// Blockchain (STEP 4)
export { AxiomHashChain } from './axiom-hash-chain';
export type { AxiomBlock, ChainValidationResult } from './axiom-hash-chain';

export { AxiomSmartContract } from './axiom-smart-contract';
export type { AxiomContract, ContractVerdict, ContractViolation } from './axiom-smart-contract';

export { AxiomTokenEconomy, TOKEN_PARAMS } from './axiom-token-economy';
export type { ReiTokenBalance, TokenTransaction, TokenReason } from './axiom-token-economy';

// Chunk Extraction & Delta Compression (STEP 5-A)
export { AxiomChunkExtractor } from './axiom-chunk-extractor';
export type { ChunkConfig, ChunkResult, ParallelExtractionResult } from './axiom-chunk-extractor';

export { AxiomDeltaCompressor } from './axiom-delta-compressor';
export type { DictEntry, DeltaEntry, DeltaCompressionResult } from './axiom-delta-compressor';

// LLMZip完全版 (STEP 5-B)
export { AxiomLLMZip } from './axiom-llm-zip';
export type { Prediction, LLMZipEntry, LLMZipResult } from './axiom-llm-zip';
