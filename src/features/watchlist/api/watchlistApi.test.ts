import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWatchlist,
  addWatchlistItem,
  updateWatchlistItem,
  setWatchlistEnabled,
  getWatchlistItemById,
} from '../api/watchlistApi';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';

beforeEach(() => {
  clearAll();
  // 锁定 mock 模式，避免受其它用例的 settings 污染。
  saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
});

describe('watchlistApi (mock)', () => {
  it('新增自选股', async () => {
    const item = await addWatchlistItem({ symbol: '300750', name: '宁德时代' });
    expect(item.symbol).toBe('300750');
    expect(item.name).toBe('宁德时代');
    expect(item.enabled).toBe(true);
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeTruthy();
  });

  it('股票代码自动转大写并 trim', async () => {
    const item = await addWatchlistItem({ symbol: '  600519  ', name: '贵州茅台' });
    expect(item.symbol).toBe('600519');
  });

  it('更新自选股', async () => {
    const item = await addWatchlistItem({ symbol: '300750', name: '宁德时代' });
    const updated = await updateWatchlistItem(item.id, {
      name: '宁德时代-更新',
      watchReason: '看好新能源',
    });
    expect(updated?.name).toBe('宁德时代-更新');
    expect(updated?.watchReason).toBe('看好新能源');
  });

  it('更新不存在的 id 返回 null', async () => {
    const result = await updateWatchlistItem('non-existent', { name: 'test' });
    expect(result).toBeNull();
  });

  it('停用自选股', async () => {
    const item = await addWatchlistItem({ symbol: '300750', name: '宁德时代' });
    const disabled = await setWatchlistEnabled(item.id, false);
    expect(disabled?.enabled).toBe(false);
  });

  it('停用后重新启用', async () => {
    const item = await addWatchlistItem({ symbol: '300750', name: '宁德时代' });
    await setWatchlistEnabled(item.id, false);
    const enabled = await setWatchlistEnabled(item.id, true);
    expect(enabled?.enabled).toBe(true);
  });

  it('getWatchlist 返回所有条目', async () => {
    await addWatchlistItem({ symbol: '300750', name: '宁德时代' });
    await addWatchlistItem({ symbol: '600519', name: '贵州茅台' });
    const list = await getWatchlist();
    expect(list).toHaveLength(2);
  });

  it('getWatchlistItemById 命中返回条目，未命中返回 null', async () => {
    const item = await addWatchlistItem({ symbol: '300750', name: '宁德时代' });
    const hit = await getWatchlistItemById(item.id);
    const miss = await getWatchlistItemById('not-exist');
    expect(hit?.id).toBe(item.id);
    expect(miss).toBeNull();
  });

  it('getWatchlist 空数据返回空数组', async () => {
    const list = await getWatchlist();
    expect(list).toEqual([]);
  });
});
