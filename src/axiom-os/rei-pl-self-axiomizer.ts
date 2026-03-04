import { CodeAxiomExtractor, type ExtractionResult } from './code-axiom-extractor';
import { type SeedTheory } from './seed-kernel';

// 自己公理化の結果
export interface SelfAxiomResult {
  sourceModule: string;
  patterns: number;
  axioms: SeedTheory[];
  selfReferenceDetected: boolean;  // 自己参照（再帰）があるか
  sevenLogicTag: string;
  insight: string;                 // D-FUMT的洞察メッセージ
}

// Rei-PLコアコンポーネントのサンプルコード（実際は読み込む）
const REI_PL_SAMPLES: Record<string, string> = {
  lexer: `
    // Rei-PL Lexer: トークン分類
    function tokenize(src: string): Token[] {
      const tokens: Token[] = [];
      for (let i = 0; i < src.length; i++) {
        if (isWhitespace(src[i])) continue;
        const tok = matchToken(src, i);
        if (!tok) throw new Error('Unknown token at ' + i);
        tokens.push(tok);
      }
      return tokens;
    }
    const TOKEN_MAP: Record<string, TokenType> = {
      '⊤': 'TRUE', '⊥': 'FALSE', '∧': 'AND', '∨': 'OR',
      '□': 'MODAL_BOX', '◇': 'MODAL_DIA', 'Φ': 'DFUMT_PHI',
    };
  `,
  parser: `
    // Rei-PL Parser: AST構築
    function parseExpr(tokens: Token[], pos: number): [ASTNode, number] {
      const tok = tokens[pos];
      if (tok.type === 'TRUE' || tok.type === 'FALSE') {
        return [{ kind: 'Literal', value: tok.type }, pos + 1];
      }
      if (tok.type === 'AND' || tok.type === 'OR') {
        const [left, p1] = parseExpr(tokens, pos + 1);
        const [right, p2] = parseExpr(tokens, p1);
        return [{ kind: 'BinOp', op: tok.type, left, right }, p2];
      }
      throw new Error('Unexpected token: ' + tok.type);
    }
  `,
  codegen: `
    // Rei-PL CodeGen: WASM生成
    function emitExpr(node: ASTNode, ctx: Context): void {
      switch (node.kind) {
        case 'Literal':
          ctx.emit(encodeSevenValue(node.value));
          break;
        case 'BinOp':
          emitExpr(node.left, ctx);
          emitExpr(node.right, ctx);
          ctx.emit(opcode(node.op));
          break;
        case 'Pipe':
          emitExpr(node.input, ctx);
          for (const cmd of node.commands) {
            emitPipeCmd(cmd, ctx);
          }
          break;
      }
    }
    const WASM_HEADER = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  `,
};

export class ReiPLSelfAxiomizer {
  private extractor = new CodeAxiomExtractor();

  // Rei-PLの特定モジュールを公理化
  axiomize(module: keyof typeof REI_PL_SAMPLES): SelfAxiomResult {
    const code = REI_PL_SAMPLES[module];
    const result = this.extractor.extract(code, 'typescript');

    const selfReferenceDetected = result.patterns.some(
      p => p.kind === 'recursion' || p.axiom.includes('自己参照')
    );

    const insight = this.generateInsight(module, result, selfReferenceDetected);

    return {
      sourceModule: module,
      patterns: result.patterns.length,
      axioms: result.seedTheories,
      selfReferenceDetected,
      sevenLogicTag: result.sevenLogicTag,
      insight,
    };
  }

  // 全モジュールを一括公理化
  axiomizeAll(): SelfAxiomResult[] {
    return (Object.keys(REI_PL_SAMPLES) as Array<keyof typeof REI_PL_SAMPLES>)
      .map(module => this.axiomize(module));
  }

  // D-FUMT的洞察を生成
  private generateInsight(
    module: string,
    result: ExtractionResult,
    selfRef: boolean
  ): string {
    const tag = result.sevenLogicTag;
    if (module === 'lexer') {
      return `Lexerは${tag}：世界（コード）を最小単位（トークン）に分解する「空（śūnya）」への帰還。`;
    }
    if (module === 'parser') {
      return `Parserは${tag}：トークンから構造を生成する「縁起（pratītyasamutpāda）」の実装。${selfRef ? '再帰により自己参照構造を内包。' : ''}`;
    }
    if (module === 'codegen') {
      return `CodeGenは${tag}：ASTからWASMへの「種（bīja）から現象を生む」D-FUMT縮小理論の具現化。`;
    }
    return `${module}は${tag}：D-FUMT理論により公理化完了。`;
  }

  // 自己公理化の結果をSeedTheory配列として統合
  mergeSelfAxioms(): SeedTheory[] {
    const allResults = this.axiomizeAll();
    const seen = new Set<string>();
    const merged: SeedTheory[] = [];

    for (const result of allResults) {
      for (const axiom of result.axioms) {
        if (!seen.has(axiom.id)) {
          seen.add(axiom.id);
          merged.push(axiom);
        }
      }
    }
    return merged;
  }
}
