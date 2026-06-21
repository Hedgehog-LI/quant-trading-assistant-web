import { describe, it, expect, beforeEach } from 'vitest';
import { getSettings, saveSettings, exportData, importData, clearData } from './settingsApi';
import { getItem } from '../../../shared/api/localStorageClient';

beforeEach(() => {
  localStorage.clear();
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

    localStorage.clear();
    importData(exported);
    expect(getSettings().apiBaseUrl).toBe('http://x:8080');

    clearData();
    expect(getItem('settings')).toBeNull();
  });
});
