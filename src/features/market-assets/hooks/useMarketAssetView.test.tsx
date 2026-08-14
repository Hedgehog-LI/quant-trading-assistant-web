/**
 * P1.9-A useMarketAssetView URL 状态恢复单测。
 *
 * - URL 是唯一状态源：初始加载、同路由查询参数变化、浏览器后退都要恢复 selection；
 * - 非法组合回退到 availability 真实组合，且只 canonicalize 一次；
 * - 不产生无限 replace / 重复查询。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '../../../shared/api/localStorageClient';
import { saveSettings } from '../../settings/api/settingsApi';
import type { MarketAssetSeries } from '../model/types';
import { useMarketAssetView } from './useMarketAssetView';

const mocks = vi.hoisted(() => ({
  getMarketAssetAvailability: vi.fn(),
  getMarketAssetCatalog: vi.fn(),
  getMarketAssetSeries: vi.fn(),
  getMarketAssetRelatedTasks: vi.fn(),
}));

vi.mock('../api/marketAssetApi', () => mocks);

const SECURITY = {
  canonicalSymbol: 'SH.600519',
  displayName: '贵州茅台',
  market: 'SH',
  currency: 'CNY',
  timeZone: 'Asia/Shanghai',
};

const COMBO = (interval: string, dataSource: string, adjustType: string) => ({
  interval,
  dataSource,
  adjustType,
  barCount: 30,
  firstBarTime: interval === '1D' ? '2026-07-01' : '2026-07-17T09:30:00+08:00',
  lastBarTime: interval === '1D' ? '2026-07-31' : '2026-07-17T15:00:00+08:00',
  latestFetchedAt: null,
  watermarkTime: null,
  freshness: null,
});

const AVAILABILITY = {
  security: SECURITY,
  combinations: [
    COMBO('1D', 'LONGPORT', 'NONE'),
    COMBO('5M', 'LONGPORT', 'NONE'),
    COMBO('5M', 'CSV', 'QF'),
  ],
};

const SERIES: MarketAssetSeries = {
  security: SECURITY,
  query: { interval: '1D', from: '2026-07-01', to: '2026-07-31', adjustType: 'NONE', dataSource: 'LONGPORT' },
  availability: { firstBarTime: '2026-07-01', lastBarTime: '2026-07-31', latestFetchedAt: null, watermarkTime: null },
  quality: { coverageStatus: 'UNKNOWN', actualBarCount: 0, expectedBarCount: null, missingBarCount: null, suspectBarCount: 0, truncated: false, reasonCodes: [], freshness: 'UNKNOWN', freshnessDetail: null },
  summary: { firstOpen: null, lastClose: null, absoluteChange: null, changeRate: null, highestHigh: null, lowestLow: null, totalVolume: 0, totalAmount: null, actualBarCount: 0 },
  bars: [],
};

const RELATED = { security: SECURITY, plans: [], runs: [] };

/** 测试内可调用 navigate（同路由参数变化 / 前进 / 后退），并读取当前 location.search。 */
const routerCtl: { navigate: NavigateFunction; search: () => string } = {
  navigate: (() => undefined) as NavigateFunction,
  search: () => '',
};

function RouterProbe() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    routerCtl.navigate = navigate;
    routerCtl.search = () => location.search;
  }, [navigate, location]);
  return null;
}

function makeWrapper(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <RouterProbe />
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

function renderView(initialPath: string) {
  return renderHook(() => useMarketAssetView(), { wrapper: makeWrapper(initialPath) });
}

beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
  vi.clearAllMocks();
  mocks.getMarketAssetAvailability.mockResolvedValue(AVAILABILITY);
  mocks.getMarketAssetSeries.mockResolvedValue(SERIES);
  mocks.getMarketAssetRelatedTasks.mockResolvedValue(RELATED);
});

const FULL_URL =
  '/market-assets?symbol=SH.600519&interval=5M&from=2026-07-17T10%3A00%3A00%2B08%3A00&to=2026-07-17T11%3A00%3A00%2B08%3A00&adjustType=NONE&dataSource=LONGPORT';

