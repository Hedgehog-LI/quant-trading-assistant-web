/**
 * P1.9-A 行情资产主视图状态：URL 是唯一可恢复、可分享的状态源 + availability 驱动的组合回退 + 三个查询。
 *
 * - symbol / interval / from / to / adjustType / dataSource 全部可分享进 URL；
 *   selection 完全派生自 URL（useSearchParams），页面挂载、浏览器前进/后退、同路由查询参数
 *   变化都天然恢复，不再依赖 useState 一次性初始化（修复 repair-2：旧 selection 覆盖新 URL）；
 * - 所有 setter 直接写 URL（replace，不污染历史），避免 URL→state→URL 反馈循环；
 * - availability 加载后：当前 tuple 不在已采集组合内 → 按组合原子性自动选择合法完整组合
 *   （同 source → 同 interval → 默认），由幂等的 canonicalize effect 写回 URL 恰好一次；
 * - 非法参数安全回退：枚举非法回退默认值；from/to 不可解析（无法在控件展示）回退默认范围，
 *   可解析但语义非法（倒置/超限）保留并透出 rangeError，series 不发起；
 * - 范围校验（倒置/超限）前置在客户端：非法时 series 不发起，页面展示错误文案。
 */
import { useEffect, useMemo } from 'react';
import { useSearchParams, type SetURLSearchParams } from 'react-router';
import { getSettings } from '../../settings/api/settingsApi';
import {
  buildAdjustTypeOptions,
  buildDataSourceOptions,
  buildIntervalOptions,
  buildRangePresets,
  isAdjustType,
  isDataSource,
  isInterval,
  isValidCombo,
  matchPreset,
  parseRangeParam,
  resolveCombo,
  validateRange,
} from '../model/marketAssetOptions';
import type { Option, RangePreset } from '../model/marketAssetOptions';
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

/** 指定区间首选来源/复权（优先 LONGPORT+NONE，否则该区间首个组合）。 */
function defaultForInterval(combos: MarketAssetCombination[], interval: string): { dataSource: string; adjustType: string } {
  const list = combos.filter((c) => c.interval === interval);
  const first = list.find((c) => c.dataSource === 'LONGPORT' && c.adjustType === 'NONE') ?? list[0];
  return { dataSource: first?.dataSource ?? 'LONGPORT', adjustType: first?.adjustType ?? 'NONE' };
}

/**
 * from/to 可展示性校验：仅要求可解析（能在 RangePicker 展示），不校验语义。
 * 语义非法（倒置/超限）保留在 selection 中由 rangeError 透出，避免用户输入被静默回退。
 * 不可解析（格式与 interval 不匹配）返回 null → 回退默认范围（安全回退）。
 */
function parseableRange(interval: string, from: string, to: string): { from: string; to: string } | null {
  if (!from || !to) return null;
  const fromMs = parseRangeParam(from, interval);
  const toMs = parseRangeParam(to, interval);
  if (fromMs == null || toMs == null) return null;
  return { from, to };
}

/** 从 URL 派生完整 selection：枚举非法回退默认值；from/to 不可解析回退默认范围。 */
function parseFromUrl(searchParams: URLSearchParams, now: Date): MarketAssetSelection {
  const interval = isInterval(searchParams.get('interval') ?? '') ? (searchParams.get('interval') as string) : '1D';
  const adjustType = isAdjustType(searchParams.get('adjustType') ?? '') ? (searchParams.get('adjustType') as string) : 'NONE';
  const dataSource = isDataSource(searchParams.get('dataSource') ?? '') ? (searchParams.get('dataSource') as string) : 'LONGPORT';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const range = parseableRange(interval, from, to) ?? defaultRangeFor(interval, now);
  return { interval, from: range.from, to: range.to, adjustType, dataSource };
}

/** 把当前 URL 参数合并为一个完整 tuple（symbol + 有效选择），供 canonicalize 与 setter 复用。 */
function toFullUrl(searchParams: URLSearchParams, symbol: string, selection: MarketAssetSelection): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (symbol) next.set('symbol', symbol);
  next.set('interval', selection.interval);
  next.set('from', selection.from);
  next.set('to', selection.to);
  next.set('adjustType', selection.adjustType);
  next.set('dataSource', selection.dataSource);
  return next;
}

/** 工具栏各 setter 的入参：直接写 URL（replace），不依赖状态回灌。 */
interface SelectionWritersParams {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  symbol: string;
  selection: MarketAssetSelection;
  combos: MarketAssetCombination[];
  now: Date;
}

/**
 * 构建所有选择操作：setSymbol/setInterval/setAdjustType/setDataSource/applyPreset/setCustomRange。
 * 全部直接 setSearchParams 写 URL（replace，不污染历史），selection 由 URL 派生，因此无需回写 state。
 */
