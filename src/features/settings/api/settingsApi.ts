/**
 * Settings localStorage 读写 + 导入导出清空。
 */
import { getItem, setItem, exportAll, importAll, clearAll } from '../../../shared/api/localStorageClient';
import type { AppSettings } from '../../../shared/types/domain';

const SETTINGS_KEY = 'settings';

const DEFAULT_SETTINGS: AppSettings = {
  apiMode: 'mock',
  apiBaseUrl: '',
};

export function getSettings(): AppSettings {
  return getItem<AppSettings>(SETTINGS_KEY) ?? { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings): void {
  setItem(SETTINGS_KEY, settings);
}

export function exportData(): Record<string, unknown> {
  return exportAll();
}

export function importData(data: Record<string, unknown>): void {
  importAll(data);
}

export function clearData(): void {
  clearAll();
}
