/**
 * reviewApi remote 分支单测。
 *
 * 用 vi.mock 拦截 shared/api/client，断言各 remote 实现正确解包 ApiResponse，
 * 以及 success=false 时抛错。vi.mock 必须在文件顶层，vi.fn 在 beforeEach 重置。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../shared/api/client', () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

import {
  getReviews,
  addReview,
  updateReview,
  getReviewById,
  deleteReview,
} from './reviewApi';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';
import { client } from '../../../shared/api/client';
import type { ReviewNote } from '../../../shared/types/domain';
import type { ApiResponse } from '../../../shared/api/types';

function ok<T>(data: T): { data: ApiResponse<T> } {
  return { data: { success: true, code: 'SUCCESS', message: null, data, timestamp: '' } };
}

function fail(message: string): { data: ApiResponse<unknown> } {
  return { data: { success: false, code: 'BIZ_ERROR', message, data: null, timestamp: '' } };
}

function buildReview(overrides: Partial<ReviewNote> = {}): ReviewNote {
  return {
    id: '1',
    reviewDate: '2026-06-08',
    title: '今日复盘',
    linkedJournalIds: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
  vi.mocked(client.get).mockReset();
  vi.mocked(client.post).mockReset();
  vi.mocked(client.put).mockReset();
  vi.mocked(client.delete).mockReset();
  vi.mocked(client.patch).mockReset();
});

describe('reviewApi (remote)', () => {
  it('getReviews 解包数组', async () => {
    const list = [buildReview()];
    vi.mocked(client.get).mockResolvedValue(ok(list));
    const result = await getReviews();
    expect(result).toEqual(list);
    expect(client.get).toHaveBeenCalledWith('/reviews');
  });

  it('addReview 解包新建项', async () => {
    const created = buildReview({ id: '2' });
    vi.mocked(client.post).mockResolvedValue(ok(created));
    const result = await addReview({
      reviewDate: '2026-06-08',
      title: '今日复盘',
      linkedJournalIds: [],
    });
    expect(result.id).toBe('2');
    expect(client.post).toHaveBeenCalledWith('/reviews', {
      reviewDate: '2026-06-08',
      title: '今日复盘',
      linkedJournalIds: [],
    });
  });

  it('updateReview 先 GET 后 PUT 合并，避免丢字段', async () => {
    const existing = buildReview({ id: '3', marketContext: '震荡' });
    vi.mocked(client.get).mockResolvedValue(ok(existing));
    vi.mocked(client.put).mockResolvedValue(ok({ ...existing, title: '改后标题' }));
    const result = await updateReview('3', { title: '改后标题' });
    expect(result?.title).toBe('改后标题');
    // PUT 的 body 是合并后的完整对象，保留 marketContext。
    expect(client.put).toHaveBeenCalledWith(
      '/reviews/3',
      expect.objectContaining({ marketContext: '震荡', title: '改后标题' }),
    );
  });

  it('getReviewById 业务失败返回 null（与 mock 口径一致）', async () => {
    vi.mocked(client.get).mockResolvedValue(fail('RESOURCE_NOT_FOUND'));
    const result = await getReviewById('not-exist');
    expect(result).toBeNull();
  });

  it('getReviews 业务失败抛错', async () => {
    vi.mocked(client.get).mockResolvedValue(fail('INTERNAL_ERROR'));
    await expect(getReviews()).rejects.toThrow('INTERNAL_ERROR');
  });

  it('deleteReview 用 unwrapVoid，data=null 不抛错', async () => {
    vi.mocked(client.delete).mockResolvedValue(ok(null as unknown as ReviewNote));
    await expect(deleteReview('1')).resolves.toBeUndefined();
    expect(client.delete).toHaveBeenCalledWith('/reviews/1');
  });

  it('deleteReview 业务失败抛错', async () => {
    vi.mocked(client.delete).mockResolvedValue(fail('RESOURCE_NOT_FOUND'));
    await expect(deleteReview('1')).rejects.toThrow('RESOURCE_NOT_FOUND');
  });
});
