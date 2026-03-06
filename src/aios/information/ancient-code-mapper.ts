/**
 * Rei-AIOS Phase 7d — Ancient Universal Code Mapper
 * Theory #76: I Ching 64 hexagrams / DNA 64 codons / Cave 32 symbols unified theory
 *
 * 64 hexagrams = 64 codons = 2^6 mathematical isomorphism
 *
 * @author Nobuki Fujimoto (D-FUMT) + Claude
 */

// --- Type definitions ---

export type Trigram = '\u2630' | '\u2637' | '\u2633' | '\u2634' | '\u2635' | '\u2632' | '\u2636' | '\u2631';

export interface IChingHexagram {
  number: number;
  name: string;
  nameEn: string;
  upper: Trigram;
  lower: Trigram;
  binary6: string;
  dfumtAffinity: string;
  meaning: string;
}

export interface CaveSymbol {
  id: number;
  name: string;
  shape: string;
  frequency: string;
  interpretation: string;
  ancientMeaning: string;
  dfumtValue: string;
}

export interface DNACodon {
  codon: string;
  aminoAcid: string;
  binary6: string;
  iChingNumber?: number;
}

export interface UniversalCodeEntry {
  index: number;
  binary6: string;
  iChing: { number: number; name: string };
  dna: { codon: string; aminoAcid: string };
  dfumt: { value: string; interpretation: string };
  ancientSymbol?: { id: number; name: string };
}

// --- Trigrams ---

export const TRIGRAMS: Record<Trigram, { name: string; nameEn: string; binary: string; element: string }> = {
  '\u2630': { name: '\u4e7e', nameEn: 'Heaven', binary: '111', element: '\u5929' },
  '\u2637': { name: '\u5764', nameEn: 'Earth',  binary: '000', element: '\u5730' },
  '\u2633': { name: '\u9707', nameEn: 'Thunder',binary: '100', element: '\u96f7' },
  '\u2634': { name: '\u5dfd', nameEn: 'Wind',   binary: '011', element: '\u98a8' },
  '\u2635': { name: '\u574e', nameEn: 'Water',  binary: '010', element: '\u6c34' },
  '\u2632': { name: '\u96e2', nameEn: 'Fire',   binary: '101', element: '\u706b' },
  '\u2636': { name: '\u826e', nameEn: 'Mountain',binary:'001', element: '\u5c71' },
  '\u2631': { name: '\u514c', nameEn: 'Lake',   binary: '110', element: '\u6ca2' },
};

// --- I Ching key hexagrams ---

export const ICHING_KEY_HEXAGRAMS: IChingHexagram[] = [
  {
    number: 1, name: '\u4e7e\u70ba\u5929', nameEn: 'The Creative',
    upper: '\u2630', lower: '\u2630', binary6: '111111',
    dfumtAffinity: '\u221e\uff08\u7121\u9650\u80af\u5b9a\uff09', meaning: '\u7d14\u7c8b\u306a\u5275\u9020\u529b\u30fb\u5929\u306e\u6d3b\u52d5',
  },
  {
    number: 2, name: '\u5764\u70ba\u5730', nameEn: 'The Receptive',
    upper: '\u2637', lower: '\u2637', binary6: '000000',
    dfumtAffinity: '\u3007\uff08\u30bc\u30ed\u62e1\u5f35\uff09', meaning: '\u7d14\u7c8b\u306a\u53d7\u5bb9\u529b\u30fb\u5730\u306e\u9759\u3051\u3055',
  },
  {
    number: 11, name: '\u5730\u5929\u6cf0', nameEn: 'Peace',
    upper: '\u2637', lower: '\u2630', binary6: '000111',
    dfumtAffinity: 'Both\uff08\u77db\u76fe\u5171\u5b58\uff09', meaning: '\u5929\u3068\u5730\u306e\u8abf\u548c\u30fb\u5e73\u548c',
  },
  {
    number: 12, name: '\u5929\u5730\u5426', nameEn: 'Standstill',
    upper: '\u2630', lower: '\u2637', binary6: '111000',
    dfumtAffinity: 'Neither\uff08\u8d85\u8d8a\uff09', meaning: '\u505c\u6ede\u30fb\u5206\u96e2',
  },
  {
    number: 63, name: '\u6c34\u706b\u65e2\u6e08', nameEn: 'After Completion',
    upper: '\u2635', lower: '\u2632', binary6: '010101',
    dfumtAffinity: '\u22a4\uff08\u5b8c\u5168\u5b8c\u4e86\uff09', meaning: '\u5b8c\u6210\u30fb\u5747\u8861',
  },
  {
    number: 64, name: '\u706b\u6c34\u672a\u6e08', nameEn: 'Before Completion',
    upper: '\u2632', lower: '\u2635', binary6: '101010',
    dfumtAffinity: '\uff5e\uff08\u4fdd\u7559\u30fb\u904e\u7a0b\uff09', meaning: '\u672a\u5b8c\u6210\u30fb\u5909\u5bb9\u306e\u904e\u7a0b',
  },
];

