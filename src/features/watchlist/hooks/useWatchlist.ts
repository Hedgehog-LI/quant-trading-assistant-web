import { useState, useCallback, useMemo } from 'react';
import {
  getWatchlist,
  addWatchlistItem,
  updateWatchlistItem,
  setWatchlistEnabled,
} from '../api/watchlistApi';
import type { WatchlistItem } from '../../../shared/types/domain';

export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>(() => getWatchlist());

  const refresh = useCallback(() => {
    setItems(getWatchlist());
  }, []);

  const add = useCallback(
    (input: Omit<WatchlistItem, 'id' | 'enabled' | 'createdAt' | 'updatedAt'>) => {
      // 检查 symbol 唯一
      const upper = input.symbol.trim().toUpperCase();
      if (items.some((i) => i.symbol === upper)) {
        throw new Error(`股票代码已存在: ${upper}`);
      }
      addWatchlistItem(input);
      refresh();
    },
    [items, refresh],
  );

  const update = useCallback(
    (id: string, input: Partial<Omit<WatchlistItem, 'id' | 'createdAt' | 'updatedAt'>>) => {
      updateWatchlistItem(id, input);
      refresh();
    },
    [refresh],
  );

  const toggleEnabled = useCallback(
    (id: string, enabled: boolean) => {
      setWatchlistEnabled(id, enabled);
      refresh();
    },
    [refresh],
  );

  return { items, refresh, add, update, toggleEnabled };
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

  return { filtered, keyword, setKeyword, tradeStyleFilter, setTradeStyleFilter, showDisabled, setShowDisabled };
}
