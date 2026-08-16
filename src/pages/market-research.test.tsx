import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '../shared/api/localStorageClient';
import { saveSettings } from '../features/settings/api/settingsApi';
import { getMarketOverview } from '../features/market-overview/api/marketOverviewApi';
import { getMarketResearchSectorDetail } from '../features/market-research/api/marketResearchApi';
import type { MarketOverview } from '../features/market-overview/model/types';
import { MarketResearchPage } from './market-research';
import { MarketResearchSectorPage } from './market-research-sector';

vi.mock('../features/market-overview/api/marketOverviewApi', () => ({
  getMarketOverview: vi.fn(),
}));
vi.mock('../features/market-overview/components/BenchmarkTrendChart', () => ({
  BenchmarkTrendChart: () => <div data-testid="stub-benchmark-chart">benchmark-chart</div>,
}));
vi.mock('../features/market-overview/components/ActivityLiquidityChart', () => ({
  ActivityLiquidityChart: () => <div data-testid="stub-activity-chart">activity-chart</div>,
}));
vi.mock('../features/market-overview/components/BreadthChart', () => ({
  BreadthChart: () => <div data-testid="stub-breadth-chart">breadth-chart</div>,
}));
vi.mock('../features/market-overview/components/IndustryMigrationChart', () => ({
  IndustryMigrationChart: () => <div data-testid="stub-migration-chart">migration-chart</div>,
}));

const mockedGetMarketOverview = vi.mocked(getMarketOverview);

function buildOverview(
  qualityStatus: MarketOverview['metadata']['qualityStatus'],
  overrides: Partial<MarketOverview> = {},
): MarketOverview {
  return {
    metadata: {
      market: 'CN', startDate: '2026-07-01', endDate: '2026-07-31', dataAsOf: '2026-07-31',
      dataScope: 'SAMPLE', sampleSize: 150, benchmarkSymbol: 'SH.000001',
      providerCodes: ['SINA_PUBLIC', 'TENCENT_PUBLIC'], taxonomyCode: 'SINA_INDUSTRY',
      barCoverage: 0.893333, membershipCoverage: 0.673333, qualifiedTradingDays: 131,
      qualityStatus, limitations: ['当前为 Top-N 样本，不是全市场'],
      unavailableMetrics: ['OFFICIAL_MONEY_FLOW'],
    },
    benchmarkSeries: [{
      tradeDate: '2026-07-01', closePrice: 3050, dailyReturn: 0.001, amount: 3e10,
      ma20: 3011.5, ma60: null, drawdown: 0,
    }],
    activitySeries: [{
      tradeDate: '2026-07-01', marketTurnover: 3.9e11, turnoverMedian20: 3.9e11,
      turnoverMedian60: null, activityRatio: 1.01, activeStockRatio: 0.4, validStocks: 150,
    }],
    breadthSeries: [{
      tradeDate: '2026-07-01', advancingStocks: 78, decliningStocks: 61, flatStocks: 11,
      validStocks: 150, advanceRatio: 0.52, adLine: 17, aboveMa20Stocks: 60, aboveMa20Ratio: 0.4,
    }],
    liquidityProxySeries: {
      unit: '1/元', caliber: '日频价格冲击代理',
      days: [{ tradeDate: '2026-07-01', medianIlliquidity: 3.1e-8, p90Illiquidity: 1.1e-7, qualifiedStocks: 150, zeroAmountRows: 0 }],
    },
    industryTurnoverMigration: [{
      tradeDate: '2026-07-01', industryCode: 'new_blhy', industryName: '玻璃行业', turnover: 1.2e8,
      turnoverShare: 0.0312, previousDayShareChange: 0.0005, median20Share: 0.03,
      median20ShareChange: 0.0012, rank: 3, coveredStocks: 8,
    }],
    quality: {
      coverageGap: { uncoveredSampleStocks: 49, uncoveredTurnoverAmount: 1.2e10, symbols: ['BJ.920099'] },
      providerAttribution: [{ dataset: 'benchmarkDailyBar', providers: ['TENCENT_PUBLIC'] }],
      qualityFindings: [], assumptions: ['INDEX_KLINE_DERIVED 日历'], unavailableMetrics: ['OFFICIAL_MONEY_FLOW'],
    },
    ...overrides,
  };
}

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <ConfigProvider locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/market-research?start=2026-07-01&end=2026-07-31']}>
          <Routes>
            <Route path="/market-research" element={children} />
            <Route path="/market-research/sectors/:sectorId" element={<MarketResearchSectorPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}

beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
  vi.clearAllMocks();
});