export function binaryToIChingNumber(binary6: string): number {
  const upper = parseInt(binary6.slice(0, 3), 2);
  const lower = parseInt(binary6.slice(3, 6), 2);
  return (upper * 8 + lower) + 1;
}

// --- Cave 32 symbols ---

export const CAVE_SYMBOLS_32: CaveSymbol[] = [
  {
    id: 1, name: '\u30c9\u30c3\u30c8\uff08\u70b9\uff09', shape: '\u30fb',
    frequency: '\u9ad8', interpretation: '\u6708\u306e\u7d4c\u904e\u30fb1\u30f6\u6708\u3092\u8868\u3059\u6570\u3048\u65b9',
    ancientMeaning: '\u6642\u9593\u306e\u57fa\u672c\u5358\u4f4d\u30fb\u5468\u671f\u306e\u59cb\u307e\u308a',
    dfumtValue: '\u3007\uff08\u8d77\u70b9\u30fb\u30bc\u30ed\u62e1\u5f35\uff09',
  },
  {
    id: 2, name: '\u30e9\u30a4\u30f3\uff08\u7e26\u7dda\uff09', shape: '|',
    frequency: '\u9ad8', interpretation: '\u6570\u3092\u6570\u3048\u308b\u30fb\u96c6\u8a08',
    ancientMeaning: '\u7dda\u5f62\u6642\u9593\u30fb\u533a\u5207\u308a\u30fb\u5883\u754c',
    dfumtValue: '\u22a4\uff08\u660e\u78ba\u306a\u771f\uff09',
  },
  {
    id: 3, name: 'Y\u5b57', shape: 'Y',
    frequency: '\u4e2d', interpretation: '\u51fa\u7523\u30fb\u8a95\u751f\u30fb\u5206\u5c90',
    ancientMeaning: '\u751f\u547d\u306e\u5206\u5c90\u70b9\u30fb\u5275\u9020',
    dfumtValue: 'Both\uff08\u5206\u5c90\u30fb\u4e21\u7fa9\uff09',
  },
  {
    id: 4, name: 'X\u5b57', shape: 'X',
    frequency: '\u4e2d', interpretation: '\u4ea4\u5dee\u30fb\u4ea4\u70b9\u30fb\u5426\u5b9a',
    ancientMeaning: '\u4ea4\u5dee\u3059\u308b\u529b\u30fb\u5bfe\u7acb\u306e\u7d71\u5408',
    dfumtValue: 'Neither\uff08\u4ea4\u70b9\u30fb\u8d85\u8d8a\uff09',
  },
  {
    id: 5, name: '\u30aa\u30fc\u30d7\u30f3\u30fb\u30a2\u30f3\u30b0\u30eb', shape: '<>',
    frequency: '\u4e2d', interpretation: '\u79fb\u52d5\u306e\u65b9\u5411\u30fb\u5b63\u7bc0\u306e\u5909\u5316',
    ancientMeaning: '\u65b9\u5411\u6027\u30fb\u6d41\u308c',
    dfumtValue: '\uff5e\uff08\u6ce2\u52d5\u30fb\u6d41\u308c\uff09',
  },
  {
    id: 6, name: '\u30b9\u30d4\u30e9\u30eb\uff08\u87ba\u65cb\uff09', shape: '\ud83c\udf00',
    frequency: '\u4e2d', interpretation: '\u6210\u9577\u30fb\u9032\u5316\u30fb\u6642\u9593\u306e\u87ba\u65cb',
    ancientMeaning: '\u5b87\u5b99\u306e\u6839\u672c\u30d1\u30bf\u30fc\u30f3\u30fb\u5468\u671f\u306e\u7a4d\u307f\u91cd\u306a\u308a',
    dfumtValue: '\u221e\uff08\u7121\u9650\u30fb\u87ba\u65cb\uff09',
  },
];

