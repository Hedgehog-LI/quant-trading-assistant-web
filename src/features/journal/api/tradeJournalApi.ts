/**
 * 交易记录数据访问层（mock / remote 双模式）。
 *
 * - mock：localStorage 读写，amount = price * quantity，新增 reviewStatus='PENDING'。
 * - remote：调用后端 /trade-journals/*（client 自动拼 /api/v1，vite proxy /api → 后端）。
 *
 * 按 settings.apiMode 分流，每次调用现读 settings，切换模式无需刷新页面。
 *
 * 导出形式：保留具名 async 函数（不聚合成 tradeJournalApi 对象）。
 * 跨 feature 调用方（dashboard、portfolio mock FIFO、ReviewForm 关联交易下拉、useReview 批量改状态）
 * 都用具名函数，签名一致。
 *
 * remote 注意：
 * - 后端 PUT 全量编辑，费用字段传 null 会被归 0。update 必须先 GET 读完整记录，再合并后 PUT，
 *   避免前端 Partial 更新导致费用被清零。
 * - 后端无批量 review-status 接口。batchUpdateReviewStatus remote = Promise.all 逐条 PATCH。
 */
import { client } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import { unwrap, unwrapVoid } from '../../../shared/api/unwrappers';
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import { getSettings } from '../../settings/api/settingsApi';
import type { EntityId, TradeJournal, ReviewStatus } from '../../../shared/types/domain';

const KEY = 'tradeJournals';

// ============ mock 工具 ============

function now(): string {
  return new Date().toISOString();
}

function readAll(): TradeJournal[] {
  return getItem<TradeJournal[]>(KEY) ?? [];
}

function writeAll(items: TradeJournal[]): void {
  setItem(KEY, items);
}

// ============ 接口 ============

/**
 * mock / remote 共享的接口，所有方法返回 Promise，签名一致。
 * 具名导出函数内部走 pick() 分流。
 */
export interface TradeJournalApi {
  getAll(): Promise<TradeJournal[]>;
  getById(id: EntityId): Promise<TradeJournal | null>;
  create(input: Omit<TradeJournal, 'id' | 'amount' | 'reviewStatus' | 'createdAt' | 'updatedAt'>): Promise<TradeJournal>;
  update(
    id: EntityId,
    input: Partial<Omit<TradeJournal, 'id' | 'createdAt' | 'updatedAt'>> & {
      unlinkPlan?: boolean;
    },
  ): Promise<TradeJournal | null>;
  updateReviewStatus(id: EntityId, reviewStatus: ReviewStatus): Promise<TradeJournal | null>;
  batchUpdateReviewStatus(ids: EntityId[], reviewStatus: ReviewStatus): Promise<void>;
  remove(id: EntityId): Promise<void>;
}

// ============ mock 实现 ============

const mockApi: TradeJournalApi = {
  async getAll() {
    return readAll();
  },

  async getById(id) {
    return readAll().find((i) => i.id === id) ?? null;
  },

  async create(input) {
    const items = readAll();
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
    writeAll(items);
    return item;
  },

  async update(id, input) {
    const items = readAll();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const { unlinkPlan, ...rest } = input;
    const updated: TradeJournal = { ...items[idx], ...rest, updatedAt: now() };
    if (unlinkPlan) {
      // 显式解绑计划关联（与后端 unlinkPlan 三态语义一致）
      updated.planId = undefined;
    }
    // 如果 price 或 quantity 变了，重新计算 amount
    if (rest.price !== undefined || rest.quantity !== undefined) {
      updated.amount = updated.price * updated.quantity;
    }
    items[idx] = updated;
    writeAll(items);
    return updated;
  },

  async updateReviewStatus(id, reviewStatus) {
    return mockApi.update(id, { reviewStatus });
  },

  async batchUpdateReviewStatus(ids, reviewStatus) {
    const items = readAll();
    const idSet = new Set(ids);
    items.forEach((item) => {
      if (idSet.has(item.id)) {
        item.reviewStatus = reviewStatus;
        item.updatedAt = now();
      }
    });
    writeAll(items);
  },

  async remove(id) {
    const items = readAll();
    writeAll(items.filter((i) => i.id !== id));
  },
};

