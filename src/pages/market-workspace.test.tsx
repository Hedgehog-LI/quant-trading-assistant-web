import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskItemsDrawer } from './market-workspace';
import type { MarketDataSyncPlan, MarketDataSyncTaskItem } from '../shared/types/domain';

// Mock the workbench API module
const mockApi = vi.hoisted(() => ({
  listTaskItems: vi.fn(),
  reconcileTask: vi.fn(),
}));

vi.mock('../features/market-data/api/workbenchApi', async () => {
  const actual = await vi.importActual<typeof import('../features/market-data/api/workbenchApi')>(
    '../features/market-data/api/workbenchApi',
  );
  return {
    ...actual,
    listTaskItems: mockApi.listTaskItems,
    reconcileTask: mockApi.reconcileTask,
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
