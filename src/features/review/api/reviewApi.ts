/**
 * 盘后复盘数据访问层（mock / remote 双模式）。
 *
 * 范式对齐 portfolioApi：
 * - interface 定义统一契约，mock 与 remote 共享同一签名；
 * - 每个具名导出函数内部 pick() 分流，按 settings.apiMode 现读现取；
 * - remote 通过 shared client 调用后端，返回经 unwrap 解包。
 *
 * 保留具名 async 函数导出（非 reviewApi 聚合对象），便于 dashboard 等
 * 跨 feature 调用方直接用具名函数。
 *
 * 后端契约（前缀 /reviews）：
 * - GET    /reviews          → ReviewNote[]（可带 date/symbol query）
 * - GET    /reviews/{id}     → ReviewNote
 * - POST   /reviews          → ReviewNote（reviewDate/title 必填，linkedJournalIds 必须存在）
 * - PUT    /reviews/{id}     → ReviewNote（全量编辑，title 必填）
 * - DELETE /reviews/{id}     → Void（不存在时 success=false）。
 *
 * update 全量合并：后端 PUT 是全量语义，前端 update 是 Partial，remote 实现
 * 先读完整记录再合并后 PUT，避免后端丢字段。
 */
import { client } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import { unwrap, unwrapVoid } from '../../../shared/api/unwrappers';
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import { getSettings } from '../../settings/api/settingsApi';
import type { EntityId, ReviewNote } from '../../../shared/types/domain';

const KEY = 'reviews';

function now(): string {
  return new Date().toISOString();
}

// ============ 输入类型 ============

export type ReviewInput = Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>;
export type ReviewUpdate = Partial<Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>>;

// ============ 接口 ============

interface ReviewApi {
  getAll(): Promise<ReviewNote[]>;
  getById(id: EntityId): Promise<ReviewNote | null>;
  create(input: ReviewInput): Promise<ReviewNote>;
  update(id: EntityId, input: ReviewUpdate): Promise<ReviewNote | null>;
  remove(id: EntityId): Promise<void>;
}

// ============ mock 实现 ============

function readAll(): ReviewNote[] {
  return getItem<ReviewNote[]>(KEY) ?? [];
}

function saveAll(items: ReviewNote[]): void {
  setItem(KEY, items);
}

const mockApi: ReviewApi = {
  async getAll() {
    return readAll();
  },
  async getById(id) {
    return readAll().find((i) => i.id === id) ?? null;
  },
  async create(input) {
    const items = readAll();
    const item: ReviewNote = {
      ...input,
      symbol: input.symbol?.trim().toUpperCase() || undefined,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    };
    items.push(item);
    saveAll(items);
    return item;
  },
  async update(id, input) {
    const items = readAll();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...input, updatedAt: now() };
    saveAll(items);
    return items[idx];
  },
  async remove(id) {
    const items = readAll();
    saveAll(items.filter((i) => i.id !== id));
  },
};

// ============ remote 实现 ============
// unwrap 统一从 shared/api/unwrappers 引入。

const remoteApi: ReviewApi = {
  async getAll() {
    return unwrap(client.get<ApiResponse<ReviewNote[]>>('/reviews'));
  },
  async getById(id) {
    try {
      return await unwrap(client.get<ApiResponse<ReviewNote>>(`/reviews/${id}`));
    } catch {
      // 与 mock 语义一致：未找到返回 null。
      return null;
    }
  },
  async create(input) {
    return unwrap(client.post<ApiResponse<ReviewNote>>('/reviews', input));
  },
  async update(id, input) {
    // 后端 PUT 全量编辑语义：先读完整记录，合并后再 PUT，避免丢字段。
    const existing = await unwrap(client.get<ApiResponse<ReviewNote>>(`/reviews/${id}`));
    const merged: ReviewNote = { ...existing, ...input, updatedAt: now() };
    return unwrap(client.put<ApiResponse<ReviewNote>>(`/reviews/${id}`, merged));
  },
  async remove(id) {
    // DELETE 接口 data 合法为 null，必须用 unwrapVoid（unwrap 会因 data=null 误抛错）。
    await unwrapVoid(client.delete<ApiResponse<unknown>>(`/reviews/${id}`));
  },
};

// ============ 分流 ============

function pick(): ReviewApi {
  return getSettings().apiMode === 'remote' ? remoteApi : mockApi;
}

// ============ 具名导出（跨 feature 调用方用具名函数） ============

export async function getReviews(): Promise<ReviewNote[]> {
  return pick().getAll();
}

export async function getReviewById(id: EntityId): Promise<ReviewNote | null> {
  return pick().getById(id);
}

export async function addReview(input: ReviewInput): Promise<ReviewNote> {
  return pick().create(input);
}

export async function updateReview(id: EntityId, input: ReviewUpdate): Promise<ReviewNote | null> {
  return pick().update(id, input);
}

export async function deleteReview(id: EntityId): Promise<void> {
  return pick().remove(id);
}
