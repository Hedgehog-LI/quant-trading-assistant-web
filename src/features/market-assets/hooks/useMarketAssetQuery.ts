/**
 * P1.9-A 行情资产查询 hooks（TanStack Query）。
 *
 * - query key 固定包含 symbol / interval / range(from,to) / source(adjustType,dataSource)
 *   / dataMode(apiMode)，保证 mock↔remote、不同范围、不同组合之间缓存隔离；
 * - 未选证券（params 为 null）时 series 走 enabled:false，不发请求；
 * - remote 空数据不回退 mock，apiMode 决定数据源（见 marketAssetApi.pick）。
 */
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '../../settings/api/settingsApi';
import {
  getMarketAssetAvailability,
  getMarketAssetCatalog,
  getMarketAssetRelatedTasks,
  getMarketAssetSeries,
} from '../api/marketAssetApi';
import type { MarketAssetCatalogFilter, MarketAssetSeriesParams } from '../model/types';

function apiMode(): 'mock' | 'remote' {
  return getSettings().apiMode;
}

/** 已真正落入日 K 或分钟 K 的资产目录。 */
export function useMarketAssetCatalog(filter: MarketAssetCatalogFilter) {
  return useQuery({
    queryKey: ['market-assets', 'catalog', filter.market ?? 'ALL', filter.keyword ?? '', filter.page ?? 1, filter.size ?? 20, apiMode()],
    queryFn: () => getMarketAssetCatalog(filter),
  });
}

/** 未选证券时可用：按 symbol 查询组合覆盖概况。 */
export function useMarketAssetAvailability(canonicalSymbol: string) {
  return useQuery({
    queryKey: ['market-assets', 'availability', canonicalSymbol, apiMode()],
    queryFn: () => getMarketAssetAvailability(canonicalSymbol),
    enabled: canonicalSymbol.trim().length > 0,
  });
}

/** 已选证券 + 组合：查询区间 K 线/摘要/质量。params 为 null 时不发请求。 */
export function useMarketAssetSeries(params: MarketAssetSeriesParams | null) {
  const symbol = params?.canonicalSymbol ?? '';
  return useQuery({
    queryKey: [
      'market-assets',
      'series',
      symbol,
      params?.interval,
      params?.from,
      params?.to,
      params?.adjustType,
      params?.dataSource,
      apiMode(),
    ],
    queryFn: () => getMarketAssetSeries(params as MarketAssetSeriesParams),
    enabled: params != null,
  });
}

/** 相关采集计划/记录；interval 可选，为 undefined 时返回全部粒度。 */
export function useMarketAssetRelatedTasks(canonicalSymbol: string, interval?: string, enabled = true) {
  return useQuery({
    queryKey: ['market-assets', 'related-tasks', canonicalSymbol, interval ?? 'ALL', apiMode()],
    queryFn: () => getMarketAssetRelatedTasks(canonicalSymbol, interval),
    enabled: enabled && canonicalSymbol.trim().length > 0,
  });
}
