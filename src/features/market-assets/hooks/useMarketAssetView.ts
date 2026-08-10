/**
 * P1.9-A 行情资产主视图状态：URL 可分享参数 + availability 驱动的组合回退 + 三个查询。
 *
 * - symbol / interval / from / to / adjustType / dataSource 全部可分享进 URL；
 *   非法参数回退到安全默认并重写 URL（设计 §6）；
 * - 未选证券：不请求 series / related-tasks（查询 hooks 内 enabled:false）；
 * - availability 加载后：当前组合不在已采集组合内 → 回退到默认组合
 *   （1D+LONGPORT+NONE，否则最新可用分钟粒度）。回退通过“reconciled 派生值”完成，
 *   不在 effect 内 setState，避免级联渲染；
 * - 范围校验（倒置/超限）前置在客户端：非法时 series 不发起，页面展示错误文案。
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getSettings } from '../../settings/api/settingsApi';
import {
  buildComboOptions,
  buildIntervalOptions,
  buildRangePresets,
  isAdjustType,
  isDataSource,
  isInterval,
  matchPreset,
  validateRange,
} from '../model/marketAssetOptions';
import type { RangePreset } from '../model/marketAssetOptions';
import type { MarketAssetCombination, MarketAssetSeriesParams } from '../model/types';
import { useMarketAssetAvailability, useMarketAssetRelatedTasks, useMarketAssetSeries } from './useMarketAssetQuery';

export interface MarketAssetSelection {
  interval: string;
  from: string;
  to: string;
  adjustType: string;
  dataSource: string;
}

export interface UseMarketAssetViewResult extends MarketAssetSelection {
  symbol: string;
  setSymbol: (symbol: string) => void;
  intervalOptions: { value: string; label: string }[];
  dataSourceOptions: { value: string; label: string }[];
  adjustTypeOptions: { value: string; label: string }[];
  rangePresets: RangePreset[];
  activePreset: string | null;
  rangeError: string | null;
  hasCombinations: boolean;
  availabilityLoading: boolean;
  setInterval: (interval: string) => void;
  setAdjustType: (adjustType: string) => void;
  setDataSource: (dataSource: string) => void;
  applyPreset: (preset: RangePreset) => void;
  setCustomRange: (from: string, to: string) => void;
  seriesParams: MarketAssetSeriesParams | null;
  apiMode: 'mock' | 'remote';
  availabilityQuery: ReturnType<typeof useMarketAssetAvailability>;
  seriesQuery: ReturnType<typeof useMarketAssetSeries>;
  relatedQuery: ReturnType<typeof useMarketAssetRelatedTasks>;
}

/** 默认区间：日 K 近 6 月、分钟 K 近 5 交易日（1M 也安全）。 */
function defaultRangeFor(interval: string, now: Date): RangePreset {
  const presets = buildRangePresets(interval, now);
  const key = interval === '1D' ? '6M' : '5D';
  return presets.find((p) => p.key === key) ?? presets[0];
}

function defaultForInterval(combos: MarketAssetCombination[], interval: string): { dataSource: string; adjustType: string } {
  const list = combos.filter((c) => c.interval === interval);
  const first = list.find((c) => c.dataSource === 'LONGPORT' && c.adjustType === 'NONE') ?? list[0];
  return { dataSource: first?.dataSource ?? 'LONGPORT', adjustType: first?.adjustType ?? 'NONE' };
}

function validRangeText(interval: string, from: string, to: string): { from: string; to: string } | null {
  if (from && to && validateRange(interval, from, to) == null) return { from, to };
  return null;
}

/** 派生有效选择：combos 未加载时用原始选择，已加载时把不在已采集组合内的项回退到默认。 */
function reconcileSelection(
  selection: MarketAssetSelection,
  combos: MarketAssetCombination[],
  now: Date,
): MarketAssetSelection {
  if (combos.length === 0) return selection;
  const intervalOptions = buildIntervalOptions(combos);
  const nextInterval = intervalOptions.some((o) => o.value === selection.interval)
    ? selection.interval
    : (intervalOptions[0]?.value ?? selection.interval);
  const { dataSourceOptions, adjustTypeOptions } = buildComboOptions(combos, nextInterval);
  const def = defaultForInterval(combos, nextInterval);
  const nextDataSource = dataSourceOptions.some((o) => o.value === selection.dataSource)
    ? selection.dataSource
    : (dataSourceOptions.some((o) => o.value === def.dataSource)
        ? def.dataSource
        : (dataSourceOptions[0]?.value ?? selection.dataSource));
  const nextAdjustType = adjustTypeOptions.some((o) => o.value === selection.adjustType)
    ? selection.adjustType
    : (adjustTypeOptions.some((o) => o.value === def.adjustType)
        ? def.adjustType
        : (adjustTypeOptions[0]?.value ?? selection.adjustType));
  if (nextInterval === selection.interval && nextDataSource === selection.dataSource && nextAdjustType === selection.adjustType) {
    return selection;
  }
  const range = defaultRangeFor(nextInterval, now);
  return { interval: nextInterval, from: range.from, to: range.to, adjustType: nextAdjustType, dataSource: nextDataSource };
}

