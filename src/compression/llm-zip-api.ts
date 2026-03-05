/**
 * Rei-AIOS STEP 8 — LLMZipAPI
 * Anthropic Claude APIを使った意味的圧縮エンジン
 *
 * マジックバイト: REI\x05（既存LLMZipと同一系列）
 * 拡張マジック:   REI\x07（API接続版として区別）
 *
 * 圧縮フロー:
 *   元コード → Claude API（要約プロンプト）→ 意味記述（極小）→ .reiax保存
 *
 * 復元フロー:
 *   意味記述 → Claude API（再生成プロンプト）→ 意味的等価コード
 *
 * D-FUMT統合:
 *   七価論理値で圧縮の「確信度」を表現
 *   TRUE=完全復元可能 / BOTH=意味保存 / NEITHER=要注意
 */

import * as https from 'https';
import * as zlib from 'zlib';

// ─── 型定義 ────────────────────────────────────────────────────
export type DFUMTValue = 'TRUE' | 'FALSE' | 'BOTH' | 'NEITHER' | 'INFINITY' | 'ZERO' | 'FLOWING';

export interface LLMZipAPIOptions {
  apiKey?: string;          // 未指定時は環境変数 ANTHROPIC_API_KEY を使用
  model?: string;           // デフォルト: claude-haiku-4-5-20251001
  maxTokens?: number;       // 要約の最大トークン数（デフォルト: 200）
  temperature?: number;     // 0.0〜1.0（デフォルト: 0.1 — 再現性重視）
  fallbackToLocal?: boolean; // API失敗時にローカル処理で続行
  language?: 'auto' | 'typescript' | 'python' | 'javascript' | 'general';
}

export interface SemanticDescriptor {
  magic: string;              // "REI\x07"
  version: string;            // "2.0"
  originalSize: number;
  originalHash: string;
  descriptor: string;         // Claude APIが生成した意味記述
  language: string;           // 検出された言語
  dfumtConfidence: DFUMTValue; // 復元可能性の七価論理評価
  model: string;              // 使用したモデル
  compressedAt: string;
  tokenCount: number;         // 意味記述のトークン数（概算）
}

export interface LLMZipResult {
  success: boolean;
  descriptor?: SemanticDescriptor;
  archivedBuffer?: Buffer;    // マジックバイト + gzip圧縮されたJSON
  compressionRatio?: number;  // archivedSize / originalSize
  usedAPI: boolean;           // true=Claude API / false=ローカルフォールバック
  error?: string;
}

export interface LLMUnzipResult {
  success: boolean;
  regeneratedCode?: string;
  dfumtEquivalence: DFUMTValue; // 復元品質の七価論理評価
  usedAPI: boolean;
  error?: string;
}

// ─── ローカルフォールバック ─────────────────────────────────────
function localDescribe(source: string, language: string): string {
  const lines = source.split('\n').filter(l => l.trim());
  const functions = lines.filter(l =>
    l.match(/function\s+\w+|def\s+\w+|const\s+\w+\s*=.*=>/)
  ).map(l => l.trim().slice(0, 60));
  const imports = lines.filter(l =>
    l.startsWith('import ') || l.startsWith('from ')
  ).map(l => l.trim().slice(0, 60));

  const parts: string[] = [];
  if (language !== 'general') parts.push(`[${language}]`);
  if (imports.length > 0) parts.push(`imports: ${imports.slice(0,3).join(', ')}`);
  if (functions.length > 0) parts.push(`functions: ${functions.slice(0,5).join(', ')}`);
  parts.push(`lines: ${lines.length}`);
  return parts.join(' | ');
}

function localRegenerate(descriptor: string, language: string): string {
  return [
    `// Regenerated from semantic descriptor (local fallback)`,
    `// Descriptor: ${descriptor}`,
    `// Language: ${language}`,
    `// NOTE: Full regeneration requires Claude API connection`,
    ``,
    `// TODO: Implement based on descriptor above`,
  ].join('\n');
}

function detectLanguage(source: string): string {
  if (source.includes('import ') && source.includes(': ')) return 'typescript';
  if (source.includes('def ') && source.includes(':')) return 'python';
  if (source.includes('function ') || source.includes('=>')) return 'javascript';
  return 'general';
}

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function countTokens(text: string): number {
  // 概算: 4文字 ≈ 1トークン
  return Math.ceil(text.length / 4);
}

function evalConfidence(originalSize: number, descriptorSize: number): DFUMTValue {
  const ratio = descriptorSize / originalSize;
  if (ratio < 0.05) return 'BOTH';       // 5%未満: 意味保存（BOTHの境界）
  if (ratio < 0.15) return 'TRUE';       // 15%未満: 復元可能
  if (ratio < 0.30) return 'FLOWING';    // 30%未満: 流動的
  return 'NEITHER';                      // それ以上: 要注意
}

