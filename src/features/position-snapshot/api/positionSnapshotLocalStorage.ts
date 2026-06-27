import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import { calculatePositionSnapshot } from './positionSnapshotCalculator';
import type {
  PositionMarketType,
  PositionSnapshotDetail,
  PositionSnapshotFilter,
  PositionSnapshotItemInput,
  PositionSnapshotSaveInput,
  PositionSnapshotUpdateInput,
  SnapshotStatus,
} from '../model/types';

const KEY = 'positionSnapshots';
const MARKET_TYPES: PositionMarketType[] = ['SH', 'SZ', 'BJ', 'UNKNOWN'];

function now(): string {
  return new Date().toISOString();
}

function readAll(): PositionSnapshotDetail[] {
  return getItem<PositionSnapshotDetail[]>(KEY) ?? [];
}

function saveAll(items: PositionSnapshotDetail[]): void {
  setItem(KEY, items);
}

function sameId(left: string | number, right: string | number): boolean {
  return String(left) === String(right);
}

function normalizeItems(items: PositionSnapshotItemInput[]): PositionSnapshotItemInput[] {
  const symbols = new Set<string>();
  return items.map((item) => {
    const symbol = item.symbol.trim().toUpperCase();
    if (!symbol) throw new Error('股票代码不能为空');
    if (symbols.has(symbol)) throw new Error(`同一快照内股票代码不能重复：${symbol}`);
    symbols.add(symbol);

    const marketType = item.marketType ?? 'UNKNOWN';
    if (!MARKET_TYPES.includes(marketType)) throw new Error(`无效的证券市场类型：${marketType}`);
    if (!Number.isInteger(item.holdingQuantity) || item.holdingQuantity <= 0) {
      throw new Error(`股票 ${symbol} 的持仓数量必须为正整数`);
    }
    const availableQuantity = item.availableQuantity ?? item.holdingQuantity;
    if (!Number.isInteger(availableQuantity) || availableQuantity < 0 || availableQuantity > item.holdingQuantity) {
      throw new Error(`股票 ${symbol} 的可用数量不能超过持仓数量`);
    }
    if (!Number.isFinite(item.costPrice) || item.costPrice < 0 || !Number.isFinite(item.currentPrice) || item.currentPrice < 0) {
      throw new Error(`股票 ${symbol} 的成本价和当前价不能为负数`);
    }
    return {
      ...item,
      symbol,
      name: item.name?.trim() || undefined,
      marketType,
      availableQuantity,
      remark: item.remark?.trim() || undefined,
    };
  });
}

function validateHeader(snapshotDate: string, snapshotTime: string): void {
  if (!snapshotDate || !snapshotTime) throw new Error('快照日期和时间不能为空');
  if (snapshotTime.slice(0, 10) !== snapshotDate) {
    throw new Error('快照日期必须与快照时间中的日期一致');
  }
}

function buildDetail(
  input: PositionSnapshotSaveInput,
  id: string | number,
  createdAt: string,
): PositionSnapshotDetail {
  validateHeader(input.snapshotDate, input.snapshotTime);
  const calculated = calculatePositionSnapshot(normalizeItems(input.items));
  const timestamp = now();
  return {
    id,
    snapshotDate: input.snapshotDate,
    snapshotTime: input.snapshotTime,
    snapshotName: input.snapshotName?.trim() || undefined,
    sourceType: input.sourceType,
    snapshotStatus: input.snapshotStatus,
    remark: input.remark?.trim() || undefined,
    totalCostAmount: calculated.totalCostAmount,
    totalMarketValue: calculated.totalMarketValue,
    totalUnrealizedPnl: calculated.totalUnrealizedPnl,
    totalPnlRate: calculated.totalPnlRate,
    positionCount: calculated.positionCount,
    createdAt,
    updatedAt: timestamp,
    items: calculated.items.map((item) => ({
      ...item,
      id: generateId(),
      snapshotId: id,
      marketType: item.marketType ?? 'UNKNOWN',
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  };
}

export function listLocalPositionSnapshots(filter: PositionSnapshotFilter = {}): PositionSnapshotDetail[] {
  return readAll()
    .filter((item) => filter.fromDate === undefined || item.snapshotDate >= filter.fromDate)
    .filter((item) => filter.toDate === undefined || item.snapshotDate <= filter.toDate)
    .filter((item) => filter.status === undefined || item.snapshotStatus === filter.status)
    .filter((item) => filter.sourceType === undefined || item.sourceType === filter.sourceType)
    .filter((item) => filter.status !== undefined || filter.includeCanceled === true || item.snapshotStatus !== 'CANCELED')
    .sort((a, b) => b.snapshotTime.localeCompare(a.snapshotTime) || String(b.id).localeCompare(String(a.id)));
}

export function getLocalPositionSnapshotById(id: string | number): PositionSnapshotDetail {
  const item = readAll().find((snapshot) => sameId(snapshot.id, id));
  if (!item) throw new Error(`持仓快照不存在：${id}`);
  return item;
}

export function getLatestLocalPositionSnapshot(): PositionSnapshotDetail | null {
  return readAll()
    .filter((item) => item.snapshotStatus === 'CONFIRMED')
    .sort((a, b) => b.snapshotTime.localeCompare(a.snapshotTime) || String(b.id).localeCompare(String(a.id)))[0] ?? null;
}

export function createLocalPositionSnapshot(input: PositionSnapshotSaveInput): PositionSnapshotDetail {
  if (input.snapshotStatus !== 'DRAFT' && input.snapshotStatus !== 'CONFIRMED') {
    throw new Error('新建持仓快照只允许草稿或已确认状态');
  }
  const id = generateId();
  const timestamp = now();
  const created = buildDetail(input, id, timestamp);
  const all = readAll();
  all.push(created);
  saveAll(all);
  return created;
}

export function updateLocalPositionSnapshot(id: string | number, input: PositionSnapshotUpdateInput): PositionSnapshotDetail {
  const all = readAll();
  const index = all.findIndex((item) => sameId(item.id, id));
  if (index < 0) throw new Error(`持仓快照不存在：${id}`);
  const existing = all[index];
  if (existing.snapshotStatus !== 'DRAFT') throw new Error('只有草稿状态的持仓快照允许编辑');
  const updated = buildDetail(
    { ...input, sourceType: existing.sourceType, snapshotStatus: 'DRAFT' },
    existing.id,
    existing.createdAt,
  );
  all[index] = updated;
  saveAll(all);
  return updated;
}

function transitionLocalPositionSnapshot(
  id: string | number,
  target: SnapshotStatus,
  allowedCurrentStatuses: SnapshotStatus[],
): PositionSnapshotDetail {
  const all = readAll();
  const index = all.findIndex((item) => sameId(item.id, id));
  if (index < 0) throw new Error(`持仓快照不存在：${id}`);
  const existing = all[index];
  if (!allowedCurrentStatuses.includes(existing.snapshotStatus)) {
    throw new Error(`持仓快照不允许从 ${existing.snapshotStatus} 流转到 ${target}`);
  }
  const updated = { ...existing, snapshotStatus: target, updatedAt: now() };
  all[index] = updated;
  saveAll(all);
  return updated;
}

export function confirmLocalPositionSnapshot(id: string | number): PositionSnapshotDetail {
  return transitionLocalPositionSnapshot(id, 'CONFIRMED', ['DRAFT']);
}

export function cancelLocalPositionSnapshot(id: string | number): PositionSnapshotDetail {
  return transitionLocalPositionSnapshot(id, 'CANCELED', ['DRAFT', 'CONFIRMED']);
}
