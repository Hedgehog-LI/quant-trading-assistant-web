import { client } from '../../../shared/api/client';
import { unwrap } from '../../../shared/api/unwrappers';
import { getSettings } from '../../settings/api/settingsApi';
import type {
  WorkbenchOverview,
  MarketDataSyncPlan,
  MarketDataSyncTask,
  MarketDataSyncTaskItem,
  StockMinuteBar,
  MarketTradingSession,
  MarketDataWatermark,
  MinuteBarUpsertResult,
  EntityId,
} from '../../../shared/types/domain';

interface PageResult<T> { items: T[]; total: number; page: number; size: number; }

const BASE = '/market-data';

// ==================== Remote 实现 ====================

const remoteApi = {
  getOverview: () => unwrap<WorkbenchOverview>(client.get(`${BASE}/workbench/overview`)),
  createPlan: (data: PlanInput) =>
    unwrap<MarketDataSyncPlan>(client.post(`${BASE}/sync-plans`, data)),
  listPlans: (params: PlanFilter) =>
    unwrap<PageResult<MarketDataSyncPlan>>(client.get(`${BASE}/sync-plans`, { params })),
  getPlan: (id: EntityId) =>
    unwrap<MarketDataSyncPlan>(client.get(`${BASE}/sync-plans/${id}`)),
  updatePlan: (id: EntityId, data: PlanUpdateInput) =>
    unwrap<MarketDataSyncPlan>(client.put(`${BASE}/sync-plans/${id}`, data)),
  togglePlan: (id: EntityId, enabled: boolean) =>
    unwrap<MarketDataSyncPlan>(client.post(`${BASE}/sync-plans/${id}/toggle`, null, { params: { enabled } })),
  runPlan: (id: EntityId) =>
    unwrap<MarketDataSyncPlan>(client.post(`${BASE}/sync-plans/${id}/run`)),
  listTaskItems: (taskId: EntityId, status?: string, page = 1, size = 20) =>
    unwrap<PageResult<MarketDataSyncTaskItem>>(client.get(`${BASE}/sync-tasks/${taskId}/items`, { params: { status, page, size } })),
  reconcileTask: (taskId: EntityId) =>
    unwrap<MarketDataSyncTask>(client.post(`${BASE}/sync-tasks/${taskId}/reconcile`)),
  listMinuteBars: (filter: MinuteBarFilter) =>
    unwrap<PageResult<StockMinuteBar>>(client.get(`${BASE}/minute-bars`, { params: filter })),
  upsertMinuteBar: (data: MinuteBarInput) =>
    unwrap<MinuteBarUpsertResult>(client.post(`${BASE}/minute-bars`, data)),
  getTradingSessions: () =>
    unwrap<MarketTradingSession[]>(client.get(`${BASE}/trading-sessions`)),
  isTradingDay: (marketCode: string, date: string) =>
    unwrap<boolean>(client.get(`${BASE}/trading-sessions/is-trading-day`, { params: { marketCode, date } })),
  listWatermarks: (params: WatermarkFilter) =>
    unwrap<PageResult<MarketDataWatermark>>(client.get(`${BASE}/watermarks`, { params })),
};

// ==================== Mock 实现 ====================

function emptyPage<T>(): PageResult<T> {
  return { items: [], total: 0, page: 1, size: 20 };
}

const mockApi = {
  getOverview: async (): Promise<WorkbenchOverview> => ({
    totalSymbols: 0,
    totalMinuteBars: 0,
    totalDailyBars: 0,
    unresolvedHighAlerts: 0,
    unresolvedWarnAlerts: 0,
    failedTasksToday: 0,
    recentWatermarks: [],
    recentAlerts: [],
    tradingSessions: [
      { id: 1, marketCode: 'CN_A', sessionType: 'AUCTION', sessionName: '集合竞价（开盘）', startTime: '09:15', endTime: '09:25', isAuction: true, sortOrder: 1, enabled: true },
      { id: 2, marketCode: 'CN_A', sessionType: 'AM', sessionName: '上午连续竞价', startTime: '09:30', endTime: '11:30', isAuction: false, sortOrder: 2, enabled: true },
      { id: 3, marketCode: 'CN_A', sessionType: 'PM', sessionName: '下午连续竞价', startTime: '13:00', endTime: '14:57', isAuction: false, sortOrder: 3, enabled: true },
      { id: 4, marketCode: 'CN_A', sessionType: 'AUCTION', sessionName: '集合竞价（收盘）', startTime: '14:57', endTime: '15:00', isAuction: true, sortOrder: 4, enabled: true },
    ],
  }),
  createPlan: async (_data: PlanInput): Promise<MarketDataSyncPlan> => ({
    id: Date.now(), planName: _data.planName, taskType: _data.taskType, provider: _data.provider,
    scopeJson: _data.scopeJson, intervalType: _data.intervalType, adjustType: _data.adjustType || 'NONE',
    triggerType: _data.triggerType || 'MANUAL', cronExpr: _data.cronExpr,
    includeAuction: _data.includeAuction || false, collectFrequency: _data.collectFrequency,
    enabled: true, description: _data.description, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }),
  listPlans: async (_params: PlanFilter): Promise<PageResult<MarketDataSyncPlan>> => emptyPage(),
  getPlan: async (_id: EntityId): Promise<MarketDataSyncPlan> => { throw new Error('mock 模式无计划数据'); },
  updatePlan: async (_id: EntityId, _data: PlanUpdateInput): Promise<MarketDataSyncPlan> => { throw new Error('mock 模式无计划数据'); },
  togglePlan: async (_id: EntityId, enabled: boolean): Promise<MarketDataSyncPlan> => ({ enabled } as MarketDataSyncPlan),
  runPlan: async (_id: EntityId): Promise<MarketDataSyncPlan> => ({ lastRunAt: new Date().toISOString(), lastTaskId: Date.now() } as MarketDataSyncPlan),
  listTaskItems: async (_taskId: EntityId, _status?: string): Promise<PageResult<MarketDataSyncTaskItem>> => emptyPage(),
  reconcileTask: async (taskId: EntityId): Promise<MarketDataSyncTask> => ({ id: Number(taskId), taskType: 'DAILY_BAR_BACKFILL', provider: 'LONGPORT', scopeJson: '{}', status: 'SUCCEEDED', createdAt: new Date().toISOString() } as MarketDataSyncTask),
  listMinuteBars: async (_filter: MinuteBarFilter): Promise<PageResult<StockMinuteBar>> => emptyPage(),
  upsertMinuteBar: async (_data: MinuteBarInput): Promise<MinuteBarUpsertResult> => ({ result: 'INSERTED', qualityStatus: 'VALID' }),
  getTradingSessions: async (): Promise<MarketTradingSession[]> => (await mockApi.getOverview()).tradingSessions!,
  isTradingDay: async (_marketCode: string, _date: string): Promise<boolean> => {
    const d = new Date(_date);
    const day = d.getDay();
    return day !== 0 && day !== 6;
  },
  listWatermarks: async (_params: WatermarkFilter): Promise<PageResult<MarketDataWatermark>> => emptyPage(),
};

