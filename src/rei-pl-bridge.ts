/**
 * Rei-PL Bridge — Minimal connection between Rei-AIOS and Rei-PL compiler
 *
 * Rei-PL (Source → WASM) コンパイラへの型付きブリッジ。
 * 動的importでrei-plを遅延ロードし、ESM/CJS差異を吸収する。
 */

// ─── Types (matching rei-pl's CompileResult / RunResult) ───

export interface ReiPLCompileResult {
  wasm: Uint8Array;
  diagnostics: string[];
  stats: {
    sourceChars: number;
    tokenCount: number;
    astNodes: number;
    wasmBytes: number;
    compressionRatio: number;
  };
}

export interface ReiPLRunResult {
  output: string;
  numericOutputs: number[];
  success: boolean;
  error?: string;
}

// ─── Error ───

export class ReiPLBridgeError extends Error {
  public readonly cause?: Error;
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ReiPLBridgeError';
    this.cause = cause;
  }
}

// ─── Module Loader (lazy, cached) ───

let _compiler: any = null;

/**
 * rei-pl コンパイラモジュールを動的ロードする。
 * ESMパッケージを正しくロードするため、真のdynamic import()を使用。
 */
async function loadCompiler(): Promise<any> {
  if (_compiler) return _compiler;

  // rei-pl は "type": "module" (ESM) のため、
  // CJSからはrequire()不可。真のdynamic import()を使用する。
  const dynamicImport = new Function('specifier', 'return import(specifier)') as
    (specifier: string) => Promise<any>;

  try {
    _compiler = await dynamicImport('rei-pl/src/rei-compiler.ts');
    return _compiler;
  } catch {
    // フォールバック: 拡張子なし
    try {
      _compiler = await dynamicImport('rei-pl/src/rei-compiler');
      return _compiler;
    } catch (e: any) {
      throw new ReiPLBridgeError(
        `Failed to load rei-pl compiler: ${e.message}. ` +
        'Ensure rei-pl is installed and the runtime supports TypeScript imports (e.g., tsx/ts-node).',
        e,
      );
    }
  }
}

// ─── Public API ───

/**
 * Rei-PL ソースコードを WASM バイナリにコンパイルする。
 *
 * @param reiSourceCode - Rei-PL ソースコード
 * @returns WASM バイナリ (Uint8Array)
 * @throws ReiPLBridgeError コンパイル失敗時
 *
 * @example
 * ```typescript
 * const wasm = await compile('compress main() = "Hello, World!" |> print');
 * console.log(`WASM: ${wasm.length} bytes`);
 * ```
 */
export async function compile(reiSourceCode: string): Promise<Uint8Array> {
  if (!reiSourceCode || typeof reiSourceCode !== 'string') {
    throw new ReiPLBridgeError('Source code must be a non-empty string');
  }

  try {
    const compiler = await loadCompiler();
    const result = compiler.compile(reiSourceCode);

    if (!result || !result.wasm) {
      throw new Error('Compiler returned no WASM output');
    }

    return result.wasm;
  } catch (e: any) {
    if (e instanceof ReiPLBridgeError) throw e;
    throw new ReiPLBridgeError(`Compilation failed: ${e.message}`, e);
  }
}

/**
 * コンパイル結果を詳細情報付きで返す。
 *
 * @param reiSourceCode - Rei-PL ソースコード
 * @returns CompileResult (wasm, diagnostics, stats)
 */
export async function compileWithDetails(reiSourceCode: string): Promise<ReiPLCompileResult> {
  if (!reiSourceCode || typeof reiSourceCode !== 'string') {
    throw new ReiPLBridgeError('Source code must be a non-empty string');
  }

  try {
    const compiler = await loadCompiler();
    const result = compiler.compile(reiSourceCode);

    if (!result || !result.wasm) {
      throw new Error('Compiler returned no WASM output');
    }

    return {
      wasm: result.wasm,
      diagnostics: result.diagnostics || [],
      stats: result.stats,
    };
  } catch (e: any) {
    if (e instanceof ReiPLBridgeError) throw e;
    throw new ReiPLBridgeError(`Compilation failed: ${e.message}`, e);
  }
}

/**
 * Rei-PL ソースコードをコンパイルし、WASM を実行する。
 *
 * @param reiSourceCode - Rei-PL ソースコード
 * @returns 実行結果 (output, success, error)
 */
export async function compileAndRun(reiSourceCode: string): Promise<ReiPLRunResult> {
  const wasm = await compile(reiSourceCode);

  try {
    const compiler = await loadCompiler();
    const result = await compiler.run(wasm);
    return {
      output: result.output,
      numericOutputs: result.numericOutputs || [],
      success: result.success,
      error: result.error,
    };
  } catch (e: any) {
    if (e instanceof ReiPLBridgeError) throw e;
    throw new ReiPLBridgeError(`WASM execution failed: ${e.message}`, e);
  }
}
