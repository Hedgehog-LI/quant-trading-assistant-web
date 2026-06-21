import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTradeJournals,
  addTradeJournal,
  updateTradeJournal,
  updateReviewStatus,
  batchUpdateReviewStatus,
} from '../api/tradeJournalApi';

beforeEach(() => {
  localStorage.clear();
});

describe('tradeJournalApi', () => {
  it('新增交易记录自动计算 amount', () => {
    const journal = addTradeJournal({
      tradeDate: '2026-06-08',
      symbol: '300750',
      name: '宁德时代',
      side: 'BUY',
      price: 220.5,
      quantity: 100,
      emotionTags: [],
      mistakeTags: [],
    });
    expect(journal.amount).toBeCloseTo(22050, 2);
    expect(journal.reviewStatus).toBe('PENDING');
  });

  it('更新 price 后重新计算 amount', () => {
    const journal = addTradeJournal({
      tradeDate: '2026-06-08',
      symbol: '300750',
      side: 'BUY',
      price: 100,
      quantity: 200,
      emotionTags: [],
      mistakeTags: [],
    });
    const updated = updateTradeJournal(journal.id, { price: 110 });
    expect(updated?.amount).toBeCloseTo(22000, 2);
  });

  it('更新 quantity 后重新计算 amount', () => {
    const journal = addTradeJournal({
      tradeDate: '2026-06-08',
      symbol: '300750',
      side: 'SELL',
      price: 50,
      quantity: 100,
      emotionTags: [],
      mistakeTags: [],
    });
    const updated = updateTradeJournal(journal.id, { quantity: 200 });
    expect(updated?.amount).toBeCloseTo(10000, 2);
  });

  it('updateReviewStatus 单条更新', () => {
    const journal = addTradeJournal({
      tradeDate: '2026-06-08',
      symbol: '300750',
      side: 'BUY',
      price: 100,
      quantity: 100,
      emotionTags: [],
      mistakeTags: [],
    });
    const updated = updateReviewStatus(journal.id, 'REVIEWED');
    expect(updated?.reviewStatus).toBe('REVIEWED');
  });

  it('batchUpdateReviewStatus 批量更新', () => {
    const j1 = addTradeJournal({ tradeDate: '2026-06-08', symbol: 'A', side: 'BUY', price: 10, quantity: 100, emotionTags: [], mistakeTags: [] });
    const j2 = addTradeJournal({ tradeDate: '2026-06-08', symbol: 'B', side: 'SELL', price: 20, quantity: 100, emotionTags: [], mistakeTags: [] });
    const j3 = addTradeJournal({ tradeDate: '2026-06-08', symbol: 'C', side: 'BUY', price: 30, quantity: 100, emotionTags: [], mistakeTags: [] });

    batchUpdateReviewStatus([j1.id, j3.id], 'REVIEWED');

    const journals = getTradeJournals();
    const found1 = journals.find((j) => j.id === j1.id);
    const found2 = journals.find((j) => j.id === j2.id);
    const found3 = journals.find((j) => j.id === j3.id);
    expect(found1?.reviewStatus).toBe('REVIEWED');
    expect(found2?.reviewStatus).toBe('PENDING');
    expect(found3?.reviewStatus).toBe('REVIEWED');
  });

  it('新增时 symbol 自动转大写', () => {
    const journal = addTradeJournal({
      tradeDate: '2026-06-08',
      symbol: ' 300750 ',
      side: 'BUY',
      price: 100,
      quantity: 100,
      emotionTags: [],
      mistakeTags: [],
    });
    expect(journal.symbol).toBe('300750');
  });

  it('新增带费用字段并透传保存，amount 仍为毛额不含费用', () => {
    const journal = addTradeJournal({
      tradeDate: '2026-06-08',
      symbol: '300750',
      side: 'BUY',
      price: 100,
      quantity: 100,
      commissionFee: 5,
      stampTax: 3,
      emotionTags: [],
      mistakeTags: [],
    });
    expect(journal.commissionFee).toBe(5);
    expect(journal.stampTax).toBe(3);
    expect(journal.totalFee).toBeUndefined();
    expect(journal.amount).toBeCloseTo(10000, 2);
  });

  it('新增时 totalFee 字段优先透传', () => {
    const journal = addTradeJournal({
      tradeDate: '2026-06-08',
      symbol: '300750',
      side: 'BUY',
      price: 100,
      quantity: 100,
      commissionFee: 5,
      totalFee: 8,
      emotionTags: [],
      mistakeTags: [],
    });
    expect(journal.totalFee).toBe(8);
    expect(journal.commissionFee).toBe(5);
  });

  it('更新费用字段', () => {
    const journal = addTradeJournal({
      tradeDate: '2026-06-08',
      symbol: '300750',
      side: 'BUY',
      price: 100,
      quantity: 100,
      emotionTags: [],
      mistakeTags: [],
    });
    const updated = updateTradeJournal(journal.id, { commissionFee: 10, stampTax: 2 });
    expect(updated?.commissionFee).toBe(10);
    expect(updated?.stampTax).toBe(2);
  });
});
