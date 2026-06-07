import { useState, useCallback, useMemo } from 'react';
import {
  getTradeJournals,
  addTradeJournal,
  updateTradeJournal,
  updateReviewStatus,
} from '../api/tradeJournalApi';
import { today } from '../../../shared/utils/date';
import type { TradeJournal } from '../../../shared/types/domain';

export function useTradeJournal() {
  const [items, setItems] = useState<TradeJournal[]>(() => getTradeJournals());

  const refresh = useCallback(() => {
    setItems(getTradeJournals());
  }, []);

  const add = useCallback(
    (input: Omit<TradeJournal, 'id' | 'amount' | 'reviewStatus' | 'createdAt' | 'updatedAt'>) => {
      addTradeJournal(input);
      refresh();
    },
    [refresh],
  );

  const update = useCallback(
    (id: string, input: Partial<Omit<TradeJournal, 'id' | 'createdAt' | 'updatedAt'>>) => {
      updateTradeJournal(id, input);
      refresh();
    },
    [refresh],
  );

  const markReviewed = useCallback(
    (id: string) => {
      updateReviewStatus(id, 'REVIEWED');
      refresh();
    },
    [refresh],
  );

  return { items, refresh, add, update, markReviewed };
}

export function useTradeJournalFiltered(items: TradeJournal[]) {
  const [dateFilter, setDateFilter] = useState<string>(today());
  const [symbolFilter, setSymbolFilter] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string | undefined>(undefined);

  const filtered = useMemo(() => {
    let result = items;
    if (dateFilter) {
      result = result.filter((i) => i.tradeDate === dateFilter);
    }
    if (symbolFilter.trim()) {
      const kw = symbolFilter.trim().toUpperCase();
      result = result.filter(
        (i) => i.symbol.toUpperCase().includes(kw) || (i.name ?? '').includes(symbolFilter.trim()),
      );
    }
    if (reviewStatusFilter) {
      result = result.filter((i) => i.reviewStatus === reviewStatusFilter);
    }
    return result;
  }, [items, dateFilter, symbolFilter, reviewStatusFilter]);

  return { filtered, dateFilter, setDateFilter, symbolFilter, setSymbolFilter, reviewStatusFilter, setReviewStatusFilter };
}
