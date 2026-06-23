/**
 * tradeJournalApi remote 分支单测。
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
  getTradeJournals,
  addTradeJournal,
  updateTradeJournal,
  getTradeJournalById,
  deleteTradeJournal,
} from './tradeJournalApi';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';
import { client } from '../../../shared/api/client';
import type { TradeJournal } from '../../../shared/types/domain';
import type { ApiResponse } from '../../../shared/api/types';

function ok<T>(data: T): { data: ApiResponse<T> } {
  return { data: { success: true, code: 'SUCCESS', message: null, data, timestamp: '' } };
}

function fail(message: string): { data: ApiResponse<unknown> } {
  return { data: { success: false, code: 'BIZ_ERROR', message, data: null, timestamp: '' } };
}

function buildJournal(overrides: Partial<TradeJournal> = {}): TradeJournal {
  return {
    id: '1',
    tradeDate: '2026-06-08',
    symbol: '300750',
    side: 'BUY',
    price: 100,
    quantity: 100,
    amount: 10000,
    emotionTags: [],
    mistakeTags: [],
    reviewStatus: 'PENDING',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
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

describe('tradeJournalApi (remote)', () => {
  it('getTradeJournals 解包数组', async () => {
    const list = [buildJournal()];
    vi.mocked(client.get).mockResolvedValue(ok(list));
    const result = await getTradeJournals();
    expect(result).toEqual(list);
    expect(client.get).toHaveBeenCalledWith('/trade-journals');
  });

  it('addTradeJournal 解包新建项', async () => {
    const created = buildJournal({ id: '2' });
    vi.mocked(client.post).mockResolvedValue(ok(created));
    const result = await addTradeJournal({
      tradeDate: '2026-06-08',
      symbol: '300750',
      side: 'BUY',
      price: 100,
      quantity: 100,
      emotionTags: [],
      mistakeTags: [],
    });
    expect(result.id).toBe('2');
    expect(client.post).toHaveBeenCalledWith('/trade-journals', {
      tradeDate: '2026-06-08',
      symbol: '300750',
      side: 'BUY',
      price: 100,
      quantity: 100,
      emotionTags: [],
      mistakeTags: [],
    });
  });

  it('updateTradeJournal 先 GET 后 PUT 合并，避免费用清零', async () => {
    const existing = buildJournal({ id: '3', commissionFee: 5, stampTax: 10 });
    vi.mocked(client.get).mockResolvedValue(ok(existing));
    vi.mocked(client.put).mockResolvedValue(ok({ ...existing, price: 120 }));
    const result = await updateTradeJournal('3', { price: 120 });
    expect(result?.price).toBe(120);
    // PUT 的 body 是合并后的完整对象，保留费用字段。
    expect(client.put).toHaveBeenCalledWith(
      '/trade-journals/3',
      expect.objectContaining({ commissionFee: 5, stampTax: 10, price: 120 }),
    );
  });

  it('getTradeJournalById 业务失败返回 null（与 mock 口径一致）', async () => {
    vi.mocked(client.get).mockResolvedValue(fail('RESOURCE_NOT_FOUND'));
    const result = await getTradeJournalById('not-exist');
    expect(result).toBeNull();
  });

  it('getTradeJournals 业务失败抛错', async () => {
    vi.mocked(client.get).mockResolvedValue(fail('INTERNAL_ERROR'));
    await expect(getTradeJournals()).rejects.toThrow('INTERNAL_ERROR');
  });

  it('deleteTradeJournal 用 unwrapVoid，data=null 不抛错', async () => {
    vi.mocked(client.delete).mockResolvedValue(ok(null as unknown as TradeJournal));
    await expect(deleteTradeJournal('1')).resolves.toBeUndefined();
    expect(client.delete).toHaveBeenCalledWith('/trade-journals/1');
  });

  it('deleteTradeJournal 业务失败抛错', async () => {
    vi.mocked(client.delete).mockResolvedValue(fail('RESOURCE_NOT_FOUND'));
    await expect(deleteTradeJournal('1')).rejects.toThrow('RESOURCE_NOT_FOUND');
  });
});
