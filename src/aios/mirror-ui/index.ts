export * from './types';
export { MirrorUI }            from './mirror-ui';
export { MirrorWindowManager } from './mirror-window';

import { MirrorUI } from './mirror-ui';
import type { MirrorConfig } from './types';

let _instance: MirrorUI | null = null;
export const getMirrorUI = (): MirrorUI | null => _instance;

export async function initMirrorUI(
  layer: ConstructorParameters<typeof MirrorUI>[0],
  autoOpen = false,
  config?: Partial<MirrorConfig>,
): Promise<MirrorUI> {
  _instance = new MirrorUI(layer);
  if (autoOpen) await _instance.open(config);
  return _instance;
}
