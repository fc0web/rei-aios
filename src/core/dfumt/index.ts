// ============================================================
// index.ts — D-FUMT コアエクスポート
//
// Rei-AIOS の公理層として機能する。
// constants.ts と universal-extension.ts を統合して公開する。
// ============================================================

export * from './constants';
export * from './universal-extension';

// 便利なファクトリ関数
export { universalExt as dfumt } from './universal-extension';