// ============ remote 实现 ============
// unwrap 统一从 shared/api/unwrappers 引入。

const remoteApi: TradeJournalApi = {
  async getAll() {
    return unwrap(client.get<ApiResponse<TradeJournal[]>>('/trade-journals'));
  },

  async getById(id) {
    try {
      return await unwrap(client.get<ApiResponse<TradeJournal>>(`/trade-journals/${id}`));
    } catch {
      // 不存在或接口报错统一返回 null（与 mock 口径一致）
      return null;
    }
  },

  async create(input) {
    // amount 后端自动算，前端不传
    return unwrap(client.post<ApiResponse<TradeJournal>>('/trade-journals', input));
  },

  async update(id, input) {
    // 后端 PUT 全量编辑，费用字段传 null 会归 0。
    // 先读完整记录再合并后 PUT，避免前端 Partial 更新导致费用清零。
    let existing: TradeJournal;
    try {
      existing = await unwrap(client.get<ApiResponse<TradeJournal>>(`/trade-journals/${id}`));
    } catch {
      return null;
    }
    // unlinkPlan 透传到 body（后端按三态处理），不写入 TradeJournal 实体
    const { unlinkPlan, ...rest } = input;
    const merged = { ...existing, ...rest, ...(unlinkPlan ? { unlinkPlan: true } : {}) };
    return unwrap(client.put<ApiResponse<TradeJournal>>(`/trade-journals/${id}`, merged));
  },

  async updateReviewStatus(id, reviewStatus) {
    try {
      return await unwrap(
        client.patch<ApiResponse<TradeJournal>>(`/trade-journals/${id}/review-status`, { reviewStatus }),
      );
    } catch {
      return null;
    }
  },

  async batchUpdateReviewStatus(ids, reviewStatus) {
    // 后端无批量 review-status 接口，逐条 PATCH 并发执行。
    await Promise.all(ids.map((id) => remoteApi.updateReviewStatus(id, reviewStatus)));
  },

  async remove(id) {
    // DELETE 接口 data 合法为 null，必须用 unwrapVoid（unwrap 会因 data=null 误抛错）。
    await unwrapVoid(client.delete<ApiResponse<unknown>>(`/trade-journals/${id}`));
  },
};

// ============ 分流 ============

function pick(): TradeJournalApi {
  return getSettings().apiMode === 'remote' ? remoteApi : mockApi;
}

// ============ 具名导出（跨 feature 调用方使用） ============

export async function getTradeJournals(): Promise<TradeJournal[]> {
  return pick().getAll();
}

export async function getTradeJournalById(id: EntityId): Promise<TradeJournal | null> {
  return pick().getById(id);
}

export async function addTradeJournal(
  input: Omit<TradeJournal, 'id' | 'amount' | 'reviewStatus' | 'createdAt' | 'updatedAt'>,
): Promise<TradeJournal> {
  return pick().create(input);
}

export async function updateTradeJournal(
  id: EntityId,
  input: Partial<Omit<TradeJournal, 'id' | 'createdAt' | 'updatedAt'>> & {
    unlinkPlan?: boolean;
  },
): Promise<TradeJournal | null> {
  return pick().update(id, input);
}

export async function updateReviewStatus(
  id: EntityId,
  reviewStatus: ReviewStatus,
): Promise<TradeJournal | null> {
  return pick().updateReviewStatus(id, reviewStatus);
}

export async function batchUpdateReviewStatus(
  ids: EntityId[],
  reviewStatus: ReviewStatus,
): Promise<void> {
  return pick().batchUpdateReviewStatus(ids, reviewStatus);
}

export async function deleteTradeJournal(id: EntityId): Promise<void> {
  return pick().remove(id);
}
