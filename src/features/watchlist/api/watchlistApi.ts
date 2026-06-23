/**
 * 自选股数据访问层（mock / remote 双模式）。
 *
 * - mock：localStorage，key='watchlist'。
 * - remote：调用后端 /api/v1/watchlist/*（baseURL 已配置，vite proxy /api → 后端）。
 *
 * 按 settings.apiMode 分流，每次调用现读 settings，切换模式无需刷新页面。
 * 范式参照 features/portfolio/api/portfolioApi.ts。
 *
 * 导出形式：保留具名 async 函数导出（不聚合成 watchlistApi 对象），
 * 因为跨 feature 调用方（dashboard）用具名函数调用，便于最小改动。
 */
import { client } from '../../../shared/api/client';
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import type { ApiResponse } from '../../../shared/api/types';
import { unwrap, unwrapVoid } from '../../../shared/api/unwrappers';
import { generateId } from '../../../shared/utils/id';
import { getSettings } from '../../settings/api/settingsApi';
import type { EntityId, WatchlistItem } from '../../../shared/types/domain';

const KEY = 'watchlist';

// ============ 共享类型 ============

/**
 * 新增入参：Omit 掉 id / enabled / 时间戳。
 * 与 addWatchlistItem 原签名一致，mock/remote 共用。
 */
export type WatchlistItemInput = Omit<WatchlistItem, 'id' | 'enabled' | 'createdAt' | 'updatedAt'>;

/**
 * 更新入参：Partial，Omit 掉 id / 时间戳（enabled 允许更新，沿用原签名语义）。
 */
export type WatchlistItemUpdate = Partial<Omit<WatchlistItem, 'id' | 'createdAt' | 'updatedAt'>>;

// ============ 接口 ============

export interface WatchlistApi {
  getAll(): Promise<WatchlistItem[]>;
  getById(id: EntityId): Promise<WatchlistItem | null>;
  add(input: WatchlistItemInput): Promise<WatchlistItem>;
  update(id: EntityId, input: WatchlistItemUpdate): Promise<WatchlistItem | null>;
  setEnabled(id: EntityId, enabled: boolean): Promise<WatchlistItem | null>;
  remove(id: EntityId): Promise<void>;
}

// ============ mock 实现 ============

function now(): string {
  return new Date().toISOString();
}

const mockApi: WatchlistApi = {
  async getAll() {
    return getItem<WatchlistItem[]>(KEY) ?? [];
  },

  async getById(id) {
    const items = getItem<WatchlistItem[]>(KEY) ?? [];
    return items.find((i) => i.id === id) ?? null;
  },

  async add(input) {
    const items = getItem<WatchlistItem[]>(KEY) ?? [];
    const item: WatchlistItem = {
      ...input,
      symbol: input.symbol.trim().toUpperCase(),
      id: generateId(),
      enabled: true,
      createdAt: now(),
      updatedAt: now(),
    };
    items.push(item);
    setItem(KEY, items);
    return item;
  },

  async update(id, input) {
    const items = getItem<WatchlistItem[]>(KEY) ?? [];
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...input, updatedAt: now() };
    setItem(KEY, items);
    return items[idx];
  },

  async setEnabled(id, enabled) {
    const items = getItem<WatchlistItem[]>(KEY) ?? [];
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], enabled, updatedAt: now() };
    setItem(KEY, items);
    return items[idx];
  },

  async remove(id) {
    const items = getItem<WatchlistItem[]>(KEY) ?? [];
    setItem(
      KEY,
      items.filter((i) => i.id !== id),
    );
  },
};

// ============ remote 实现 ============
// unwrap 统一从 shared/api/unwrappers 引入。

const remoteApi: WatchlistApi = {
  async getAll() {
    return unwrap(client.get<ApiResponse<WatchlistItem[]>>('/watchlist'));
  },

  async getById(id) {
    return unwrap(client.get<ApiResponse<WatchlistItem>>(`/watchlist/${id}`));
  },

  async add(input) {
    // 后端 CreateWatchlistDTO：symbol/name 必填，其余可选。
    // symbol 在前端先规范化（trim + 大写），保持与 mock 一致口径。
    const body: WatchlistItemInput = {
      ...input,
      symbol: input.symbol.trim().toUpperCase(),
    };
    return unwrap(client.post<ApiResponse<WatchlistItem>>('/watchlist', body));
  },

  async update(id, input) {
    // 后端 PUT /watchlist/{id} 是全量编辑语义，未传字段会被归默认。
    // 前端入参是 Partial，因此先读完整记录再合并后 PUT，避免后端丢字段。
    const existing = await unwrap(client.get<ApiResponse<WatchlistItem>>(`/watchlist/${id}`));
    const merged: WatchlistItem = { ...existing, ...input };
    return unwrap(client.put<ApiResponse<WatchlistItem>>(`/watchlist/${id}`, merged));
  },

  async setEnabled(id, enabled) {
    return unwrap(
      client.patch<ApiResponse<WatchlistItem>>(`/watchlist/${id}/enabled`, { enabled }),
    );
  },

  async remove(id) {
    // DELETE 接口 data 合法为 null，必须用 unwrapVoid（unwrap 会因 data=null 误抛错）。
    await unwrapVoid(client.delete<ApiResponse<unknown>>(`/watchlist/${id}`));
  },
};

// ============ 分流 ============

function pick(): WatchlistApi {
  return getSettings().apiMode === 'remote' ? remoteApi : mockApi;
}

// ============ 具名 async 导出（调用方最小改动） ============

export async function getWatchlist(): Promise<WatchlistItem[]> {
  return pick().getAll();
}

export async function getWatchlistItemById(id: EntityId): Promise<WatchlistItem | null> {
  return pick().getById(id);
}

export async function addWatchlistItem(input: WatchlistItemInput): Promise<WatchlistItem> {
  return pick().add(input);
}

export async function updateWatchlistItem(
  id: EntityId,
  input: WatchlistItemUpdate,
): Promise<WatchlistItem | null> {
  return pick().update(id, input);
}

export async function setWatchlistEnabled(
  id: EntityId,
  enabled: boolean,
): Promise<WatchlistItem | null> {
  return pick().setEnabled(id, enabled);
}

export async function deleteWatchlistItem(id: EntityId): Promise<void> {
  return pick().remove(id);
}
