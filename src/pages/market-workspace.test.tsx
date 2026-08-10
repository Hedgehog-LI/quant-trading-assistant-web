import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { TaskItemsDrawer, PlansTab, MinuteBarTab } from './market-workspace';
import { buildPlanInput } from '../features/market-data/utils/syncPlanForm';
import { searchSecurities } from '../features/market-data/api/securityDirectoryApi';
import { saveSettings } from '../features/settings/api/settingsApi';
import { clearAll } from '../shared/api/localStorageClient';
import type { MarketDataSyncPlan, MarketDataSyncTaskItem } from '../shared/types/domain';

/** 捕获当前路由（pathname + search），用于断言「查看数据」跳转目标。 */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

/** PlansTab 使用 useNavigate，必须包在 Router 上下文内。 */
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

// Mock the workbench API module
const mockApi = vi.hoisted(() => ({
  listTaskItems: vi.fn(),
  reconcileTask: vi.fn(),
  createSyncPlan: vi.fn(),
  updateSyncPlan: vi.fn(),
  listSyncPlans: vi.fn(),
  listMinuteBars: vi.fn(),
}));

vi.mock('../features/market-data/api/workbenchApi', async () => {
  const actual = await vi.importActual<typeof import('../features/market-data/api/workbenchApi')>(
    '../features/market-data/api/workbenchApi',
  );
  return {
    ...actual,
    listTaskItems: mockApi.listTaskItems,
    reconcileTask: mockApi.reconcileTask,
    createSyncPlan: mockApi.createSyncPlan,
    updateSyncPlan: mockApi.updateSyncPlan,
    listSyncPlans: mockApi.listSyncPlans,
    listMinuteBars: mockApi.listMinuteBars,
  };
});

// Mock the security directory API so SecuritySelector never touches the network/seed catalog.
vi.mock('../features/market-data/api/securityDirectoryApi', async () => {
  const actual = await vi.importActual<typeof import('../features/market-data/api/securityDirectoryApi')>(
    '../features/market-data/api/securityDirectoryApi',
  );
  return {
    ...actual,
    searchSecurities: vi.fn(),
  };
});

// Mock antd message
import { message as antdMessage } from 'antd';
vi.spyOn(antdMessage, 'success').mockImplementation(() => ({} as never));
vi.spyOn(antdMessage, 'error').mockImplementation(() => ({} as never));
vi.spyOn(antdMessage, 'loading').mockImplementation(() => ({} as never));

const emptyPage = { items: [], total: 0, page: 1, size: 20 };
type TaskItemsPage = {
  items: MarketDataSyncTaskItem[];
  total: number;
  page: number;
  size: number;
};
const plan1: MarketDataSyncPlan = {
  id: 'p1', planName: '计划A', taskType: 'DAILY_BAR_BACKFILL', provider: 'LONGPORT',
  scopeJson: '{}', adjustType: 'NONE', triggerType: 'MANUAL', includeAuction: false,
  enabled: true, lastTaskId: 101, createdAt: '', updatedAt: '',
};
const plan2: MarketDataSyncPlan = {
  id: 'p2', planName: '计划B', taskType: 'DAILY_BAR_BACKFILL', provider: 'LONGPORT',
  scopeJson: '{}', adjustType: 'NONE', triggerType: 'MANUAL', includeAuction: false,
  enabled: true, lastTaskId: 102, createdAt: '', updatedAt: '',
};

const mockItem: MarketDataSyncTaskItem = {
  id: 'i1', taskId: 101, canonicalSymbol: 'SH.600519', status: 'SUCCEEDED',
  rowCount: 5, insertedCount: 3, updatedCount: 2, skippedCount: 0,
  startedAt: '2026-07-10T10:00:00', finishedAt: '2026-07-10T10:01:00', createdAt: '',
};

