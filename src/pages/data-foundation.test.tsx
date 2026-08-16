import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '../shared/api/localStorageClient';
import { saveSettings } from '../features/settings/api/settingsApi';
import {
  createBackfillTask,
  createDataset,
  createDatasetVersion,
  getBackfillTask,
  getReleasedVersion,
  listBackfillChunks,
  listBackfillTasks,
  listCoverage,
  listDatasets,
  listDatasetVersions,
  listImportBatches,
  listQualityResults,
  pauseBackfillTask,
  publishVersion,
  retryFailedChunks,
  runBackfillTask,
  runQualityCheck,
  uploadImportSnapshot,
} from '../features/data-foundation/api/dataFoundationApi';
import type {
  BackfillChunk,
  BackfillTask,
  CoverageWatermark,
  Dataset,
  DatasetVersion,
  ImportBatch,
  QualityResult,
} from '../features/data-foundation/model/types';
import { DataFoundationPage } from './data-foundation';

vi.mock('../features/data-foundation/api/dataFoundationApi', () => ({
  listDatasets: vi.fn(),
  createDataset: vi.fn(),
  createDatasetVersion: vi.fn(),
  listDatasetVersions: vi.fn(),
  getReleasedVersion: vi.fn(),
  getBackfillTask: vi.fn(),
  listBackfillChunks: vi.fn(),
  listBackfillTasks: vi.fn(),
  createBackfillTask: vi.fn(),
  runBackfillTask: vi.fn(),
  pauseBackfillTask: vi.fn(),
  retryFailedChunks: vi.fn(),
  runQualityCheck: vi.fn(),
  listQualityResults: vi.fn(),
  listCoverage: vi.fn(),
  publishVersion: vi.fn(),
  uploadImportSnapshot: vi.fn(),
  listImportBatches: vi.fn(),
}));

const mockedListDatasets = vi.mocked(listDatasets);
const mockedCreateDataset = vi.mocked(createDataset);
const mockedCreateVersion = vi.mocked(createDatasetVersion);
const mockedListVersions = vi.mocked(listDatasetVersions);
const mockedGetReleased = vi.mocked(getReleasedVersion);
const mockedGetTask = vi.mocked(getBackfillTask);
const mockedListChunks = vi.mocked(listBackfillChunks);
const mockedListTasks = vi.mocked(listBackfillTasks);
const mockedCreateTask = vi.mocked(createBackfillTask);
const mockedRunTask = vi.mocked(runBackfillTask);
const mockedPauseTask = vi.mocked(pauseBackfillTask);
const mockedRetryChunks = vi.mocked(retryFailedChunks);
const mockedRunQualityCheck = vi.mocked(runQualityCheck);
const mockedListQuality = vi.mocked(listQualityResults);
const mockedListCoverage = vi.mocked(listCoverage);
const mockedPublish = vi.mocked(publishVersion);
const mockedUpload = vi.mocked(uploadImportSnapshot);
const mockedListImports = vi.mocked(listImportBatches);

// ---------------------------------------------------------------- 夹具（对齐后端 VO 字段）

const dataset: Dataset = {
  id: 1, datasetCode: 'CN_DAILY_BAR', datasetName: 'A股日K数据集', marketCode: 'CN',
  barType: 'DAILY', frequency: '1D', providerCode: 'TENCENT_PUBLIC', adjustType: 'NONE',
  unitCaliber: 'price=CNY;volume=share', description: null, currentVersionId: 3,
  createdAt: '2026-08-16T09:00:00',
};

const importDataset: Dataset = {
  id: 2, datasetCode: 'CN_DAILY_IMPORT', datasetName: 'A股日K导入数据集', marketCode: 'CN',
  barType: 'DAILY', frequency: '1D', providerCode: 'IMPORT_CSV_DAILY', adjustType: 'NONE',
  unitCaliber: null, description: null, currentVersionId: null,
  createdAt: '2026-08-16T09:00:00',
};

const DATASET_LABEL = 'CN_DAILY_BAR（A股日K数据集）';
const IMPORT_DATASET_LABEL = 'CN_DAILY_IMPORT（A股日K导入数据集）';

const task: BackfillTask = {
  id: 7, datasetCode: 'CN_DAILY_BAR', datasetVersionId: 3, marketCode: 'CN',
  providerCode: 'TENCENT_PUBLIC', frequency: '1D', adjustType: 'NONE',
  startDate: '2026-07-01', endDate: '2026-07-31', chunkSize: 100, status: 'PARTIAL_FAILED',
  plannedCount: 10, successCount: 8, failCount: 2, skipCount: 0,
  insertedCount: null, updatedCount: null, lastErrorCode: 'PROVIDER_CALL_FAILED',
  lastErrorMessage: '公共源 429', startedAt: '2026-08-16T10:00:00', finishedAt: null,
  createdAt: '2026-08-16T09:58:00', symbols: null, totalChunks: 10, succeededChunks: 8, failedChunks: 2,
};

