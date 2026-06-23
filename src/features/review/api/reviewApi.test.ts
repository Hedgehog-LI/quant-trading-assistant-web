import { describe, it, expect, beforeEach } from 'vitest';
import {
  addReview,
  updateReview,
  getReviews,
  getReviewById,
} from '../api/reviewApi';
import {
  addTradeJournal,
  getTradeJournals,
  batchUpdateReviewStatus,
} from '../../journal/api/tradeJournalApi';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';

beforeEach(() => {
  clearAll();
  // 锁定 mock 模式，避免读取用户真实 settings 干扰。
  saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
});

describe('reviewApi', () => {
  it('新增个股复盘', async () => {
    const review = await addReview({
      reviewDate: '2026-06-08',
      symbol: '300750',
      title: '宁德时代复盘',
      linkedJournalIds: [],
    });
    expect(review.symbol).toBe('300750');
    expect(review.title).toBe('宁德时代复盘');
    expect(review.id).toBeTruthy();
  });

  it('新增每日总复盘（symbol 为空）', async () => {
    const review = await addReview({
      reviewDate: '2026-06-08',
      title: '每日总复盘',
      linkedJournalIds: [],
    });
    expect(review.symbol).toBeUndefined();
  });

  it('更新复盘', async () => {
    const review = await addReview({
      reviewDate: '2026-06-08',
      title: '复盘',
      linkedJournalIds: [],
    });
    const updated = await updateReview(review.id, {
      title: '复盘-更新',
      rightThings: '严格执行止损',
    });
    expect(updated?.title).toBe('复盘-更新');
    expect(updated?.rightThings).toBe('严格执行止损');
  });

  it('getReviews / getReviewById 读取', async () => {
    const r1 = await addReview({
      reviewDate: '2026-06-08',
      symbol: '300750',
      title: '复盘 A',
      linkedJournalIds: [],
    });
    const all = await getReviews();
    expect(all).toHaveLength(1);

    const found = await getReviewById(r1.id);
    expect(found?.title).toBe('复盘 A');

    const missing = await getReviewById('not-exist');
    expect(missing).toBeNull();
  });

  it('更新不存在的复盘返回 null', async () => {
    const result = await updateReview('not-exist', { title: 'x' });
    expect(result).toBeNull();
  });

  it('关联交易后 journal 自动标记 REVIEWED', async () => {
    // journal 已改为 async 签名，await 调用。
    const j1 = await addTradeJournal({ tradeDate: '2026-06-08', symbol: '300750', side: 'BUY', price: 100, quantity: 100, emotionTags: [], mistakeTags: [] });
    const j2 = await addTradeJournal({ tradeDate: '2026-06-08', symbol: '600519', side: 'SELL', price: 200, quantity: 100, emotionTags: [], mistakeTags: [] });

    // 新建 review 并关联 j1
    const review = await addReview({
      reviewDate: '2026-06-08',
      symbol: '300750',
      title: '复盘',
      linkedJournalIds: [j1.id],
    });
    expect(review.linkedJournalIds).toEqual([j1.id]);

    // 模拟 useReview 的 add 逻辑：批量更新 journal 状态
    await batchUpdateReviewStatus([j1.id], 'REVIEWED');

    const journals = await getTradeJournals();
    const found1 = journals.find((j) => j.id === j1.id);
    const found2 = journals.find((j) => j.id === j2.id);
    expect(found1?.reviewStatus).toBe('REVIEWED');
    expect(found2?.reviewStatus).toBe('PENDING');
  });
});
