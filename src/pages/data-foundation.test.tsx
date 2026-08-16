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
  getBackfillTask,
  getReleasedVersion,
  listBackfillChunks,
  listBackfillTasks,
  listCoverage,
  listDatasets,
  listDatasetVersions,
  listImportBatches,
  listQualityResults,
  publishVersion,
  retryFailedChunks,
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
const mockedListVersions = vi.mocked(listDatasetVersions);
const mockedGetReleased = vi.mocked(getReleasedVersion);
const mockedGetTask = vi.mocked(getBackfillTask);
const mockedListChunks = vi.mocked(listBackfillChunks);
const mockedListTasks = vi.mocked(listBackfillTasks);
const mockedCreateTask = vi.mocked(createBackfillTask);
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

const DATASET_LABEL = 'CN_DAILY_BAR（A股日K数据集）';

const task: BackfillTask = {
  id: 7, datasetCode: 'CN_DAILY_BAR', datasetVersionId: 3, marketCode: 'CN',
  providerCode: 'TENCENT_PUBLIC', frequency: '1D', adjustType: 'NONE',
  startDate: '2026-07-01', endDate: '2026-07-31', chunkSize: 100, status: 'PARTIAL_FAILED',
  plannedCount: 10, successCount: 8, failCount: 2, skipCount: 0,
  insertedCount: null, updatedCount: null, lastErrorCode: 'PROVIDER_CALL_FAILED',
  lastErrorMessage: '公共源 429', startedAt: '2026-08-16T10:00:00', finishedAt: null,
  createdAt: '2026-08-16T09:58:00', symbols: null, totalChunks: 10, succeededChunks: 8, failedChunks: 2,
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
  createdAt: '2026-08-16T11:00:00',
};

const uploadedBatch: ImportBatch = {
  id: 12, importKind: 'DAILY_BAR', providerCode: 'IMPORT_CSV_DAILY', fileName: 'bars2.csv',
  fileHash: 'def', insertedCount: 5, updatedCount: 2, skippedCount: 1, rejectedCount: 2,
  status: 'COMPLETED', errorReportJson: '{"errors":[{"line":9,"reason":"非交易日"}]}',
  createdAt: '2026-08-16T11:05:00',
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
  mockedListDatasets.mockResolvedValue([dataset]);
  mockedListTasks.mockResolvedValue({ items: [], total: 0, page: 1, size: 10 });
  mockedListVersions.mockResolvedValue([version]);
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

  it('F02 任务列表渲染状态 Tag 与计数（null 显示 --），刷新触发重新查询', async () => {
    mockedListTasks.mockResolvedValue({ items: [task], total: 1, page: 1, size: 10 });
    render(<DataFoundationPage />, { wrapper: Wrapper });

    const statusTag = await screen.findByTestId('task-status-PARTIAL_FAILED');
    expect(statusTag).toHaveTextContent('PARTIAL_FAILED');
    expect(statusTag.className).toContain('ant-tag-warning');
    // null 计数（写入/更新）显示 '-- / --'，不显示 0
    expect(screen.getAllByText('-- / --').length).toBeGreaterThan(0);
    expect(screen.queryByText('0 / 0')).not.toBeInTheDocument();
    expect(screen.getByText('共 1 条')).toBeInTheDocument();
    expect(mockedListTasks).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('backfill-refresh'));
    await waitFor(() => expect(mockedListTasks).toHaveBeenCalledTimes(2));
  });

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

  it('F04 版本质量结果 FAIL/WARN 标色、覆盖率百分比与 null 占位，质量检查/发布可触发', async () => {
    mockedRunQualityCheck.mockResolvedValue(qualityResults);
    render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('tab', { name: '数据集与版本' }));
    await selectAntdOption('dataset-select', DATASET_LABEL);

    // 版本列表与未发布空态（发布门禁说明，不把空当错误）
    expect(await screen.findByText('V20260731')).toBeInTheDocument();
    expect(await screen.findByText(/尚未发布任何版本/)).toBeInTheDocument();

    // 点击版本行 → 覆盖率与质量结果
    fireEvent.click(screen.getByText('V20260731'));
    expect(await screen.findByTestId('coverage-quality-3')).toBeInTheDocument();

    const failTag = await screen.findByTestId('quality-status-FAIL');
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

  it('F05 导入上传走 kind+file，结果计数与错误报告展示，历史批次含错误行', async () => {
    mockedUpload.mockResolvedValue(uploadedBatch);
    const { container } = render(<DataFoundationPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('tab', { name: '导入' }));

    // 历史批次计数与错误报告
    expect(await screen.findByText('bars.csv')).toBeInTheDocument();
    expect(screen.getByTestId('import-error-11')).toHaveTextContent('OHLC 无效');

    // 上传：选择文件 → 提交
    const file = new File(['trade_date,symbol\n2026-07-01,SH.600519\n'], 'bars2.csv', { type: 'text/csv' });
    const input = container.querySelector('input[type="file"]') as HTMLElement;
    fireEvent.change(input, { target: { files: [file] } });

    const submit = await screen.findByTestId('import-submit');
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));
    expect(mockedUpload.mock.calls[0][0]).toBe('DAILY_BAR');
    expect(mockedUpload.mock.calls[0][1]).toBe(file);

    // 上传结果：批次计数 + 错误报告展开
    expect(await screen.findByTestId('import-result')).toHaveTextContent('批次 #12');
    expect(screen.getByText('新增 5')).toBeInTheDocument();
    expect(screen.getByText('更新 2')).toBeInTheDocument();
    expect(screen.getByText('拒绝 2')).toBeInTheDocument();
    expect(screen.getByTestId('import-result-error-report')).toHaveTextContent('非交易日');
  });

  it('F06 mock 模式仅提示切换后端模式，不调用任何 api、无假数据', () => {
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
    expect(screen.queryByText('PARTIAL_FAILED')).not.toBeInTheDocument();
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
