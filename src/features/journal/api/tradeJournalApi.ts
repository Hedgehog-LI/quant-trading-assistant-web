/**
 * TradeJournal localStorage CRUD。
 */
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import type { TradeJournal } from '../../../shared/types/domain';

const KEY = 'tradeJournals';

function now(): string {
  return new Date().toISOString();
}

export function getTradeJournals(): TradeJournal[] {
  return getItem<TradeJournal[]>(KEY) ?? [];
}

function save(items: TradeJournal[]): void {
  setItem(KEY, items);
}

export function addTradeJournal(
  input: Omit<TradeJournal, 'id' | 'amount' | 'reviewStatus' | 'createdAt' | 'updatedAt'>,
): TradeJournal {
  const items = getTradeJournals();
  const amount = input.price * input.quantity;
  const item: TradeJournal = {
    ...input,
    symbol: input.symbol.trim().toUpperCase(),
    id: generateId(),
    amount,
    reviewStatus: 'PENDING',
    createdAt: now(),
    updatedAt: now(),
  };
  items.push(item);
  save(items);
  return item;
}

export function updateTradeJournal(
  id: string,
  input: Partial<Omit<TradeJournal, 'id' | 'createdAt' | 'updatedAt'>>,
): TradeJournal | null {
  const items = getTradeJournals();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const updated = { ...items[idx], ...input, updatedAt: now() };
  // 如果 price 或 quantity 变了，重新计算 amount
  if (input.price !== undefined || input.quantity !== undefined) {
    updated.amount = updated.price * updated.quantity;
  }
  items[idx] = updated;
  save(items);
  return updated;
}

export function updateReviewStatus(id: string, reviewStatus: TradeJournal['reviewStatus']): TradeJournal | null {
  return updateTradeJournal(id, { reviewStatus });
}

export function batchUpdateReviewStatus(ids: string[], reviewStatus: TradeJournal['reviewStatus']): void {
  const items = getTradeJournals();
  const idSet = new Set(ids);
  items.forEach((item) => {
    if (idSet.has(item.id)) {
      item.reviewStatus = reviewStatus;
      item.updatedAt = now();
    }
  });
  save(items);
}

export function getTradeJournalById(id: string): TradeJournal | null {
  return getTradeJournals().find((i) => i.id === id) ?? null;
}
