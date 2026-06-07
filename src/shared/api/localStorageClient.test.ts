import { describe, it, expect, beforeEach } from 'vitest';
import {
  getItem,
  setItem,
  removeItem,
  getAllKeys,
  clearAll,
  exportAll,
  importAll,
} from './localStorageClient';

beforeEach(() => {
  localStorage.clear();
});

describe('localStorageClient', () => {
  it('setItem + getItem 正常读写', () => {
    setItem('test', { a: 1 });
    const result = getItem<{ a: number }>('test');
    expect(result).toEqual({ a: 1 });
  });

  it('getItem 不存在返回 null', () => {
    expect(getItem('not-exist')).toBeNull();
  });

  it('getItem 解析失败返回 null', () => {
    localStorage.setItem('qta:bad', 'not-json');
    expect(getItem('bad')).toBeNull();
  });

  it('removeItem 删除后 getItem 返回 null', () => {
    setItem('del', 'value');
    expect(getItem('del')).toBe('value');
    removeItem('del');
    expect(getItem('del')).toBeNull();
  });

  it('getAllKeys 只返回 qta: 前缀的 key', () => {
    setItem('watchlist', []);
    setItem('settings', {});
    localStorage.setItem('other-key', 'value');
    const keys = getAllKeys();
    expect(keys).toContain('watchlist');
    expect(keys).toContain('settings');
    expect(keys).not.toContain('other-key');
  });

  it('clearAll 只清除 qta: 前缀', () => {
    setItem('watchlist', []);
    localStorage.setItem('other-key', 'value');
    clearAll();
    expect(getItem('watchlist')).toBeNull();
    expect(localStorage.getItem('other-key')).toBe('value');
    localStorage.removeItem('other-key');
  });

  it('exportAll 导出带前缀的 key', () => {
    setItem('watchlist', [1, 2]);
    setItem('settings', { mode: 'mock' });
    const exported = exportAll();
    expect(exported['qta:watchlist']).toEqual([1, 2]);
    expect(exported['qta:settings']).toEqual({ mode: 'mock' });
  });

  it('importAll 导入数据', () => {
    importAll({
      'qta:watchlist': [{ id: '1', symbol: 'TEST' }],
      'qta:settings': { apiMode: 'remote' },
    });
    expect(getItem('watchlist')).toEqual([{ id: '1', symbol: 'TEST' }]);
    expect(getItem('settings')).toEqual({ apiMode: 'remote' });
  });
});
