/**
 * 市场广度图（三 pane）：
 * pane0 上涨占比 + 高于 MA20 占比（百分比）；pane1 涨/跌家数正负柱（涨红跌绿）；
 * pane2 累计 A/D 线。tooltip 展示原始家数与比例，辅助区分普遍上涨与权重推动。
 */
import { useEffect, useRef } from 'react';
import {
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { dash, formatPercent } from '../model/formatters';
import { toBreadthChartData } from '../model/overviewTransform';
import type { BreadthPoint } from '../model/types';
import {
  createTooltipElement,
  observeContainerResize,
  subscribeOverviewCrosshair,
  useOverviewChartLifecycle,
} from './chartKit';

const ADVANCE_COLOR = '#1677ff';
const ABOVE_MA_COLOR = '#722ed1';
const AD_LINE_COLOR = '#fa8c16';
const PERCENT_FORMATTER = (value: number) => `${(value * 100).toFixed(1)}%`;

interface Props {
  series: BreadthPoint[];
}

export function BreadthChart({ series }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const advanceRef = useRef<ISeriesApi<'Line'> | null>(null);
  const aboveMaRef = useRef<ISeriesApi<'Line'> | null>(null);
  const advDecRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const adLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lookupRef = useRef<Map<string, BreadthPoint>>(new Map());

  useOverviewChartLifecycle(containerRef, (chart, container) => {
    chartRef.current = chart;
    advanceRef.current = chart.addSeries(LineSeries, {
      color: ADVANCE_COLOR, lineWidth: 2,
      priceFormat: { type: 'custom', formatter: PERCENT_FORMATTER, minMove: 0.0001 },
    }, 0);
    aboveMaRef.current = chart.addSeries(LineSeries, {
      color: ABOVE_MA_COLOR, lineWidth: 1,
      priceFormat: { type: 'custom', formatter: PERCENT_FORMATTER, minMove: 0.0001 },
    }, 0);
    advDecRef.current = chart.addSeries(HistogramSeries, {}, 1);
    adLineRef.current = chart.addSeries(LineSeries, { color: AD_LINE_COLOR, lineWidth: 2 }, 2);

    const tooltip = createTooltipElement(container);
    const unsubscribe = subscribeOverviewCrosshair(chart, tooltip, container, (time) => {
      const point = lookupRef.current.get(time);
      if (!point) return [];
      return [
        point.tradeDate,
        `上涨 ${point.advancingStocks} · 下跌 ${point.decliningStocks} · 平盘 ${point.flatStocks} · 有效 ${point.validStocks}`,
        `上涨占比 ${dash(formatPercent(point.advanceRatio))}`,
        `高于MA20 ${point.aboveMa20Stocks} 只 · 占比 ${dash(formatPercent(point.aboveMa20Ratio))}`,
        `A/D 线 ${point.adLine ?? '--'}`,
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
    const data = toBreadthChartData(series);
    lookupRef.current = new Map(series.map((point) => [point.tradeDate, point]));
    advanceRef.current?.setData(data.advanceRatio);
    aboveMaRef.current?.setData(data.aboveMa20Ratio);
    advDecRef.current?.setData(data.advanceDecline);
    adLineRef.current?.setData(data.adLine);
    chartRef.current?.timeScale().fitContent();
  }, [series]);

  return (
    <div data-testid="overview-breadth-chart" style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: 460 }} />
    </div>
  );
}
