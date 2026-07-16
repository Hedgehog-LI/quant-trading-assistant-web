import { client } from '../../../shared/api/client';
import { unwrap, unwrapVoid } from '../../../shared/api/unwrappers';
import { getItem, setItem, removeItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import { getSettings } from '../../settings/api/settingsApi';
import type { MarketSegment, MarketSegmentMember, EntityId } from '../../../shared/types/domain';

interface PageResult<T> { items: T[]; total: number; page: number; size: number; }

const BASE = '/market-data/segments';

// ==================== localStorage keys ====================

const SEGMENT_KEY = 'marketSegments';
const MEMBER_KEY_PREFIX = 'marketSegmentMembers:';

function memberKey(segmentId: EntityId): string {
  return `${MEMBER_KEY_PREFIX}${segmentId}`;
}

/** 规范化 canonical symbol：去空格 + 转大写。 */
function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** 校验 canonical symbol 格式（与后端 CANONICAL_SYMBOL_REGEX 一致）。 */
function isValidCanonicalSymbol(symbol: string): boolean {
  return /^(SH|SZ|BJ)\.\d{4,6}$/.test(symbol);
}

function nowIso(): string {
  return new Date().toISOString();
}

function genCode(name: string): string {
  return `SEG_${Math.abs(hashCode(name + Date.now())) % 1000000}`;
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

// ==================== Mock 实现（localStorage 持久化 + UUID ID）====================

const mockApi = {
  create: async (data: SegmentInput): Promise<MarketSegment> => {
    const all = getItem<MarketSegment[]>(SEGMENT_KEY) ?? [];
    const seg: MarketSegment = {
      id: generateId(),
      segmentCode: genCode(data.segmentName),
      segmentName: data.segmentName,
      segmentType: data.segmentType || 'CUSTOM',
      description: data.description,
      enabled: data.enabled ?? true,
      memberCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    all.push(seg);
    setItem(SEGMENT_KEY, all);
    setItem(memberKey(seg.id), []);
    return seg;
  },

  list: async (params: SegmentFilter): Promise<PageResult<MarketSegment>> => {
    let all = getItem<MarketSegment[]>(SEGMENT_KEY) ?? [];
    if (params.segmentType) all = all.filter((s) => s.segmentType === params.segmentType);
    if (params.enabled !== undefined) all = all.filter((s) => s.enabled === params.enabled);
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      all = all.filter((s) =>
        s.segmentName.toLowerCase().includes(kw) || s.segmentCode.toLowerCase().includes(kw));
    }
    // 同步 memberCount
    all = all.map((s) => ({
      ...s,
      memberCount: (getItem<MarketSegmentMember[]>(memberKey(s.id)) ?? []).length,
    }));
    const total = all.length;
    const page = params.page ?? 1;
    const size = params.size ?? 20;
    const start = (page - 1) * size;
    return { items: all.slice(start, start + size), total, page, size };
  },

  get: async (id: EntityId): Promise<MarketSegment> => {
    const all = getItem<MarketSegment[]>(SEGMENT_KEY) ?? [];
    const seg = all.find((s) => s.id === id);
    if (!seg) throw new Error('板块不存在');
    return { ...seg, memberCount: (getItem<MarketSegmentMember[]>(memberKey(id)) ?? []).length };
  },

  update: async (id: EntityId, data: SegmentInput): Promise<MarketSegment> => {
    const all = getItem<MarketSegment[]>(SEGMENT_KEY) ?? [];
    const idx = all.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error('板块不存在');
    all[idx] = {
      ...all[idx],
      segmentName: data.segmentName ?? all[idx].segmentName,
      segmentType: data.segmentType ?? all[idx].segmentType,
      description: data.description ?? all[idx].description,
      enabled: data.enabled ?? all[idx].enabled,
      updatedAt: nowIso(),
    };
    setItem(SEGMENT_KEY, all);
    return { ...all[idx], memberCount: (getItem<MarketSegmentMember[]>(memberKey(id)) ?? []).length };
  },

  remove: async (id: EntityId): Promise<void> => {
    const all = getItem<MarketSegment[]>(SEGMENT_KEY) ?? [];
    setItem(SEGMENT_KEY, all.filter((s) => s.id !== id));
    // 真正级联删除成员桶
    removeItem(memberKey(id));
  },

  listMembers: async (id: EntityId): Promise<MarketSegmentMember[]> => {
    return getItem<MarketSegmentMember[]>(memberKey(id)) ?? [];
  },

  addMember: async (id: EntityId, data: MemberInput): Promise<MarketSegmentMember> => {
    // 验证板块存在
    const all = getItem<MarketSegment[]>(SEGMENT_KEY) ?? [];
    const seg = all.find((s) => s.id === id);
    if (!seg) throw new Error('板块不存在');

    // 规范化 symbol
    const normalized = normalizeSymbol(data.canonicalSymbol);
    if (!isValidCanonicalSymbol(normalized)) {
      throw new Error(`canonical symbol 格式不合法: ${data.canonicalSymbol}`);
    }

    const members = getItem<MarketSegmentMember[]>(memberKey(id)) ?? [];
    // 重复判断使用规范化后的 symbol
    if (members.some((m) => m.canonicalSymbol === normalized)) {
      throw new Error(`成员已存在: ${normalized}`);
    }
    const member: MarketSegmentMember = {
      id: generateId(),
      segmentId: id,
      canonicalSymbol: normalized,
      sortOrder: data.sortOrder ?? 0,
      remark: data.remark,
      createdAt: nowIso(),
    };
    members.push(member);
    setItem(memberKey(id), members);
    // 更新 segment 的 memberCount
    const idx = all.findIndex((s) => s.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], memberCount: members.length, updatedAt: nowIso() };
      setItem(SEGMENT_KEY, all);
    }
    return member;
  },

  removeMember: async (id: EntityId, symbol: string): Promise<void> => {
    const normalized = normalizeSymbol(symbol);
    const members = getItem<MarketSegmentMember[]>(memberKey(id)) ?? [];
    // 先计算 remaining，只有命中时更新
    const remaining = members.filter((m) => m.canonicalSymbol !== normalized);
    if (remaining.length === members.length) {
      // 未命中，不改变计数
      return;
    }
    setItem(memberKey(id), remaining);
    // 更新 segment 的 memberCount = remaining.length（绝不使用 members.length - 1）
    const all = getItem<MarketSegment[]>(SEGMENT_KEY) ?? [];
    const idx = all.findIndex((s) => s.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], memberCount: remaining.length, updatedAt: nowIso() };
      setItem(SEGMENT_KEY, all);
    }
  },
};

