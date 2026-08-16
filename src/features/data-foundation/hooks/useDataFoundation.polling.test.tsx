/**
 * 数据底座轮询 hooks 专项测试（真实定时器，验证 refetchInterval 开始/停止语义）：
 * - 任务详情：QUEUED/RUNNING 每 2s 轮询，终态后停止；
 * - 任务列表：仅存在活跃任务时轮询，全部终态后停止；
 * - 分片：poll=true 轮询、poll=false 不轮询。
 */
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '../../../shared/api/localStorageClient';
import { saveSettings } from '../../settings/api/settingsApi';
import { getBackfillTask, listBackfillChunks, listBackfillTasks } from '../api/dataFoundationApi';
import type { BackfillTask } from '../model/types';
import { useBackfillChunks, useBackfillTask, useBackfillTaskList } from './useDataFoundation';

vi.mock('../api/dataFoundationApi', () => ({
  getBackfillTask: vi.fn(),
  listBackfillChunks: vi.fn(),
  listBackfillTasks: vi.fn(),
}));

const mockedGetTask = vi.mocked(getBackfillTask);
const mockedListChunks = vi.mocked(listBackfillChunks);
const mockedListTasks = vi.mocked(listBackfillTasks);

const queuedTask: BackfillTask = {
  id: 7, datasetCode: 'CN_DAILY_BAR', datasetVersionId: 3, marketCode: 'CN',
  providerCode: 'TENCENT_PUBLIC', frequency: '1D', adjustType: 'NONE',
  startDate: '2026-07-01', endDate: '2026-07-31', chunkSize: 50, status: 'QUEUED',
  plannedCount: 10, successCount: 0, failCount: 0, skipCount: 0,
  insertedCount: null, updatedCount: null, lastErrorCode: null, lastErrorMessage: null,
  startedAt: null, finishedAt: null, createdAt: '2026-08-16T09:58:00',
  symbols: null, totalChunks: 10, succeededChunks: 0, failedChunks: 0,
};

const succeededTask: BackfillTask = { ...queuedTask, status: 'SUCCEEDED', successCount: 10, succeededChunks: 10 };

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
  vi.clearAllMocks();
});

describe('数据底座轮询 hooks', () => {
  it('任务详情：QUEUED 时按 2s 轮询，进入终态（SUCCEEDED）后停止轮询', async () => {
    let calls = 0;
    mockedGetTask.mockImplementation(async () => {
      calls += 1;
      return calls === 1 ? queuedTask : succeededTask;
    });

    const { result } = renderHook(() => useBackfillTask(7), { wrapper: Wrapper });

    // 初始查询返回 QUEUED → 轮询开启
    await waitFor(() => expect(result.current.data?.status).toBe('QUEUED'));
    expect(calls).toBe(1);

    // ~2s 后的轮询取回 SUCCEEDED
    await waitFor(() => expect(result.current.data?.status).toBe('SUCCEEDED'), { timeout: 4000 });
    expect(calls).toBe(2);

    // 终态后不再轮询
    await sleep(2600);
    expect(calls).toBe(2);
  }, 12000);

  it('任务列表：存在活跃任务时轮询，全部终态后停止', async () => {
    let active = true;
    mockedListTasks.mockImplementation(async () =>
      active
        ? { items: [queuedTask], total: 1, page: 1, size: 10 }
        : { items: [succeededTask], total: 1, page: 1, size: 10 },
    );

    const { result } = renderHook(() => useBackfillTaskList({ page: 1, pageSize: 10 }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data?.items[0]?.status).toBe('QUEUED'));
    expect(mockedListTasks).toHaveBeenCalledTimes(1);

    // 轮询保持活跃
    await waitFor(() => expect(mockedListTasks).toHaveBeenCalledTimes(2), { timeout: 4000 });

    // 数据转为终态 → 一次轮询取回后停止
    active = false;
    await waitFor(() => expect(result.current.data?.items[0]?.status).toBe('SUCCEEDED'), { timeout: 4000 });
    const countAtStop = mockedListTasks.mock.calls.length;
    await sleep(2600);
    expect(mockedListTasks.mock.calls.length).toBe(countAtStop);
  }, 15000);

  it('分片：poll=true 时轮询、poll=false 时不轮询', async () => {
    mockedListChunks.mockResolvedValue([]);

    // poll=false：只发生初始查询，2.6s 后无第二次
    const idle = renderHook(() => useBackfillChunks(7, false), { wrapper: Wrapper });
    await waitFor(() => expect(mockedListChunks).toHaveBeenCalledTimes(1));
    await sleep(2600);
    expect(mockedListChunks).toHaveBeenCalledTimes(1);
    idle.unmount();

    // poll=true：初始查询 + ~2s 轮询
    vi.clearAllMocks();
    mockedListChunks.mockResolvedValue([]);
    renderHook(() => useBackfillChunks(7, true), { wrapper: Wrapper });
    await waitFor(() => expect(mockedListChunks).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockedListChunks).toHaveBeenCalledTimes(2), { timeout: 4000 });
  }, 12000);
});