describe('TaskItemsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listTaskItems.mockResolvedValue(emptyPage);
    mockApi.reconcileTask.mockResolvedValue({ id: 101, status: 'SUCCEEDED' } as never);
  });

  it('1. 打开 Drawer 只请求一次 listTaskItems（page=1）', async () => {
    mockApi.listTaskItems.mockResolvedValue({ items: [mockItem], total: 1, page: 1, size: 20 });
    render(<TaskItemsDrawer plan={plan1} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockApi.listTaskItems).toHaveBeenCalledTimes(1);
    });
    expect(mockApi.listTaskItems).toHaveBeenCalledWith(101, undefined, 1, 20);
    await waitFor(() => {
      expect(screen.getByText('SH.600519')).toBeInTheDocument();
    });
    expect(screen.getByText('2026-07-10 10:00')).toBeInTheDocument();
    expect(screen.getByText('2026-07-10 10:01')).toBeInTheDocument();
  });

  it('2. 从第二页切换 plan 时只请求新 taskId 的第一页', async () => {
    mockApi.listTaskItems.mockResolvedValue({ items: [], total: 25, page: 1, size: 20 });
    const { rerender } = render(<TaskItemsDrawer plan={plan1} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockApi.listTaskItems).toHaveBeenCalledWith(101, undefined, 1, 20);
    });
    fireEvent.click(screen.getByTitle('2'));
    await waitFor(() => {
      expect(mockApi.listTaskItems).toHaveBeenCalledWith(101, undefined, 2, 20);
    });
    vi.clearAllMocks();
    mockApi.listTaskItems.mockResolvedValue({ items: [], total: 0, page: 1, size: 20 });
    rerender(<TaskItemsDrawer plan={plan2} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockApi.listTaskItems).toHaveBeenCalledWith(102, undefined, 1, 20);
    });
    // 只请求一次（page=1）
    expect(mockApi.listTaskItems).toHaveBeenCalledTimes(1);
    expect(mockApi.listTaskItems).not.toHaveBeenCalledWith(102, undefined, 2, 20);
  });

  it('3. 翻页只请求一次对应 page', async () => {
    mockApi.listTaskItems.mockResolvedValue({ items: [], total: 25, page: 1, size: 20 });
    render(<TaskItemsDrawer plan={plan1} onClose={vi.fn()} />);
    await waitFor(() => expect(mockApi.listTaskItems).toHaveBeenCalledTimes(1));
    vi.clearAllMocks();
    mockApi.listTaskItems.mockResolvedValue({ items: [], total: 25, page: 2, size: 20 });
    // Click page 2
    fireEvent.click(screen.getByTitle('2'));
    await waitFor(() => {
      expect(mockApi.listTaskItems).toHaveBeenCalledWith(101, undefined, 2, 20);
    });
    expect(mockApi.listTaskItems).toHaveBeenCalledTimes(1);
  });

  it('4. 旧响应不覆盖新 task 数据（竞态防护）', async () => {
    // Plan1 的响应延迟
    let resolveP1: (value: TaskItemsPage) => void = () => {};
    mockApi.listTaskItems.mockImplementationOnce(() => new Promise<TaskItemsPage>(resolve => { resolveP1 = resolve; }));
    // Plan2 的响应立即
    mockApi.listTaskItems.mockResolvedValueOnce({ items: [], total: 0, page: 1, size: 20 });

    const { rerender } = render(<TaskItemsDrawer plan={plan1} onClose={vi.fn()} />);
    // 等 plan1 effect 发出请求
    await waitFor(() => expect(mockApi.listTaskItems).toHaveBeenCalledTimes(1));
    // 立即切换到 plan2
    rerender(<TaskItemsDrawer plan={plan2} onClose={vi.fn()} />);
    await waitFor(() => expect(mockApi.listTaskItems).toHaveBeenCalledTimes(2));
    // 此时 plan1 的延迟响应还没 resolve
    // Resolve plan1 的旧响应（应该被 reqId 丢弃）
    await act(async () => resolveP1({ items: [{ id: 'old', taskId: 101, canonicalSymbol: 'OLD_DATA', status: 'SUCCEEDED', createdAt: '' }], total: 1, page: 1, size: 20 }));
    // OLD_DATA 不应该出现
    expect(screen.queryByText('OLD_DATA')).not.toBeInTheDocument();
  });

  it('5. 收敛 pending 时重复点击只调用一次 reconcileTask', async () => {
    mockApi.listTaskItems.mockResolvedValue({ items: [mockItem], total: 1, page: 1, size: 20 });
    let resolveReconcile: () => void = () => {};
    mockApi.reconcileTask.mockImplementation(() => new Promise(r => { resolveReconcile = r as () => void; }));

    render(<TaskItemsDrawer plan={plan1} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('SH.600519')).toBeInTheDocument());

    // 点击收敛按钮两次
    const reconcileBtn = screen.getByText('刷新/收敛');
    fireEvent.click(reconcileBtn);
    fireEvent.click(reconcileBtn);
    expect(mockApi.reconcileTask).toHaveBeenCalledTimes(1);
    // 清理 pending Promise
    await act(async () => resolveReconcile());
    await waitFor(() => expect(mockApi.listTaskItems).toHaveBeenCalledTimes(2));
  });

  it('6. 收敛成功后重新加载当前页', async () => {
    mockApi.listTaskItems.mockResolvedValue({ items: [mockItem], total: 1, page: 1, size: 20 });
    mockApi.reconcileTask.mockResolvedValue({ id: 101, status: 'SUCCEEDED' } as never);

    render(<TaskItemsDrawer plan={plan1} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('SH.600519')).toBeInTheDocument());
    vi.clearAllMocks();
    mockApi.listTaskItems.mockResolvedValue({ items: [mockItem], total: 1, page: 1, size: 20 });

    fireEvent.click(screen.getByText('刷新/收敛'));
    await waitFor(() => {
      expect(mockApi.reconcileTask).toHaveBeenCalledWith(101);
    });
    // 收敛成功后 listTaskItems 被重新调用
    await waitFor(() => {
      expect(mockApi.listTaskItems).toHaveBeenCalledWith(101, undefined, 1, 20);
    });
  });

  it('7. 收敛失败展示错误', async () => {
    mockApi.listTaskItems.mockResolvedValue({ items: [mockItem], total: 1, page: 1, size: 20 });
    mockApi.reconcileTask.mockRejectedValue(new Error('收敛失败_后端错误'));

    render(<TaskItemsDrawer plan={plan1} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('SH.600519')).toBeInTheDocument());
    fireEvent.click(screen.getByText('刷新/收敛'));
    await waitFor(() => {
      expect(screen.getByText(/收敛失败/)).toBeInTheDocument();
    });
  });
});

