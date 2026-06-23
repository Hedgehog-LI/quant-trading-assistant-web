/**
 * tradePlanApi remote 分支单测。
 *
 * 用 vi.mock 拦截 shared/api/client，断言各 remote 实现正确解包 ApiResponse，
 * 以及 success=false 时抛错。vi.mock 必须在文件顶层，vi.fn 在 beforeEach 重置。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  getTradePlans,
  addTradePlan,
  updateTradePlan,
  getTradePlanById,
  deleteTradePlan,
} from './tradePlanApi';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';
import { client } from '../../../shared/api/client';
import type { TradePlan } from '../../../shared/types/domain';
import type { ApiResponse } from '../../../shared/api/types';

function ok<T>(data: T): { data: ApiResponse<T> } {
  return { data: { success: true, code: 'SUCCESS', message: null, data, timestamp: '' } };
}

function fail(message: string): { data: ApiResponse<unknown> } {
  return { data: { success: false, code: 'BIZ_ERROR', message, data: null, timestamp: '' } };
}

beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
  vi.mocked(client.get).mockReset();
  vi.mocked(client.post).mockReset();
  vi.mocked(client.put).mockReset();
  vi.mocked(client.delete).mockReset();
  vi.mocked(client.patch).mockReset();
});

describe('tradePlanApi (remote)', () => {
  it('getTradePlans 解包数组', async () => {
    const list: TradePlan[] = [
      {
        id: '1',
        planDate: '2026-06-08',
        symbol: '300750',
        planStatus: 'DRAFT',
        allowedToTrade: false,
        createdAt: '',
        updatedAt: '',
      },
    ];
    vi.mocked(client.get).mockResolvedValue(ok(list));
    const result = await getTradePlans();
    expect(result).toEqual(list);
    expect(client.get).toHaveBeenCalledWith('/trade-plans');
  });

  it('addTradePlan 解包新建项', async () => {
    const created: TradePlan = {
      id: '2',
      planDate: '2026-06-08',
      symbol: '300750',
      planStatus: 'DRAFT',
      allowedToTrade: false,
      createdAt: '',
      updatedAt: '',
    };
    vi.mocked(client.post).mockResolvedValue(ok(created));
    const result = await addTradePlan({
      planDate: '2026-06-08',
      symbol: '300750',
      planStatus: 'DRAFT',
      allowedToTrade: false,
    });
    expect(result.id).toBe('2');
    expect(client.post).toHaveBeenCalledWith('/trade-plans', {
      planDate: '2026-06-08',
      symbol: '300750',
      planStatus: 'DRAFT',
      allowedToTrade: false,
    });
  });

  it('updateTradePlan 先 GET 后 PUT 合并，避免后端丢字段', async () => {
    const existing: TradePlan = {
      id: '3',
      planDate: '2026-06-08',
      symbol: '300750',
      planStatus: 'DRAFT',
      allowedToTrade: false,
      buyCondition: '原条件',
      createdAt: '',
      updatedAt: '',
    };
    vi.mocked(client.get).mockResolvedValue(ok(existing));
    vi.mocked(client.put).mockResolvedValue(ok({ ...existing, planStatus: 'ACTIVE' }));
    const result = await updateTradePlan('3', { planStatus: 'ACTIVE' });
    expect(result?.planStatus).toBe('ACTIVE');
    // PUT 的 body 是合并后的完整对象（保留 buyCondition）。
    expect(client.put).toHaveBeenCalledWith(
      '/trade-plans/3',
      expect.objectContaining({ buyCondition: '原条件', planStatus: 'ACTIVE' }),
    );
  });

  it('getTradePlanById 业务失败返回 null（与 mock 口径一致）', async () => {
    vi.mocked(client.get).mockResolvedValue(fail('RESOURCE_NOT_FOUND'));
    const result = await getTradePlanById('not-exist');
    expect(result).toBeNull();
  });

  it('getTradePlans 业务失败抛错', async () => {
    vi.mocked(client.get).mockResolvedValue(fail('INTERNAL_ERROR'));
    await expect(getTradePlans()).rejects.toThrow('INTERNAL_ERROR');
  });

  it('deleteTradePlan 用 unwrapVoid，data=null 不抛错', async () => {
    vi.mocked(client.delete).mockResolvedValue(ok(null as unknown as TradePlan));
    await expect(deleteTradePlan('1')).resolves.toBeUndefined();
    expect(client.delete).toHaveBeenCalledWith('/trade-plans/1');
  });

  it('deleteTradePlan 业务失败抛错', async () => {
    vi.mocked(client.delete).mockResolvedValue(fail('RESOURCE_NOT_FOUND'));
    await expect(deleteTradePlan('1')).rejects.toThrow('RESOURCE_NOT_FOUND');
  });
});
