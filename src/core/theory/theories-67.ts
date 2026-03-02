/**
 * theories-67 — D-FUMT 66+1理論スタブ
 * 生成パラメーター圧縮・生成インターフェース
 */

export interface GenerativeParams {
  seed: number;
  scale: number;
  phase: number;
  depth: number;
  field: string;
}

export function compressToGenerativeParams(value: unknown): GenerativeParams {
  const str = JSON.stringify(value) ?? '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return {
    seed:  hash,
    scale: 1.0,
    phase: 0.0,
    depth: 1,
    field: 'default',
  };
}

export function generate(params: GenerativeParams): unknown {
  return { generated: true, params };
}
