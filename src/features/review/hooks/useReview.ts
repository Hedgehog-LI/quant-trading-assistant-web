/**
 * 盘后复盘状态管理 hook。
 *
 * 范式对齐 usePortfolio：useState + useCallback + mount 拉取，不引入 react-query。
 * - mount 时拉取 reviews；
 * - 维护 loading / error / empty 三态 + cancelled flag；
 * - add / update 改 async：写后端（remote 模式）后 refresh；
 * - 关联交易记录由 hook 自动标记 REVIEWED（await batchUpdateReviewStatus，
 *   兼容 journal 未来 async 改造）。
 */
import { useState, useCallback, useEffect } from 'react';
import { getReviews, addReview, updateReview, deleteReview } from '../api/reviewApi';
import { batchUpdateReviewStatus } from '../../journal/api/tradeJournalApi';
import { getSettings } from '../../settings/api/settingsApi';
import { today } from '../../../shared/utils/date';
import { useMemo } from 'react';
import type { EntityId, ReviewNote } from '../../../shared/types/domain';

export interface UseReviewResult {
  items: ReviewNote[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  /** 当前数据模式（供页面展示数据源提示） */
  apiMode: 'mock' | 'remote';
  refresh: () => Promise<void>;
  add: (input: Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ReviewNote>;
  update: (id: EntityId, input: Partial<Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
}

export function useReview(): UseReviewResult {
  const [items, setItems] = useState<ReviewNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiMode = getSettings().apiMode;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReviews();
      setItems(data);
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
        const data = await getReviews();
        if (cancelled) return;
        setItems(data);
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
    async (input: Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>) => {
      const review = await addReview(input);
      // 关联的交易记录自动标记为 REVIEWED。
      // batchUpdateReviewStatus 当前同步返回 void；await 兼容 journal 后续 async 改造。
      if (input.linkedJournalIds.length > 0) {
        await batchUpdateReviewStatus(input.linkedJournalIds, 'REVIEWED');
      }
      await refresh();
      return review;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: EntityId, input: Partial<Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>>) => {
      await updateReview(id, input);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: EntityId) => {
      await deleteReview(id);
      await refresh();
    },
    [refresh],
  );

  const isEmpty = !loading && !error && items.length === 0;

  return { items, loading, error, isEmpty, apiMode, refresh, add, update, remove };
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
