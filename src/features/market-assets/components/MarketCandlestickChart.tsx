/**
 * P1.9-A K 线 + 成交量图表（lightweight-charts 5.2）。
 *
 * - 主 pane Candlestick，副 pane Histogram（共享时间轴/十字光标）；
 * - 上涨红、下跌绿、平盘中性灰（口径来自 chartAdapter）；
 * - 初次加载与查询切换后 fitContent，替换数据不叠加旧序列；
 * - ResizeObserver 自适应容器；卸载时移除 chart 并断开观察，禁止内存泄漏；
 * - 保留默认 attribution 标识（不关闭）；
 * - 十字光标 tooltip：时间、开高低收、涨跌幅、成交量、成交额、质量状态。
 */
import { useEffect, useRef } from 'react';
import { Empty, Skeleton, Tag } from 'antd';
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import {
  CANDLE_DOWN_COLOR,
  CANDLE_UP_COLOR,
  toCandles,
  toChartTime,
  toNumber,
  toVolumeHistogram,
} from '../model/chartAdapter';
import type { MarketAssetBar } from '../model/types';

interface Props {
  bars: MarketAssetBar[];
  interval: string;
  loading: boolean;
}

function fmtChangeRate(open: number | null, close: number | null): string {
  if (open == null || close == null || open === 0) return '--';
  const rate = (close - open) / open;
  return `${rate >= 0 ? '+' : ''}${(rate * 100).toFixed(2)}%`;
}

export function MarketCandlestickChart({ bars, interval, loading }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const barLookupRef = useRef<Map<string, MarketAssetBar>>(new Map());
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // 创建 chart / series / 十字光标 tooltip / ResizeObserver；卸载时销毁。
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 4 },
      autoSize: false,
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(
      CandlestickSeries,
      { upColor: CANDLE_UP_COLOR, downColor: CANDLE_DOWN_COLOR, borderUpColor: CANDLE_UP_COLOR, borderDownColor: CANDLE_DOWN_COLOR },
      0,
    );
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: 'volume' }, priceScaleId: 'vol' },
      1,
    );
    // 副 pane 的价格刻度需按 paneIndex 定位（v5 默认查 pane 0，成交量在 pane 1）。
    chart.priceScale('vol', 1).applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '10';
    tooltip.style.background = 'rgba(255, 255, 255, 0.96)';
    tooltip.style.border = '1px solid #d9d9d9';
    tooltip.style.borderRadius = '4px';
    tooltip.style.padding = '4px 8px';
    tooltip.style.fontSize = '12px';
    tooltip.style.whiteSpace = 'nowrap';
    tooltip.style.display = 'none';
    container.style.position = 'relative';
    container.appendChild(tooltip);
    tooltipRef.current = tooltip;

    const handleCrosshair = (param: MouseEventParams<Time>) => {
      if (!param.time || !param.point) {
        tooltip.style.display = 'none';
        return;
      }
      const bar = barLookupRef.current.get(String(param.time));
      const open = toNumber(bar?.open ?? null);
      const close = toNumber(bar?.close ?? null);
      const volume = toNumber(String(bar?.volume ?? ''));
      const changeRate = fmtChangeRate(open, close);
      const lines = [
        `<b>${bar?.time ?? String(param.time)}</b>`,
        `开 ${bar?.open ?? '--'} 高 ${bar?.high ?? '--'} 低 ${bar?.low ?? '--'} 收 ${bar?.close ?? '--'}`,
        `涨跌幅 ${changeRate} | 量 ${volume ?? '--'} | 额 ${bar?.amount ?? '--'}`,
        `质量 ${bar?.qualityStatus ?? '--'}${bar?.fetchedAt ? ` | 抓取 ${bar.fetchedAt}` : ''}`,
      ];
      tooltip.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
      tooltip.style.display = 'block';
      const x = param.point.x + 12;
      const y = param.point.y + 12;
      const containerRect = container.getBoundingClientRect();
      tooltip.style.left = `${Math.min(x, containerRect.width - 260)}px`;
      tooltip.style.top = `${Math.min(y, containerRect.height - 80)}px`;
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width: Math.max(width, 1), height: Math.max(height, 1) });
      }
    });
    resizeObserver.observe(container);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshair);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      tooltipRef.current = null;
      tooltip.remove();
    };
  }, []);

  // 数据变化：替换序列数据（不叠加）、更新十字光标查找表、fitContent。
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries) return;

    const lookup = new Map<string, MarketAssetBar>();
    for (const bar of bars) {
      const t = toChartTime(bar.time, interval);
      if (t != null) lookup.set(String(t), bar);
    }
    barLookupRef.current = lookup;

    candleSeries.setData(toCandles(bars, interval));
    volumeSeries.setData(toVolumeHistogram(bars, interval));
    chartRef.current?.timeScale().fitContent();
  }, [bars, interval]);

  const isEmpty = !loading && bars.length === 0;

  return (
    <div data-testid="asset-candlestick-chart" style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: 420 }} />
      {loading && bars.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)' }}>
          <Skeleton active paragraph={{ rows: 8 }} style={{ padding: 16 }} />
        </div>
      )}
      {isEmpty && (
        <Empty
          style={{ padding: 48 }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="所选范围无记录"
        />
      )}
      {bars.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {bars.filter((b) => b.qualityStatus === 'SUSPECT').length > 0 && (
            <Tag color="orange">含疑似异常数据，已保留展示</Tag>
          )}
        </div>
      )}
    </div>
  );
}
