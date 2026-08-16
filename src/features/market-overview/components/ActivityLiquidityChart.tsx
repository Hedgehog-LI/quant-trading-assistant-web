/**
 * 流动性与交易活跃度图（三 pane）：
 * pane0 样本域成交额柱 + 20/60 日成交额中位数；pane1 活跃度比值 + 成交扩散（百分比）；
 * pane2 日频价格冲击代理 median/P90（科学计数）。只表征"成交活跃度"与"价格冲击代理"，
 * 不冒充官方资金流。null → whitespace 断点。
 */
import { useEffect, useRef } from 'react';
import {
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { dash, formatIlliquidity, formatMoney, formatPercent } from '../model/formatters';
import { toActivityChartData } from '../model/overviewTransform';
import type { ActivityPoint, LiquidityProxyPoint } from '../model/types';
import {
  createTooltipElement,
  observeContainerResize,
  subscribeOverviewCrosshair,
  useOverviewChartLifecycle,
} from './chartKit';

const MEDIAN20_COLOR = '#fa8c16';
const MEDIAN60_COLOR = '#722ed1';
const RATIO_COLOR = '#1677ff';
const ACTIVE_COLOR = '#13c2c2';
const ILLIQ_MEDIAN_COLOR = '#eb2f96';
const ILLIQ_P90_COLOR = '#f5222d';
const PERCENT_FORMATTER = (value: number) => `${(value * 100).toFixed(1)}%`;
const ILLIQUIDITY_FORMATTER = (value: number) => value.toExponential(2);

interface Props {
  activity: ActivityPoint[];
  liquidityDays: LiquidityProxyPoint[];
}

export function ActivityLiquidityChart({ activity, liquidityDays }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const turnoverRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const median20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const median60Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ratioRef = useRef<ISeriesApi<'Line'> | null>(null);
  const activeRef = useRef<ISeriesApi<'Line'> | null>(null);
  const illiqMedianRef = useRef<ISeriesApi<'Line'> | null>(null);
  const illiqP90Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const activityLookupRef = useRef<Map<string, ActivityPoint>>(new Map());
  const liquidityLookupRef = useRef<Map<string, LiquidityProxyPoint>>(new Map());

  useOverviewChartLifecycle(containerRef, (chart, container) => {
    chartRef.current = chart;
    turnoverRef.current = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } }, 0);
    median20Ref.current = chart.addSeries(LineSeries, { color: MEDIAN20_COLOR, lineWidth: 1 }, 0);
    median60Ref.current = chart.addSeries(LineSeries, { color: MEDIAN60_COLOR, lineWidth: 1 }, 0);
    ratioRef.current = chart.addSeries(LineSeries, {
      color: RATIO_COLOR, lineWidth: 2,
      priceFormat: { type: 'custom', formatter: PERCENT_FORMATTER, minMove: 0.0001 },
    }, 1);
    activeRef.current = chart.addSeries(LineSeries, {
      color: ACTIVE_COLOR, lineWidth: 1,
      priceFormat: { type: 'custom', formatter: PERCENT_FORMATTER, minMove: 0.0001 },
    }, 1);
    illiqMedianRef.current = chart.addSeries(LineSeries, {
      color: ILLIQ_MEDIAN_COLOR, lineWidth: 1,
      priceFormat: { type: 'custom', formatter: ILLIQUIDITY_FORMATTER, minMove: 1e-12 },
    }, 2);
    illiqP90Ref.current = chart.addSeries(LineSeries, {
      color: ILLIQ_P90_COLOR, lineWidth: 1,
      priceFormat: { type: 'custom', formatter: ILLIQUIDITY_FORMATTER, minMove: 1e-12 },
    }, 2);

    const tooltip = createTooltipElement(container);
    const unsubscribe = subscribeOverviewCrosshair(chart, tooltip, container, (time) => {
      const activityPoint = activityLookupRef.current.get(time);
      const liquidity = liquidityLookupRef.current.get(time);
      if (!activityPoint) return [];
      return [
        activityPoint.tradeDate,
        `样本域成交额 ${dash(formatMoney(activityPoint.marketTurnover))} · 有效证券 ${activityPoint.validStocks}`,
        `20日中位 ${dash(formatMoney(activityPoint.turnoverMedian20))} · 60日中位 ${dash(formatMoney(activityPoint.turnoverMedian60))}`,
        `活跃度比值 ${activityPoint.activityRatio?.toFixed(3) ?? '--'} · 成交扩散 ${dash(formatPercent(activityPoint.activeStockRatio))}`,
        liquidity
          ? `冲击代理中位 ${dash(formatIlliquidity(liquidity.medianIlliquidity))} · P90 ${dash(formatIlliquidity(liquidity.p90Illiquidity))} · 合格 ${liquidity.qualifiedStocks}`
          : '冲击代理 --',
      ];
    });
    const disconnect = observeContainerResize(chart, container);
    return () => {
      unsubscribe();
      disconnect();
      tooltip.remove();
    };
  });

  useEffect(() => {
    const data = toActivityChartData(activity, liquidityDays);
    activityLookupRef.current = new Map(activity.map((point) => [point.tradeDate, point]));
    liquidityLookupRef.current = new Map(liquidityDays.map((point) => [point.tradeDate, point]));
    turnoverRef.current?.setData(data.turnover);
    median20Ref.current?.setData(data.turnoverMedian20);
    median60Ref.current?.setData(data.turnoverMedian60);
    ratioRef.current?.setData(data.activityRatio);
    activeRef.current?.setData(data.activeStockRatio);
    illiqMedianRef.current?.setData(data.medianIlliquidity);
    illiqP90Ref.current?.setData(data.p90Illiquidity);
    chartRef.current?.timeScale().fitContent();
  }, [activity, liquidityDays]);

  return (
    <div data-testid="overview-activity-chart" style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: 460 }} />
    </div>
  );
}