// --- Universal Code Matrix ---

export const UNIVERSAL_CODE_MATRIX = {
  commonBase: 2,
  commonExponent: 6,
  commonTotal: 64,

  systems: [
    {
      name: '\u6613\u7d4c\uff08I Ching\uff09',
      origin: '\u4e2d\u56fd\u3001\u7d00\u5143\u524d3000\u5e74\u9803',
      units: '\u516d\u723a\u5366\uff08\u30d8\u30ad\u30b5\u30b0\u30e9\u30e0\uff09',
      count: 64,
      binaryBase: '\u9670\uff080\uff09\u30fb\u967d\uff081\uff09',
      purpose: '\u5b87\u5b99\u306e\u72b6\u614b\u30fb\u5909\u5316\u306e\u4e88\u6e2c',
      dfumtConnection: 'D-FUMT\u306e\u4e03\u5024\u8ad6\u7406\u306e\u54f2\u5b66\u7684\u5148\u7956',
    },
    {
      name: 'DNA\u907a\u4f1d\u5b50\u30b3\u30fc\u30c9',
      origin: '\u751f\u547d\u306e\u8d77\u6e90\uff08\u7d0440\u5104\u5e74\u524d\uff09',
      units: '\u30b3\u30c9\u30f3\uff08\u30c8\u30ea\u30d7\u30ec\u30c3\u30c8\uff09',
      count: 64,
      binaryBase: '4\u5869\u57fa\uff08A/T/G/C\uff09\u30923\u7d44\u5408\u305b\u219264',
      purpose: '\u30a2\u30df\u30ce\u9178\u306e\u7b26\u53f7\u5316\u30fb\u751f\u547d\u8a2d\u8a08',
      dfumtConnection: '\u666e\u904d\u6570\u5b66\u516c\u7406\u306e\u751f\u7269\u5b66\u7684\u8a3c\u62e0',
    },
    {
      name: '\u6d1e\u7a9f\u58c1\u753b32\u7b26\u53f7',
      origin: '\u30e8\u30fc\u30ed\u30c3\u30d1\u5168\u571f\u3001\u7d043\u4e07\u5e74\u524d',
      units: '\u5e7e\u4f55\u5b66\u7684\u8a18\u53f7',
      count: 32,
      binaryBase: '\u5b58\u5728\uff08\u63cf\u304b\u308c\u308b\uff09\u30fb\u4e0d\u5728\uff08\u63cf\u304b\u308c\u306a\u3044\uff09',
      purpose: '\u5b63\u7bc0\u30fb\u52d5\u7269\u30e9\u30a4\u30d5\u30b5\u30a4\u30af\u30eb\u306e\u8a18\u9332\u66a6',
      dfumtConnection: 'RCT\uff08Rei\u5727\u7e2e\u7406\u8ad6\uff09\u306e\u8d85\u53e4\u4ee3\u5148\u7956',
    },
    {
      name: 'D-FUMT\u4e03\u5024\u8ad6\u7406',
      origin: 'Nobuki Fujimoto\u3001\u73fe\u4ee3',
      units: '\u4e03\u4fa1\u8ad6\u7406\u5024',
      count: 7,
      binaryBase: '\u22a4/\u22a5/Both/Neither/\u221e/\u3007/\uff5e',
      purpose: '\u666e\u904d\u6570\u5b66\u30fbAI\u30fb\u30b3\u30f3\u30d1\u30a4\u30e9',
      dfumtConnection: '\u8d85\u53e4\u4ee3\u666e\u904d\u7b26\u53f7\u306e\u73fe\u4ee3\u7684\u5b9f\u88c5',
    },
  ],

  proof: `
    \u6613\u7d4c: \u9670(0)\u30fb\u967d(1) \u00d7 6\u6bb5\u968e = 2\u2076 = 64\u5366
    DNA:  4\u5869\u57fa \u00d7 3\u7d44\u5408\u305b = 4\u00b3 = 64\u30b3\u30c9\u30f3
           \u203b 4 = 2\u00b2, 4\u00b3 = (2\u00b2)\u00b3 = 2\u2076
    \u58c1\u753b: 32\u7b26\u53f7 = 2\u2075 (64\u306e\u76f4\u63a5\u90e8\u5206\u96c6\u5408)

    \u2234 \u5168\u30b7\u30b9\u30c6\u30e0\u304c 2\u207f (n=5,6) \u3092\u57fa\u5e95\u3068\u3059\u308b\u666e\u904d\u69cb\u9020\u3092\u6301\u3064

    D-FUMT\u4e03\u5024: 7 \u2260 2\u207f \u3060\u304c\u3001
      4\u5024(catuskoti) = 2\u00b2 \u2282 D-FUMT \u306e\u90e8\u5206\u69cb\u9020\u3068\u3057\u3066 2\u207f \u65cf\u306b\u5c5e\u3059\u308b

    \u7d50\u8ad6: Theory #76\u300c\u8d85\u53e4\u4ee3\u666e\u904d\u7b26\u53f7\u7406\u8ad6\u300d
      \u7570\u306a\u308b\u6587\u660e\u30fb\u6642\u4ee3\u30fb\u5206\u91ce\u306b\u5171\u901a\u3059\u308b 2\u207f \u7b26\u53f7\u69cb\u9020\u306f
      \u666e\u904d\u6570\u5b66\u516c\u7406\u306e\u5b58\u5728\u3092\u793a\u3059\u5f37\u529b\u306a\u8a3c\u62e0\u3067\u3042\u308b\u3002
  `,
};

