/**
 * Rei-AIOS Phase 7a — D-FUMT Seven-valued Task State Types
 *
 * Extends existing TaskStatus ('pending'|'running'|'done'|'failed'|'skipped')
 * with D-FUMT seven-valued logic.
 */

import { AlienPersonaId } from '../aios/historians/alien-intelligence-personas';

/** D-FUMT seven-valued task state */
export type DFUMTTaskState =
  | '\u22a4'        // TRUE - complete
  | '\u22a5'        // FALSE - failed
  | 'Both'     // completed AND failed (contradiction coexistence)
  | 'Neither'  // transcendent state (undefinable)
  | '\u221e'        // infinite progress (INFINITY)
  | '\u3007'       // annihilation/cancel (ZERO)
  | '\uff5e';      // pending/superposition (FLOWING)

export interface DFUMTTask {
  id: string;
  title: string;
  description?: string;
  state: DFUMTTaskState;
  personaId?: AlienPersonaId;
  depth: number;           // subterranean depth (importance 0-10)
  dimension: number;       // extradimensional dimension count
  period?: number;         // ancient period (days)
  probability: number;     // alien probability amplitude (0.0-1.0)
  theoryRef?: number;      // related D-FUMT theory ID
  stateHistory: DFUMTStateTransition[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DFUMTStateTransition {
  from: DFUMTTaskState;
  to: DFUMTTaskState;
  reason?: string;
  personaId?: AlienPersonaId;
  timestamp: Date;
}

export interface DFUMTTaskEvaluation {
  taskId: string;
  state: DFUMTTaskState;
  personaEvaluation: Partial<Record<AlienPersonaId, string>>;
  dimensionalAnalysis: {
    dimension4: boolean;
    dimension5: boolean;
    dimensionN: boolean;
  };
  infiniteEvaluation: string;
}

/** State transition rules */
export const DFUMT_STATE_TRANSITIONS: Record<DFUMTTaskState, DFUMTTaskState[]> = {
  '\uff5e': ['\u221e', '\u3007'],
  '\u221e': ['\u22a4', '\u22a5', 'Both', 'Neither', '\u3007'],
  '\u22a4': [],
  '\u22a5': ['\u221e', '\u3007'],
  'Both': ['\u22a4', '\u22a5', '\u3007'],
  'Neither': ['\u22a4', '\u3007'],
  '\u3007': [],
};

export const DFUMT_STATE_LABELS: Record<DFUMTTaskState, string> = {
  '\u22a4': '\u5b8c\u5168\u5b8c\u4e86\uff08TRUE\uff09',
  '\u22a5': '\u5b8c\u5168\u5931\u6557\uff08FALSE\uff09',
  'Both': '\u77db\u76fe\u5171\u5b58\uff08BOTH\uff09\u2014\u2014\u5b8c\u4e86\u304b\u3064\u5931\u6557',
  'Neither': '\u8d85\u8d8a\u72b6\u614b\uff08NEITHER\uff09\u2014\u2014\u5b9a\u7fa9\u4e0d\u80fd',
  '\u221e': '\u7121\u9650\u9032\u884c\u4e2d\uff08INFINITY\uff09',
  '\u3007': '\u6d88\u6ec5\uff08ZERO\uff09',
  '\uff5e': '\u4fdd\u7559\u30fb\u91cd\u306d\u5408\u308f\u305b\uff08FLOWING\uff09',
};
