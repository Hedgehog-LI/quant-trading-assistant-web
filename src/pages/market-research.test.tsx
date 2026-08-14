import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll } from '../shared/api/localStorageClient';
import { saveSettings } from '../features/settings/api/settingsApi';
import { MarketResearchPage, MarketResearchSectorPage } from './market-research';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}{location.search}</div>;
}

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <ConfigProvider locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/market-research']}>
          <Routes>
            <Route path="/market-research" element={<>{children}<LocationProbe /></>} />
            <Route path="/market-research/sectors/:sectorId" element={<><MarketResearchSectorPage /><LocationProbe /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}

beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
});

describe('MarketResearchPage', () => {
  it('默认以1日强度展示热力、强弱梯队和当日证据', async () => {
    render(<MarketResearchPage />, { wrapper: Wrapper });

    expect(await screen.findByRole('heading', { name: '市场雷达' })).toBeInTheDocument();
    expect(screen.getByText('LOCAL_DEMO', { selector: '.research-demo-watermark' })).toBeInTheDocument();
    expect(await screen.findByTestId('research-heatmap')).toBeInTheDocument();
    expect(screen.getByTestId('one-day-strength-ladder')).toBeInTheDocument();
    expect(screen.queryByTestId('rotation-matrix')).not.toBeInTheDocument();
    expect(screen.getByText('当日横截面强度 · 轮动需至少5日')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '生成结果' })).not.toBeInTheDocument();
    expect(screen.getByText('板块排行与证据')).toBeInTheDocument();
    expect(screen.getAllByText('源排名').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/当日强度百分位/).length).toBeGreaterThan(0);
    expect(screen.getByText('当前没有可验证的真实资金流口径')).toBeInTheDocument();
    expect(screen.getByText(/只展示最新收盘的横截面强弱/)).toBeInTheDocument();
    expect(screen.queryByText('贵州茅台')).not.toBeInTheDocument();
  });

  it('点击热力板块进入稳定 sectorId 详情并展示历史轨迹', async () => {
    const user = userEvent.setup();
    render(<MarketResearchPage />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('button', { name: '查看云启材料板块详情' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/market-research/sectors/9001?market=CN&window=1');
    });
    expect(await screen.findByRole('heading', { name: '云启材料' })).toBeInTheDocument();
    expect(screen.getByTestId('sector-history-chart')).toBeInTheDocument();
    expect(screen.getByText('每日强度历史')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '板块每日强度历史轨迹' })).toBeInTheDocument();
    const titles = Array.from(document.querySelectorAll('.sector-history-chart title'));
    expect(titles[0]).toHaveTextContent('2026-08-03');
    expect(titles.at(-1)).toHaveTextContent('2026-08-12');
    expect(screen.getByText('当前详情只展示已验证证据')).toBeInTheDocument();
  });
});
