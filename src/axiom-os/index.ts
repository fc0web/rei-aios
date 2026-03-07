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

// RCT — Rei圧縮理論 Theory #67 (STEP 6-A)
export { AxiomRCT } from './axiom-rct';
export type { EndoEdge, SpanTreeNode, RCTEntry, RCTResult } from './axiom-rct';

// 圧縮スイート (STEP 6-B/C/D)
export { AxiomCompressionSelector } from './axiom-compression-selector';
export type { DataProfile, SelectionResult, BenchmarkResult, CompressionMethod } from './axiom-compression-selector';

export { AxiomLLMZipEnhanced } from './axiom-llm-zip-enhanced';
export type { EnhancedLLMZipResult } from './axiom-llm-zip-enhanced';

export { AxiomStreamCompressor } from './axiom-stream-compressor';
export type { StreamConfig, StreamChunk, StreamStats } from './axiom-stream-compressor';

// Axiom Discovery System (STEP 13)
export { AxiomProposalQueue } from './axiom-proposal-queue';
export type {
  AxiomProposal,
  ProposalStatus,
  DiscoverySource,
  QueueStats,
} from './axiom-proposal-queue';

export { AxiomDiscoveryAgent, DEFAULT_CONFIG } from './axiom-discovery-agent';
export type {
  DiscoveryConfig,
  DiscoveryReport,
} from './axiom-discovery-agent';

// D-FUMT Consistency Checker (STEP 14)
export { DFUMTConsistencyChecker } from './dfumt-consistency-checker';
export type { ConsistencyReport, TheoryPairCheck } from './dfumt-consistency-checker';

// Maya × Aztec 情報科学実装 (STEP 15)
export { ReiHuffmanCoder } from './rei-huffman-coder';
export type { CodeEntry, HybridEncodeResult } from './rei-huffman-coder';

export { ReiEntropyZero } from './rei-entropy-zero';
export type { EntropyResult, DistributionAnalysis } from './rei-entropy-zero';

export { ReiSpaceGeometry } from './rei-space-geometry';
export type { Point, ConvexPolygon, SpacePartition, GeometryEvalResult } from './rei-space-geometry';

export { ReiDistributedBus } from './rei-distributed-bus';
export type { DistributedNode, ConsensusResult } from './rei-distributed-bus';

export { ReiCycleScheduler } from './rei-cycle-scheduler';
export type { CycleTask, CycleAlignment, TaskSyncStatus } from './rei-cycle-scheduler';

// ギリシャ神話実装 (STEP 16)
export { MoiraTerminator } from './moira-terminator';
export type {
  MoiraPhase, TerminationReason, ReasoningProcess, TheoryDisposal, TerminationJudgment,
} from './moira-terminator';

export { PrometheusProtocol } from './prometheus-protocol';
export type {
  DescentLevel, KnowledgePacket, DescentReport,
} from './prometheus-protocol';

export { NarcissusDetector } from './narcissus-detector';
export type {
  LoopKind, BlindSpotReport, LoopRecord, OscillationPattern,
} from './narcissus-detector';

export { AriadneTracer } from './ariadne-tracer';
export type {
  ThreadNode, BacktraceResult, LabyrinthStats,
} from './ariadne-tracer';

// 公理の逆 — 反公理・定理・無公理 (STEP 17)
export { AntiAxiomEngine } from './anti-axiom-engine';
export type {
  AntiAxiomKind, AntiAxiom, EmergentSystem, AntiAxiomResult,
} from './anti-axiom-engine';

export { TheoremDeriver } from './theorem-deriver';
export type {
  DeductionRule, Theorem, DerivationResult, TheoremSystem,
} from './theorem-deriver';

export { NoAxiomVoid } from './no-axiom-void';
export type {
  VoidSnapshot, EmergenceEvent, ReturnEvent, ZeroCycle,
} from './no-axiom-void';

// ReiTaskQueue (STEP 18)
export { ReiTaskQueue } from './rei-task-queue';
export type { ReiTask, TaskState, ScheduleStrategy, TaskQueueStats } from './rei-task-queue';

// NagarjunaProof (STEP 18)
export { NagarjunaProof } from './nagarjuna-proof';
export type { NagarjunaProofResult, ProofStep } from './nagarjuna-proof';

// DependentOrigination (STEP 19)
export { DependentOrigination } from './dependent-origination';
export type { OriginNode, OriginationResult, OriginationMap } from './dependent-origination';

// SelfGenerationEngine (STEP 20)
export { SelfGenerationEngine } from './self-generation-engine';
export type { GeneratedAxiomSystem, GeneratedAxiom, GenerationReport } from './self-generation-engine';

// CategoryTheoryEngine (Phase 6k)
export { CategoryTheoryEngine } from './category-theory-engine';
export type {
  CategoryObject, Morphism, Category, Functor,
  NaturalTransform, Diagram, FunctorVerification, NaturalityVerification,
} from './category-theory-engine';

// MetaAxiomValidator (Phase 6k)
export { MetaAxiomValidator } from './meta-axiom-validator';
export type {
  MetaAxiomName, MetaAxiom, ValidationResult, GodelLimit,
} from './meta-axiom-validator';

// CircularOriginEngine (Phase 6k)
export { CircularOriginEngine } from './circular-origin-engine';
export type {
  OntologyTradition, OntologyMapping, ZeroCycleResult,
  DependentOriginResult, RootPrinciple,
} from './circular-origin-engine';

// InfinityCategoryEngine (Phase 6k-HoTT)
export { InfinityCategoryEngine } from './infinity-category-engine';
export type {
  NMorphism, HigherPath, InfinityCategory, CoherenceResult,
} from './infinity-category-engine';

// HomotopyTypeEngine (Phase 6k-HoTT)
export { HomotopyTypeEngine } from './homotopy-type-engine';
export type {
  PathKind, IdentityType, Path, Homotopy,
  TruncationResult, UnivalenceResult, PathInductionResult,
} from './homotopy-type-engine';

// UniverseHierarchyEngine (Phase 6k-HoTT)
export { UniverseHierarchyEngine } from './universe-hierarchy-engine';
export type {
  Universe, HierarchyResult, FullHierarchyVerification,
} from './universe-hierarchy-engine';
