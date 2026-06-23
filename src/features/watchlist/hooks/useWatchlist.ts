/**
 * 自选股状态管理 hook。
 *
 * 跟随项目现有风格（useState + useCallback + refresh），不引入 react-query。
 * 范式参照 features/portfolio/hooks/usePortfolio.ts。
 *
 * - mount 时拉取全量列表；
 * - 维护 loading / error / empty 三态 + cancelled flag；
 * - add / update / toggleEnabled 均 async，失败抛错由调用方（页面）统一 message.error；
 * - add 前做前端 symbol 唯一性校验（mock / remote 共用），重复直接抛错。
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  getWatchlist,
  addWatchlistItem,
  updateWatchlistItem,
  setWatchlistEnabled,
  deleteWatchlistItem,
} from '../api/watchlistApi';
import type { WatchlistItemInput, WatchlistItemUpdate } from '../api/watchlistApi';
import { getSettings } from '../../settings/api/settingsApi';
import type { EntityId, WatchlistItem } from '../../../shared/types/domain';

export interface UseWatchlistResult {
  items: WatchlistItem[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  /** 当前数据模式（供页面展示数据源提示） */
  apiMode: 'mock' | 'remote';
  refresh: () => Promise<void>;
  add: (input: WatchlistItemInput) => Promise<void>;
  update: (id: EntityId, input: WatchlistItemUpdate) => Promise<void>;
  toggleEnabled: (id: EntityId, enabled: boolean) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
}

export function useWatchlist(): UseWatchlistResult {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiMode = getSettings().apiMode;

  // 手动刷新（事件触发，含 loading 态切换）。
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getWatchlist();
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
        const list = await getWatchlist();
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

  const add = useCallback(async (input: WatchlistItemInput) => {
    // 前端 symbol 唯一性校验（mock / remote 共用），重复直接抛错。
    const upper = input.symbol.trim().toUpperCase();
    // 读取最新列表避免闭包陈旧值
    const current = await getWatchlist();
    if (current.some((i) => i.symbol === upper)) {
      throw new Error(`股票代码已存在: ${upper}`);
    }
    await addWatchlistItem(input);
    await refresh();
  }, [refresh]);

  const update = useCallback(async (id: EntityId, input: WatchlistItemUpdate) => {
    await updateWatchlistItem(id, input);
    await refresh();
  }, [refresh]);

  const toggleEnabled = useCallback(async (id: EntityId, enabled: boolean) => {
    await setWatchlistEnabled(id, enabled);
    await refresh();
  }, [refresh]);

  const remove = useCallback(
    async (id: EntityId) => {
      await deleteWatchlistItem(id);
      await refresh();
    },
    [refresh],
  );

  const isEmpty = !loading && !error && items.length === 0;

  return {
    items,
    loading,
    error,
    isEmpty,
    apiMode,
    refresh,
    add,
    update,
    toggleEnabled,
    remove,
  };
}

export function useWatchlistFiltered(items: WatchlistItem[]) {
  const [keyword, setKeyword] = useState('');
  const [tradeStyleFilter, setTradeStyleFilter] = useState<string | undefined>();
  const [showDisabled, setShowDisabled] = useState(false);

  const filtered = useMemo(() => {
    let result = items;
    if (!showDisabled) {
      result = result.filter((i) => i.enabled);
    }
    if (keyword.trim()) {
      const kw = keyword.trim().toUpperCase();
      result = result.filter(
        (i) => i.symbol.toUpperCase().includes(kw) || i.name.includes(keyword.trim()),
      );
    }
    if (tradeStyleFilter) {
      result = result.filter((i) => i.tradeStyle === tradeStyleFilter);
    }
    return result;
  }, [items, keyword, tradeStyleFilter, showDisabled]);

  return {
    filtered,
    keyword,
    setKeyword,
    tradeStyleFilter,
    setTradeStyleFilter,
    showDisabled,
    setShowDisabled,
  };
}