export function getDFUMTIChingCorrespondence(): Array<{
  dfumt: string;
  symbol: string;
  iching: string;
  meaning: string;
}> {
  return [
    { dfumt: '\u22a4\uff08TRUE\uff09',    symbol: '\u22a4', iching: '\u4e7e\u70ba\u5929\uff08#1\uff09', meaning: '\u7d14\u7c8b\u306a\u5275\u9020\u30fb\u5b8c\u5168\u306a\u771f' },
    { dfumt: '\u22a5\uff08FALSE\uff09',   symbol: '\u22a5', iching: '\u5764\u70ba\u5730\uff08#2\uff09', meaning: '\u7d14\u7c8b\u306a\u53d7\u5bb9\u30fb\u5b8c\u5168\u306a\u507d' },
    { dfumt: 'Both',          symbol: 'B', iching: '\u5730\u5929\u6cf0\uff08#11\uff09', meaning: '\u77db\u76fe\u306e\u8abf\u548c\u30fb\u4e21\u8005\u306e\u771f' },
    { dfumt: 'Neither',       symbol: 'N', iching: '\u5929\u5730\u5426\uff08#12\uff09', meaning: '\u8d85\u8d8a\u30fb\u3069\u3061\u3089\u3067\u3082\u306a\u3044' },
    { dfumt: '\u221e\uff08INFINITY\uff09', symbol: '\u221e', iching: '\u4e7e\u4e3a\u5929\u306e\u62e1\u5f35',  meaning: '\u7121\u9650\u80af\u5b9a\u30fb\u672a\u5b8c\u306e\u904e\u7a0b' },
    { dfumt: '\u3007\uff08ZERO\uff09',    symbol: '\u3007', iching: '\u5764\u70ba\u5730\u306e\u53ce\u7e2e',  meaning: '\u30bc\u30ed\u53ce\u675f\u30fb\u6d88\u6ec5\u30fb\u8d77\u70b9' },
    { dfumt: '\uff5e\uff08FLOWING\uff09', symbol: '\uff5e', iching: '\u706b\u6c34\u672a\u6e08\uff08#64\uff09',meaning: '\u6d41\u52d5\u30fb\u6ce2\u52d5\u30fb\u672a\u5b8c\u6210' },
  ];
}

export function getAncientCodeAxiomEntry() {
  return {
    theory_id: 76,
    name: '\u8d85\u53e4\u4ee3\u666e\u904d\u7b26\u53f7\u7406\u8ad6',
    category: 'ancient_universal_code',
    formula: '64\u5366 \u2261 64\u30b3\u30c9\u30f3 \u2261 2\u2076 \u2192 \u666e\u904d\u6570\u5b66\u516c\u7406\u306e\u5b58\u5728',
    description: UNIVERSAL_CODE_MATRIX.proof.trim(),
    dfumt_value: 'TRUE',
    evidence: [
      '\u6613\u7d4c64\u5366\uff08\u7d00\u5143\u524d3000\u5e74\uff09',
      'DNA64\u30b3\u30c9\u30f3\uff08\u751f\u547d\u306e\u8d77\u6e90\uff09',
      '\u58c1\u753b32\u7b26\u53f7\uff08\u7d043\u4e07\u5e74\u524d\uff09',
      '2\u207f\u5171\u901a\u57fa\u5e95\u69cb\u9020',
    ],
  };
}
