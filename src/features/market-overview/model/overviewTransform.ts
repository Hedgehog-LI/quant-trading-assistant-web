/**
 * 市场全景图表数据转换（纯函数，可单测）。
 *
 * - 输入为 API 原始序列（types.ts），输出为 lightweight-charts setData 可用的序列与
 *   自绘堆叠面积图图层；转换不修改原始数据。
 * - null 断点：指标值为 null 的交易日输出 whitespace 点（仅 time），lightweight-charts
 *   渲染为断线，绝不补 0。
 * - 行业迁移图层：某行业当日未进入 Top-8 时其命名图层份额为 0（该部分注意力已并入
 *   OTHER，是真实语义而非数据缺失）；turnoverShare 为 null 才视为缺失并按 0 堆叠、
 *   记入 gapDates。
 */
import type { HistogramData, LineData, Time, WhitespaceData } from 'lightweight-charts';
import type {
  ActivityPoint,
  BenchmarkPoint,
  BreadthPoint,
  IndustryMigrationRow,
  LiquidityProxyPoint,
} from './types';

export type LinePoint = LineData<Time> | WhitespaceData<Time>;
export type HistogramPoint = HistogramData<Time> | WhitespaceData<Time>;

function linePoint(time: string, value: number | null): LinePoint {
  if (value == null || !Number.isFinite(value)) return { time: time as Time };
  return { time: time as Time, value };
}

function histogramPoint(time: string, value: number | null, color: string): HistogramPoint {
  if (value == null || !Number.isFinite(value)) return { time: time as Time };
  return { time: time as Time, value, color };
}

/** 确保序列按交易日升序（API 契约已升序，此处防御性排序，保证图表时间轴单调）。 */
function sortByDate<T extends { tradeDate: string }>(points: T[]): T[] {
  return [...points].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
}

export interface BenchmarkChartData {
  close: LinePoint[];
  ma20: LinePoint[];
  ma60: LinePoint[];
  amount: HistogramPoint[];
  drawdown: LinePoint[];
}

/** 基准趋势：收盘/MA20/MA60/成交额/回撤，null → whitespace 断点。 */
export function toBenchmarkChartData(series: BenchmarkPoint[]): BenchmarkChartData {
  const sorted = sortByDate(series);
  return {
    close: sorted.map((p) => linePoint(p.tradeDate, p.closePrice)),
    ma20: sorted.map((p) => linePoint(p.tradeDate, p.ma20)),
    ma60: sorted.map((p) => linePoint(p.tradeDate, p.ma60)),
    amount: sorted.map((p) => histogramPoint(p.tradeDate, p.amount, '#9db8f0')),
    drawdown: sorted.map((p) => linePoint(p.tradeDate, p.drawdown)),
  };
}

export interface ActivityChartData {
  turnover: HistogramPoint[];
  turnoverMedian20: LinePoint[];
  turnoverMedian60: LinePoint[];
  activityRatio: LinePoint[];
  activeStockRatio: LinePoint[];
  medianIlliquidity: LinePoint[];
  p90Illiquidity: LinePoint[];
}

/** 成交活跃度 + 日频价格冲击代理：成交额柱、20/60 日中位线、活跃度/扩散/冲击代理线。 */
export function toActivityChartData(
  activity: ActivityPoint[],
  liquidityDays: LiquidityProxyPoint[],
): ActivityChartData {
  const sortedActivity = sortByDate(activity);
  const sortedLiquidity = sortByDate(liquidityDays);
  return {
    turnover: sortedActivity.map((p) => histogramPoint(p.tradeDate, p.marketTurnover, '#9db8f0')),
    turnoverMedian20: sortedActivity.map((p) => linePoint(p.tradeDate, p.turnoverMedian20)),
    turnoverMedian60: sortedActivity.map((p) => linePoint(p.tradeDate, p.turnoverMedian60)),
    activityRatio: sortedActivity.map((p) => linePoint(p.tradeDate, p.activityRatio)),
    activeStockRatio: sortedActivity.map((p) => linePoint(p.tradeDate, p.activeStockRatio)),
    medianIlliquidity: sortedLiquidity.map((p) => linePoint(p.tradeDate, p.medianIlliquidity)),
    p90Illiquidity: sortedLiquidity.map((p) => linePoint(p.tradeDate, p.p90Illiquidity)),
  };
}

export interface BreadthChartData {
  advanceRatio: LinePoint[];
  aboveMa20Ratio: LinePoint[];
  adLine: LinePoint[];
  /** 上涨为正（红）、下跌为负（绿），平盘不画；与 A 股涨跌色一致。 */
  advanceDecline: HistogramPoint[];
}

