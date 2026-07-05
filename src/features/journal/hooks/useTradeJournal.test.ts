import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTradeJournalFiltered } from '../hooks/useTradeJournal';
import type { TradeJournal } from '../../../shared/types/domain';

function makeItem(overrides: Partial<TradeJournal> = {}): TradeJournal {
  return {
    id: overrides.id ?? 1,
    tradeDate: overrides.tradeDate ?? '2026-06-08',
    symbol: overrides.symbol ?? '300750',
    name: overrides.name ?? '宁德时代',
    side: overrides.side ?? 'BUY',
    price: overrides.price ?? 220.5,
    quantity: overrides.quantity ?? 100,
    amount: overrides.amount ?? 22050,
    emotionTags: overrides.emotionTags ?? [],
    mistakeTags: overrides.mistakeTags ?? [],
    reviewStatus: overrides.reviewStatus ?? 'PENDING',
    createdAt: overrides.createdAt ?? '2026-06-08T10:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-06-08T10:00:00Z',
  };
}

const ITEMS: TradeJournal[] = [
  makeItem({ id: 1, tradeDate: '2026-06-08', symbol: '300750', name: '宁德时代', reviewStatus: 'PENDING' }),
  makeItem({ id: 2, tradeDate: '2026-06-09', symbol: '000858', name: '五粮液', reviewStatus: 'REVIEWED' }),
  makeItem({ id: 3, tradeDate: '2026-06-10', symbol: '600519', name: '贵州茅台', reviewStatus: 'PENDING' }),
];

describe('useTradeJournalFiltered', () => {
  it('默认 dateFilter 为空字符串', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));
    expect(result.current.dateFilter).toBe('');
  });

  it('默认 symbolFilter 为空字符串', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));
    expect(result.current.symbolFilter).toBe('');
  });

  it('默认 reviewStatusFilter 为 undefined', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));
    expect(result.current.reviewStatusFilter).toBeUndefined();
  });

  it('初始状态 hasActiveFilters 为 false', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('初始状态返回全部交易记录', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));
    expect(result.current.filtered).toHaveLength(3);
    expect(result.current.filtered).toEqual(ITEMS);
  });

  it('日期筛选能够正确过滤', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));

    act(() => {
      result.current.setDateFilter('2026-06-08');
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe(1);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('日期筛选无匹配时返回空数组', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));

    act(() => {
      result.current.setDateFilter('2025-01-01');
    });

    expect(result.current.filtered).toHaveLength(0);
  });

  it('股票代码筛选能够正确过滤（大小写不敏感）', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));

    act(() => {
      result.current.setSymbolFilter('300750');
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].symbol).toBe('300750');
  });

  it('股票名称筛选能够正确过滤', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));

    act(() => {
      result.current.setSymbolFilter('茅台');
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].name).toBe('贵州茅台');
  });

  it('复盘状态筛选能够正确过滤', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));

    act(() => {
      result.current.setReviewStatusFilter('REVIEWED');
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].reviewStatus).toBe('REVIEWED');
  });

  it('多条件组合筛选', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));

    act(() => {
      result.current.setDateFilter('2026-06-10');
      result.current.setReviewStatusFilter('PENDING');
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe(3);
  });

  it('清空筛选后恢复全部记录', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));

    act(() => {
      result.current.setDateFilter('2026-06-08');
      result.current.setSymbolFilter('300750');
      result.current.setReviewStatusFilter('REVIEWED');
    });

    expect(result.current.filtered).toHaveLength(0);
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.dateFilter).toBe('');
    expect(result.current.symbolFilter).toBe('');
    expect(result.current.reviewStatusFilter).toBeUndefined();
    expect(result.current.filtered).toHaveLength(3);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('空数组输入时 filtered 也为空数组', () => {
    const { result } = renderHook(() => useTradeJournalFiltered([]));
    expect(result.current.filtered).toHaveLength(0);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('symbolFilter 只有空白字符时不计为活跃筛选', () => {
    const { result } = renderHook(() => useTradeJournalFiltered(ITEMS));

    act(() => {
      result.current.setSymbolFilter('   ');
    });

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filtered).toHaveLength(3);
  });
});
