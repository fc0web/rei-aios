/**
 * Rei AIOS — Formation モジュール エクスポート
 * Theme J: 合わせ鏡マルチレイヤー環境
 */

export {
  FormationEngine, BaseFormation,
  FormationType, FormationConfig, FormationPlan,
  FormationStep, FormationRunResult, FormationStatus,
} from './formation-engine';

export { TriangleFormation } from './formations/triangle';
export { DiamondFormation }  from './formations/diamond';
export { InfiniteFormation } from './formations/infinite';
