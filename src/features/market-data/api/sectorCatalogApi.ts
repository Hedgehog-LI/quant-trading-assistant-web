import { client } from '../../../shared/api/client';
import { unwrap, unwrapVoid } from '../../../shared/api/unwrappers';
import { generateId } from '../../../shared/utils/id';
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { getSettings } from '../../settings/api/settingsApi';
import type { EntityId, MarketSectorMemberSnapshot, MarketSectorPeer, MarketSectorRank,
  MarketSectorSnapshot, MarketSectorWatch } from '../../../shared/types/domain';

export type SectorMarket = 'CN' | 'HK' | 'US';
export type SectorRankIndicator =
  | 'leading-gainer' | 'today-trend' | 'popularity' | 'market-cap'
  | 'revenue' | 'revenue-growth' | 'net-profit' | 'net-profit-growth';

export interface SectorRankQuery {
  market: SectorMarket;
  indicator: SectorRankIndicator;
  sortType?: 'single' | 'multi';
  limit?: number;
}

export interface CreateSectorWatchInput {
  market: SectorMarket;
  providerSectorId: string;
  trackingSymbol?: string;
}

export interface PageResult<T> { items: T[]; total: number; page: number; size: number; }

const WATCH_KEY = 'marketSectorWatches';

const demoRanks: Record<SectorMarket, MarketSectorRank[]> = {
  CN: [{ market: 'CN', name: '半导体（演示）', providerSectorId: 'BK/CN/DEMO001', changeRate: 0.021,
    leadingName: '示例龙头', leadingSymbol: 'SH.512480', leadingChangeRate: 0.035, providerCode: 'LOCAL_DEMO' }],
  HK: [{ market: 'HK', name: '科技（演示）', providerSectorId: 'BK/HK/DEMO001', changeRate: 0.016,
    leadingName: '示例龙头', leadingSymbol: 'HK.03033', leadingChangeRate: 0.024, providerCode: 'LOCAL_DEMO' }],
  US: [{ market: 'US', name: 'Technology（演示）', providerSectorId: 'BK/US/DEMO001', changeRate: 0.012,
    leadingName: '示例龙头', leadingSymbol: 'US.XLK', leadingChangeRate: 0.018, providerCode: 'LOCAL_DEMO' }],
};

export function listIndustryRankings(query: SectorRankQuery): Promise<MarketSectorRank[]> {
  if (getSettings().apiMode === 'mock') {
    return Promise.resolve(demoRanks[query.market]);
  }
  return unwrap<MarketSectorRank[]>(client.get('/market-data/sector-catalog/industry-rankings', {
    params: { ...query, sortType: query.sortType ?? 'single', limit: query.limit ?? 20 },
  }));
}

export function getIndustryPeers(market: SectorMarket, providerSectorId: string): Promise<MarketSectorPeer> {
  if (getSettings().apiMode === 'mock') {
    const rank = demoRanks[market].find((item) => item.providerSectorId === providerSectorId) ?? demoRanks[market][0];
    return Promise.resolve({ market, topName: '本地演示', name: rank.name, providerSectorId,
      stockCount: 0, changeRate: rank.changeRate, hasChildren: false, providerCode: 'LOCAL_DEMO' });
  }
  return unwrap<MarketSectorPeer>(client.get('/market-data/sector-catalog/industry-peers', {
    params: { market, providerSectorId },
  }));
}