export function useMarketAssetView(): UseMarketAssetViewResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const symbol = searchParams.get('symbol')?.trim() ?? '';

  const [selection, setSelection] = useState<MarketAssetSelection>(() => {
    const interval = isInterval(searchParams.get('interval') ?? '') ? (searchParams.get('interval') as string) : '1D';
    const adjustType = isAdjustType(searchParams.get('adjustType') ?? '') ? (searchParams.get('adjustType') as string) : 'NONE';
    const dataSource = isDataSource(searchParams.get('dataSource') ?? '') ? (searchParams.get('dataSource') as string) : 'LONGPORT';
    const from = searchParams.get('from') ?? '';
    const to = searchParams.get('to') ?? '';
    const range = validRangeText(interval, from, to) ?? defaultRangeFor(interval, now);
    return { interval, from: range.from, to: range.to, adjustType, dataSource };
  });

  const availabilityQuery = useMarketAssetAvailability(symbol);
  const combos = useMemo(() => availabilityQuery.data?.combinations ?? [], [availabilityQuery.data]);

  const reconciled = useMemo(
    () => reconcileSelection(selection, combos, now),
    [selection, combos, now],
  );

  // 选择变化 → 同步 URL（replace，保持可分享）。未选证券时不写 URL。
  useEffect(() => {
    if (!symbol) return;
    const next = new URLSearchParams(searchParams);
    next.set('symbol', symbol);
    next.set('interval', reconciled.interval);
    next.set('from', reconciled.from);
    next.set('to', reconciled.to);
    next.set('adjustType', reconciled.adjustType);
    next.set('dataSource', reconciled.dataSource);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [symbol, reconciled, searchParams, setSearchParams]);

  const intervalOptions = useMemo(() => buildIntervalOptions(combos), [combos]);
  const { dataSourceOptions, adjustTypeOptions } = useMemo(
    () => buildComboOptions(combos, reconciled.interval),
    [combos, reconciled.interval],
  );
  const rangePresets = useMemo(() => buildRangePresets(reconciled.interval, now), [reconciled.interval, now]);
  const activePreset = matchPreset(rangePresets, reconciled.from, reconciled.to);
  const rangeError = validateRange(reconciled.interval, reconciled.from, reconciled.to);

  const seriesParams: MarketAssetSeriesParams | null =
    symbol && rangeError == null && combos.some((c) => c.interval === reconciled.interval)
      ? {
          canonicalSymbol: symbol,
          interval: reconciled.interval,
          from: reconciled.from,
          to: reconciled.to,
          adjustType: reconciled.adjustType,
          dataSource: reconciled.dataSource,
        }
      : null;

  const seriesQuery = useMarketAssetSeries(seriesParams);
  const relatedQuery = useMarketAssetRelatedTasks(symbol, reconciled.interval);

  const setSymbol = (nextSymbol: string) => {
    const trimmed = nextSymbol.trim();
    const next = new URLSearchParams();
    if (trimmed) next.set('symbol', trimmed);
    setSearchParams(next, { replace: true });
    const range = defaultRangeFor('1D', now);
    setSelection({ interval: '1D', from: range.from, to: range.to, adjustType: 'NONE', dataSource: 'LONGPORT' });
  };

  const setInterval = (interval: string) => {
    const def = defaultForInterval(combos, interval);
    const range = defaultRangeFor(interval, now);
    setSelection({ interval, from: range.from, to: range.to, adjustType: def.adjustType, dataSource: def.dataSource });
  };

  const setAdjustType = (adjustType: string) => setSelection((prev) => ({ ...prev, adjustType }));
  const setDataSource = (dataSource: string) => setSelection((prev) => ({ ...prev, dataSource }));
  const applyPreset = (preset: RangePreset) => setSelection((prev) => ({ ...prev, from: preset.from, to: preset.to }));
  const setCustomRange = (from: string, to: string) => setSelection((prev) => ({ ...prev, from, to }));

  return {
    symbol,
    setSymbol,
    interval: reconciled.interval,
    from: reconciled.from,
    to: reconciled.to,
    adjustType: reconciled.adjustType,
    dataSource: reconciled.dataSource,
    intervalOptions,
    dataSourceOptions,
    adjustTypeOptions,
    rangePresets,
    activePreset,
    rangeError,
    hasCombinations: combos.length > 0,
    availabilityLoading: availabilityQuery.isLoading,
    setInterval,
    setAdjustType,
    setDataSource,
    applyPreset,
    setCustomRange,
    seriesParams,
    apiMode: getSettings().apiMode,
    availabilityQuery,
    seriesQuery,
    relatedQuery,
  };
}
