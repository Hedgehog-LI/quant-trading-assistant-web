/**
 * 手工当前价快照 localStorage CRUD。
 *
 * 所有读写通过 localStorageClient，禁止直接 localStorage。
 * upsert 语义：相同 symbol + priceDate 视为同一条，覆盖价格（与后端 POST /prices 一致）。
 * 本轮不支持删除（后端无删除接口），改价请用新日期录入或覆盖同日期。
 */
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import type { PriceSnapshot, PriceSnapshotInput } from '../model/types';

const KEY = 'portfolioPriceSnapshots';

function now(): string {
  return new Date().toISOString();
}

export function getAllSnapshots(): PriceSnapshot[] {
  return getItem<PriceSnapshot[]>(KEY) ?? [];
}

function saveAll(items: PriceSnapshot[]): void {
  setItem(KEY, items);
}

/**
 * 取每个 symbol 最新 priceDate 的快照价格（mock 模式喂给 calculator 的 currentPrice）。
 * 对齐后端 PortfolioPriceManager.getLatestPriceMap。
 */
export function getLatestPriceBySymbol(): Map<string, number> {
  const all = getAllSnapshots();
  const latest = new Map<string, { date: string; price: number }>();
  for (const s of all) {
    const cur = latest.get(s.symbol);
    if (cur === undefined || s.priceDate > cur.date) {
      latest.set(s.symbol, { date: s.priceDate, price: s.currentPrice });
    }
  }
  const result = new Map<string, number>();
  for (const [symbol, v] of latest) {
    result.set(symbol, v.price);
  }
  return result;
}

/**
 * 新增或更新手工当前价（相同 symbol + priceDate 覆盖）。
 * symbol 自动 trim + 大写。
 */
export function upsertSnapshot(input: PriceSnapshotInput): PriceSnapshot {
  const all = getAllSnapshots();
  const symbol = input.symbol.trim().toUpperCase();
  const idx = all.findIndex((s) => s.symbol === symbol && s.priceDate === input.priceDate);
  const ts = now();

  if (idx >= 0) {
    const updated: PriceSnapshot = {
      ...all[idx],
      name: input.name,
      currentPrice: input.currentPrice,
      note: input.note,
      symbol,
      updatedAt: ts,
    };
    all[idx] = updated;
    saveAll(all);
    return updated;
  }

  const created: PriceSnapshot = {
    symbol,
    name: input.name,
    currentPrice: input.currentPrice,
    priceDate: input.priceDate,
    note: input.note,
    id: generateId(),
    createdAt: ts,
    updatedAt: ts,
  };
  all.push(created);
  saveAll(all);
  return created;
}
