import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWatchlist,
  addWatchlistItem,
  updateWatchlistItem,
  setWatchlistEnabled,
} from '../api/watchlistApi';

beforeEach(() => {
  localStorage.clear();
});

describe('watchlistApi', () => {
  it('新增自选股', () => {
    const item = addWatchlistItem({ symbol: '300750', name: '宁德时代' });
    expect(item.symbol).toBe('300750');
    expect(item.name).toBe('宁德时代');
    expect(item.enabled).toBe(true);
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeTruthy();
  });

  it('股票代码自动转大写并 trim', () => {
    const item = addWatchlistItem({ symbol: '  600519  ', name: '贵州茅台' });
    expect(item.symbol).toBe('600519');
  });

  it('更新自选股', () => {
    const item = addWatchlistItem({ symbol: '300750', name: '宁德时代' });
    const updated = updateWatchlistItem(item.id, { name: '宁德时代-更新', watchReason: '看好新能源' });
    expect(updated?.name).toBe('宁德时代-更新');
    expect(updated?.watchReason).toBe('看好新能源');
  });

  it('更新不存在的 id 返回 null', () => {
    const result = updateWatchlistItem('non-existent', { name: 'test' });
    expect(result).toBeNull();
  });

  it('停用自选股', () => {
    const item = addWatchlistItem({ symbol: '300750', name: '宁德时代' });
    const disabled = setWatchlistEnabled(item.id, false);
    expect(disabled?.enabled).toBe(false);
  });

  it('停用后重新启用', () => {
    const item = addWatchlistItem({ symbol: '300750', name: '宁德时代' });
    setWatchlistEnabled(item.id, false);
    const enabled = setWatchlistEnabled(item.id, true);
    expect(enabled?.enabled).toBe(true);
  });

  it('getWatchlist 返回所有条目', () => {
    addWatchlistItem({ symbol: '300750', name: '宁德时代' });
    addWatchlistItem({ symbol: '600519', name: '贵州茅台' });
    const list = getWatchlist();
    expect(list).toHaveLength(2);
  });
});