// ─── Claude API 呼び出し ────────────────────────────────────────
async function callClaudeAPI(
  prompt: string,
  apiKey: string,
  model: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(`API Error: ${json.error.message}`));
          } else {
            const text = json.content?.[0]?.text ?? '';
            resolve(text.trim());
          }
        } catch (e) {
          reject(new Error(`Parse error: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── 圧縮プロンプト ────────────────────────────────────────────
function buildCompressPrompt(source: string, language: string): string {
  return `You are a semantic code compressor for the Rei-PL D-FUMT system.

Analyze the following ${language} code and create an ULTRA-COMPACT semantic descriptor.
The descriptor must capture the COMPLETE MEANING so the code can be fully regenerated.

Rules:
- Maximum 200 characters
- Include: purpose, key algorithms, data structures, function signatures
- Format: "LANG | purpose | functions: f1(params)->ret, f2... | patterns: pattern1, pattern2"
- Be extremely concise but semantically complete
- No explanations, just the descriptor

Code to compress:
\`\`\`${language}
${source.slice(0, 3000)}
\`\`\`

Output ONLY the semantic descriptor (no markdown, no explanation):`;
}

// ─── 再生成プロンプト ──────────────────────────────────────────
function buildRegeneratePrompt(descriptor: SemanticDescriptor): string {
  return `You are a semantic code regenerator for the Rei-PL D-FUMT system.

Regenerate complete, working ${descriptor.language} code from this semantic descriptor:
"${descriptor.descriptor}"

Original size was approximately ${descriptor.originalSize} characters.

Rules:
- Generate COMPLETE, RUNNABLE code (not pseudocode)
- Match the language: ${descriptor.language}
- Include proper imports, type annotations if TypeScript
- Add comment: "// Regenerated by Rei-AIOS LLMZip v2.0 — D-FUMT semantic compression"
- Make it semantically equivalent to the original

Output ONLY the code (no markdown fences, no explanation):`;
}

// ─── LLMZipAPI メインクラス ────────────────────────────────────
export class LLMZipAPI {
  private opts: Required<LLMZipAPIOptions>;

  constructor(opts: LLMZipAPIOptions = {}) {
    this.opts = {
      apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
      model: opts.model ?? 'claude-haiku-4-5-20251001', // 高速・低コスト
      maxTokens: opts.maxTokens ?? 200,
      temperature: opts.temperature ?? 0.1,
      fallbackToLocal: opts.fallbackToLocal ?? true,
      language: opts.language ?? 'auto',
    };
  }

  // ── 意味的圧縮 ─────────────────────────────────────────────
  async compress(source: string): Promise<LLMZipResult> {
    const language = this.opts.language === 'auto'
      ? detectLanguage(source)
      : this.opts.language;

    let descriptor: string;
    let usedAPI = false;

    // API呼び出し試行
    if (this.opts.apiKey) {
      try {
        const prompt = buildCompressPrompt(source, language);
        descriptor = await callClaudeAPI(
          prompt,
          this.opts.apiKey,
          this.opts.model,
          this.opts.maxTokens,
          this.opts.temperature
        );
        usedAPI = true;
        console.log(`[LLMZipAPI] Claude API圧縮成功: ${descriptor.length}文字`);
      } catch (e: any) {
        if (!this.opts.fallbackToLocal) {
          return { success: false, usedAPI: false, error: e.message };
        }
        console.warn(`[LLMZipAPI] API失敗→ローカルフォールバック: ${e.message}`);
        descriptor = localDescribe(source, language);
      }
    } else {
      console.log('[LLMZipAPI] APIキーなし→ローカルフォールバック');
      descriptor = localDescribe(source, language);
    }

    const sem: SemanticDescriptor = {
      magic: 'REI\x07',
      version: '2.0',
      originalSize: source.length,
      originalHash: simpleHash(source),
      descriptor,
      language,
      dfumtConfidence: evalConfidence(source.length, descriptor.length),
      model: usedAPI ? this.opts.model : 'local-fallback',
      compressedAt: new Date().toISOString(),
      tokenCount: countTokens(descriptor),
    };

    const json = JSON.stringify(sem);
    const compressed = zlib.gzipSync(Buffer.from(json, 'utf8'));
    const magic = Buffer.from('REI\x07', 'utf8');
    const archivedBuffer = Buffer.concat([magic, compressed]);

    return {
      success: true,
      descriptor: sem,
      archivedBuffer,
      compressionRatio: archivedBuffer.length / Math.max(source.length, 1),
      usedAPI,
    };
  }

  // ── 意味的復元 ─────────────────────────────────────────────
  async decompress(buffer: Buffer): Promise<LLMUnzipResult> {
    // マジックバイト確認
    const magic = buffer.slice(0, 4).toString('utf8');
    if (magic !== 'REI\x07') {
      return {
        success: false,
        dfumtEquivalence: 'FALSE',
        usedAPI: false,
        error: `無効なマジックバイト: ${JSON.stringify(magic)}`,
      };
    }

    let sem: SemanticDescriptor;
    try {
      const json = zlib.gunzipSync(buffer.slice(4)).toString('utf8');
      sem = JSON.parse(json) as SemanticDescriptor;
    } catch (e: any) {
      return {
        success: false,
        dfumtEquivalence: 'FALSE',
        usedAPI: false,
        error: `展開失敗: ${e.message}`,
      };
    }

    let regeneratedCode: string;
    let usedAPI = false;

    if (this.opts.apiKey) {
      try {
        const prompt = buildRegeneratePrompt(sem);
        regeneratedCode = await callClaudeAPI(
          prompt,
          this.opts.apiKey,
          this.opts.model,
          2000, // 再生成は長めに
          this.opts.temperature
        );
        usedAPI = true;
        console.log(`[LLMZipAPI] Claude API再生成成功: ${regeneratedCode.length}文字`);
      } catch (e: any) {
        if (!this.opts.fallbackToLocal) {
          return { success: false, dfumtEquivalence: 'FALSE', usedAPI: false, error: e.message };
        }
        regeneratedCode = localRegenerate(sem.descriptor, sem.language);
      }
    } else {
      regeneratedCode = localRegenerate(sem.descriptor, sem.language);
    }

    // 復元品質の七価論理評価
    const equivalence: DFUMTValue = usedAPI
      ? sem.dfumtConfidence  // API使用時は圧縮時の評価を継承
      : 'NEITHER';           // ローカルフォールバックは「不確定」

    return {
      success: true,
      regeneratedCode,
      dfumtEquivalence: equivalence,
      usedAPI,
    };
  }

  // ── バッチ圧縮（複数ファイル） ─────────────────────────────
  async compressBatch(sources: { name: string; content: string }[]): Promise<{
    results: { name: string; result: LLMZipResult }[];
    totalOriginal: number;
    totalCompressed: number;
    avgRatio: number;
    apiUsedCount: number;
  }> {
    const results: { name: string; result: LLMZipResult }[] = [];
    let totalOriginal = 0;
    let totalCompressed = 0;
    let apiUsedCount = 0;

    for (const src of sources) {
      const result = await this.compress(src.content);
      results.push({ name: src.name, result });
      totalOriginal += src.content.length;
      if (result.archivedBuffer) totalCompressed += result.archivedBuffer.length;
      if (result.usedAPI) apiUsedCount++;
    }

    const avgRatio = totalOriginal > 0 ? totalCompressed / totalOriginal : 1;

    return { results, totalOriginal, totalCompressed, avgRatio, apiUsedCount };
  }

  // ── 圧縮レポート生成 ───────────────────────────────────────
  report(result: LLMZipResult): string {
    if (!result.success || !result.descriptor) return '❌ 圧縮失敗';

    const sem = result.descriptor;
    const ratio = result.compressionRatio ?? 1;
    const dfumtSymbols: Record<DFUMTValue, string> = {
      TRUE: '⊤', FALSE: '⊥', BOTH: 'B', NEITHER: 'N',
      INFINITY: '∞', ZERO: '〇', FLOWING: '～'
    };

    return [
      `📦 LLMZip意味的圧縮レポート`,
      `─────────────────────────────`,
      `元サイズ:   ${sem.originalSize} bytes`,
      `圧縮後:     ${result.archivedBuffer?.length ?? 0} bytes`,
      `圧縮率:     ${(ratio * 100).toFixed(1)}%`,
      `意味記述:   ${sem.descriptor.length}文字`,
      `言語:       ${sem.language}`,
      `D-FUMT確信度: ${dfumtSymbols[sem.dfumtConfidence]} ${sem.dfumtConfidence}`,
      `APIモデル:  ${sem.model}`,
      `─────────────────────────────`,
      `意味記述内容:`,
      `  "${sem.descriptor}"`,
    ].join('\n');
  }
}

// ─── 後方互換: 既存LLMZip APIと同一インターフェース ────────────
export async function llmZipCompress(
  source: string,
  opts: LLMZipAPIOptions = {}
): Promise<LLMZipResult> {
  const engine = new LLMZipAPI(opts);
  return engine.compress(source);
}

export async function llmZipDecompress(
  buffer: Buffer,
  opts: LLMZipAPIOptions = {}
): Promise<LLMUnzipResult> {
  const engine = new LLMZipAPI(opts);
  return engine.decompress(buffer);
}
