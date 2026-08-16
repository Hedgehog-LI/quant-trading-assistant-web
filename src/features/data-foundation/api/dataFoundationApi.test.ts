import { beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../../../shared/api/client';
import { clearAll } from '../../../shared/api/localStorageClient';
import { saveSettings } from '../../settings/api/settingsApi';
import {
  createBackfillTask,
  getReleasedVersion,
  listBackfillTasks,
  listDatasets,
  listDatasetVersions,
  listImportBatches,
  pauseBackfillTask,
  publishVersion,
  runQualityCheck,
  uploadImportSnapshot,
} from './dataFoundationApi';
import type { BackfillTask, DatasetVersion, ImportBatch } from '../model/types';

function okResponse<T>(data: T) {
  return { data: { success: true, code: 'SUCCESS', data, message: null } };
}

function failResponse(code: string, message: string) {
  return { data: { success: false, code, message, data: null } };
}

const minimalTask: BackfillTask = {
  id: 7, datasetCode: 'CN_DAILY_BAR', datasetVersionId: 3, marketCode: 'CN',
  providerCode: 'TENCENT_PUBLIC', frequency: '1D', adjustType: 'NONE',
  startDate: '2026-07-01', endDate: '2026-07-31', chunkSize: 100, status: 'PARTIAL_FAILED',
  plannedCount: 10, successCount: 9, failCount: 1, skipCount: 0,
  insertedCount: 220, updatedCount: 3, lastErrorCode: 'PROVIDER_CALL_FAILED',
  lastErrorMessage: 'provider 429', startedAt: '2026-08-16T10:00:00', finishedAt: null,
  createdAt: '2026-08-16T09:58:00', symbols: null, totalChunks: 10, succeededChunks: 9, failedChunks: 1,
};

const minimalVersion: DatasetVersion = {
  id: 3, datasetId: 1, datasetCode: 'CN_DAILY_BAR', versionCode: 'V20260731',
  status: 'QUALIFIED', startDate: '2021-01-01', endDate: '2026-07-31',
  sourceProvider: 'TENCENT_PUBLIC', sourceNote: null, rowCount: 1200,
  qualifiedAt: '2026-08-01T00:00:00', releasedAt: null, createdAt: '2026-07-31T20:00:00',
  isCurrentReleased: false,
};

const minimalBatch: ImportBatch = {
  id: 11, importKind: 'DAILY_BAR', providerCode: 'IMPORT_CSV_DAILY', fileName: 'bars.csv',
  fileHash: 'abc', insertedCount: 5, updatedCount: 2, skippedCount: 1, rejectedCount: 1,
  status: 'COMPLETED', errorReportJson: '{"errors":[{"line":3,"reason":"OHLC 无效"}]}',
  createdAt: '2026-08-16T11:00:00',
};

describe('dataFoundationApi', () => {
  beforeEach(() => {
    clearAll();
    vi.restoreAllMocks();
  });

  it('remote 数据集版本查询拼接 code 路径，回补任务列表透传 status/page/pageSize', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const get = vi.spyOn(client, 'get')
      .mockResolvedValueOnce(okResponse([minimalVersion]))
      .mockResolvedValueOnce(okResponse({ items: [minimalTask], total: 1, page: 1, size: 20 }));

    const versions = await listDatasetVersions('CN_DAILY_BAR');
    const tasks = await listBackfillTasks({ status: 'PARTIAL_FAILED', page: 1, pageSize: 20 });

    expect(get).toHaveBeenNthCalledWith(1, '/market-data/data-foundation/datasets/CN_DAILY_BAR/versions');
    expect(versions[0].versionCode).toBe('V20260731');
    expect(get).toHaveBeenNthCalledWith(2, '/market-data/data-foundation/backfill-tasks', {
      params: { status: 'PARTIAL_FAILED', page: 1, pageSize: 20 },
    });
    expect(tasks.total).toBe(1);
  });

  it('remote status 省略时不下发空参数（undefined 被剔除）', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const get = vi.spyOn(client, 'get')
      .mockResolvedValue(okResponse({ items: [], total: 0, page: 1, size: 20 }));

    await listBackfillTasks({ page: 2, pageSize: 50 });

    expect(get).toHaveBeenCalledWith('/market-data/data-foundation/backfill-tasks', {
      params: { status: undefined, page: 2, pageSize: 50 },
    });
  });

  it('创建回补任务 POST 组装 body（symbols 数组与 chunkSize 原样透传）', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const post = vi.spyOn(client, 'post').mockResolvedValue(okResponse(minimalTask));

    const task = await createBackfillTask({
      datasetCode: 'CN_DAILY_BAR', marketCode: 'CN', providerCode: 'TENCENT_PUBLIC',
      frequency: '1D', adjustType: 'NONE', startDate: '2026-07-01', endDate: '2026-07-31',
      symbols: ['SH.600519'], chunkSize: 100,
    });

    expect(post).toHaveBeenCalledWith('/market-data/data-foundation/backfill-tasks', {
      datasetCode: 'CN_DAILY_BAR', marketCode: 'CN', providerCode: 'TENCENT_PUBLIC',
      frequency: '1D', adjustType: 'NONE', startDate: '2026-07-01', endDate: '2026-07-31',
      symbols: ['SH.600519'], chunkSize: 100,
    });
    expect(task.id).toBe(7);
  });

  it('业务失败（success=false）抛 ApiRequestError 并保留后端 message', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    vi.spyOn(client, 'post').mockResolvedValue(
      failResponse('DATA_FOUNDATION_QUALITY_GATE_FAILED', '存在 FAIL 质量检查，禁止发布'),
    );

    await expect(publishVersion(3)).rejects.toThrow('存在 FAIL 质量检查，禁止发布');
    await expect(publishVersion(3)).rejects.toMatchObject({
      name: 'ApiRequestError',
      code: 'DATA_FOUNDATION_QUALITY_GATE_FAILED',
    });
  });

  it('质量检查 POST、发布 POST 路径正确', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const post = vi.spyOn(client, 'post')
      .mockResolvedValueOnce(okResponse([]))
      .mockResolvedValueOnce(okResponse({ ...minimalVersion, status: 'RELEASED', isCurrentReleased: true }));

    await runQualityCheck(3);
    const released = await publishVersion(3);

    expect(post).toHaveBeenNthCalledWith(1, '/market-data/data-foundation/dataset-versions/3/quality-check');
    expect(post).toHaveBeenNthCalledWith(2, '/market-data/data-foundation/dataset-versions/3/publish');
    expect(released.status).toBe('RELEASED');
  });

  it('导入上传构造 FormData（字段名 file）且 kind 为查询参数，不手动设置 Content-Type', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const post = vi.spyOn(client, 'post').mockResolvedValue(okResponse(minimalBatch));
    const file = new File(['date,symbol\n2026-07-01,SH.600519\n'], 'bars.csv', { type: 'text/csv' });

    const batch = await uploadImportSnapshot('DAILY_BAR', file);

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/market-data/data-foundation/imports');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect(config).toEqual({ params: { kind: 'DAILY_BAR' } });
    expect(JSON.stringify(config)).not.toContain('Content-Type');
    expect(batch.rejectedCount).toBe(1);
  });

  it('导入批次列表 kind 省略时参数剔除、路径正确', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const get = vi.spyOn(client, 'get').mockResolvedValue(okResponse([minimalBatch]));

    await listImportBatches({ page: 1, pageSize: 10 });

    expect(get).toHaveBeenCalledWith('/market-data/data-foundation/imports', {
      params: { kind: undefined, page: 1, pageSize: 10 },
    });
  });

  it('未发布版本 data=null 解包为 null（合法语义，非失败）', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    vi.spyOn(client, 'get').mockResolvedValue(okResponse(null));

    await expect(getReleasedVersion('CN_DAILY_BAR')).resolves.toBeNull();
  });

  it('暂停接口 data=null 用 unwrapVoid 只校验 success', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const post = vi.spyOn(client, 'post').mockResolvedValue(okResponse(null));

    await expect(pauseBackfillTask(7)).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith('/market-data/data-foundation/backfill-tasks/7/pause');
  });

  it('remote 网络失败直接抛错，禁止回退任何本地演示数据', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    vi.spyOn(client, 'get').mockRejectedValue(new Error('Network Error'));

    await expect(listBackfillTasks({ page: 1, pageSize: 20 })).rejects.toThrow('Network Error');
  });

  it('mock 模式设置下仍只走 HTTP：不存在本地合成数据路径', async () => {
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
    const get = vi.spyOn(client, 'get').mockResolvedValue(okResponse([]));

    const datasets = await listDatasets();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/market-data/data-foundation/datasets');
    expect(datasets).toEqual([]);
    expect(JSON.stringify(datasets)).not.toContain('DEMO');
  });
});
