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
  it('同屏展示热力、轮动、排行证据和显著演示水印', async () => {
    render(<MarketResearchPage />, { wrapper: Wrapper });

    expect(await screen.findByRole('heading', { name: '市场雷达' })).toBeInTheDocument();
    expect(screen.getByText('LOCAL_DEMO', { selector: '.research-demo-watermark' })).toBeInTheDocument();
    expect(await screen.findByTestId('research-heatmap')).toBeInTheDocument();
    expect(screen.getByTestId('rotation-matrix')).toBeInTheDocument();
    expect(screen.getByText('板块排行与证据')).toBeInTheDocument();
    expect(screen.getAllByText(/相对强弱百分位/).length).toBeGreaterThan(0);
    expect(screen.getByText('当前没有可验证的真实资金流口径')).toBeInTheDocument();
    expect(screen.queryByText('贵州茅台')).not.toBeInTheDocument();
  });

  it('点击热力板块进入稳定 sectorId 详情并展示历史轨迹', async () => {
    const user = userEvent.setup();
    render(<MarketResearchPage />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('button', { name: '查看云启材料板块详情' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/market-research/sectors/9001?market=CN&window=20');
    });
    expect(await screen.findByRole('heading', { name: '云启材料' })).toBeInTheDocument();
    expect(screen.getByTestId('sector-history-chart')).toBeInTheDocument();
    expect(screen.getByText('当前详情只展示已验证证据')).toBeInTheDocument();
  });
});
