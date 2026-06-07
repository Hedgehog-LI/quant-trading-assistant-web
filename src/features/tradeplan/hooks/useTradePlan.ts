import { useState, useCallback, useMemo } from 'react';
import {
  getTradePlans,
  addTradePlan,
  updateTradePlan,
} from '../api/tradePlanApi';
import { today } from '../../../shared/utils/date';
import type { TradePlan } from '../../../shared/types/domain';

export function useTradePlan() {
  const [items, setItems] = useState<TradePlan[]>(() => getTradePlans());

  const refresh = useCallback(() => {
    setItems(getTradePlans());
  }, []);

  const add = useCallback(
    (input: Omit<TradePlan, 'id' | 'createdAt' | 'updatedAt'>) => {
      const upper = input.symbol.trim().toUpperCase();
      const planDate = input.planDate;
      if (items.some((i) => i.symbol === upper && i.planDate === planDate)) {
        throw new Error(`该股票在 ${planDate} 已有交易计划`);
      }
      addTradePlan(input);
      refresh();
    },
    [items, refresh],
  );

  const update = useCallback(
    (id: string, input: Partial<Omit<TradePlan, 'id' | 'createdAt' | 'updatedAt'>>) => {
      updateTradePlan(id, input);
      refresh();
    },
    [refresh],
  );

  return { items, refresh, add, update };
}

export function useTradePlanFiltered(items: TradePlan[]) {
  const [dateFilter, setDateFilter] = useState<string>(today());
  const [symbolFilter, setSymbolFilter] = useState('');

  const filtered = useMemo(() => {
    let result = items;
    if (dateFilter) {
      result = result.filter((i) => i.planDate === dateFilter);
    }
    if (symbolFilter.trim()) {
      const kw = symbolFilter.trim().toUpperCase();
      result = result.filter(
        (i) => i.symbol.toUpperCase().includes(kw) || (i.name ?? '').includes(symbolFilter.trim()),
      );
    }
    return result;
  }, [items, dateFilter, symbolFilter]);

  return { filtered, dateFilter, setDateFilter, symbolFilter, setSymbolFilter };
}
