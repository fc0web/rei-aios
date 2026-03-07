/**
 * Rei-AIOS — External Runtime Interfaces
 *
 * rei-automator の parser / ReiRuntime / AutoController に依存せず、
 * インターフェース経由で注入できるようにする。
 *
 * rei-automator 側が initReiAIOSDeps() で具象クラスを登録する。
 */

// ─── Parse Function ──────────────────────────────────────────

/** パースエラー */
export interface ParseError {
  message: string;
  line: number;
  column?: number;
}

/** パース結果（プログラム） */
export interface IReiProgram {
  commands: any[];   // ReiCommand は複雑な union 型のため any で受ける
  errors: ParseError[];
}

/** parse() 関数の型 */
export type ParseFunction = (code: string) => IReiProgram;

// ─── AutoBackend / AutoController ────────────────────────────

export interface IAutoBackend {
  click(x: number, y: number): Promise<void>;
  dblclick(x: number, y: number): Promise<void>;
  rightclick(x: number, y: number): Promise<void>;
  move(x: number, y: number): Promise<void>;
  drag(x1: number, y1: number, x2: number, y2: number): Promise<void>;
  type(text: string): Promise<void>;
  key(keyName: string): Promise<void>;
  shortcut(keys: string[]): Promise<void>;
}

/** AutoController ファクトリ */
export type AutoControllerFactory = (backend: IAutoBackend) => IAutoBackend;

// ─── ReiRuntime ──────────────────────────────────────────────

export interface IReiRuntime {
  execute(program: IReiProgram): Promise<any>;
  setExecutionMode?(mode: string, target?: string): void;
  setWinApiBackend?(winApi: any): void;
  setContext?(ctx: Record<string, any>): void;
}

/** ReiRuntime ファクトリ: controller を受け取って IReiRuntime を返す */
export type ReiRuntimeFactory = (controller: IAutoBackend) => IReiRuntime;

// ─── WinApi Backend ──────────────────────────────────────────

export interface IWinApiBackend {
  click(x: number, y: number): Promise<void>;
  type(text: string): Promise<void>;
  key(keyName: string): Promise<void>;
  shortcut(keys: string[]): Promise<void>;
  setTargetWindow(title: string): Promise<void>;
}

// ─── Dependency Container ────────────────────────────────────

export interface ReiAIOSDeps {
  parse: ParseFunction;
  createRuntime: ReiRuntimeFactory;
  createController: AutoControllerFactory;
}

/** グローバル依存コンテナ */
let _deps: ReiAIOSDeps | null = null;

/** rei-automator から呼び出して依存性を登録する */
export function initReiAIOSDeps(deps: ReiAIOSDeps): void {
  _deps = deps;
}

/** 依存性を取得（未初期化なら例外） */
export function getReiAIOSDeps(): ReiAIOSDeps {
  if (!_deps) {
    throw new Error(
      '[Rei-AIOS] Dependencies not initialized. ' +
      'Call initReiAIOSDeps() from rei-automator before using AIOS features.'
    );
  }
  return _deps;
}

/** テスト用: 依存性をリセット */
export function resetReiAIOSDeps(): void {
  _deps = null;
}

// ─── Code Generation API ─────────────────────────────────

/** Rei-PLコード生成関数の型 */
export type ReiCodeGenerator = (theory: { id: string; axiom: string; category: string }) => string;

/** コード生成ファクトリ */
export interface ReiCodeGenDeps {
  generateCode: ReiCodeGenerator;
}

let _codeGenDeps: ReiCodeGenDeps | null = null;

export function initReiCodeGenDeps(deps: ReiCodeGenDeps): void {
  _codeGenDeps = deps;
}

export function getCodeGenerator(): ReiCodeGenerator | null {
  return _codeGenDeps?.generateCode ?? null;
}
