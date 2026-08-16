/**
 * 基准趋势图（lightweight-charts 5.2 三 pane）：
 * pane0 收盘 + MA20 + MA60；pane1 成交额柱；pane2 回撤（百分比）。
 * 共享时间轴与十字光标；null 指标以 whitespace 断点呈现，禁止补 0。
 */
import { useEffect, useRef } from 'react';
import {
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { dash, formatMoney, formatPercent, formatSignedPercent } from '../model/formatters';
import { toBenchmarkChartData } from '../model/overviewTransform';
import type { BenchmarkPoint } from '../model/types';
import {
  createTooltipElement,
  observeContainerResize,
  subscribeOverviewCrosshair,
  useOverviewChartLifecycle,
} from './chartKit';

const CLOSE_COLOR = '#172b4d';
const MA20_COLOR = '#fa8c16';
const MA60_COLOR = '#722ed1';
const DRAWDOWN_COLOR = '#f5222d';
const PERCENT_FORMATTER = (value: number) => `${(value * 100).toFixed(1)}%`;

interface Props {
  series: BenchmarkPoint[];
}

export function BenchmarkTrendChart({ series }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const closeRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma60Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const amountRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const drawdownRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lookupRef = useRef<Map<string, BenchmarkPoint>>(new Map());

  useOverviewChartLifecycle(containerRef, (chart, container) => {
    chartRef.current = chart;
    closeRef.current = chart.addSeries(LineSeries, { color: CLOSE_COLOR, lineWidth: 2 }, 0);
    ma20Ref.current = chart.addSeries(LineSeries, { color: MA20_COLOR, lineWidth: 1 }, 0);
    ma60Ref.current = chart.addSeries(LineSeries, { color: MA60_COLOR, lineWidth: 1 }, 0);
    amountRef.current = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } }, 1);
    drawdownRef.current = chart.addSeries(LineSeries, {
      color: DRAWDOWN_COLOR, lineWidth: 1,
      priceFormat: { type: 'custom', formatter: PERCENT_FORMATTER, minMove: 0.0001 },
    }, 2);

    const tooltip = createTooltipElement(container);
    const unsubscribe = subscribeOverviewCrosshair(chart, tooltip, container, (time) => {
      const point = lookupRef.current.get(time);
      if (!point) return [];
      return [
        point.tradeDate,
        `收盘 ${point.closePrice?.toFixed(2) ?? '--'} · 当日 ${dash(formatSignedPercent(point.dailyReturn, 2))}`,
        `MA20 ${point.ma20?.toFixed(2) ?? '--'} · MA60 ${point.ma60?.toFixed(2) ?? '--'}`,
        `成交额 ${dash(formatMoney(point.amount))}`,
        `回撤 ${dash(formatPercent(point.drawdown))}`,
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
    const data = toBenchmarkChartData(series);
    lookupRef.current = new Map(series.map((point) => [point.tradeDate, point]));
    closeRef.current?.setData(data.close);
    ma20Ref.current?.setData(data.ma20);
    ma60Ref.current?.setData(data.ma60);
    amountRef.current?.setData(data.amount);
    drawdownRef.current?.setData(data.drawdown);
    chartRef.current?.timeScale().fitContent();
  }, [series]);

  return (
    <div data-testid="overview-benchmark-chart" style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: 500 }} />
    </div>
  );
}
