/**
 * Settings localStorage 读写 + 导入导出清空。
 */
import { getItem, setItem, exportAll, importAll, clearAll } from '../../../shared/api/localStorageClient';
import type { AppSettings } from '../../../shared/types/domain';

const SETTINGS_KEY = 'settings';

/**
 * 解析默认数据模式（构建期注入，见 src/vite-env.d.ts / 根目录 .env / .env.production）。
 *
 * - VITE_DEFAULT_API_MODE='remote'：生产部署默认，核心业务数据走后端 REST API → DB。
 * - 其它值 / 未设置：默认 'mock'（localStorage，本地开发 / 离线兜底）。
 *
 * 在 getSettings 内每次解析而非缓存到模块常量：
 * 1. 用户清除 localStorage 后立即按最新默认值恢复；
 * 2. 单测可用 vi.stubEnv 即时切换默认值，无需重新加载模块。
 */
function resolveDefaultApiMode(): AppSettings['apiMode'] {
  return import.meta.env.VITE_DEFAULT_API_MODE === 'remote' ? 'remote' : 'mock';
}

/** 未在 localStorage 配置时的默认设置（apiBaseUrl 留空 = 走同源 /api/v1）。 */
function defaultSettings(): AppSettings {
  return { apiMode: resolveDefaultApiMode(), apiBaseUrl: '' };
}

export function getSettings(): AppSettings {
  return getItem<AppSettings>(SETTINGS_KEY) ?? defaultSettings();
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
