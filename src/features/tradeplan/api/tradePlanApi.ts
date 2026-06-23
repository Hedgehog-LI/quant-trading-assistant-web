/**
 * 交易计划数据访问层（mock / remote 双模式）。
 *
 * - mock：读写本地 localStorage（key='tradePlans'），generateId 生成 UUID string。
 * - remote：调用后端 /trade-plans/*（baseURL 已配置 /api/v1 由 client 自动拼接）。
 *
 * 按 settings.apiMode 分流，每次调用现读 settings，切换模式无需刷新页面。
 * 范式参照 portfolioApi.ts：interface + unwrap + mockApi + remoteApi + pick 分流。
 *
 * 导出形式：保留具名 async 函数（不聚合成对象），方便跨 feature（dashboard）用具名函数调用。
 * 所有方法返回 Promise（mock 同步 localStorage 也包 async）。
 */
import { client } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import { unwrap, unwrapVoid } from '../../../shared/api/unwrappers';
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import { getSettings } from '../../settings/api/settingsApi';
import type { EntityId, PlanStatus, TradePlan } from '../../../shared/types/domain';

const KEY = 'tradePlans';

function now(): string {
  return new Date().toISOString();
}

// ============ 输入类型 ============

export type TradePlanInput = Omit<TradePlan, 'id' | 'createdAt' | 'updatedAt'>;
export type TradePlanUpdateInput = Partial<Omit<TradePlan, 'id' | 'createdAt' | 'updatedAt'>>;

// ============ 接口 ============

export interface TradePlanApi {
  getAll(): Promise<TradePlan[]>;
  getById(id: EntityId): Promise<TradePlan | null>;
  add(input: TradePlanInput): Promise<TradePlan>;
  update(id: EntityId, input: TradePlanUpdateInput): Promise<TradePlan | null>;
  updateStatus(id: EntityId, planStatus: PlanStatus): Promise<TradePlan | null>;
  remove(id: EntityId): Promise<void>;
}

// ============ mock 实现 ============

const mockApi: TradePlanApi = {
  async getAll() {
    return getItem<TradePlan[]>(KEY) ?? [];
  },

  async getById(id) {
    const items = getItem<TradePlan[]>(KEY) ?? [];
    return items.find((i) => i.id === id) ?? null;
  },

  async add(input) {
    const items = getItem<TradePlan[]>(KEY) ?? [];
    const item: TradePlan = {
      ...input,
      symbol: input.symbol.trim().toUpperCase(),
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    };
    items.push(item);
    setItem(KEY, items);
    return item;
  },

  async update(id, input) {
    const items = getItem<TradePlan[]>(KEY) ?? [];
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...input, updatedAt: now() };
    setItem(KEY, items);
    return items[idx];
  },

  async updateStatus(id, planStatus) {
    return mockApi.update(id, { planStatus });
  },

  async remove(id) {
    const items = getItem<TradePlan[]>(KEY) ?? [];
    setItem(
      KEY,
      items.filter((i) => i.id !== id),
    );
  },
};

// ============ remote 实现 ============
// unwrap 统一从 shared/api/unwrappers 引入。

const remoteApi: TradePlanApi = {
  async getAll() {
    return unwrap(client.get<ApiResponse<TradePlan[]>>('/trade-plans'));
  },

  async getById(id) {
    try {
      return await unwrap(client.get<ApiResponse<TradePlan>>(`/trade-plans/${id}`));
    } catch (e) {
      // 404 / 业务失败视为不存在，返回 null（与 mock 口径一致）
      if (e instanceof Error) return null;
      throw e;
    }
  },

  async add(input) {
    return unwrap(client.post<ApiResponse<TradePlan>>('/trade-plans', input));
  },

  /**
   * 后端 PUT 全量编辑语义，前端 input 是 Partial。
   * 先读完整记录再合并后 PUT，避免后端丢字段。
   */
  async update(id, input) {
    const existing = await unwrap(client.get<ApiResponse<TradePlan>>(`/trade-plans/${id}`));
    const merged: TradePlan = { ...existing, ...input };
    return unwrap(client.put<ApiResponse<TradePlan>>(`/trade-plans/${id}`, merged));
  },

  async updateStatus(id, planStatus) {
    return unwrap(client.patch<ApiResponse<TradePlan>>(`/trade-plans/${id}/status`, { planStatus }));
  },

  async remove(id) {
    // DELETE 接口 data 合法为 null，必须用 unwrapVoid（unwrap 会因 data=null 误抛错）。
    await unwrapVoid(client.delete<ApiResponse<unknown>>(`/trade-plans/${id}`));
  },
};

// ============ 分流 ============

function pick(): TradePlanApi {
  return getSettings().apiMode === 'remote' ? remoteApi : mockApi;
}

// ============ 具名 async 导出（保留以兼容跨 feature 调用） ============

export async function getTradePlans(): Promise<TradePlan[]> {
  return pick().getAll();
}

export async function getTradePlanById(id: EntityId): Promise<TradePlan | null> {
  return pick().getById(id);
}

export async function addTradePlan(input: TradePlanInput): Promise<TradePlan> {
  return pick().add(input);
}

export async function updateTradePlan(
  id: EntityId,
  input: TradePlanUpdateInput,
): Promise<TradePlan | null> {
  return pick().update(id, input);
}

/**
 * 改计划状态（DRAFT→ACTIVE / ACTIVE→DONE / →CANCELLED）。
 * remote 走 PATCH /trade-plans/{id}/status；mock 合并到 update。
 */
export async function updateTradePlanStatus(
  id: EntityId,
  planStatus: PlanStatus,
): Promise<TradePlan | null> {
  return pick().updateStatus(id, planStatus);
}

export async function deleteTradePlan(id: EntityId): Promise<void> {
  return pick().remove(id);
}
