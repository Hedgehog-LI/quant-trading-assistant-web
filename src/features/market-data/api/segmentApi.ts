import { client } from '../../../shared/api/client';
import { unwrap } from '../../../shared/api/unwrappers';
import { getSettings } from '../../settings/api/settingsApi';
import type { MarketSegment, MarketSegmentMember, EntityId } from '../../../shared/types/domain';

interface PageResult<T> { items: T[]; total: number; page: number; size: number; }

const BASE = '/market-data/segments';

const remoteApi = {
  create: (data: SegmentInput) => unwrap<MarketSegment>(client.post(BASE, data)),
  list: (params: SegmentFilter) => unwrap<PageResult<MarketSegment>>(client.get(BASE, { params })),
  get: (id: EntityId) => unwrap<MarketSegment>(client.get(`${BASE}/${id}`)),
  update: (id: EntityId, data: SegmentInput) => unwrap<MarketSegment>(client.put(`${BASE}/${id}`, data)),
  remove: (id: EntityId) => unwrap<void>(client.delete(`${BASE}/${id}`)),
  listMembers: (id: EntityId) => unwrap<MarketSegmentMember[]>(client.get(`${BASE}/${id}/members`)),
  addMember: (id: EntityId, data: MemberInput) => unwrap<MarketSegmentMember>(client.post(`${BASE}/${id}/members`, data)),
  removeMember: (id: EntityId, symbol: string) => unwrap<void>(client.delete(`${BASE}/${id}/members/${symbol}`)),
};

function emptyPage<T>(): PageResult<T> { return { items: [], total: 0, page: 1, size: 20 }; }

const mockApi = {
  create: async (data: SegmentInput): Promise<MarketSegment> => ({
    id: Date.now(), segmentCode: 'SEG_' + Date.now() % 1000000, segmentName: data.segmentName,
    segmentType: data.segmentType || 'CUSTOM', description: data.description,
    enabled: data.enabled ?? true, memberCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }),
  list: async (_params: SegmentFilter): Promise<PageResult<MarketSegment>> => emptyPage(),
  get: async (_id: EntityId): Promise<MarketSegment> => { throw new Error('mock 无板块数据'); },
  update: async (_id: EntityId, data: SegmentInput): Promise<MarketSegment> => ({ segmentName: data.segmentName, enabled: data.enabled ?? true } as MarketSegment),
  remove: async (_id: EntityId): Promise<void> => {},
  listMembers: async (_id: EntityId): Promise<MarketSegmentMember[]> => [],
  addMember: async (_id: EntityId, data: MemberInput): Promise<MarketSegmentMember> => ({
    id: Date.now(), segmentId: Number(_id), canonicalSymbol: data.canonicalSymbol,
    sortOrder: data.sortOrder || 0, remark: data.remark, createdAt: new Date().toISOString(),
  }),
  removeMember: async (_id: EntityId, _symbol: string): Promise<void> => {},
};

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