/** 市场广度：上涨占比/MA20 覆盖率线、涨跌家数正负柱、A/D 线。 */
export function toBreadthChartData(series: BreadthPoint[]): BreadthChartData {
  const sorted = sortByDate(series);
  return {
    advanceRatio: sorted.map((p) => linePoint(p.tradeDate, p.advanceRatio)),
    aboveMa20Ratio: sorted.map((p) => linePoint(p.tradeDate, p.aboveMa20Ratio)),
    adLine: sorted.map((p) => linePoint(p.tradeDate, p.adLine)),
    advanceDecline: sorted.map((p) => {
      const net = p.advancingStocks - p.decliningStocks;
      return histogramPoint(p.tradeDate, net === 0 ? null : net, net > 0 ? '#f5222d' : '#52c41a');
    }),
  };
}

/** 行业迁移图层色板（前 8 命名行业 + OTHER 灰）。 */
export const MIGRATION_PALETTE = [
  '#1677ff', '#f5222d', '#fa8c16', '#52c41a', '#722ed1', '#13c2c2', '#eb2f96', '#fadb14',
] as const;
export const OTHER_INDUSTRY_CODE = 'OTHER';
export const OTHER_LAYER_COLOR = '#bfbfbf';

export interface MigrationLayerPoint {
  date: string;
  /** 图层份额（0..1）；命名行业当日未进 Top-8 时为 0（注意力并入 OTHER）。 */
  value: number;
}

export interface MigrationLayer {
  industryCode: string;
  industryName: string;
  color: string;
  points: MigrationLayerPoint[];
  /** 窗口内合计成交额（用于图层排序）。 */
  totalTurnover: number;
}

export interface MigrationChartData {
  /** 升序交易日轴。 */
  dates: string[];
  /** 命名行业按合计成交额降序，OTHER 恒为最后图层。 */
  layers: MigrationLayer[];
  /** (date, industryCode) → 原始行（tooltip 用）。 */
  rowByDateAndCode: Map<string, IndustryMigrationRow>;
}

/** 行业成交占比迁移 → 堆叠面积图层（Top-8 + OTHER；缺失份额按 0 堆叠不产生断点）。 */
export function toMigrationChartData(rows: IndustryMigrationRow[]): MigrationChartData {
  const rowByDateAndCode = new Map<string, IndustryMigrationRow>();
  const dateSet = new Set<string>();
  const codes = new Map<string, { name: string; totalTurnover: number }>();
  for (const row of rows) {
    rowByDateAndCode.set(`${row.tradeDate}|${row.industryCode}`, row);
    dateSet.add(row.tradeDate);
    const entry = codes.get(row.industryCode) ?? { name: row.industryName, totalTurnover: 0 };
    entry.name = row.industryName;
    entry.totalTurnover += row.turnover ?? 0;
    codes.set(row.industryCode, entry);
  }
  const dates = [...dateSet].sort();
  const named = [...codes.entries()]
    .filter(([code]) => code !== OTHER_INDUSTRY_CODE)
    .sort((a, b) => b[1].totalTurnover - a[1].totalTurnover)
    .map(([code]) => code);
  const orderedCodes = codes.has(OTHER_INDUSTRY_CODE)
    ? [...named, OTHER_INDUSTRY_CODE]
    : named;
  const layers: MigrationLayer[] = orderedCodes.map((code, index) => ({
    industryCode: code,
    industryName: codes.get(code)?.name ?? code,
    color: code === OTHER_INDUSTRY_CODE
      ? OTHER_LAYER_COLOR
      : MIGRATION_PALETTE[index % MIGRATION_PALETTE.length],
    totalTurnover: codes.get(code)?.totalTurnover ?? 0,
    points: dates.map((date) => ({
      date,
      value: rowByDateAndCode.get(`${date}|${code}`)?.turnoverShare ?? 0,
    })),
  }));
  return { dates, layers, rowByDateAndCode };
}

/** 迁移 tooltip 行：由原始行生成（日期 + 行业 + 成交额/占比/前日变化/20 日中位变化/覆盖数/排名）。 */
export function buildMigrationTooltipRows(
  rowsByDate: Map<string, IndustryMigrationRow>,
): IndustryMigrationRow[] {
  return [...rowsByDate.values()].sort(
    (a, b) => (b.turnoverShare ?? 0) - (a.turnoverShare ?? 0),
  );
}
