/**
 * watchlistApi remote 分支单测。
 *
 * 用 vi.mock 拦截 shared/api/client，断言各 remote 实现正确解包 ApiResponse，
 * 以及 success=false 时抛错。vi.mock 必须在文件顶层，vi.fn 在 beforeEach 重置。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// 必须在 import api 之前 mock，否则拦截不到。
vi.mock('../../../shared/api/client', () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

import {
  getWatchlist,
  addWatchlistItem,
  updateWatchlistItem,
  deleteWatchlistItem,
} from './watchlistApi';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';
import { client } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import type { WatchlistItem } from '../../../shared/types/domain';

function ok<T>(data: T): { data: ApiResponse<T> } {
  return { data: { success: true, code: 'SUCCESS', message: null, data, timestamp: '' } };
}

function fail(message: string): { data: ApiResponse<unknown> } {
  return { data: { success: false, code: 'BIZ_ERROR', message, data: null, timestamp: '' } };
}

beforeEach(() => {
  clearAll();
  // 锁定 remote 模式，确保走 remoteApi 分支。
  saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
  vi.mocked(client.get).mockReset();
  vi.mocked(client.post).mockReset();
  vi.mocked(client.put).mockReset();
  vi.mocked(client.delete).mockReset();
  vi.mocked(client.patch).mockReset();
});

describe('watchlistApi (remote)', () => {
  it('getWatchlist 解包数组', async () => {
    const list: WatchlistItem[] = [
      {
        symbol: '300750',
        name: '宁德时代',
        id: '1',
        enabled: true,
        createdAt: '',
        updatedAt: '',
      },
    ];
    vi.mocked(client.get).mockResolvedValue(ok(list));
    const result = await getWatchlist();
    expect(result).toEqual(list);
    expect(client.get).toHaveBeenCalledWith('/watchlist');
  });

  it('addWatchlistItem 解包新建项并规范化 symbol', async () => {
    const created: WatchlistItem = {
      symbol: '300750',
      name: '宁德时代',
      id: '2',
      enabled: true,
      createdAt: '',
      updatedAt: '',
    };
    vi.mocked(client.post).mockResolvedValue(ok(created));
    const result = await addWatchlistItem({ symbol: ' 300750 ', name: '宁德时代' });
    expect(result.id).toBe('2');
    // 传给后端的 body 应已规范化为大写。
    expect(client.post).toHaveBeenCalledWith('/watchlist', {
      symbol: '300750',
      name: '宁德时代',
    });
  });

  it('updateWatchlistItem 先 GET 后 PUT 合并', async () => {
    const existing: WatchlistItem = {
      symbol: '300750',
      name: '宁德时代',
      id: '3',
      enabled: true,
      supportPrice: 100,
      createdAt: '',
      updatedAt: '',
    };
    vi.mocked(client.get).mockResolvedValue(ok(existing));
    vi.mocked(client.put).mockResolvedValue(ok({ ...existing, supportPrice: 120 }));
    const result = await updateWatchlistItem('3', { supportPrice: 120 });
    expect(result?.supportPrice).toBe(120);
    expect(client.put).toHaveBeenCalled();
  });

  it('业务失败 success=false 抛错', async () => {
    vi.mocked(client.get).mockResolvedValue(fail('RESOURCE_NOT_FOUND'));
    await expect(getWatchlist()).rejects.toThrow('RESOURCE_NOT_FOUND');
  });

  it('deleteWatchlistItem 用 unwrapVoid，data=null 不抛错', async () => {
    // DELETE 的 data 合法为 null，unwrapVoid 只检查 success。
    vi.mocked(client.delete).mockResolvedValue(ok(null as unknown as WatchlistItem));
    await expect(deleteWatchlistItem('1')).resolves.toBeUndefined();
    expect(client.delete).toHaveBeenCalledWith('/watchlist/1');
  });

  it('deleteWatchlistItem 业务失败抛错', async () => {
    vi.mocked(client.delete).mockResolvedValue(fail('RESOURCE_NOT_FOUND'));
    await expect(deleteWatchlistItem('1')).rejects.toThrow('RESOURCE_NOT_FOUND');
  });
});
