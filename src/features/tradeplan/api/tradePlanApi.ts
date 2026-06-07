/**
 * TradePlan localStorage CRUD。
 */
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import type { TradePlan } from '../../../shared/types/domain';

const KEY = 'tradePlans';

function now(): string {
  return new Date().toISOString();
}

export function getTradePlans(): TradePlan[] {
  return getItem<TradePlan[]>(KEY) ?? [];
}

function save(items: TradePlan[]): void {
  setItem(KEY, items);
}

export function addTradePlan(
  input: Omit<TradePlan, 'id' | 'createdAt' | 'updatedAt'>,
): TradePlan {
  const items = getTradePlans();
  const item: TradePlan = {
    ...input,
    symbol: input.symbol.trim().toUpperCase(),
    id: generateId(),
    createdAt: now(),
    updatedAt: now(),
  };
  items.push(item);
  save(items);
  return item;
}

export function updateTradePlan(
  id: string,
  input: Partial<Omit<TradePlan, 'id' | 'createdAt' | 'updatedAt'>>,
): TradePlan | null {
  const items = getTradePlans();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...input, updatedAt: now() };
  save(items);
  return items[idx];
}

export function getTradePlanById(id: string): TradePlan | null {
  return getTradePlans().find((i) => i.id === id) ?? null;
}