export async function createSectorWatch(input: CreateSectorWatchInput): Promise<MarketSectorWatch> {
  if (getSettings().apiMode === 'remote') {
    return unwrap<MarketSectorWatch>(client.post('/market-data/sector-catalog/watches', input));
  }
  const watches = getItem<MarketSectorWatch[]>(WATCH_KEY) ?? [];
  if (watches.some((item) => item.providerSectorId === input.providerSectorId)) throw new Error('该行业已经关注');
  const rank = demoRanks[input.market].find((item) => item.providerSectorId === input.providerSectorId);
  const now = new Date().toISOString();
  const id = generateId();
  const snapshot: MarketSectorSnapshot = { id: generateId(), watchId: id, snapshotTime: now,
    rankIndicator: 'constituent-summary', changeRate: rank?.changeRate, leadingName: rank?.leadingName,
    leadingSymbol: rank?.leadingSymbol, leadingChangeRate: rank?.leadingChangeRate,
    constituentCount: 0, totalNetInflow: 0, totalTurnoverAmount: 0, totalVolume: 0, dataSource: 'LOCAL_DEMO' };
  const watch: MarketSectorWatch = { id, providerCode: 'LOCAL_DEMO', providerSectorId: input.providerSectorId,
    marketCode: input.market, sectorName: rank?.name ?? input.providerSectorId, topName: '本地演示',
    trackingSymbol: input.trackingSymbol, enabled: true, lastRefreshedAt: now,
    createdAt: now, updatedAt: now, latestSnapshot: snapshot };
  setItem(WATCH_KEY, [...watches, watch]);
  return watch;
}

export function listSectorWatches(market?: SectorMarket): Promise<MarketSectorWatch[]> {
  if (getSettings().apiMode === 'remote') {
    return unwrap<MarketSectorWatch[]>(client.get('/market-data/sector-catalog/watches', { params: { market } }));
  }
  const watches = getItem<MarketSectorWatch[]>(WATCH_KEY) ?? [];
  return Promise.resolve(market ? watches.filter((item) => item.marketCode === market) : watches);
}

export async function refreshSectorWatch(id: EntityId): Promise<MarketSectorWatch> {
  if (getSettings().apiMode === 'remote') {
    return unwrap<MarketSectorWatch>(client.post(`/market-data/sector-catalog/watches/${id}/refresh`));
  }
  const watches = getItem<MarketSectorWatch[]>(WATCH_KEY) ?? [];
  const index = watches.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('行业关注不存在');
  watches[index] = { ...watches[index], lastRefreshedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  setItem(WATCH_KEY, watches);
  return watches[index];
}

export async function toggleSectorWatch(id: EntityId, enabled: boolean): Promise<MarketSectorWatch> {
  if (getSettings().apiMode === 'remote') {
    return unwrap<MarketSectorWatch>(client.post(`/market-data/sector-catalog/watches/${id}/toggle`, undefined,
      { params: { enabled } }));
  }
  const watches = getItem<MarketSectorWatch[]>(WATCH_KEY) ?? [];
  const index = watches.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('行业关注不存在');
  watches[index] = { ...watches[index], enabled, updatedAt: new Date().toISOString() };
  setItem(WATCH_KEY, watches);
  return watches[index];
}

export async function deleteSectorWatch(id: EntityId): Promise<void> {
  if (getSettings().apiMode === 'remote') {
    return unwrapVoid(client.delete(`/market-data/sector-catalog/watches/${id}`));
  }
  setItem(WATCH_KEY, (getItem<MarketSectorWatch[]>(WATCH_KEY) ?? []).filter((item) => item.id !== id));
}

export function listSectorSnapshots(id: EntityId, page = 1, size = 30): Promise<PageResult<MarketSectorSnapshot>> {
  if (getSettings().apiMode === 'remote') {
    return unwrap<PageResult<MarketSectorSnapshot>>(client.get(`/market-data/sector-catalog/watches/${id}/snapshots`,
      { params: { page, size } }));
  }
  const snapshot = (getItem<MarketSectorWatch[]>(WATCH_KEY) ?? []).find((item) => item.id === id)?.latestSnapshot;
  const items = snapshot ? [snapshot] : [];
  return Promise.resolve({ items, total: items.length, page, size });
}

export function listSectorSnapshotMembers(snapshotId: EntityId): Promise<MarketSectorMemberSnapshot[]> {
  if (getSettings().apiMode === 'remote') {
    return unwrap<MarketSectorMemberSnapshot[]>(client.get(`/market-data/sector-catalog/snapshots/${snapshotId}/members`));
  }
  return Promise.resolve([]);
}