describe('MarketResearchPage（市场全景）', () => {
  it('OK 响应渲染五类证据区域、覆盖率与 Provider 标签', async () => {
    mockedGetMarketOverview.mockResolvedValue(buildOverview('OK'));
    render(<MarketResearchPage />, { wrapper: Wrapper });

    expect(await screen.findByText('基准趋势与回撤')).toBeInTheDocument();
    expect(screen.getByText('流动性与交易活跃度')).toBeInTheDocument();
    expect(screen.getByText('市场广度')).toBeInTheDocument();
    expect(screen.getByText(/行业成交占比迁移/)).toBeInTheDocument();
    expect(screen.getByText('数据质量与可解释状态')).toBeInTheDocument();
    expect(screen.getByTestId('stub-benchmark-chart')).toBeInTheDocument();
    expect(screen.getByTestId('stub-activity-chart')).toBeInTheDocument();
    expect(screen.getByTestId('stub-breadth-chart')).toBeInTheDocument();
    expect(screen.getByTestId('stub-migration-chart')).toBeInTheDocument();
    expect(screen.getByText('SINA_PUBLIC')).toBeInTheDocument();
    expect(screen.getByText('TENCENT_PUBLIC')).toBeInTheDocument();
    expect(mockedGetMarketOverview).toHaveBeenCalledWith('CN', '2026-07-01', '2026-07-31');
  });

  it('null 覆盖率显示占位 --，不显示为 0', async () => {
    const overview = buildOverview('DEGRADED');
    overview.metadata.barCoverage = null;
    overview.metadata.membershipCoverage = null;
    mockedGetMarketOverview.mockResolvedValue(overview);
    render(<MarketResearchPage />, { wrapper: Wrapper });

    await screen.findByText('基准趋势与回撤');
    const coverage = screen.getByText(/日K覆盖/).textContent ?? '';
    const membership = screen.getAllByText(/行业映射/)
      .map((node) => node.textContent ?? '')
      .find((text) => text.startsWith('行业映射')) ?? '';
    expect(coverage).toContain('--');
    expect(coverage).not.toContain('0%');
    expect(membership).toContain('--');
  });

  it('DEGRADED 展示结构化质量原因，官方资金流为 UNAVAILABLE，短期图表保留', async () => {
    const overview = buildOverview('DEGRADED');
    overview.quality.qualityFindings = [
      { code: 'LOW_BAR_COVERAGE', severity: 'WARN', message: '窗口样本日 K 覆盖率 0.893333', affectedCount: 23 },
      { code: 'INSUFFICIENT_WARMUP', severity: 'WARN', message: '中期结论门禁需要至少 120 个合格交易日（当前 90）', affectedCount: 90 },
    ];
    mockedGetMarketOverview.mockResolvedValue(overview);
    render(<MarketResearchPage />, { wrapper: Wrapper });

    expect((await screen.findAllByText(/LOW_BAR_COVERAGE/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/INSUFFICIENT_WARMUP/).length).toBeGreaterThan(0);
    expect(screen.getByText(/样本日 K 覆盖不足/)).toBeInTheDocument();
    expect(screen.getByTestId('stub-benchmark-chart')).toBeInTheDocument();
    expect(screen.getByTestId('overview-money-flow-unavailable')).toBeInTheDocument();
  });

  it('INDUSTRY_MIGRATION_BLOCKED 时行业图阻断为空，不渲染伪图', async () => {
    const overview = buildOverview('DEGRADED');
    overview.industryTurnoverMigration = [];
    overview.quality.qualityFindings = [{
      code: 'INDUSTRY_MIGRATION_BLOCKED', severity: 'WARN',
      message: '行业映射覆盖率 0.400000 低于阻断阈值 0.50，行业成交占比迁移已阻断为空', affectedCount: 6,
    }];
    mockedGetMarketOverview.mockResolvedValue(overview);
    render(<MarketResearchPage />, { wrapper: Wrapper });

    expect(await screen.findByTestId('overview-migration-blocked')).toBeInTheDocument();
    expect(screen.getAllByText(/行业成交占比迁移已阻断/).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('stub-migration-chart')).not.toBeInTheDocument();
  });

  it('NO_DATA 渲染完整空态，不渲染任何图表', async () => {
    const overview = buildOverview('NO_DATA');
    overview.benchmarkSeries = [];
    overview.activitySeries = [];
    overview.breadthSeries = [];
    overview.liquidityProxySeries = { unit: '1/元', caliber: '', days: [] };
    overview.industryTurnoverMigration = [];
    mockedGetMarketOverview.mockResolvedValue(overview);
    render(<MarketResearchPage />, { wrapper: Wrapper });

    expect(await screen.findByTestId('overview-no-data')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-benchmark-chart')).not.toBeInTheDocument();
    expect(screen.queryByText('基准趋势与回撤')).not.toBeInTheDocument();
  });

  it('API 错误展示错误态与重试入口，不回退演示数据', async () => {
    mockedGetMarketOverview.mockRejectedValue(new Error('Network Error'));
    render(<MarketResearchPage />, { wrapper: Wrapper });

    expect(await screen.findByText('市场全景数据加载失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重试/ })).toBeInTheDocument();
    expect(screen.queryByTestId('stub-benchmark-chart')).not.toBeInTheDocument();
  });

  it('刷新按钮触发重新查询（同窗口参数）', async () => {
    mockedGetMarketOverview.mockResolvedValue(buildOverview('OK'));
    render(<MarketResearchPage />, { wrapper: Wrapper });
    await screen.findByText('基准趋势与回撤');
    expect(mockedGetMarketOverview).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /刷新/ }));

    await waitFor(() => expect(mockedGetMarketOverview).toHaveBeenCalledTimes(2));
    expect(mockedGetMarketOverview).toHaveBeenLastCalledWith('CN', '2026-07-01', '2026-07-31');
  });

  it('板块详情路由保留：mock 演示板块可渲染历史详情', async () => {
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
    render(
      <ConfigProvider locale={zhCN}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={['/market-research/sectors/9001?market=CN&window=1']}>
            <Routes>
              <Route path="/market-research/sectors/:sectorId" element={<MarketResearchSectorPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>,
    );

    expect(await screen.findByText('返回市场全景')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '云启材料' })).toBeInTheDocument();
    expect(screen.getByText('每日强度历史')).toBeInTheDocument();
    expect(getMarketResearchSectorDetail).toBeTruthy();
  });
});
