import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getSettings, saveSettings, exportData, importData, clearData } from './settingsApi';
import { clearAll, getItem } from '../../../shared/api/localStorageClient';

beforeEach(() => {
  clearAll();
});

describe('settingsApi', () => {
  it('未配置时返回默认设置，apiBaseUrl 为空（默认走同源 /api/v1）', () => {
    const settings = getSettings();
    expect(settings.apiMode).toBe('mock');
    expect(settings.apiBaseUrl).toBe('');
  });

  it('saveSettings 后 getSettings 返回保存的值', () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: 'http://localhost:8080' });
    const settings = getSettings();
    expect(settings.apiMode).toBe('remote');
    expect(settings.apiBaseUrl).toBe('http://localhost:8080');
  });

  it('apiBaseUrl 显式保存为空后仍为空', () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    expect(getSettings().apiBaseUrl).toBe('');
  });

  it('exportData / importData / clearData 透传 localStorageClient', () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: 'http://x:8080' });
    const exported = exportData();
    expect(exported['qta:settings']).toBeDefined();

    clearAll();
    importData(exported);
    expect(getSettings().apiBaseUrl).toBe('http://x:8080');

    clearData();
    expect(getItem('settings')).toBeNull();
  });

  describe('默认数据模式 (VITE_DEFAULT_API_MODE)', () => {
    const original = import.meta.env.VITE_DEFAULT_API_MODE;

    afterEach(() => {
      vi.stubEnv('VITE_DEFAULT_API_MODE', original);
    });

    it('VITE_DEFAULT_API_MODE=remote 时未配置默认 remote', () => {
      vi.stubEnv('VITE_DEFAULT_API_MODE', 'remote');
      expect(getSettings().apiMode).toBe('remote');
    });

    it('VITE_DEFAULT_API_MODE 为非法值时收敛为 mock', () => {
      vi.stubEnv('VITE_DEFAULT_API_MODE', 'something-invalid');
      expect(getSettings().apiMode).toBe('mock');
    });

    it('VITE_DEFAULT_API_MODE 未设置时默认 mock', () => {
      vi.stubEnv('VITE_DEFAULT_API_MODE', undefined);
      expect(getSettings().apiMode).toBe('mock');
    });

    it('env 默认值不覆盖用户已保存的设置', () => {
      // 用户在设置页显式保存 mock 时，优先于 env 默认值 remote。
      vi.stubEnv('VITE_DEFAULT_API_MODE', 'remote');
      saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
      expect(getSettings().apiMode).toBe('mock');
    });
  });
});
