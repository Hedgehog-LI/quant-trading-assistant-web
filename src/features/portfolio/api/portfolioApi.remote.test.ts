/**
 * portfolioApi remote 分支单测。
 *
 * 用 vi.mock 拦截 shared/api/client，断言各 remote 实现正确解包 ApiResponse，
 * 以及 success=false 时抛错。portfolio 无 delete，覆盖 get / upsertPrice + 失败路径。
 * vi.mock 必须在文件顶层，vi.fn 在 beforeEach 重置。
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

import { portfolioApi } from './portfolioApi';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';
import { client } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import type {
  PortfolioSummary,
  PortfolioPosition,
  ClosedTrade,
  PriceSnapshot,
} from '../model/types';

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

describe('portfolioApi (remote)', () => {
  it('getSummary 解包汇总数据', async () => {
    const summary: PortfolioSummary = {
      realizedPnl: 1000,
      unrealizedPnl: 500,
      totalPnl: 1500,
      currentCost: 10000,
      currentMarketValue: 10500,
      closedTradeCount: 2,
      winCount: 1,
      lossCount: 1,
      winRate: 0.5,
      averageReturnPoint: 5,
      averageHoldingDays: 4,
      warnings: [],
      disclaimer: '',
    };
    vi.mocked(client.get).mockResolvedValue(ok(summary));
    const result = await portfolioApi.getSummary();
    expect(result.totalPnl).toBe(1500);
    expect(client.get).toHaveBeenCalledWith('/portfolio/summary');
  });

  it('getPositions 解包持仓数组', async () => {
    const positions: PortfolioPosition[] = [
      {
        symbol: '300750',
        quantity: 100,
        averageCost: 100,
        costAmount: 10000,
        currentPrice: 110,
        marketValue: 11000,
        unrealizedPnl: 1000,
        unrealizedReturnPoint: 10,
        firstBuyDate: '2026-06-01',
        holdingDays: 7,
        warnings: [],
      },
    ];
    vi.mocked(client.get).mockResolvedValue(ok(positions));
    const result = await portfolioApi.getPositions();
    expect(result).toHaveLength(1);
    expect(client.get).toHaveBeenCalledWith('/portfolio/positions');
  });

  it('getClosedTrades 解包已结算交易数组', async () => {
    const trades: ClosedTrade[] = [
      {
        symbol: '300750',
        buyDate: '2026-06-01',
        sellDate: '2026-06-05',
        holdingDays: 4,
        quantity: 100,
        buyAveragePrice: 100,
        sellAveragePrice: 110,
        costAmount: 10000,
        sellAmount: 11000,
        totalFee: 10,
        realizedPnl: 990,
        returnPoint: 9.9,
        profitable: true,
        buyJournalIds: [],
        sellJournalId: '2',
      },
    ];
    vi.mocked(client.get).mockResolvedValue(ok(trades));
    const result = await portfolioApi.getClosedTrades();
    expect(result).toHaveLength(1);
    expect(client.get).toHaveBeenCalledWith('/portfolio/closed-trades');
  });

  it('upsertPrice 解包新建快照', async () => {
    const snap: PriceSnapshot = {
      id: '1',
      symbol: '300750',
      currentPrice: 110,
      priceDate: '2026-06-08',
      createdAt: '',
      updatedAt: '',
    };
    vi.mocked(client.post).mockResolvedValue(ok(snap));
    const result = await portfolioApi.upsertPrice({
      symbol: '300750',
      currentPrice: 110,
      priceDate: '2026-06-08',
    });
    expect(result.id).toBe('1');
    expect(client.post).toHaveBeenCalledWith('/portfolio/prices', {
      symbol: '300750',
      currentPrice: 110,
      priceDate: '2026-06-08',
    });
  });

  it('getSummary 业务失败抛错', async () => {
    vi.mocked(client.get).mockResolvedValue(fail('INTERNAL_ERROR'));
    await expect(portfolioApi.getSummary()).rejects.toThrow('INTERNAL_ERROR');
  });

  it('getSummary data=null 视为失败抛错', async () => {
    // unwrap 对 data=null 也抛错（不同于 unwrapVoid）。
    vi.mocked(client.get).mockResolvedValue(ok(null));
    await expect(portfolioApi.getSummary()).rejects.toThrow();
  });
});
