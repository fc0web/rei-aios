export type MirrorMode = 'horizontal' | 'vertical' | 'radial' | 'dimensional';
export type ReflectionDepth = 1 | 2 | 3 | 4 | 5;

export interface MirrorCursorState {
  id: string; label: string; color: string;
  x: number; y: number; state: string; type: string;
  visible: boolean; trail: Array<{ x: number; y: number }>;
}

export type MirrorActionKind =
  | 'click' | 'move' | 'type' | 'scroll' | 'think'
  | 'scene' | 'phi-spiral' | 'zero-expansion' | 'custom';

export interface MirrorActionEvent {
  id: string; agentId: string; kind: MirrorActionKind;
  label: string; x?: number; y?: number;
  timestamp: number; duration?: number;
}

export const MIRROR_IPC = {
  CURSOR_BATCH:    'mirror:cursor-batch',
  ACTION_EVENT:    'mirror:action-event',
  CONFIG_UPDATE:   'mirror:config-update',
  WINDOW_CLOSE:    'mirror:window-close',
  REFLECTION_SYNC: 'mirror:reflection-sync',
  READY:           'mirror:ready',
  CLOSED:          'mirror:closed',
  REQUEST_SYNC:    'mirror:request-sync',
  OPEN_MIRROR:     'mirror:open',
  CLOSE_MIRROR:    'mirror:close',
  SET_MODE:        'mirror:set-mode',
  SET_DEPTH:       'mirror:set-depth',
} as const;

export interface MirrorConfig {
  mode: MirrorMode; depth: ReflectionDepth;
  reflectionOpacityBase: number; reflectionOpacityDecay: number;
  showActionFeed: boolean; showDepthLines: boolean;
  showDFUMTOverlay: boolean; syncIntervalMs: number;
  windowWidth: number; windowHeight: number;
}

export const DEFAULT_MIRROR_CONFIG: MirrorConfig = {
  mode: 'horizontal', depth: 3,
  reflectionOpacityBase: 0.75, reflectionOpacityDecay: 0.55,
  showActionFeed: true, showDepthLines: true,
  showDFUMTOverlay: true, syncIntervalMs: 16,
  windowWidth: 800, windowHeight: 600,
};