function buildSelectionWriters(params: SelectionWritersParams): {
  setSymbol: (symbol: string) => void;
  setInterval: (interval: string) => void;
  setAdjustType: (adjustType: string) => void;
  setDataSource: (dataSource: string) => void;
  applyPreset: (preset: RangePreset) => void;
  setCustomRange: (from: string, to: string) => void;
} {
  const { searchParams, setSearchParams, symbol, selection, combos, now } = params;
  const setSymbol = (nextSymbol: string) => {
    const trimmed = nextSymbol.trim();
    const range = defaultRangeFor('1D', now);
    const next = new URLSearchParams();
    if (trimmed) {
      next.set('symbol', trimmed);
      next.set('interval', '1D');
      next.set('from', range.from);
      next.set('to', range.to);
      next.set('adjustType', 'NONE');
      next.set('dataSource', 'LONGPORT');
    }
    setSearchParams(next, { replace: true });
  };
  const setInterval = (interval: string) => {
    const def = defaultForInterval(combos, interval);
    const range = defaultRangeFor(interval, now);
    setSearchParams(toFullUrl(searchParams, symbol, {
      interval, from: range.from, to: range.to, adjustType: def.adjustType, dataSource: def.dataSource,
    }), { replace: true });
  };
  const setAdjustType = (adjustType: string) => {
    setSearchParams(toFullUrl(searchParams, symbol, { ...selection, adjustType }), { replace: true });
  };
  const setDataSource = (dataSource: string) => {
    setSearchParams(toFullUrl(searchParams, symbol, { ...selection, dataSource }), { replace: true });
  };
  const applyPreset = (preset: RangePreset) => {
    setSearchParams(toFullUrl(searchParams, symbol, { ...selection, from: preset.from, to: preset.to }), { replace: true });
  };
  const setCustomRange = (from: string, to: string) => {
    setSearchParams(toFullUrl(searchParams, symbol, { ...selection, from, to }), { replace: true });
  };
  return { setSymbol, setInterval, setAdjustType, setDataSource, applyPreset, setCustomRange };
}

/**
 * 派生有效选择：combos 未加载时用原始选择；已加载时按组合原子性把不在已采集
 * 组合内的 tuple 回退到合法完整组合（切换来源后自动选择该 interval+source 的复权）。
 */
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
  const next = resolveCombo(combos, nextInterval, selection.dataSource, selection.adjustType);
  if (next.interval === selection.interval && next.dataSource === selection.dataSource
      && next.adjustType === selection.adjustType) {
    return selection;
  }
  const range = defaultRangeFor(next.interval, now);
  return { interval: next.interval, from: range.from, to: range.to, adjustType: next.adjustType, dataSource: next.dataSource };
}

/** 派生工具栏选项（按当前 interval+source 组合原子性过滤复权项）。 */
function deriveViewOptions(
  combos: MarketAssetCombination[],
  interval: string,
  dataSource: string,
  now: Date,
): { intervalOptions: Option[]; dataSourceOptions: Option[]; adjustTypeOptions: Option[]; rangePresets: RangePreset[] } {
  return {
    intervalOptions: buildIntervalOptions(combos),
    dataSourceOptions: buildDataSourceOptions(combos, interval),
    adjustTypeOptions: buildAdjustTypeOptions(combos, interval, dataSource),
    rangePresets: buildRangePresets(interval, now),
  };
}

export function useMarketAssetView(): UseMarketAssetViewResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const symbol = searchParams.get('symbol')?.trim() ?? '';

  // selection 完全派生自 URL（单一状态源），而非 useState 一次性初始化。
  const selection = useMemo(() => parseFromUrl(searchParams, now), [searchParams, now]);

  const availabilityQuery = useMarketAssetAvailability(symbol);
  const combos = useMemo(() => availabilityQuery.data?.combinations ?? [], [availabilityQuery.data]);

  const reconciled = useMemo(
    () => reconcileSelection(selection, combos, now),
    [selection, combos, now],
  );

  // 幂等 canonicalize：仅当“有效选择”与 URL 不一致时写回（组合原子性 / 不可解析参数回退）。
  // 写回后 selection 重新派生即与 URL 一致，不会再触发，因此恰好一次、无反馈循环。
  useEffect(() => {
    if (!symbol) return;
    const next = toFullUrl(searchParams, symbol, reconciled);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [symbol, reconciled, searchParams, setSearchParams]);

  const options = useMemo(
    () => deriveViewOptions(combos, reconciled.interval, reconciled.dataSource, now),
    [combos, reconciled.interval, reconciled.dataSource, now],
  );
  const activePreset = matchPreset(options.rangePresets, reconciled.from, reconciled.to);
  const rangeError = validateRange(reconciled.interval, reconciled.from, reconciled.to);

  const seriesParams: MarketAssetSeriesParams | null =
    symbol && rangeError == null && isValidCombo(combos, reconciled.interval, reconciled.dataSource, reconciled.adjustType)
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
  const relatedQuery = useMarketAssetRelatedTasks(symbol, reconciled.interval, availabilityQuery.isSuccess);

  const writers = buildSelectionWriters({ searchParams, setSearchParams, symbol, selection, combos, now });

  return {
    symbol,
    interval: reconciled.interval,
    from: reconciled.from,
    to: reconciled.to,
    adjustType: reconciled.adjustType,
    dataSource: reconciled.dataSource,
    intervalOptions: options.intervalOptions,
    dataSourceOptions: options.dataSourceOptions,
    adjustTypeOptions: options.adjustTypeOptions,
    rangePresets: options.rangePresets,
    activePreset,
    rangeError,
    hasCombinations: combos.length > 0,
    availabilityLoading: availabilityQuery.isLoading,
    ...writers,
    seriesParams,
    apiMode: getSettings().apiMode,
    availabilityQuery,
    seriesQuery,
    relatedQuery,
  };
}