// ==================== 采集计划 SecuritySelector 集成 (RS-05) ====================

/**
 * Advance fake timers past the SecuritySelector 250ms debounce and flush the
 * microtask queue that resolves the mocked searchSecurities promise + React
 * state updates. Under fake timers waitFor cannot self-advance, so we settle
 * microtasks via repeated `await Promise.resolve()`.
 */
async function flushSelectorDebounce(ms = 250) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
}

describe('采集计划 SecuritySelector 集成', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    clearAll();
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
    mockApi.listSyncPlans.mockResolvedValue({ items: [], total: 0, page: 1, size: 20 });
    mockApi.createSyncPlan.mockResolvedValue({} as never);
    mockApi.updateSyncPlan.mockResolvedValue({} as never);
    vi.mocked(searchSecurities).mockReset();
    vi.mocked(searchSecurities).mockResolvedValue({
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
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('采集计划 scope：SecuritySelector 选中后 buildPlanInput 的 scopeJson 含正确 canonical symbol', async () => {
    await act(async () => {
      render(<PlansTab />, { wrapper: routerWrapper(['/market-workspace']) });
      // 让 useEffect(listSyncPlans) 的 microtask 在 fake timers 下落地。
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });
    expect(mockApi.listSyncPlans).toHaveBeenCalled();
    // 打开新建 Drawer
    fireEvent.click(screen.getByText('新建采集计划'));
    await flushSelectorDebounce(0);
    const selectorInput = screen.getByPlaceholderText(/检索证券/) as HTMLInputElement;

    // 驱动 SecuritySelector：输入 → debounce → 点击 data-canonical-symbol="SH.603308"
    fireEvent.change(selectorInput, { target: { value: '应流' } });
    await flushSelectorDebounce();
    const listItem = screen.getByTestId('security-selector-results')
      .querySelector('[data-canonical-symbol="SH.603308"]') as HTMLElement;
    expect(listItem).toBeTruthy();
    fireEvent.click(listItem);
    await flushSelectorDebounce(0);

    // SecurityVerificationField 是 symbols Form.Item 的受控子组件，会把 form 的 symbols
    // 值渲染成“已选标的”下的 Tag。这里读取它，证明 selector → form 字段写入成功。
    // 限定在“已选标的”区块内，避免命中 SecuritySelector 自身的已选/结果 Tag。
    const selectedLabel = Array.from(document.querySelectorAll('.ant-drawer-body *'))
      .find((el) => el.childNodes.length === 1 && el.textContent?.trim() === '已选标的') as HTMLElement | undefined;
    expect(selectedLabel).toBeTruthy();
    // “已选标的”与 Tag 列表在同一父容器内。
    const selectedRegion = selectedLabel!.parentElement!;
    const selectedTags = Array.from(selectedRegion.querySelectorAll('.ant-tag'))
      .map((t) => t.textContent ?? '');
    expect(selectedTags).toContain('SH.603308');

    // 用真实生产函数 buildPlanInput 把该 symbols 值转成 scopeJson，断言 canonical symbol 进入。
    // （采用 TaskPacket 允许的回退断言：跳过 antd v6 Select/日期保存的脆弱事件交互。）
    const symbolsValue = selectedTags.join(', ');
    const input = buildPlanInput({
      planName: '日K计划-选择器',
      taskType: 'DAILY_BAR_BACKFILL',
      provider: 'LONGPORT',
      symbols: symbolsValue,
      startDate: '2026-07-01',
      endDate: '2026-07-10',
      adjustType: 'NONE',
    });
    const scope = JSON.parse(input.scopeJson);
    expect(scope.symbols).toContain('SH.603308');
  });

  it('采集计划/板块成员选择过程不触发 quote/K 线同步写', async () => {
    await act(async () => {
      render(<PlansTab />, { wrapper: routerWrapper(['/market-workspace']) });
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });
    expect(mockApi.listSyncPlans).toHaveBeenCalled();
    fireEvent.click(screen.getByText('新建采集计划'));
    await flushSelectorDebounce(0);
    const selectorInput = screen.getByPlaceholderText(/检索证券/) as HTMLInputElement;

    // 仅驱动选择过程，不提交
    fireEvent.change(selectorInput, { target: { value: '应流' } });
    await flushSelectorDebounce();
    const listItem = screen.getByTestId('security-selector-results')
      .querySelector('[data-canonical-symbol="SH.603308"]') as HTMLElement;
    fireEvent.click(listItem);
    await flushSelectorDebounce(0);

    // 未提交：createSyncPlan / updateSyncPlan 都不应被调用
    expect(mockApi.createSyncPlan).not.toHaveBeenCalled();
    expect(mockApi.updateSyncPlan).not.toHaveBeenCalled();
  });
});

// ==================== 入口串联：采集计划「查看数据」(AC-06) ====================

describe('采集计划「查看数据」入口（AC-06）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAll();
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
  });

  it('日 K 计划：跳转 /market-assets 并带入 symbol/interval/source/adjust/range', async () => {
    mockApi.listSyncPlans.mockResolvedValue({
      items: [{
        ...plan1,
        scopeJson: JSON.stringify({ symbols: ['SH.600519'], startDate: '2026-01-01', endDate: '2026-06-30' }),
      }],
      total: 1, page: 1, size: 20,
    });
    render(<PlansTab />, { wrapper: routerWrapper(['/market-workspace']) });
    await waitFor(() => expect(screen.getByTestId('plan-view-p1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('plan-view-p1'));
    await waitFor(() => {
      const loc = screen.getByTestId('location').textContent ?? '';
      expect(loc).toContain('/market-assets');
      expect(loc).toContain('symbol=SH.600519');
      expect(loc).toContain('interval=1D');
      expect(loc).toContain('dataSource=LONGPORT');
      expect(loc).toContain('adjustType=NONE');
      expect(loc).toContain('from=2026-01-01');
      expect(loc).toContain('to=2026-06-30');
    });
  });

  it('分钟 K 计划：interval 用 intervalType，日期转 +08:00 交易时段', async () => {
    mockApi.listSyncPlans.mockResolvedValue({
      items: [{
        ...plan1,
        taskType: 'MINUTE_BAR_BACKFILL', intervalType: '5M',
        scopeJson: JSON.stringify({ symbols: ['SH.600519'], startDate: '2026-01-01', endDate: '2026-01-10' }),
      }],
      total: 1, page: 1, size: 20,
    });
    render(<PlansTab />, { wrapper: routerWrapper(['/market-workspace']) });
    await waitFor(() => expect(screen.getByTestId('plan-view-p1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('plan-view-p1'));
    await waitFor(() => {
      const loc = screen.getByTestId('location').textContent ?? '';
      expect(loc).toContain('interval=5M');
      expect(loc).toContain('from=2026-01-01T09%3A30%3A00%2B08%3A00');
      expect(loc).toContain('to=2026-01-10T15%3A00%3A00%2B08%3A00');
    });
  });

  it('scopeJson 无标的首：查看数据按钮禁用', async () => {
    mockApi.listSyncPlans.mockResolvedValue({
      items: [{ ...plan1, scopeJson: JSON.stringify({ startDate: '2026-01-01' }) }],
      total: 1, page: 1, size: 20,
    });
    render(<PlansTab />, { wrapper: routerWrapper(['/market-workspace']) });
    await waitFor(() => expect(screen.getByTestId('plan-view-p1')).toBeInTheDocument());
    expect(screen.getByTestId('plan-view-p1')).toBeDisabled();
  });
});

// ==================== 入口串联：分钟 K「图表查看」(AC-06) ====================

describe('分钟 K「图表查看」入口（AC-06）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAll();
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
    mockApi.listMinuteBars.mockResolvedValue({
      items: [{
        id: 'm1', canonicalSymbol: 'SH.600519', tradeDate: '2026-07-17',
        barStartTime: '2026-07-17T09:30:00+08:00', barEndTime: '2026-07-17T09:35:00+08:00',
        intervalType: '5M', openPrice: 100, highPrice: 101, lowPrice: 99, closePrice: 100.5,
        volume: 1000, amount: 100000, adjustType: 'NONE', dataSource: 'LONGPORT',
        qualityStatus: 'VALID', fetchedAt: '2026-07-17T09:35:00',
      }],
      total: 1, page: 1, size: 20,
    });
  });

  it('点击图表查看：跳转 /market-assets 并带入 symbol/interval/source/adjust/当日时段 range', async () => {
    render(<MinuteBarTab />, { wrapper: routerWrapper(['/market-workspace']) });
    await waitFor(() => expect(screen.getByTestId('minute-view-m1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('minute-view-m1'));
    await waitFor(() => {
      const loc = screen.getByTestId('location').textContent ?? '';
      expect(loc).toContain('/market-assets');
      expect(loc).toContain('symbol=SH.600519');
      expect(loc).toContain('interval=5M');
      expect(loc).toContain('dataSource=LONGPORT');
      expect(loc).toContain('adjustType=NONE');
      expect(loc).toContain('from=2026-07-17T09%3A30%3A00%2B08%3A00');
      expect(loc).toContain('to=2026-07-17T15%3A00%3A00%2B08%3A00');
    });
  });
});
