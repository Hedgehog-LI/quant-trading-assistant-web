/**
 * Review localStorage CRUD。
 */
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import type { ReviewNote } from '../../../shared/types/domain';

const KEY = 'reviews';

function now(): string {
  return new Date().toISOString();
}

export function getReviews(): ReviewNote[] {
  return getItem<ReviewNote[]>(KEY) ?? [];
}

function save(items: ReviewNote[]): void {
  setItem(KEY, items);
}

export function addReview(
  input: Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>,
): ReviewNote {
  const items = getReviews();
  const item: ReviewNote = {
    ...input,
    symbol: input.symbol?.trim().toUpperCase() || undefined,
    id: generateId(),
    createdAt: now(),
    updatedAt: now(),
  };
  items.push(item);
  save(items);
  return item;
}

export function updateReview(
  id: string,
  input: Partial<Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>>,
): ReviewNote | null {
  const items = getReviews();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...input, updatedAt: now() };
  save(items);
  return items[idx];
}

export function getReviewById(id: string): ReviewNote | null {
  return getReviews().find((i) => i.id === id) ?? null;
}