describe('useMarketAssetView', () => {
  it('初始 URL 完整参数：恢复 symbol/interval/from/to/adjustType/dataSource 并发起 series', async () => {
    const { result } = renderView(FULL_URL);
    await waitFor(() => expect(mocks.getMarketAssetAvailability).toHaveBeenCalledWith('SH.600519'));
    await waitFor(() => expect(mocks.getMarketAssetSeries).toHaveBeenCalled());
    expect(result.current.symbol).toBe('SH.600519');
    expect(result.current.interval).toBe('5M');
    expect(result.current.from).toBe('2026-07-17T10:00:00+08:00');
    expect(result.current.to).toBe('2026-07-17T11:00:00+08:00');
    expect(result.current.adjustType).toBe('NONE');
    expect(result.current.dataSource).toBe('LONGPORT');
    expect(mocks.getMarketAssetSeries).toHaveBeenCalledWith(expect.objectContaining({
      canonicalSymbol: 'SH.600519',
      interval: '5M',
      adjustType: 'NONE',
      dataSource: 'LONGPORT',
    }));
  });

  it('挂载后导航到另一组查询参数：selection 跟随新 URL 恢复', async () => {
    const { result } = renderView('/market-assets?symbol=SH.600519&interval=1D');
    await waitFor(() => expect(mocks.getMarketAssetSeries).toHaveBeenCalled());

    act(() => routerCtl.navigate(
      '/market-assets?symbol=SH.600519&interval=5M&from=2026-07-17T10%3A00%3A00%2B08%3A00&to=2026-07-17T11%3A00%3A00%2B08%3A00&adjustType=QF&dataSource=CSV',
    ));
    await waitFor(() => expect(result.current.interval).toBe('5M'));
    expect(result.current.adjustType).toBe('QF');
    expect(result.current.dataSource).toBe('CSV');
    expect(result.current.from).toBe('2026-07-17T10:00:00+08:00');
    expect(result.current.to).toBe('2026-07-17T11:00:00+08:00');
  });

  it('浏览器后退：恢复上一组 URL 状态', async () => {
    const { result } = renderView('/market-assets?symbol=SH.600519&interval=1D&from=2026-07-01&to=2026-07-31');
    await waitFor(() => expect(mocks.getMarketAssetSeries).toHaveBeenCalled());
    expect(result.current.interval).toBe('1D');

    act(() => routerCtl.navigate(
      '/market-assets?symbol=SH.600519&interval=5M&from=2026-07-17T10%3A00%3A00%2B08%3A00&to=2026-07-17T11%3A00%3A00%2B08%3A00&adjustType=QF&dataSource=CSV',
    ));
    await waitFor(() => expect(result.current.interval).toBe('5M'));

    act(() => routerCtl.navigate(-1));
    await waitFor(() => expect(result.current.interval).toBe('1D'));
    expect(result.current.from).toBe('2026-07-01');
    expect(result.current.to).toBe('2026-07-31');
  });

  it('非法组合：回退到 availability 真实组合并只 canonicalize 一次，series 用回退参数', async () => {
    // LONGPORT+QF 不是真实组合：应回退到 5M/LONGPORT/NONE
    const { result } = renderView(
      '/market-assets?symbol=SH.600519&interval=5M&from=2026-07-17T10%3A00%3A00%2B08%3A00&to=2026-07-17T11%3A00%3A00%2B08%3A00&adjustType=QF&dataSource=LONGPORT',
    );
    await waitFor(() => expect(mocks.getMarketAssetSeries).toHaveBeenCalled());
    // 组合原子性回退：LONGPORT+QF → LONGPORT+NONE（真实组合）；tuple 变化时 range 重置为默认（既有行为）
    expect(result.current.adjustType).toBe('NONE');
    expect(result.current.dataSource).toBe('LONGPORT');
    expect(mocks.getMarketAssetSeries).toHaveBeenCalledWith(expect.objectContaining({
      interval: '5M', adjustType: 'NONE', dataSource: 'LONGPORT',
    }));
    // 只 canonicalize 一次：URL 稳定后不再 rewrite
    const stable = routerCtl.search();
    expect(stable).toContain('adjustType=NONE');
    expect(stable).toContain('dataSource=LONGPORT');
    await waitFor(() => {});
    expect(routerCtl.search()).toBe(stable);
    expect(mocks.getMarketAssetSeries).toHaveBeenCalledTimes(1);
  });

  it('非法枚举与不可解析时间：安全回退默认值且 series 不因反馈循环重复请求', async () => {
    // interval=BOGUS → 回退 1D；from/to 为分钟格式但对 1D 不可解析 → 回退默认范围
    const { result } = renderView(
      '/market-assets?symbol=SH.600519&interval=BOGUS&from=2026-07-17T10%3A00%3A00%2B08%3A00&to=2026-07-17T11%3A00%3A00%2B08%3A00',
    );
    await waitFor(() => expect(mocks.getMarketAssetSeries).toHaveBeenCalled());
    expect(result.current.interval).toBe('1D');
    expect(result.current.adjustType).toBe('NONE');
    expect(result.current.from).not.toBe('2026-07-17T10:00:00+08:00');
    expect(result.current.from.length).toBeGreaterThan(0);
    // URL 只被 canonicalize 一次：稳定后不再 rewrite，series 也只请求一次
    const stable = routerCtl.search();
    await waitFor(() => {});
    expect(routerCtl.search()).toBe(stable);
    expect(mocks.getMarketAssetSeries).toHaveBeenCalledTimes(1);
  });
});
