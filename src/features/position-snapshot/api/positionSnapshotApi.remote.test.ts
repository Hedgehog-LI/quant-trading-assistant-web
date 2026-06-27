import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/api/client', () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

import { positionSnapshotApi } from './positionSnapshotApi';
import { client } from '../../../shared/api/client';
import { clearAll } from '../../../shared/api/localStorageClient';
import { saveSettings } from '../../settings/api/settingsApi';
import type { ApiResponse } from '../../../shared/api/types';
import type { PositionSnapshotDetail } from '../model/types';

function ok<T>(data: T | null): { data: ApiResponse<T> } {
  return { data: { success: true, code: 'SUCCESS', message: null, data, timestamp: '' } };
}

function detail(): PositionSnapshotDetail {
  return {
    id: 1,
    snapshotDate: '2026-06-27',
    snapshotTime: '2026-06-27T15:05:00',
    snapshotName: '收盘持仓',
    sourceType: 'MANUAL',
    snapshotStatus: 'DRAFT',
    totalCostAmount: 1000,
    totalMarketValue: 1200,
    totalUnrealizedPnl: 200,
    totalPnlRate: 0.2,
    positionCount: 0,
    items: [],
    createdAt: '',
    updatedAt: '',
  };
}

beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
  vi.mocked(client.get).mockReset();
  vi.mocked(client.post).mockReset();
  vi.mocked(client.put).mockReset();
  vi.mocked(client.patch).mockReset();
});

describe('positionSnapshotApi remote', () => {
  it('list 传递历史查询参数', async () => {
    vi.mocked(client.get).mockResolvedValue(ok([detail()]));
    const result = await positionSnapshotApi.list({ status: 'DRAFT', includeCanceled: false });
    expect(result).toHaveLength(1);
    expect(client.get).toHaveBeenCalledWith('/position-snapshots', {
      params: { status: 'DRAFT', includeCanceled: false },
    });
  });

  it('latest 允许后端返回 data=null', async () => {
    vi.mocked(client.get).mockResolvedValue(ok(null));
    await expect(positionSnapshotApi.getLatest()).resolves.toBeNull();
  });

  it('latest 兼容后端省略空 data 字段', async () => {
    vi.mocked(client.get).mockResolvedValue({
      data: { success: true, code: 'SUCCESS', message: null, timestamp: '' },
    });
    await expect(positionSnapshotApi.getLatest()).resolves.toBeNull();
  });

  it('create 调用创建接口', async () => {
    vi.mocked(client.post).mockResolvedValue(ok(detail()));
    const input = {
      snapshotDate: '2026-06-27',
      snapshotTime: '2026-06-27T15:05:00',
      sourceType: 'MANUAL' as const,
      snapshotStatus: 'DRAFT' as const,
      items: [],
    };
    await positionSnapshotApi.create(input);
    expect(client.post).toHaveBeenCalledWith('/position-snapshots', input);
  });

  it('update 调用草稿整批更新接口', async () => {
    vi.mocked(client.put).mockResolvedValue(ok(detail()));
    const input = {
      snapshotDate: '2026-06-27',
      snapshotTime: '2026-06-27T15:05:00',
      items: [],
    };
    await positionSnapshotApi.update(1, input);
    expect(client.put).toHaveBeenCalledWith('/position-snapshots/1', input);
  });

  it('confirm 和 cancel 使用独立状态接口', async () => {
    vi.mocked(client.patch).mockResolvedValue(ok(detail()));
    await positionSnapshotApi.confirm(1);
    await positionSnapshotApi.cancel(1);
    expect(client.patch).toHaveBeenNthCalledWith(1, '/position-snapshots/1/confirm');
    expect(client.patch).toHaveBeenNthCalledWith(2, '/position-snapshots/1/cancel');
  });
});
