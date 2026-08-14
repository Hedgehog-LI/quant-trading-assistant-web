import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketAssetsPage } from './market-assets';
import { clearAll } from '../shared/api/localStorageClient';
import { saveSettings } from '../features/settings/api/settingsApi';
import type { MarketAssetSeries } from '../features/market-assets/model/types';
import { ApiRequestError } from '../shared/api/errors';

const mocks = vi.hoisted(() => ({
  getMarketAssetAvailability: vi.fn(),
  getMarketAssetCatalog: vi.fn(),
  getMarketAssetSeries: vi.fn(),
  getMarketAssetRelatedTasks: vi.fn(),
}));

vi.mock('../features/market-assets/api/marketAssetApi', async () => {
  const actual =
    await vi.importActual<typeof import('../features/market-assets/api/marketAssetApi')>(
      '../features/market-assets/api/marketAssetApi',
    );
  return {
    ...actual,
    getMarketAssetAvailability: mocks.getMarketAssetAvailability,
    getMarketAssetCatalog: mocks.getMarketAssetCatalog,
    getMarketAssetSeries: mocks.getMarketAssetSeries,
    getMarketAssetRelatedTasks: mocks.getMarketAssetRelatedTasks,
  };
});

// jsdom 无 canvas，lightweight-charts createChart 会失败；用桩替换。
vi.mock('lightweight-charts', () => ({
  ColorType: { Solid: 'solid' },
  CandlestickSeries: Symbol('CandlestickSeries'),
  HistogramSeries: Symbol('HistogramSeries'),
  createChart: () => ({
    addSeries: () => ({ setData: vi.fn(), applyOptions: vi.fn() }),
    priceScale: () => ({ applyOptions: vi.fn() }),
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  }),
}));

const SECURITY = {
  canonicalSymbol: 'SH.600519',
  displayName: '贵州茅台',
  market: 'SH',
  currency: 'CNY',
  timeZone: 'Asia/Shanghai',
};

const AVAILABILITY = {
  security: SECURITY,
  combinations: [
    {
      interval: '1D',
      dataSource: 'LONGPORT',
      adjustType: 'NONE',
      barCount: 20,
      firstBarTime: '2026-07-01',
      lastBarTime: '2026-07-31',
      latestFetchedAt: null,
      watermarkTime: null,
    },
    {
      interval: '5M',
      dataSource: 'LONGPORT',
      adjustType: 'NONE',
      barCount: 48,
      firstBarTime: '2026-07-17T09:30:00+08:00',
      lastBarTime: '2026-07-17T15:00:00+08:00',
      latestFetchedAt: null,
      watermarkTime: null,
    },
  ],
};

const SERIES: MarketAssetSeries = {
  security: SECURITY,
  query: {
    interval: '1D',
    from: '2026-02-11',
    to: '2026-08-10',
    adjustType: 'NONE',
    dataSource: 'LONGPORT',
  },
  availability: {
    firstBarTime: '2026-07-01',
    lastBarTime: '2026-07-31',
    latestFetchedAt: null,
    watermarkTime: null,
  },
  quality: {
    coverageStatus: 'UNKNOWN',
    actualBarCount: 2,
    expectedBarCount: null,
    missingBarCount: null,
    suspectBarCount: 0,
    truncated: false,
    reasonCodes: [],
    freshness: 'UNKNOWN',
    freshnessDetail: null,
  },
  summary: {
    firstOpen: '10.00',
    lastClose: '10.50',
    absoluteChange: '0.50',
    changeRate: '0.05',
    highestHigh: '10.60',
    lowestLow: '9.90',
    totalVolume: 3000,
    totalAmount: '31000.00',
    actualBarCount: 2,
  },
  bars: [
    { time: '2026-07-01', open: '10.00', high: '10.30', low: '9.90', close: '10.20', volume: 1000, amount: '10200.00', qualityStatus: 'VALID', fetchedAt: null },
    { time: '2026-07-02', open: '10.20', high: '10.60', low: '10.10', close: '10.50', volume: 2000, amount: '21000.00', qualityStatus: 'VALID', fetchedAt: null },
  ],
};

const RELATED = { security: SECURITY, plans: [], runs: [] };

function makeWrapper(initialPath = '/market-assets') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ConfigProvider locale={zhCN}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    );
  };
}

beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
  vi.clearAllMocks();
  mocks.getMarketAssetAvailability.mockResolvedValue(AVAILABILITY);
  mocks.getMarketAssetCatalog.mockResolvedValue({
    items: [{
      security: SECURITY,
      dailyBarCount: 20,
      minuteBarCount: 48,
      minuteIntervalCount: 1,
      firstDailyDate: '2026-07-01',
      lastDailyDate: '2026-07-31',
      firstMinuteTime: '2026-07-17T09:30:00+08:00',
      lastMinuteTime: '2026-07-17T15:00:00+08:00',
      latestFetchedAt: '2026-07-31T15:01:00+08:00',
    }],
    total: 1,
    page: 1,
    size: 20,
  });
  mocks.getMarketAssetSeries.mockResolvedValue(SERIES);
  mocks.getMarketAssetRelatedTasks.mockResolvedValue(RELATED);
});

describe('MarketAssetsPage', () => {
  it('未选证券：显示真实已入库资产目录，不请求 series', async () => {
    render(<MarketAssetsPage />, { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByText('贵州茅台')).toBeInTheDocument());
    expect(screen.getByText('日 K 20 条')).toBeInTheDocument();
    expect(mocks.getMarketAssetCatalog).toHaveBeenCalled();
    expect(mocks.getMarketAssetSeries).not.toHaveBeenCalled();
    expect(mocks.getMarketAssetAvailability).not.toHaveBeenCalled();
  });

  it('点击资产目录查看：触发 availability + series 并展示图表', async () => {
    render(<MarketAssetsPage />, { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByTestId('open-asset-SH.600519')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('open-asset-SH.600519'));
    await waitFor(() => expect(mocks.getMarketAssetAvailability).toHaveBeenCalledWith('SH.600519'));
    await waitFor(() => expect(mocks.getMarketAssetSeries).toHaveBeenCalled());
    expect(screen.getByText('K 线与成交量')).toBeInTheDocument();
  });

  it('availability 无组合：提示尚未采集，不请求 series', async () => {
    mocks.getMarketAssetAvailability.mockResolvedValue({ security: SECURITY, combinations: [] });
    render(<MarketAssetsPage />, { wrapper: makeWrapper('/market-assets?symbol=SH.600519') });
    await waitFor(() => expect(screen.getByText(/尚未采集该证券数据/)).toBeInTheDocument());
    expect(mocks.getMarketAssetSeries).not.toHaveBeenCalled();
  });

  it('证券未登记：展示可操作业务空态，不泄漏原始 404 文本', async () => {
    mocks.getMarketAssetAvailability.mockRejectedValue(
      new ApiRequestError('STOCK_NOT_FOUND', '证券不存在: SH.600519', 404),
    );
    render(<MarketAssetsPage />, { wrapper: makeWrapper('/market-assets?symbol=SH.600519') });
    await waitFor(() => expect(screen.getByText('尚未建立该证券的行情资产')).toBeInTheDocument());
    expect(screen.getByText('去行情工作台')).toBeInTheDocument();
    expect(screen.queryByText('Request failed with status code 404')).not.toBeInTheDocument();
    expect(mocks.getMarketAssetSeries).not.toHaveBeenCalled();
  });

  it('series 失败：显示错误与重试，点击重试重新请求', async () => {
    mocks.getMarketAssetSeries.mockRejectedValueOnce(new Error('范围过大'));
    render(<MarketAssetsPage />, { wrapper: makeWrapper('/market-assets?symbol=SH.600519') });
    await waitFor(() => expect(screen.getByText(/行情数据查询失败/)).toBeInTheDocument());
    expect(mocks.getMarketAssetSeries).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('series-retry'));
    await waitFor(() => expect(mocks.getMarketAssetSeries).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('K 线与成交量')).toBeInTheDocument());
  });

  it('URL 直接携带 symbol 进入：自动加载并展示', async () => {
    render(<MarketAssetsPage />, { wrapper: makeWrapper('/market-assets?symbol=SH.600519') });
    await waitFor(() => expect(mocks.getMarketAssetSeries).toHaveBeenCalled());
    expect(screen.getByText('已选证券：SH.600519')).toBeInTheDocument();
  });
});
