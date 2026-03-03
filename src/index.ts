/**
 * Rei-AIOS — Axiomatic Operating System
 *
 * D-FUMT理論に基づく知的計算基盤
 * Author: Nobuki Fujimoto
 *
 * エントリーポイント:
 *   - interfaces: 外部依存の注入インターフェース
 *   - aios:       AIOS エンジン / LLM 管理 / アクション実行
 *   - agi:        AGI レイヤー（タスク分解・実行）
 *   - core:       D-FUMT 理論コア（定数・エンジン）
 */

// ─── Interfaces（外部依存の注入） ───────────────────────────
export {
  initReiAIOSDeps,
  getReiAIOSDeps,
  resetReiAIOSDeps,
  type ReiAIOSDeps,
  type ParseFunction,
  type IReiProgram,
  type IReiRuntime,
  type IAutoBackend,
  type AutoControllerFactory,
  type ReiRuntimeFactory,
} from './interfaces/rei-runtime-interface';

// ─── AIOS Engine ──────────────────────────────────────────────
export { AIOSEngine }     from './aios/aios-engine';
export { ActionExecutor } from './aios/action-executor';
export { LLMManager }     from './aios/llm-manager';
export { ReiSandbox }     from './aios/rei-runtime/rei-sandbox';

// ─── AGI Layer ────────────────────────────────────────────────
export { initAGILayer }   from './agi/index';

// ─── D-FUMT Core ──────────────────────────────────────────────
export { DFUMT_CONSTANTS, CONSTANT_REGISTRY } from './core/dfumt/constants';

// ─── Rei-PL Bridge（コンパイラ接続） ─────────────────────────
export {
  compile       as reiPLCompile,
  compileWithDetails as reiPLCompileWithDetails,
  compileAndRun as reiPLCompileAndRun,
  ReiPLBridgeError,
  type ReiPLCompileResult,
  type ReiPLRunResult,
} from './rei-pl-bridge';

// ─── Axiom OS（SQLite永続化層） ──────────────────────────────
export { AxiomOSStore, openDatabase, DEFAULT_DB_PATH } from './axiom-os';
export { SEED_PERSONS, SEED_THEORIES, SEED_AXIOMS }    from './axiom-os';
export type {
  PersonRow, PersonInsert, PersonUpdate,
  TheoryRow, TheoryInsert, TheoryUpdate,
  AxiomRow, AxiomInsert, AxiomUpdate,
  MemoryRow, MemoryInsert, MemoryUpdate,
} from './axiom-os';

// ─── Axiom OS Connector（AIOS↔公理OS連携） ──────────────────
export { AxiomOSConnector } from './axiom-os-connector';
export type { SearchHit, QueryResult } from './axiom-os-connector';