const queuedTask: BackfillTask = {
  ...task, id: 8, status: 'QUEUED', successCount: 0, failCount: 0,
  succeededChunks: 0, failedChunks: 0, lastErrorCode: null, lastErrorMessage: null,
};

const pausedTask: BackfillTask = { ...task, id: 9, status: 'PAUSED' };

const newPendingTask: BackfillTask = {
  ...task, id: 77, status: 'PENDING', datasetCode: 'CN_DAILY_BAR',
  startDate: '2026-07-01', endDate: '2026-07-03',
  successCount: 0, failCount: 0, succeededChunks: 0, failedChunks: 0,
  lastErrorCode: null, lastErrorMessage: null, symbols: ['SH.600519'],
  totalChunks: 1, plannedCount: 1,
};

const failedChunk: BackfillChunk = {
  id: 71, taskId: 7, chunkIndex: 3, symbols: ['SH.600519'], startDate: '2026-07-01',
  endDate: '2026-07-02', status: 'FAILED', attempts: 2, insertedCount: 0, updatedCount: 0,
  skippedCount: 0, failedCount: 1, lastErrorCode: 'PROVIDER_CALL_FAILED',
  lastErrorMessage: '腾讯公共源 429 限流', startedAt: '2026-08-16T10:01:00', finishedAt: '2026-08-16T10:01:05',
};

const version: DatasetVersion = {
  id: 3, datasetId: 1, datasetCode: 'CN_DAILY_BAR', versionCode: 'V20260731', status: 'QUALIFIED',
  startDate: '2021-01-01', endDate: '2026-07-31', sourceProvider: 'TENCENT_PUBLIC', sourceNote: null,
  rowCount: 1200, qualifiedAt: '2026-08-01T00:00:00', releasedAt: null,
  createdAt: '2026-07-31T20:00:00', isCurrentReleased: false,
  contentHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  manifestRowCount: 1188, lineageStatus: 'PENDING',
};

const rejectedVersion: DatasetVersion = {
  id: 4, datasetId: 1, datasetCode: 'CN_DAILY_BAR', versionCode: 'V202607', status: 'REJECTED',
  startDate: '2026-07-01', endDate: '2026-07-03', sourceProvider: 'IMPORT_CSV_DAILY', sourceNote: null,
  rowCount: 3, qualifiedAt: null, releasedAt: null,
  createdAt: '2026-08-16T08:00:00', isCurrentReleased: false,
  contentHash: null, manifestRowCount: null, lineageStatus: null,
};

const draftVersion: DatasetVersion = {
  id: 21, datasetId: 2, datasetCode: 'CN_DAILY_IMPORT', versionCode: 'V2021H1', status: 'DRAFT',
  startDate: '2021-01-04', endDate: '2021-01-06', sourceProvider: 'IMPORT_CSV_DAILY', sourceNote: null,
  rowCount: null, qualifiedAt: null, releasedAt: null,
  createdAt: '2026-08-16T12:00:00', isCurrentReleased: false,
};

const qualityResults: QualityResult[] = [
  { datasetVersionId: 3, checkCode: 'DAILY_BAR_GAP', status: 'FAIL', affectedCount: 12,
    detailJson: '{"missingDates":["2026-07-03"]}', checkedAt: '2026-08-16T10:00:00' },
  { datasetVersionId: 3, checkCode: 'UNIT_ANOMALY', status: 'WARN', affectedCount: 8,
    detailJson: null, checkedAt: '2026-08-16T10:00:00' },
  { datasetVersionId: 3, checkCode: 'DUPLICATE_ROWS', status: 'OK', affectedCount: 0,
    detailJson: null, checkedAt: '2026-08-16T10:00:00' },
];

const coverage: CoverageWatermark[] = [
  { datasetVersionId: 3, canonicalSymbol: 'SH.600519', firstDate: '2026-07-01', lastDate: '2026-07-31',
    rowCount: 23, expectedDays: 23, coveredDays: 23, coverageRatio: 1, calculatedAt: '2026-08-16T10:00:00' },
  { datasetVersionId: 3, canonicalSymbol: 'SZ.000001', firstDate: '2026-07-01', lastDate: '2026-07-30',
    rowCount: 22, expectedDays: 23, coveredDays: 22, coverageRatio: 0.9565, calculatedAt: '2026-08-16T10:00:00' },
  { datasetVersionId: 3, canonicalSymbol: 'BJ.920099', firstDate: null, lastDate: null,
    rowCount: 0, expectedDays: null, coveredDays: null, coverageRatio: null, calculatedAt: null },
];

