import { useState, useCallback, useMemo } from 'react';
import { getReviews, addReview, updateReview } from '../api/reviewApi';
import { batchUpdateReviewStatus } from '../../journal/api/tradeJournalApi';
import { today } from '../../../shared/utils/date';
import type { ReviewNote } from '../../../shared/types/domain';

export function useReview() {
  const [items, setItems] = useState<ReviewNote[]>(() => getReviews());

  const refresh = useCallback(() => {
    setItems(getReviews());
  }, []);

  const add = useCallback(
    (input: Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>) => {
      const review = addReview(input);
      // 关联的交易记录自动标记为 REVIEWED
      if (input.linkedJournalIds.length > 0) {
        batchUpdateReviewStatus(input.linkedJournalIds, 'REVIEWED');
      }
      refresh();
      return review;
    },
    [refresh],
  );

  const update = useCallback(
    (id: string, input: Partial<Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>>) => {
      updateReview(id, input);
      refresh();
    },
    [refresh],
  );

  return { items, refresh, add, update };
}

export function useReviewFiltered(items: ReviewNote[]) {
  const [dateFilter, setDateFilter] = useState<string>(today());
  const [symbolFilter, setSymbolFilter] = useState('');

  const filtered = useMemo(() => {
    let result = items;
    if (dateFilter) {
      result = result.filter((i) => i.reviewDate === dateFilter);
    }
    if (symbolFilter.trim()) {
      const kw = symbolFilter.trim().toUpperCase();
      result = result.filter(
        (i) => (i.symbol ?? '').toUpperCase().includes(kw) || i.title.includes(symbolFilter.trim()),
      );
    }
    return result;
  }, [items, dateFilter, symbolFilter]);

  return { filtered, dateFilter, setDateFilter, symbolFilter, setSymbolFilter };
}