// ==================== Remote 实现（axios client）====================

const remoteApi = {
  create: (data: SegmentInput) => unwrap<MarketSegment>(client.post(`${BASE}`, data)),
  list: (params: SegmentFilter) =>
    unwrap<PageResult<MarketSegment>>(client.get(`${BASE}`, { params })),
  get: (id: EntityId) => unwrap<MarketSegment>(client.get(`${BASE}/${id}`)),
  update: (id: EntityId, data: SegmentInput) => unwrap<MarketSegment>(client.put(`${BASE}/${id}`, data)),
  remove: (id: EntityId) => unwrapVoid(client.delete(`${BASE}/${id}`)),
  listMembers: (id: EntityId) => unwrap<MarketSegmentMember[]>(client.get(`${BASE}/${id}/members`)),
  addMember: (id: EntityId, data: MemberInput) =>
    unwrap<MarketSegmentMember>(client.post(`${BASE}/${id}/members`, data)),
  removeMember: (id: EntityId, symbol: string) =>
    unwrapVoid(client.delete(`${BASE}/${id}/members/${symbol}`)),
};

// ==================== 路由 ====================

function pick<T>(mock: T, remote: T): T {
  return getSettings().apiMode === 'remote' ? remote : mock;
}

export function createSegment(data: SegmentInput) { return pick(mockApi.create, remoteApi.create)(data); }
export function listSegments(params: SegmentFilter) { return pick(mockApi.list, remoteApi.list)(params); }
export function getSegment(id: EntityId) { return pick(mockApi.get, remoteApi.get)(id); }
export function updateSegment(id: EntityId, data: SegmentInput) { return pick(mockApi.update, remoteApi.update)(id, data); }
export function deleteSegment(id: EntityId) { return pick(mockApi.remove, remoteApi.remove)(id); }
export function listSegmentMembers(id: EntityId) { return pick(mockApi.listMembers, remoteApi.listMembers)(id); }
export function addSegmentMember(id: EntityId, data: MemberInput) { return pick(mockApi.addMember, remoteApi.addMember)(id, data); }
export function removeSegmentMember(id: EntityId, symbol: string) { return pick(mockApi.removeMember, remoteApi.removeMember)(id, symbol); }

// ==================== 输入/过滤类型 ====================

export interface SegmentInput {
  segmentName: string;
  segmentType?: string;
  description?: string;
  enabled?: boolean;
}

export interface SegmentFilter {
  segmentType?: string;
  enabled?: boolean;
  keyword?: string;
  page?: number;
  size?: number;
}

export interface MemberInput {
  canonicalSymbol: string;
  sortOrder?: number;
  remark?: string;
}