const historyBatch: ImportBatch = {
  id: 11, importKind: 'DAILY_BAR', providerCode: 'IMPORT_CSV_DAILY', fileName: 'bars.csv',
  fileHash: 'abc', insertedCount: 5, updatedCount: 2, skippedCount: 1, rejectedCount: 3,
  status: 'COMPLETED', errorReportJson: '{"errors":[{"line":3,"reason":"OHLC 无效"}]}',
  createdAt: '2026-08-16T11:00:00', datasetVersionId: 21,
};

const uploadedBatch: ImportBatch = {
  id: 12, importKind: 'DAILY_BAR', providerCode: 'IMPORT_CSV_DAILY', fileName: 'bars2.csv',
  fileHash: 'def', insertedCount: 5, updatedCount: 2, skippedCount: 1, rejectedCount: 2,
  status: 'COMPLETED', errorReportJson: '{"errors":[{"line":9,"reason":"非交易日"}]}',
  createdAt: '2026-08-16T11:05:00', datasetVersionId: 21,
};

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <ConfigProvider locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <div>{children}</div>
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}

/** 打开 antd Select 并点选指定选项（antd 6 无 .ant-select-selector，mousedown 根节点展开）。 */
async function selectAntdOption(testid: string, optionText: string) {
  const selectRoot = screen.getByTestId(testid);
  fireEvent.mouseDown(selectRoot);
  const option = await screen.findByText(optionText);
  fireEvent.click(option);
  await waitFor(() => expect(selectRoot.querySelector('input[role="combobox"]')).not.toBeNull());
}

beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
  vi.clearAllMocks();
  // 默认成功夹具；单个用例按需覆盖。
  mockedListDatasets.mockResolvedValue([dataset, importDataset]);
  mockedListTasks.mockResolvedValue({ items: [], total: 0, page: 1, size: 10 });
  mockedListVersions.mockImplementation(async (code: string) =>
    code === 'CN_DAILY_IMPORT' ? [draftVersion] : [version, rejectedVersion],
  );
  mockedGetReleased.mockResolvedValue(null);
  mockedGetTask.mockResolvedValue(task);
  mockedListChunks.mockResolvedValue([failedChunk]);
  mockedListQuality.mockResolvedValue(qualityResults);
  mockedListCoverage.mockResolvedValue(coverage);
  mockedListImports.mockResolvedValue([historyBatch]);
});

