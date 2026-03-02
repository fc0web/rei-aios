/**
 * Rei-AIOS — ローカルLLM統合エントリーポイント (index.ts)
 * Phase 2 実装
 *
 * 使用例:
 *   import { getModelManager, quickLoadLocalLLM } from './local-llm';
 *
 *   // 推奨モデルを自動ダウンロード＆ロード
 *   const adapter = await quickLoadLocalLLM();
 *   const res = await adapter.complete({ messages: [{ role: 'user', content: 'こんにちは' }] });
 */

export * from './local-llm-adapter';
export * from './model-manager';

import { ModelManager, getModelManager } from './model-manager';
import { LocalLLMAdapter } from './local-llm-adapter';

// ============================================================
// クイックスタート関数
// ============================================================

/**
 * 推奨モデルを自動選択してロードする
 * モデル未ダウンロードの場合は自動でダウンロードから開始
 *
 * @param onProgress ダウンロード進捗のコールバック（省略可）
 */
export async function quickLoadLocalLLM(
  onProgress?: (pct: number, speedMBps: number, etaSec: number) => void,
): Promise<LocalLLMAdapter> {
  const manager = getModelManager();

  // システムに合ったモデルを自動選択
  const compatible = manager.getCompatiblePresets();
  const preset = compatible.find(p => p.recommended) ?? compatible[0];

  if (!preset) {
    throw new Error('利用可能なモデルがありません。RAMを確認してください。');
  }

  // 進捗コールバックを登録
  if (onProgress) {
    manager.on('downloadProgress', (ev) => {
      onProgress(ev.percentage, ev.speedMBps, ev.etaSeconds);
    });
  }

  console.log(`[LocalLLM] 選択モデル: ${preset.name} (${preset.sizeGB}GB)`);
  const sysInfo = manager.getSystemInfo();
  console.log(`[LocalLLM] システム: RAM ${sysInfo.freeRamGB}GB空き / ${sysInfo.totalRamGB}GB`);

  return manager.loadModel(preset.id);
}

/**
 * ローカルLLMをLLMManagerに統合するためのプロバイダー設定を生成
 * LLMManager.addCustomProvider() に渡して使う
 */
export function createLocalLLMProviderConfig(modelPath: string) {
  return {
    id: 'local',
    name: 'ローカルAI（オフライン）',
    type: 'ollama' as const,  // 既存typeを流用（ローカル通信なし）
    baseUrl: modelPath,        // モデルパスをbaseUrlとして使用
    defaultModel: 'local',
    availableModels: ['local'],
    maxTokens: 512,
  };
}

/**
 * システム情報を表示するユーティリティ
 * セットアップ確認用
 */
export function printLocalLLMSystemInfo(): void {
  const manager = getModelManager();
  const info = manager.getSystemInfo();
  const presets = manager.getPresets();

  console.log('\n=== Rei-AIOS ローカルAI システム情報 ===');
  console.log(`RAM: ${info.freeRamGB}GB 空き / ${info.totalRamGB}GB`);
  console.log(`モデル保存先: ${info.modelsDir}`);
  console.log(`ディスク使用量: ${info.diskUsageGB}GB`);
  console.log(`\n利用可能なモデル (${info.compatibleModels}個):`);

  for (const preset of presets) {
    const compatible = preset.minRamGB <= info.totalRamGB * 0.7;
    const status = preset.state === 'downloaded' ? '✅ ダウンロード済'
      : preset.state === 'loaded'     ? '🟢 常駐中'
      : preset.state === 'downloading' ? '⏬ DL中...'
      : compatible                    ? '⬜ 未ダウンロード'
      : '❌ RAM不足';

    console.log(`  ${status} ${preset.name} (${preset.sizeGB}GB, RAM${preset.minRamGB}GB以上) — ${preset.specialty}`);
  }
  console.log('=========================================\n');
}
