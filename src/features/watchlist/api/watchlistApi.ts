/**
 * Watchlist localStorage CRUD。
 * 不直接操作 localStorage，全部通过 localStorageClient。
 */
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import type { WatchlistItem } from '../../../shared/types/domain';

const KEY = 'watchlist';

function now(): string {
  return new Date().toISOString();
}

export function getWatchlist(): WatchlistItem[] {
  return getItem<WatchlistItem[]>(KEY) ?? [];
}

function save(items: WatchlistItem[]): void {
  setItem(KEY, items);
}

export function addWatchlistItem(
  input: Omit<WatchlistItem, 'id' | 'enabled' | 'createdAt' | 'updatedAt'>,
): WatchlistItem {
  const items = getWatchlist();
  const item: WatchlistItem = {
    ...input,
    symbol: input.symbol.trim().toUpperCase(),
    id: generateId(),
    enabled: true,
    createdAt: now(),
    updatedAt: now(),
  };
  items.push(item);
  save(items);
  return item;
}

export function updateWatchlistItem(
  id: string,
  input: Partial<Omit<WatchlistItem, 'id' | 'createdAt' | 'updatedAt'>>,
): WatchlistItem | null {
  const items = getWatchlist();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...input, updatedAt: now() };
  save(items);
  return items[idx];
}

export function setWatchlistEnabled(id: string, enabled: boolean): WatchlistItem | null {
  return updateWatchlistItem(id, { enabled });
}

export function getWatchlistItemById(id: string): WatchlistItem | null {
  return getWatchlist().find((i) => i.id === id) ?? null;
}
