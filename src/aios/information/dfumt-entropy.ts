/**
 * Rei-AIOS Phase 7d — D-FUMT Entropy Theory
 * Theory #77: H7(X) = -Sum p(x) log7 p(x)
 *
 * Extends Shannon information entropy with D-FUMT seven-valued logic.
 *
 * @author Nobuki Fujimoto (D-FUMT) + Claude
 */

// --- Type definitions ---

export type DFUMTSymbol = '\u22a4' | '\u22a5' | 'Both' | 'Neither' | '\u221e' | '\u3007' | '\uff5e';

export type DFUMTProbDist = Partial<Record<DFUMTSymbol, number>>;

export interface EntropyResult {
  h7: number;
  h2: number;
  richness: number;
  dominantValue: DFUMTSymbol;
  distribution: DFUMTProbDist;
  theoryRef: 77;
}

export interface AncientCodeEntropy {
  ancient32: number;
  iching64: number;
  dfumt7: number;
  expressiveness: number;
}

// --- Constants ---

export const MAX_ENTROPY_7 = Math.log(7);
export const MAX_ENTROPY_2 = Math.log(2);
export const MAX_ENTROPY_32 = Math.log(32);
export const MAX_ENTROPY_64 = Math.log(64);

const ALL_VALUES: DFUMTSymbol[] = ['\u22a4', '\u22a5', 'Both', 'Neither', '\u221e', '\u3007', '\uff5e'];

// --- Entropy calculation ---

export function calcDFUMTEntropy(dist: DFUMTProbDist): EntropyResult {
  const raw: Record<DFUMTSymbol, number> = {} as any;
  let total = 0;
  for (const v of ALL_VALUES) {
    raw[v] = dist[v] ?? 0;
    total += raw[v];
  }
  if (total === 0) {
    for (const v of ALL_VALUES) raw[v] = 1 / 7;
    total = 1;
  }
  const normalized: Record<DFUMTSymbol, number> = {} as any;
  for (const v of ALL_VALUES) normalized[v] = raw[v] / total;

  let h7Raw = 0;
  let h2Raw = 0;
  for (const v of ALL_VALUES) {
    const p = normalized[v];
    if (p > 0) {
      h7Raw -= p * Math.log(p);
      h2Raw -= p * Math.log2(p);
    }
  }

  const h7 = h7Raw / MAX_ENTROPY_7;
  const h2 = h2Raw / Math.log2(2);

  const dominantValue = ALL_VALUES.reduce((a, b) =>
    normalized[a] > normalized[b] ? a : b
  );

  return {
    h7: Math.min(h7, 1.0),
    h2: Math.min(h2, 1.0),
    richness: h7Raw / MAX_ENTROPY_2,
    dominantValue,
    distribution: normalized,
    theoryRef: 77,
  };
}

export function compareWithAncientCodes(dist: DFUMTProbDist): AncientCodeEntropy {
  const result = calcDFUMTEntropy(dist);
  const dfumt7Raw = result.h7 * MAX_ENTROPY_7;

  return {
    ancient32: MAX_ENTROPY_32,
    iching64: MAX_ENTROPY_64,
    dfumt7: dfumt7Raw,
    expressiveness: dfumt7Raw / MAX_ENTROPY_32,
  };
}

export function calcTaskEntropy(
  stateCounts: Partial<Record<DFUMTSymbol, number>>
): EntropyResult {
  return calcDFUMTEntropy(stateCounts);
}

export function describeEntropy(result: EntropyResult): string {
  const level =
    result.h7 > 0.9 ? '\u6700\u5927\uff08\u5b8c\u5168\u306a\u4e0d\u78ba\u5b9f\u6027\uff09' :
    result.h7 > 0.7 ? '\u9ad8\uff08\u591a\u69d8\u306a\u72b6\u614b\u304c\u6df7\u5728\uff09' :
    result.h7 > 0.4 ? '\u4e2d\uff08\u504f\u308a\u3042\u308a\uff09' :
    result.h7 > 0.1 ? '\u4f4e\uff08\u652f\u914d\u7684\u306a\u72b6\u614b\u3042\u308a\uff09' :
    '\u6700\u5c0f\uff08\u307b\u307c\u78ba\u5b9a\u72b6\u614b\uff09';

  return [
    `D-FUMT\u30a8\u30f3\u30c8\u30ed\u30d4\u30fc H\u2087 = ${result.h7.toFixed(4)}\uff08${level}\uff09`,
    `\u30b7\u30e3\u30ce\u30f3\u30a8\u30f3\u30c8\u30ed\u30d4\u30fc H\u2082 = ${result.h2.toFixed(4)}`,
    `\u60c5\u5831\u8c4a\u5bcc\u5ea6\uff08\u4e03\u5024/\u4e8c\u5024\u6bd4\uff09= ${result.richness.toFixed(3)}\u500d`,
    `\u652f\u914d\u7684\u72b6\u614b: ${result.dominantValue}`,
    `\u7406\u8ad6\u53c2\u7167: Theory #${result.theoryRef}\uff08D-FUMT\u30a8\u30f3\u30c8\u30ed\u30d4\u30fc\u7406\u8ad6\uff09`,
  ].join('\n');
}
