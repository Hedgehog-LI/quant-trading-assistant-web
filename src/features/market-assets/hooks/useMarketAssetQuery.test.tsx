import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '../../../shared/api/localStorageClient';
import { saveSettings } from '../../settings/api/settingsApi';
import type { MarketAssetSeries, MarketAssetSeriesParams } from '../model/types';
import { useMarketAssetAvailability, useMarketAssetCatalog, useMarketAssetRelatedTasks, useMarketAssetSeries } from './useMarketAssetQuery';

const mocks = vi.hoisted(() => ({
  getMarketAssetAvailability: vi.fn(),
  getMarketAssetCatalog: vi.fn(),
  getMarketAssetSeries: vi.fn(),
  getMarketAssetRelatedTasks: vi.fn(),
}));

vi.mock('../api/marketAssetApi', () => mocks);

const SERIES_PARAMS: MarketAssetSeriesParams = {
  canonicalSymbol: 'SH.600519',
  interval: '1D',
  from: '2026-07-01',
  to: '2026-07-31',
  adjustType: 'NONE',
  dataSource: 'LONGPORT',
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
  vi.clearAllMocks();
});

describe('useMarketAssetSeries', () => {
  it('params 为 null（未选证券）时不发请求', async () => {
    mocks.getMarketAssetSeries.mockResolvedValue({ bars: [] } as unknown as MarketAssetSeries);
    const { result } = renderHook(() => useMarketAssetSeries(null), { wrapper: makeWrapper() });
    expect(result.current.data).toBeUndefined();
    expect(mocks.getMarketAssetSeries).not.toHaveBeenCalled();
  });

  it('有完整 params 时按 params 查询并返回数据', async () => {
    const fake: MarketAssetSeries = {
      security: { canonicalSymbol: 'SH.600519', displayName: '贵州茅台', market: 'SH', currency: 'CNY', timeZone: 'Asia/Shanghai' },
      query: SERIES_PARAMS,
      availability: { firstBarTime: '2026-07-01', lastBarTime: '2026-07-31', latestFetchedAt: null, watermarkTime: null },
      quality: { coverageStatus: 'UNKNOWN', actualBarCount: 0, expectedBarCount: null, missingBarCount: null, suspectBarCount: 0, truncated: false, reasonCodes: [], freshness: 'UNKNOWN', freshnessDetail: null },
      summary: { firstOpen: null, lastClose: null, absoluteChange: null, changeRate: null, highestHigh: null, lowestLow: null, totalVolume: 0, totalAmount: null, actualBarCount: 0 },
      bars: [],
    };
    mocks.getMarketAssetSeries.mockResolvedValue(fake);
    const { result } = renderHook(() => useMarketAssetSeries(SERIES_PARAMS), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.getMarketAssetSeries).toHaveBeenCalledWith(SERIES_PARAMS);
    expect(result.current.data).toBe(fake);
  });
});

describe('useMarketAssetCatalog', () => {
  it('按筛选条件查询已入库资产', async () => {
    mocks.getMarketAssetCatalog.mockResolvedValue({ items: [], total: 0, page: 1, size: 20 });
    const filter = { market: 'HK', keyword: '2498', page: 1, size: 20 };
    const { result } = renderHook(() => useMarketAssetCatalog(filter), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.getMarketAssetCatalog).toHaveBeenCalledWith(filter);
  });
});

describe('useMarketAssetAvailability', () => {
  it('symbol 为空时不发请求', async () => {
    mocks.getMarketAssetAvailability.mockResolvedValue({ security: { canonicalSymbol: '' } as never, combinations: [] });
    const { result } = renderHook(() => useMarketAssetAvailability(''), { wrapper: makeWrapper() });
    expect(result.current.data).toBeUndefined();
    expect(mocks.getMarketAssetAvailability).not.toHaveBeenCalled();
  });

  it('有 symbol 时按 symbol 查询', async () => {
    mocks.getMarketAssetAvailability.mockResolvedValue({
      security: { canonicalSymbol: 'SH.600519', displayName: '贵州茅台', market: 'SH', currency: 'CNY', timeZone: 'Asia/Shanghai' },
      combinations: [],
    });
    const { result } = renderHook(() => useMarketAssetAvailability('SH.600519'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.getMarketAssetAvailability).toHaveBeenCalledWith('SH.600519');
  });
});

describe('useMarketAssetRelatedTasks', () => {
  it('interval 未传时按全粒度查询', async () => {
    mocks.getMarketAssetRelatedTasks.mockResolvedValue({ security: { canonicalSymbol: 'SH.600519' } as never, plans: [], runs: [] });
    const { result } = renderHook(() => useMarketAssetRelatedTasks('SH.600519'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.getMarketAssetRelatedTasks).toHaveBeenCalledWith('SH.600519', undefined);
  });
});
