import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { QuoteSnapshotsTab, SyncTasksTab, BarsTab } from './market-data';
import { saveSettings } from '../features/settings/api/settingsApi';
import { clearAll } from '../shared/api/localStorageClient';

// Hoisted API fns that we assert on.
const mocks = vi.hoisted(() => ({
  fetchLatestQuotes: vi.fn(),
  createDailyBarSync: vi.fn(),
  getQuoteSnapshots: vi.fn(),
  getSyncTasks: vi.fn(),
  getProviderStatus: vi.fn(),
  getDailyBars: vi.fn(),
  searchSecurities: vi.fn(),
}));

// Mock the market-data write/list API: keep importActual so unrelated exports survive,
// override only the fns we drive or assert on.
vi.mock('../features/market-data/api/marketDataApi', async () => {
  const actual = await vi.importActual<typeof import('../features/market-data/api/marketDataApi')>(
    '../features/market-data/api/marketDataApi',
  );
  return {
    ...actual,
    fetchLatestQuotes: mocks.fetchLatestQuotes,
    createDailyBarSync: mocks.createDailyBarSync,
    getQuoteSnapshots: mocks.getQuoteSnapshots,
    getSyncTasks: mocks.getSyncTasks,
    getProviderStatus: mocks.getProviderStatus,
    getDailyBars: mocks.getDailyBars,
  };
});

// Mock the security directory search so the selector resolves a known result for a query.
vi.mock('../features/market-data/api/securityDirectoryApi', async () => {
  const actual =
    await vi.importActual<typeof import('../features/market-data/api/securityDirectoryApi')>(
      '../features/market-data/api/securityDirectoryApi',
    );
  return {
    ...actual,
    searchSecurities: mocks.searchSecurities,
  };
});

// Mock antd message (page calls message.info/success/error/warning).
import { message as antdMessage } from 'antd';
vi.spyOn(antdMessage, 'success').mockImplementation(() => ({} as never));
vi.spyOn(antdMessage, 'error').mockImplementation(() => ({} as never));
vi.spyOn(antdMessage, 'info').mockImplementation(() => ({} as never));
vi.spyOn(antdMessage, 'warning').mockImplementation(() => ({} as never));

const emptyPage = { items: [], total: 0, page: 1, size: 20 };
const readyProvider = { configured: true, reachable: true };

const SH603308_RESULT = {
  items: [
    {
      canonicalSymbol: 'SH.603308',
      symbol: '603308',
      displayName: '应流股份',
      name: '应流股份',
      market: 'SH',
      exchange: 'SSE',
      currency: 'CNY',
      securityType: 'STOCK',
      listStatus: 'LISTED',
      matchedBy: 'FORMAL_NAME_EXACT',
    },
  ],
  catalogStatus: 'READY',
  catalogUpdatedAt: '2026-07-29T10:00:00',
  stale: false,
  degraded: false,
};

function withProvider(ui: ReactNode): ReactNode {
  return <ConfigProvider locale={zhCN}>{ui}</ConfigProvider>;
}

/** 捕获当前路由（pathname + search），用于断言「图表查看」跳转目标。 */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

/** BarsTab 使用 useNavigate，必须包在 Router 上下文内。 */
function routerWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        {children}
        <LocationProbe />
      </MemoryRouter>
    );
  };
}

/**
 * Drive the SecuritySelector to a deterministic selection for `SH.603308`.
 * - types a query into the selector input (placeholder contains "检索证券")
 * - waits past the 250ms debounce + mocked searchSecurities promise resolution
 * - clicks the result item with data-canonical-symbol="SH.603308"
 *
 * Uses real timers (waitFor default timeout comfortably exceeds the 250ms debounce) so that
 * antd v6 Popconfirm portals still render when a submit step follows.
 */
async function selectSh603308ViaSelector(): Promise<void> {
  const input = screen.getByPlaceholderText(/检索证券/);
  await act(async () => {
    fireEvent.change(input, { target: { value: '应流' } });
  });
  // The selector debounces search by 250ms; let the timer + microtask resolve.
  await waitFor(() => {
    expect(screen.getByText('应流股份')).toBeInTheDocument();
  });
  const item = document.querySelector('[data-canonical-symbol="SH.603308"]');
  expect(item).not.toBeNull();
  await act(async () => {
    fireEvent.click(item as Element);
  });
}