describe('DataFoundationPage（数据中心）', () => {
  // 多轮 antd Form 校验/Select 交互在 4 worker 并行下耗时超过默认 5s，显式放宽到 15s（断言不变）。
  it('F01 必填/日期/chunkSize 校验失败不发起创建请求', async () => {
    render(<DataFoundationPage />, { wrapper: Wrapper });

    // 未选数据集、未填日期直接提交：三条必填校验
    await selectAntdOption('backfill-dataset-select', DATASET_LABEL);
    fireEvent.click(screen.getByTestId('backfill-submit'));
    expect(await screen.findByText('请输入起始日期')).toBeInTheDocument();
    expect(screen.getByText('请输入截止日期')).toBeInTheDocument();
    expect(mockedCreateTask).not.toHaveBeenCalled();

    // 日期格式非法
    fireEvent.change(screen.getByTestId('backfill-start-date'), { target: { value: '2026/07/01' } });
    fireEvent.change(screen.getByTestId('backfill-end-date'), { target: { value: '2026-07-31' } });
    fireEvent.click(screen.getByTestId('backfill-submit'));
    expect(await screen.findByText(/日期格式必须为 YYYY-MM-DD/)).toBeInTheDocument();
    expect(mockedCreateTask).not.toHaveBeenCalled();

    // chunkSize 超上限
    fireEvent.change(screen.getByTestId('backfill-start-date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '501' } });
    fireEvent.click(screen.getByTestId('backfill-submit'));
    expect(await screen.findByText('chunkSize 必须为 1-500 的整数')).toBeInTheDocument();
    expect(mockedCreateTask).not.toHaveBeenCalled();
  }, 15000);

  it('F01 合法表单组装创建 payload（数据集带出 market/provider/frequency/adjust，symbols 解析）', async () => {
    mockedCreateTask.mockResolvedValue(task);
    render(<DataFoundationPage />, { wrapper: Wrapper });

    await selectAntdOption('backfill-dataset-select', DATASET_LABEL);
    fireEvent.change(screen.getByTestId('backfill-start-date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByTestId('backfill-end-date'), { target: { value: '2026-07-31' } });
    fireEvent.change(screen.getByTestId('backfill-symbols'), { target: { value: 'SH.600519, SZ.000001' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByTestId('backfill-submit'));

    await waitFor(() => expect(mockedCreateTask).toHaveBeenCalledTimes(1));
    expect(mockedCreateTask).toHaveBeenCalledWith({
      datasetCode: 'CN_DAILY_BAR',
      marketCode: 'CN',
      providerCode: 'TENCENT_PUBLIC',
      frequency: '1D',
      adjustType: 'NONE',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      symbols: ['SH.600519', 'SZ.000001'],
      chunkSize: 100,
    });
    // 创建失败路径不在此覆盖；成功后无错误提示
    expect(screen.queryByTestId('backfill-create-error')).not.toBeInTheDocument();
  }, 15000);

  it('F01 创建业务失败展示后端 message，不伪造成功', async () => {
    mockedCreateTask.mockRejectedValue(new Error('回补窗口与数据集版本冲突'));
    render(<DataFoundationPage />, { wrapper: Wrapper });

    await selectAntdOption('backfill-dataset-select', DATASET_LABEL);
    fireEvent.change(screen.getByTestId('backfill-start-date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByTestId('backfill-end-date'), { target: { value: '2026-07-31' } });
    fireEvent.click(screen.getByTestId('backfill-submit'));

    expect(await screen.findByTestId('backfill-create-error')).toBeInTheDocument();
    expect(screen.getByText('回补窗口与数据集版本冲突')).toBeInTheDocument();
  });

  it('F02 任务列表渲染状态中文标签与计数（null 显示 --），刷新触发重新查询', async () => {
    mockedListTasks.mockResolvedValue({ items: [task], total: 1, page: 1, size: 10 });
    render(<DataFoundationPage />, { wrapper: Wrapper });

    const statusTag = await screen.findByTestId('task-status-PARTIAL_FAILED');
    expect(statusTag).toHaveTextContent('部分失败');
    expect(statusTag.className).toContain('ant-tag-warning');
    // null 计数（写入/更新）显示 '-- / --'，不显示 0
    expect(screen.getAllByText('-- / --').length).toBeGreaterThan(0);
    expect(screen.queryByText('0 / 0')).not.toBeInTheDocument();
    expect(screen.getByText('共 1 条')).toBeInTheDocument();
    expect(mockedListTasks).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('backfill-refresh'));
    await waitFor(() => expect(mockedListTasks).toHaveBeenCalledTimes(2));
  });

  it('G01 QUEUED 状态渲染为"排队中"，抽屉内暂停可用、启动禁用', async () => {
    mockedListTasks.mockResolvedValue({ items: [queuedTask], total: 1, page: 1, size: 10 });
    mockedGetTask.mockResolvedValue(queuedTask);
    mockedPauseTask.mockResolvedValue(undefined);
    render(<DataFoundationPage />, { wrapper: Wrapper });

    const statusTag = await screen.findByTestId('task-status-QUEUED');
    expect(statusTag).toHaveTextContent('排队中');
    expect(statusTag.className).toContain('ant-tag-processing');

    fireEvent.click(screen.getByTestId('task-detail-btn-8'));
    expect(await screen.findByTestId('task-detail-status')).toHaveTextContent('排队中');

    // QUEUED：启动禁用（防重复启动），暂停可用
    expect(screen.getByTestId('backfill-run-btn')).toBeDisabled();
    expect(screen.getByTestId('backfill-pause-btn')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('backfill-pause-btn'));
    await waitFor(() => expect(mockedPauseTask).toHaveBeenCalledWith(8));
    expect(mockedPauseTask).toHaveBeenCalledTimes(1);
  });

  it('G02 run 快速返回 QUEUED 后立即刷新任务详情（invalidate 生效）', async () => {
    mockedListTasks.mockResolvedValue({ items: [pausedTask], total: 1, page: 1, size: 10 });
    mockedGetTask.mockResolvedValue(pausedTask);
    mockedRunTask.mockResolvedValue(queuedTask);
    render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(await screen.findByTestId('task-detail-btn-9'));
    await waitFor(() => expect(mockedGetTask).toHaveBeenCalledTimes(1));
    const runBtn = await screen.findByTestId('backfill-run-btn');
    expect(runBtn).not.toBeDisabled();

    fireEvent.click(runBtn);
    await waitFor(() => expect(mockedRunTask).toHaveBeenCalledWith(9));
    // run 成功后任务详情被 invalidate 重新查询（不等待轮询）
    await waitFor(() => expect(mockedGetTask.mock.calls.filter(([id]) => id === 9).length).toBeGreaterThanOrEqual(2));
  });

  it('G03 重复点击启动不会重复发起 run 请求', async () => {
    mockedListTasks.mockResolvedValue({ items: [pausedTask], total: 1, page: 1, size: 10 });
    mockedGetTask.mockResolvedValue(pausedTask);
    mockedRunTask.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(queuedTask), 100)));
    render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(await screen.findByTestId('task-detail-btn-9'));
    await screen.findByTestId('backfill-run-btn');

    const runBtn = screen.getByTestId('backfill-run-btn');
    fireEvent.click(runBtn);
    fireEvent.click(runBtn);
    fireEvent.click(runBtn);

    await waitFor(() => expect(mockedRunTask).toHaveBeenCalledTimes(1));
    // pending 期间按钮进入 loading 即禁用，后续点击不触发
    await waitFor(() => expect(mockedRunTask.mock.calls.length).toBe(1));
  });

  it('G04 抽屉分片表展示二维信息：日期窗口与计数', async () => {
    mockedListTasks.mockResolvedValue({ items: [task], total: 1, page: 1, size: 10 });
    render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(await screen.findByTestId('task-detail-btn-7'));
    expect(await screen.findByTestId('chunk-window-3')).toHaveTextContent('2026-07-01 ~ 2026-07-02');
    expect(screen.getByTestId('chunk-counts-3')).toHaveTextContent('0 / 0 / 0 / 1');
  });

  it('G05 数据集为空时给出创建入口（不只是空下拉）', async () => {
    mockedListDatasets.mockResolvedValue([]);
    render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('tab', { name: '数据集与版本' }));
    expect(await screen.findByTestId('create-dataset-entry')).toBeInTheDocument();
    expect(screen.getByTestId('create-dataset-entry-btn')).toBeInTheDocument();
    // 回补表单同样给出创建入口
    expect(screen.getByTestId('backfill-create-dataset-entry')).toBeInTheDocument();
  });

  it('G13 回补数据集下拉只展示在线回补数据集（排除 IMPORT_CSV_DAILY 导入类）', async () => {
    render(<DataFoundationPage />, { wrapper: Wrapper });

    const selectRoot = screen.getByTestId('backfill-dataset-select');
    fireEvent.mouseDown(selectRoot);
    expect(await screen.findByText(DATASET_LABEL)).toBeInTheDocument();
    expect(screen.queryByText(IMPORT_DATASET_LABEL)).not.toBeInTheDocument();
  });

  it('G13b 仅有导入类数据集时回补表单明确提示并给创建入口', async () => {
    mockedListDatasets.mockResolvedValue([importDataset]);
    render(<DataFoundationPage />, { wrapper: Wrapper });

    expect(await screen.findByText('暂无支持在线回补的数据集')).toBeInTheDocument();
    expect(screen.getByTestId('backfill-create-dataset-entry')).toBeInTheDocument();
  });

  it('G14 回补入口新建数据集 Provider 锁定 TENCENT_PUBLIC（禁选其他组合）', async () => {
    mockedListDatasets.mockResolvedValue([]);
    render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(await screen.findByTestId('backfill-create-dataset-entry'));
    const providerRoot = await screen.findByTestId('dataset-create-provider');
    expect(providerRoot.className).toContain('ant-select-disabled');
    expect(providerRoot.textContent).toContain('TENCENT_PUBLIC');
    expect(providerRoot.textContent).not.toContain('IMPORT_CSV_DAILY');
  });

  it('G15 导入入口新建数据集 Provider 锁定 IMPORT_CSV_DAILY', async () => {
    render(<DataFoundationPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('tab', { name: '导入' }));

    fireEvent.click(await screen.findByTestId('import-create-dataset-entry'));
    const providerRoot = await screen.findByTestId('dataset-create-provider');
    expect(providerRoot.className).toContain('ant-select-disabled');
    expect(providerRoot.textContent).toContain('IMPORT_CSV_DAILY');
    expect(providerRoot.textContent).not.toContain('TENCENT_PUBLIC（');
  });

  it('G17 数据集创建 Modal 重开时清理上一次错误（不残留 mutation 错误态）', async () => {
    mockedListDatasets.mockResolvedValue([]);
    mockedCreateDataset.mockRejectedValueOnce(new Error('datasetCode 已存在'));
    render(<DataFoundationPage />, { wrapper: Wrapper });

    // 第一次打开：提交失败展示真实 message
    fireEvent.click(await screen.findByTestId('backfill-create-dataset-entry'));
    fireEvent.change(await screen.findByTestId('dataset-create-code'), { target: { value: 'CN_DAILY_X' } });
    fireEvent.change(screen.getByTestId('dataset-create-name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: '创 建' }));
    expect(await screen.findByTestId('dataset-create-error')).toHaveTextContent('datasetCode 已存在');

    // 关闭后重开：错误已清理
    fireEvent.click(screen.getByRole('button', { name: '取 消' }));
    fireEvent.click(await screen.findByTestId('backfill-create-dataset-entry'));
    await screen.findByTestId('dataset-create-modal');
    expect(screen.queryByTestId('dataset-create-error')).not.toBeInTheDocument();
  }, 15000);

  it('G16 创建任务成功后自动打开新任务详情（PENDING 状态/任务 ID/窗口/证券数/分片数）', async () => {
    mockedCreateTask.mockResolvedValue(newPendingTask);
    mockedGetTask.mockResolvedValue(newPendingTask);
    render(<DataFoundationPage />, { wrapper: Wrapper });

    await selectAntdOption('backfill-dataset-select', DATASET_LABEL);
    fireEvent.change(screen.getByTestId('backfill-start-date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByTestId('backfill-end-date'), { target: { value: '2026-07-03' } });
    fireEvent.change(screen.getByTestId('backfill-symbols'), { target: { value: 'SH.600519' } });
    fireEvent.click(screen.getByTestId('backfill-submit'));

    await waitFor(() => expect(mockedCreateTask).toHaveBeenCalledTimes(1));
    // 新任务详情抽屉自动打开并展示 PENDING（待启动）、任务 ID、窗口、证券数与分片统计
    expect(await screen.findByText('回补任务 #77（CN_DAILY_BAR）')).toBeInTheDocument();
    expect(screen.getByTestId('task-detail-status')).toHaveTextContent('待启动');
    expect(screen.getAllByText('2026-07-01 ~ 2026-07-03').length).toBeGreaterThan(0);
    expect(screen.getByTestId('task-chunk-progress')).toHaveTextContent('0 / 0 / 1');
    await waitFor(() => expect(mockedGetTask).toHaveBeenCalledWith(77));
    // 创建后表单已重置（起始日期输入为空）
    expect((screen.getByTestId('backfill-start-date') as HTMLInputElement).value).toBe('');
  }, 15000);

  it('G06 创建数据集成功后刷新并自动选中新数据集', async () => {
    mockedCreateDataset.mockResolvedValue({
      ...dataset, id: 9, datasetCode: 'CN_DAILY_NEW', datasetName: '新数据集', currentVersionId: null,
    });
    render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('tab', { name: '数据集与版本' }));
    fireEvent.click(await screen.findByTestId('create-dataset-btn'));

    fireEvent.change(await screen.findByTestId('dataset-create-code'), { target: { value: 'CN_DAILY_NEW' } });
    fireEvent.change(screen.getByTestId('dataset-create-name'), { target: { value: '新数据集' } });
    await selectAntdOption('dataset-create-provider', 'TENCENT_PUBLIC（腾讯公共源·实验性）');
    fireEvent.click(screen.getByRole('button', { name: '创 建' }));

    await waitFor(() => expect(mockedCreateDataset).toHaveBeenCalledTimes(1));
    expect(mockedCreateDataset).toHaveBeenCalledWith({
      datasetCode: 'CN_DAILY_NEW', datasetName: '新数据集', marketCode: 'CN',
      barType: 'DAILY', frequency: '1D', providerCode: 'TENCENT_PUBLIC', adjustType: 'NONE',
      description: undefined,
    });
    // 数据集列表刷新 + 新数据集自动选中（触发其版本查询）
    await waitFor(() => expect(mockedListDatasets.mock.calls.length).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(mockedListVersions).toHaveBeenCalledWith('CN_DAILY_NEW'));
  }, 15000);

  it('G07 导入 Tab：DAILY_BAR 未选择版本时禁止上传', async () => {
    render(<DataFoundationPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('tab', { name: '导入' }));

    await screen.findByTestId('import-version-flow');
    const file = new File(['symbol,trade_date\nSH.600519,2026-07-01\n'], 'bars.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByTestId('import-submit')).toBeDisabled());
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('G08 导入 Tab：DAILY_BAR 选择导入数据集与 DRAFT 版本后上传携带 datasetVersionId', async () => {
    mockedUpload.mockResolvedValue(uploadedBatch);
    const { container } = render(<DataFoundationPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('tab', { name: '导入' }));

    await screen.findByTestId('import-version-flow');
    await selectAntdOption('import-dataset-select', IMPORT_DATASET_LABEL);
    await selectAntdOption('import-version-select', 'V2021H1（2021-01-04 ~ 2021-01-06）');

    const file = new File(['symbol,trade_date,open,high,low,close,volume,amount\nSH.600519,2021-01-04,1,1,1,1,100,100\n'], 'bars2.csv', { type: 'text/csv' });
    const input = container.querySelector('input[type="file"]') as HTMLElement;
    fireEvent.change(input, { target: { files: [file] } });

    const submit = screen.getByTestId('import-submit');
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));
    expect(mockedUpload.mock.calls[0][0]).toBe('DAILY_BAR');
    expect(mockedUpload.mock.calls[0][1]).toBe(file);
    expect(mockedUpload.mock.calls[0][2]).toBe(21);

    // 上传结果展示关联版本
    expect(await screen.findByTestId('import-result')).toHaveTextContent('版本 #21');
    // 历史批次关联版本列
    expect(await screen.findByTestId('import-batch-version-11')).toHaveTextContent('#21');
  }, 15000);

  it('G09 非 DAILY_BAR 导入不强制版本（TRADING_CALENDAR 无版本关联直传）', async () => {
    mockedUpload.mockResolvedValue({ ...uploadedBatch, importKind: 'TRADING_CALENDAR', datasetVersionId: null });
    const { container } = render(<DataFoundationPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('tab', { name: '导入' }));

    await screen.findByTestId('import-version-flow');
    await selectAntdOption('import-kind-select', 'TRADING_CALENDAR（交易日历）');
    // 切换非 DAILY_BAR 后不渲染版本选择区
    await waitFor(() => expect(screen.queryByTestId('import-version-select')).not.toBeInTheDocument());

    const file = new File(['market_code,trade_date,is_trading_day\nCN,2026-07-01,true\n'], 'cal.csv', { type: 'text/csv' });
    const input = container.querySelector('input[type="file"]') as HTMLElement;
    fireEvent.change(input, { target: { files: [file] } });

    const submit = screen.getByTestId('import-submit');
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));
    expect(mockedUpload.mock.calls[0][0]).toBe('TRADING_CALENDAR');
    expect(mockedUpload.mock.calls[0][2]).toBeUndefined();
  }, 15000);

  it('G10 导入 Tab：新建版本（POST /datasets/{code}/versions）成功后自动选中', async () => {
    mockedCreateVersion.mockResolvedValue({ ...draftVersion, id: 22, versionCode: 'V2021H2' });
    render(<DataFoundationPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('tab', { name: '导入' }));

    await screen.findByTestId('import-version-flow');
    await selectAntdOption('import-dataset-select', IMPORT_DATASET_LABEL);
    await waitFor(() => expect(screen.getByTestId('import-create-version-btn')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('import-create-version-btn'));

    fireEvent.change(await screen.findByTestId('version-create-start'), { target: { value: '2021-07-01' } });
    fireEvent.change(screen.getByTestId('version-create-end'), { target: { value: '2021-07-31' } });
    fireEvent.click(screen.getByRole('button', { name: '创 建' }));

    await waitFor(() => expect(mockedCreateVersion).toHaveBeenCalledTimes(1));
    expect(mockedCreateVersion).toHaveBeenCalledWith('CN_DAILY_IMPORT', { startDate: '2021-07-01', endDate: '2021-07-31' });
  }, 15000);

  it('G11 版本展示 contentHash 缩略 / manifestRowCount / lineageStatus 异常警告', async () => {
    render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('tab', { name: '数据集与版本' }));
    await selectAntdOption('dataset-select', DATASET_LABEL);

    expect(await screen.findByTestId('version-hash-3')).toHaveTextContent('abcdef12…7890');
    expect(await screen.findByTestId('version-manifest-3')).toHaveTextContent('1188');
    const lineageTag = screen.getByTestId('version-lineage-3');
    expect(lineageTag).toHaveTextContent('PENDING');
    expect(lineageTag.className).toContain('ant-tag-warning');
  }, 15000);

  it('G12 REJECTED 版本发布按钮禁用，展开显示主要失败质量项；QUALIFIED 才可发布', async () => {
    render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('tab', { name: '数据集与版本' }));
    await selectAntdOption('dataset-select', DATASET_LABEL);
    await screen.findByText('V20260731');

    // REJECTED 版本发布禁用；QUALIFIED 版本发布可用
    expect(screen.getByTestId('publish-btn-4')).toBeDisabled();
    expect(screen.getByTestId('publish-btn-3')).not.toBeDisabled();

    // 展开 REJECTED 行查看失败项（antd 对不可展开行渲染 spaced 占位图标，取真实可展开的那个）
    const expandIcons = Array.from(document.querySelectorAll('.ant-table-row-expand-icon'));
    const expandBtn = expandIcons.find((node) => !node.className.includes('spaced'));
    expect(expandBtn).toBeDefined();
    fireEvent.click(expandBtn as HTMLElement);
    expect(await screen.findByTestId('rejected-fails-4')).toHaveTextContent('DAILY_BAR_GAP');
  }, 15000);

  it('F03 详情抽屉展示分片失败原因，重试按钮触发 retryFailedChunks', async () => {
    mockedListTasks.mockResolvedValue({ items: [task], total: 1, page: 1, size: 10 });
    mockedRetryChunks.mockResolvedValue(task);
    render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(await screen.findByTestId('task-detail-btn-7'));

    // 分片失败原因完整可见（错误码 + message）
    expect(await screen.findByTestId('chunk-error-3')).toHaveTextContent('PROVIDER_CALL_FAILED');
    expect(screen.getByTestId('chunk-error-3')).toHaveTextContent('腾讯公共源 429 限流');
    // 任务级最近错误同样展示
    expect(screen.getByTestId('task-last-error')).toBeInTheDocument();
    expect(mockedGetTask).toHaveBeenCalledWith(7);
    expect(mockedListChunks).toHaveBeenCalledWith(7);

    fireEvent.click(screen.getByTestId('backfill-retry-btn'));
    await waitFor(() => expect(mockedRetryChunks).toHaveBeenCalledWith(7));
    expect(mockedRetryChunks).toHaveBeenCalledTimes(1);
  });

  it('F04 版本质量结果 FAIL/WARN 标色、覆盖率百分比与 null 占位，质量检查/发布可触发，FAIL 给出阻断说明', async () => {
    mockedRunQualityCheck.mockResolvedValue(qualityResults);
    render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('tab', { name: '数据集与版本' }));
    await selectAntdOption('dataset-select', DATASET_LABEL);

    // 版本列表与未发布空态（发布门禁说明，不把空当错误）
    expect(await screen.findByText('V20260731')).toBeInTheDocument();
    expect(await screen.findByText(/尚未发布任何版本/)).toBeInTheDocument();

    // 点击版本行 → 覆盖率与质量结果 + 发布门禁阻断说明（FAIL 来源真实质量结果）
    fireEvent.click(screen.getByText('V20260731'));
    expect(await screen.findByTestId('coverage-quality-3')).toBeInTheDocument();
    expect(await screen.findByTestId('publish-gate-blocked')).toHaveTextContent('DAILY_BAR_GAP');
    expect(screen.getByTestId('publish-gate-blocked')).toHaveTextContent('UNIT_ANOMALY');

    const failTag = screen.getByTestId('quality-status-FAIL');
    expect(failTag).toHaveTextContent('FAIL');
    expect(failTag.className).toContain('ant-tag-error');
    const warnTag = screen.getByTestId('quality-status-WARN');
    expect(warnTag.className).toContain('ant-tag-warning');
    expect(screen.getByTestId('quality-status-OK').className).toContain('ant-tag-success');
    expect(screen.getByText('DAILY_BAR_GAP')).toBeInTheDocument();

    // 覆盖率：95.65% 百分比 + null 行 '--'
    expect(screen.getAllByText('95.65%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100.00%').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('coverage-ratio').map((node) => node.textContent)).toContain('--');

    // 质量检查与发布（QUALIFIED 版本发布可点）
    fireEvent.click(screen.getByTestId('quality-check-btn-3'));
    await waitFor(() => expect(mockedRunQualityCheck).toHaveBeenCalledWith(3));

    mockedPublish.mockResolvedValue({ ...version, status: 'RELEASED', isCurrentReleased: true });
    fireEvent.click(screen.getByTestId('publish-btn-3'));
    await waitFor(() => expect(mockedPublish).toHaveBeenCalledWith(3));
  }, 15000);

  it('F05 mock 模式仅提示切换后端模式，不调用任何 api、无假数据', () => {
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
    render(<DataFoundationPage />, { wrapper: Wrapper });

    expect(screen.getByTestId('data-foundation-mock-unavailable')).toBeInTheDocument();
    expect(screen.getByText('数据中心需要后端数据模式，请在设置中切换为后端模式。')).toBeInTheDocument();

    expect(mockedListDatasets).not.toHaveBeenCalled();
    expect(mockedListTasks).not.toHaveBeenCalled();
    expect(mockedListVersions).not.toHaveBeenCalled();
    expect(mockedListImports).not.toHaveBeenCalled();
    expect(mockedListQuality).not.toHaveBeenCalled();
    expect(mockedListCoverage).not.toHaveBeenCalled();
    expect(mockedUpload).not.toHaveBeenCalled();

    // 不渲染任何演示任务/数据集/批次
    expect(screen.queryByText('CN_DAILY_BAR')).not.toBeInTheDocument();
    expect(screen.queryByText('部分失败')).not.toBeInTheDocument();
    expect(screen.queryByText('回补任务')).not.toBeInTheDocument();
  });

  it('F07 remote 失败显示错误与重试入口，无假数据兜底', async () => {
    mockedListTasks.mockRejectedValue(new Error('后端连接失败'));
    mockedListDatasets.mockRejectedValue(new Error('后端连接失败'));
    render(<DataFoundationPage />, { wrapper: Wrapper });

    expect(await screen.findByTestId('backfill-list-error')).toHaveTextContent('后端连接失败');
    expect(screen.queryByTestId('task-status-PARTIAL_FAILED')).not.toBeInTheDocument();
    expect(screen.queryByText('2026-07-01 ~ 2026-07-31')).not.toBeInTheDocument();

    // 只失败一次请求后无任何本地数据兜底；刷新可重试
    expect(mockedListTasks).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('backfill-refresh'));
    await waitFor(() => expect(mockedListTasks).toHaveBeenCalledTimes(2));
  });
});