// ==================== 路由 ====================

function pick<T>(mock: T, remote: T): T {
  return getSettings().apiMode === 'remote' ? remote : mock;
}

export function getWorkbenchOverview() {
  return pick(mockApi.getOverview, remoteApi.getOverview)();
}
export function createSyncPlan(data: PlanInput) {
  return pick(mockApi.createPlan, remoteApi.createPlan)(data);
}
export function listSyncPlans(params: PlanFilter) {
  return pick(mockApi.listPlans, remoteApi.listPlans)(params);
}
export function getSyncPlan(id: EntityId) {
  return pick(mockApi.getPlan, remoteApi.getPlan)(id);
}
export function updateSyncPlan(id: EntityId, data: PlanUpdateInput) {
  return pick(mockApi.updatePlan, remoteApi.updatePlan)(id, data);
}
export function toggleSyncPlan(id: EntityId, enabled: boolean) {
  return pick(mockApi.togglePlan, remoteApi.togglePlan)(id, enabled);
}
export function runSyncPlan(id: EntityId) {
  return pick(mockApi.runPlan, remoteApi.runPlan)(id);
}
export function listTaskItems(taskId: EntityId, status?: string, page?: number, size?: number) {
  return pick(mockApi.listTaskItems, remoteApi.listTaskItems)(taskId, status, page, size);
}
export function reconcileTask(taskId: EntityId) {
  return pick(mockApi.reconcileTask, remoteApi.reconcileTask)(taskId);
}
export function listMinuteBars(filter: MinuteBarFilter) {
  return pick(mockApi.listMinuteBars, remoteApi.listMinuteBars)(filter);
}
export function upsertMinuteBar(data: MinuteBarInput) {
  return pick(mockApi.upsertMinuteBar, remoteApi.upsertMinuteBar)(data);
}
export function getTradingSessions() {
  return pick(mockApi.getTradingSessions, remoteApi.getTradingSessions)();
}
export function isTradingDay(marketCode: string, date: string) {
  return pick(mockApi.isTradingDay, remoteApi.isTradingDay)(marketCode, date);
}
export function listWatermarks(params: WatermarkFilter) {
  return pick(mockApi.listWatermarks, remoteApi.listWatermarks)(params);
}

// ==================== 输入/过滤类型 ====================

export interface PlanInput {
  planName: string;
  taskType: string;
  provider: string;
  scopeJson: string;
  intervalType?: string;
  adjustType?: string;
  triggerType?: string;
  cronExpr?: string;
  includeAuction?: boolean;
  collectFrequency?: string;
  description?: string;
}

export interface PlanUpdateInput {
  planName: string;
  scopeJson: string;
  intervalType?: string;
  adjustType?: string;
  triggerType?: string;
  cronExpr?: string;
  includeAuction?: boolean;
  collectFrequency?: string;
  description?: string;
}

export interface PlanFilter {
  taskType?: string;
  provider?: string;
  enabled?: boolean;
  page?: number;
  size?: number;
}

export interface MinuteBarFilter {
  canonicalSymbol?: string;
  intervalType?: string;
  adjustType?: string;
  dataSource?: string;
  fromTime?: string;
  toTime?: string;
  tradeDate?: string;
  page?: number;
  size?: number;
}

export interface MinuteBarInput {
  canonicalSymbol: string;
  barStartTime: string;
  barEndTime: string;
  intervalType: string;
  adjustType: string;
  dataSource: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
  amount: number;
  turnoverRate?: number;
  sessionType?: string;
}

export interface WatermarkFilter {
  canonicalSymbol?: string;
  dataSource?: string;
  intervalType?: string;
  page?: number;
  size?: number;
}
