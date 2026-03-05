#!/usr/bin/env node
/**
 * rei-verify — 再生成コード検証CLI
 * 使い方:
 *   npx tsx src/cli/rei-verify.ts regenerated/
 *   npx tsx src/cli/rei-verify.ts regenerated/ --strict
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as ts   from 'typescript';

// ─── 検証結果 ─────────────────────────────────────────────────

export interface VerifyResult {
  file: string;
  syntaxErrors: number;
  errorDetails: string[];   // エラー詳細
  functionCount: number;
  exportCount: number;
  sourceFidelityCount: number;
  semiFidelityCount: number;
  templateCount: number;
}

export interface VerifySummary {
  totalFiles: number;
  errorFreeFiles: number;
  errorFiles: number;
  totalFunctions: number;
  totalExports: number;
  sourceFidelityCount: number;
  semiFidelityCount: number;
  templateCount: number;
  fidelityScore: number;
}

// ─── 検証ロジック ─────────────────────────────────────────────

export function verifyFile(filePath: string): VerifyResult {
  const content = fs.readFileSync(filePath, 'utf-8');

  // TypeScript構文チェック
  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  // parseDiagnostics を収集
  let syntaxErrors = 0;
  const errorDetails: string[] = [];
  const diagnostics = (sourceFile as any).parseDiagnostics as ts.Diagnostic[] | undefined;
  if (diagnostics) {
    syntaxErrors = diagnostics.length;
    const lines = content.split('\n');
    for (const diag of diagnostics) {
      if (diag.start !== undefined) {
        const pos = sourceFile.getLineAndCharacterOfPosition(diag.start);
        const lineText = lines[pos.line]?.trim() ?? '';
        const msg = ts.flattenDiagnosticMessageText(diag.messageText, ' ');
        errorDetails.push(`L${pos.line + 1}: "${lineText.slice(0, 40)}" — ${msg}`);
      }
    }
  }

  // 構造チェック: function/const arrow 宣言数
  const functionMatches = content.match(/\b(function|const\s+\w+\s*=\s*(\(|<))/g);
  const functionCount = functionMatches?.length ?? 0;

  // export文の数
  const exportMatches = content.match(/\bexport\b/g);
  const exportCount = exportMatches?.length ?? 0;

  // 忠実度タグのカウント
  const sourceFidelityCount = (content.match(/\[再生成:source-fidelity\]/g) ?? []).length;
  const semiFidelityCount = (content.match(/\[再生成:semi-fidelity\]/g) ?? []).length;
  const templateCount = (content.match(/\[再生成:template\]/g) ?? []).length;

  return {
    file: path.basename(filePath),
    syntaxErrors,
    functionCount,
    exportCount,
    errorDetails,
    sourceFidelityCount,
    semiFidelityCount,
    templateCount,
  };
}

export function verifyDirectory(dir: string): { results: VerifyResult[]; summary: VerifySummary } {
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.generated.ts') || f === 'index.ts')
    .map(f => path.join(dir, f));

  const results: VerifyResult[] = files.map(f => verifyFile(f));

  const totalSrc = results.reduce((s, r) => s + r.sourceFidelityCount, 0);
  const totalSemi = results.reduce((s, r) => s + r.semiFidelityCount, 0);
  const totalTmpl = results.reduce((s, r) => s + r.templateCount, 0);
  const totalAxioms = totalSrc + totalSemi + totalTmpl;

  const summary: VerifySummary = {
    totalFiles: results.length,
    errorFreeFiles: results.filter(r => r.syntaxErrors === 0).length,
    errorFiles: results.filter(r => r.syntaxErrors > 0).length,
    totalFunctions: results.reduce((s, r) => s + r.functionCount, 0),
    totalExports: results.reduce((s, r) => s + r.exportCount, 0),
    sourceFidelityCount: totalSrc,
    semiFidelityCount: totalSemi,
    templateCount: totalTmpl,
    fidelityScore: totalAxioms > 0
      ? (totalSrc * 1.0 + totalSemi * 0.5) / totalAxioms
      : 0,
  };

  return { results, summary };
}

// ─── CLI メイン ───────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const targetDir = args.find(a => !a.startsWith('--'));
  const strict = args.includes('--strict');

  if (!targetDir || !fs.existsSync(targetDir)) {
    console.log('使い方: rei-verify.ts <regenerated-dir>');
    console.log('例: rei-verify.ts regenerated/ --strict');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  rei-verify — 再生成コード検証                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const { results, summary } = verifyDirectory(targetDir);

  // 各ファイルの結果
  for (const r of results) {
    const status = r.syntaxErrors === 0 ? 'OK' : 'NG';
    console.log(`  ${status} ${r.file}: ${r.functionCount}関数, ${r.exportCount}export, エラー${r.syntaxErrors}件`);
    if (r.syntaxErrors > 0) {
      for (const detail of r.errorDetails.slice(0, 3)) {
        console.log(`      ${detail}`);
      }
      if (r.errorDetails.length > 3) {
        console.log(`      ...他 ${r.errorDetails.length - 3} 件`);
      }
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  検証結果                                                  ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  検証ファイル数     : ${String(summary.totalFiles).padStart(8)}                        ║`);
  console.log(`║  構文エラー0件      :    ${String(summary.errorFreeFiles).padStart(3)} / ${summary.totalFiles}                       ║`);
  console.log(`║  構文エラーあり     :    ${String(summary.errorFiles).padStart(3)} / ${summary.totalFiles}                       ║`);
  console.log(`║  忠実度スコア       : ${(summary.fidelityScore * 100).toFixed(1).padStart(7)}%                         ║`);
  console.log(`║    source直接使用   : ${String(summary.sourceFidelityCount).padStart(8)} 件                      ║`);
  console.log(`║    semi忠実         : ${String(summary.semiFidelityCount).padStart(8)} 件                      ║`);
  console.log(`║    汎用テンプレート  : ${String(summary.templateCount).padStart(8)} 件                      ║`);
  console.log(`║  総関数数           : ${String(summary.totalFunctions).padStart(8)}                        ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (strict && summary.errorFiles > 0) {
    console.log('\n--strict: 構文エラーがあるため終了コード1');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
