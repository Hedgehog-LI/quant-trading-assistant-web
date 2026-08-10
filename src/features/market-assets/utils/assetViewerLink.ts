/**
 * P1.9-A 入口串联：把采集计划 / 日 K / 分钟 K 记录转换成行情资产查看器跳转 URL。
 *
 * - 三个入口（采集计划「查看数据」、日 K「图表查看」、分钟 K「图表查看」）
 *   共用一套参数构造，避免散落魔法字符串；
 * - 计划跳转：从 scopeJson 解析首标与日期范围；日 K 任务 interval=1D，
 *   分钟任务用 intervalType；范围不合法（缺日期/超限）时不带 from/to，
 *   让查看器回退到默认区间，避免进入页面即报 rangeError；
 * - 分钟 K 跳转：tradeDate 当日 09:30 → 15:00（+08:00）代表该交易日；
 * - 日 K 跳转：tradeDate 单日。
 */
import type { MarketDataSyncPlan, StockDailyBar, StockMinuteBar } from '../../../shared/types/domain';
import {
  isAdjustType,
  isDataSource,
  isInterval,
  validateRange,
} from '../model/marketAssetOptions';

export interface AssetViewerParams {
  symbol: string;
  interval: string;
  dataSource: string;
  adjustType: string;
  from?: string;
  to?: string;
}

/** 构造查看器查询串（不含问号，配合 navigate(`/market-assets?${...}`)）。 */
export function buildAssetViewerQuery(params: AssetViewerParams): string {
  const sp = new URLSearchParams();
  sp.set('symbol', params.symbol);
  sp.set('interval', params.interval);
  sp.set('dataSource', params.dataSource);
  sp.set('adjustType', params.adjustType);
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  return sp.toString();
}

const MINUTE_OPEN = '09:30:00';
const MINUTE_CLOSE = '15:00:00';

/** 计划日期（YYYY-MM-DD）按 interval 转成查看器 from/to 参数。 */
function planRangeToParams(
  interval: string,
  startDate: string | undefined,
  endDate: string | undefined,
): Pick<AssetViewerParams, 'from' | 'to'> {
  if (!startDate || !endDate) return {};
  const from = interval === '1D' ? startDate : `${startDate}T${MINUTE_OPEN}+08:00`;
  const to = interval === '1D' ? endDate : `${endDate}T${MINUTE_CLOSE}+08:00`;
  if (validateRange(interval, from, to) != null) return {};
  return { from, to };
}

/** 采集计划 → 查看器参数；scopeJson 非法、无标的首、interval 非法时返回 null（按钮禁用）。 */
export function planToAssetViewerParams(plan: MarketDataSyncPlan): AssetViewerParams | null {
  let scope: { symbols?: string[]; canonicalSymbol?: string; startDate?: string; endDate?: string };
  try {
    scope = JSON.parse(plan.scopeJson) as typeof scope;
  } catch {
    return null;
  }
  const symbol = (scope.symbols ?? (scope.canonicalSymbol ? [scope.canonicalSymbol] : []))[0];
  if (!symbol) return null;
  const interval = plan.taskType === 'DAILY_BAR_BACKFILL' ? '1D' : (plan.intervalType ?? '');
  if (!isInterval(interval)) return null;
  const params: AssetViewerParams = {
    symbol,
    interval,
    dataSource: isDataSource(plan.provider) ? plan.provider : 'LONGPORT',
    adjustType: isAdjustType(plan.adjustType) ? plan.adjustType : 'NONE',
  };
  Object.assign(params, planRangeToParams(interval, scope.startDate, scope.endDate));
  return params;
}

/** 分钟 K 记录 → 查看器参数：当日完整交易时段。 */
export function minuteBarToAssetViewerParams(bar: StockMinuteBar): AssetViewerParams {
  return {
    symbol: bar.canonicalSymbol,
    interval: isInterval(bar.intervalType) ? bar.intervalType : '1D',
    dataSource: isDataSource(bar.dataSource) ? bar.dataSource : 'LONGPORT',
    adjustType: isAdjustType(bar.adjustType) ? bar.adjustType : 'NONE',
    from: `${bar.tradeDate}T${MINUTE_OPEN}+08:00`,
    to: `${bar.tradeDate}T${MINUTE_CLOSE}+08:00`,
  };
}

/** 日 K 记录 → 查看器参数：单日。 */
export function dailyBarToAssetViewerParams(bar: StockDailyBar): AssetViewerParams {
  return {
    symbol: bar.canonicalSymbol,
    interval: '1D',
    dataSource: isDataSource(bar.dataSource) ? bar.dataSource : 'LONGPORT',
    adjustType: isAdjustType(bar.adjustType) ? bar.adjustType : 'NONE',
    from: bar.tradeDate,
    to: bar.tradeDate,
  };
}
