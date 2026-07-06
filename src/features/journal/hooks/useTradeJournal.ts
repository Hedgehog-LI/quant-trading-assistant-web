/**
 * 交易记录状态管理 hook。
 *
 * 跟随项目现有风格（useState + useCallback + effect 拉取），不引入 react-query。
 * - mount 时拉取全量列表；
 * - 维护 loading / error / empty 三态 + cancelled flag（避免卸载后 setState）；
 * - add / update / markReviewed 改 async，调用后自动 refresh 重新拉取；
 * - apiMode 供页面展示数据源提示。
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  getTradeJournals,
  addTradeJournal,
  updateTradeJournal,
  updateReviewStatus,
  deleteTradeJournal,
} from '../api/tradeJournalApi';
import { getSettings } from '../../settings/api/settingsApi';
import type { EntityId, TradeJournal } from '../../../shared/types/domain';

export type TradeJournalInput = Omit<
  TradeJournal,
  'id' | 'amount' | 'reviewStatus' | 'createdAt' | 'updatedAt'
>;
export type TradeJournalUpdate = Partial<Omit<TradeJournal, 'id' | 'createdAt' | 'updatedAt'>> & {
  unlinkPlan?: boolean;
};

export interface UseTradeJournalResult {
  items: TradeJournal[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  apiMode: 'mock' | 'remote';
  refresh: () => Promise<void>;
  add: (input: TradeJournalInput) => Promise<void>;
  update: (id: EntityId, input: TradeJournalUpdate) => Promise<void>;
  markReviewed: (id: EntityId) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
}

export function useTradeJournal(): UseTradeJournalResult {
  const [items, setItems] = useState<TradeJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiMode = getSettings().apiMode;

  // 手动刷新（事件触发，含 loading 态切换）。
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getTradeJournals();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 挂载时拉取：fetch 逻辑内联为局部 async 函数，所有 setState 都在 await 之后，
  // effect 同步路径不触发 setState（loading 初值已为 true）。
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await getTradeJournals();
        if (cancelled) return;
        setItems(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const add = useCallback(
    async (input: TradeJournalInput) => {
      await addTradeJournal(input);
      await refresh();
    },
    [refresh],
  );

  const update = useCallback(
    async (id: EntityId, input: TradeJournalUpdate) => {
      await updateTradeJournal(id, input);
      await refresh();
    },
    [refresh],
  );

  const markReviewed = useCallback(
    async (id: EntityId) => {
      await updateReviewStatus(id, 'REVIEWED');
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: EntityId) => {
      await deleteTradeJournal(id);
      await refresh();
    },
    [refresh],
  );

  const isEmpty = !loading && !error && items.length === 0;

  return { items, loading, error, isEmpty, apiMode, refresh, add, update, markReviewed, remove };
}

export function useTradeJournalFiltered(items: TradeJournal[]) {
  const [dateFilter, setDateFilter] = useState<string>('');
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

  const hasActiveFilters = dateFilter !== '' || symbolFilter.trim() !== '' || reviewStatusFilter !== undefined;

  const resetFilters = useCallback(() => {
    setDateFilter('');
    setSymbolFilter('');
    setReviewStatusFilter(undefined);
  }, []);

  return {
    filtered,
    dateFilter,
    setDateFilter,
    symbolFilter,
    setSymbolFilter,
    reviewStatusFilter,
    setReviewStatusFilter,
    hasActiveFilters,
    resetFilters,
  };
}