describe('market-data SecuritySelector integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAll();
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
    // Defaults: list endpoints return empty page, provider is ready so submit can proceed,
    // selector search resolves the known SH.603308 result for any qualifying query.
    mocks.getQuoteSnapshots.mockResolvedValue(emptyPage);
    mocks.getSyncTasks.mockResolvedValue(emptyPage);
    mocks.getProviderStatus.mockResolvedValue(readyProvider);
    mocks.searchSecurities.mockResolvedValue(SH603308_RESULT);
    // Write fns return benign payloads so submit handlers complete.
    mocks.fetchLatestQuotes.mockResolvedValue([]);
    mocks.createDailyBarSync.mockResolvedValue({ id: 'mock', status: 'FAILED', createdAt: '' } as never);
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // TD-D2-PAGE-MD-01, AC-03
  it('最新价查询：SecuritySelector 选中后提交的 canonical symbol 与所选一致', async () => {
    render(withProvider(<QuoteSnapshotsTab />));
    await selectSh603308ViaSelector();

    // The manual textarea should now carry the selected canonical symbol.
    await waitFor(() => {
      expect((screen.getByPlaceholderText(/输入证券代码/) as HTMLTextAreaElement).value).toContain(
        'SH.603308',
      );
    });

    // Trigger the latest-price fetch (Popconfirm), then click the confirm (OK) button.
    // antd v6 Popconfirm OK button carries the `ant-btn-primary` class; selecting by class
    // keeps the test independent of locale-dependent OK button text (确定 / OK).
    fireEvent.click(screen.getByText('拉取最新价'));
    const okBtn = await waitFor(() => {
      const btn = document.querySelector('.ant-popover .ant-btn-primary') as HTMLButtonElement | null;
      if (!btn) throw new Error('Popconfirm OK button not rendered yet');
      return btn;
    });
    await act(async () => {
      fireEvent.click(okBtn);
    });

    await waitFor(() => {
      expect(mocks.fetchLatestQuotes).toHaveBeenCalledTimes(1);
    });
    const args = mocks.fetchLatestQuotes.mock.calls.at(-1);
    expect(args?.[0]).toEqual(expect.arrayContaining(['SH.603308']));
  });

  // TD-D2-PAGE-MD-02, AC-03
  it('历史日 K 同步：SecuritySelector 选中后提交的 canonical symbol 与所选一致', async () => {
    render(withProvider(<SyncTasksTab />));
    await selectSh603308ViaSelector();

    // The manual sync input should now carry the selected canonical symbol.
    await waitFor(() => {
      expect((screen.getByPlaceholderText(/SH\.600519/) as HTMLInputElement).value).toContain(
        'SH.603308',
      );
    });

    // Submit the daily-bar sync task.
    fireEvent.click(screen.getByText('创建同步'));

    await waitFor(() => {
      expect(mocks.createDailyBarSync).toHaveBeenCalledTimes(1);
    });
    const args = mocks.createDailyBarSync.mock.calls.at(-1) ?? [];
    // createDailyBarSync(taskType, provider, canonicalSymbol, startDate?, endDate?, adjustType?)
    expect(args[2]).toBe('SH.603308');
  });

  // TD-D2-NOSIDEEFFECT-01, AC-04 — drives BOTH tabs through search+selection WITHOUT submitting.
  it('最新价/日 K 选择证券过程不调用 quote/sync/采集任务创建等写接口', async () => {
    // QuoteSnapshotsTab: select via selector, do not submit.
    const { unmount: unmountQuote } = render(withProvider(<QuoteSnapshotsTab />));
    await selectSh603308ViaSelector();
    expect(mocks.fetchLatestQuotes).not.toHaveBeenCalled();
    unmountQuote();

    // SyncTasksTab: select via selector, do not submit.
    const { unmount: unmountSync } = render(withProvider(<SyncTasksTab />));
    await selectSh603308ViaSelector();
    expect(mocks.createDailyBarSync).not.toHaveBeenCalled();
    unmountSync();
  });

  // TD-D2-FALLBACK-01, AC-05
  it('手工输入 canonical symbol 后备路径仍可提交', async () => {
    render(withProvider(<SyncTasksTab />));
    const manualInput = screen.getByPlaceholderText(/SH\.600519/) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(manualInput, { target: { value: 'SH.600519' } });
    });

    fireEvent.click(screen.getByText('创建同步'));

    await waitFor(() => {
      expect(mocks.createDailyBarSync).toHaveBeenCalledTimes(1);
    });
    const args = mocks.createDailyBarSync.mock.calls.at(-1) ?? [];
    expect(args[2]).toBe('SH.600519');
  });
});

// ==================== 入口串联：日 K「图表查看」(AC-06) ====================

describe('日 K「图表查看」入口（AC-06）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAll();
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
    mocks.getDailyBars.mockResolvedValue({
      items: [{
        id: 'b1', canonicalSymbol: 'SZ.000001', tradeDate: '2026-07-01',
        adjustType: 'QF', dataSource: 'CSV',
        openPrice: 10, highPrice: 10.5, lowPrice: 9.9, closePrice: 10.2, volume: 1000, amount: 10200,
      }],
      total: 1, page: 1, size: 20,
    });
  });

  it('点击图表查看：跳转 /market-assets 并带入 symbol/interval=1D/source/adjust/range', async () => {
    render(withProvider(<BarsTab />), { wrapper: routerWrapper(['/market-data']) });
    // 日 K tab 需要先点「查询」加载数据，再出现每行「图表查看」入口。
    fireEvent.click(screen.getByRole('button', { name: /查询/ }));
    await waitFor(() => expect(screen.getByTestId('daily-view-b1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('daily-view-b1'));
    await waitFor(() => {
      const loc = screen.getByTestId('location').textContent ?? '';
      expect(loc).toContain('/market-assets');
      expect(loc).toContain('symbol=SZ.000001');
      expect(loc).toContain('interval=1D');
      expect(loc).toContain('dataSource=CSV');
      expect(loc).toContain('adjustType=QF');
      expect(loc).toContain('from=2026-07-01');
      expect(loc).toContain('to=2026-07-01');
    });
  });
});
