/**
 * lightweight-charts 5.2 复用工具（对齐 market-assets MarketCandlestickChart 先例）：
 * - 统一创建透明背景 chart；
 * - 十字光标 tooltip：安全 DOM textContent 构建（禁止 innerHTML 拼接响应字段），
 *   按容器边界翻转，不与坐标轴/图例重叠；
 * - ResizeObserver 自适应 + 卸载清理，禁止内存泄漏。
 */
import { useEffect, useRef, type RefObject } from 'react';
import {
  ColorType,
  createChart,
  type IChartApi,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';

/** 创建市场全景统一风格的 chart（透明背景、隐藏边框）。 */
export function createOverviewChart(container: HTMLElement): IChartApi {
  return createChart(container, {
    layout: { background: { type: ColorType.Solid, color: 'transparent' } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, rightOffset: 2 },
    autoSize: false,
    localization: {
      locale: 'zh-CN',
    },
  });
}

/** 创建十字光标 tooltip DOM（挂载到容器，卸载由 cleanupTooltip 移除）。 */
export function createTooltipElement(container: HTMLElement): HTMLDivElement {
  const tooltip = document.createElement('div');
  tooltip.style.position = 'absolute';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.zIndex = '10';
  tooltip.style.background = 'rgba(255, 255, 255, 0.96)';
  tooltip.style.border = '1px solid #d9d9d9';
  tooltip.style.borderRadius = '4px';
  tooltip.style.padding = '6px 10px';
  tooltip.style.fontSize = '12px';
  tooltip.style.lineHeight = '1.7';
  tooltip.style.whiteSpace = 'nowrap';
  tooltip.style.display = 'none';
  container.style.position = 'relative';
  container.appendChild(tooltip);
  return tooltip;
}

/** 渲染 tooltip 行（textContent 安全构建）；lines 为空则隐藏。 */
export function renderTooltipLines(tooltip: HTMLDivElement, lines: string[], point: { x: number; y: number }, container: HTMLElement): void {
  if (lines.length === 0) {
    tooltip.style.display = 'none';
    return;
  }
  tooltip.textContent = '';
  for (const line of lines) {
    const div = document.createElement('div');
    div.textContent = line;
    tooltip.appendChild(div);
  }
  tooltip.style.display = 'block';
  const containerRect = container.getBoundingClientRect();
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  const flipLeft = point.x + 12 + tooltipWidth > containerRect.width;
  tooltip.style.left = `${Math.max(0, flipLeft ? point.x - tooltipWidth - 12 : point.x + 12)}px`;
  tooltip.style.top = `${Math.max(0, Math.min(point.y + 12, containerRect.height - tooltipHeight - 4))}px`;
}

/** 订阅十字光标：time 命中 lookup 时以 formatLines(time) 渲染 tooltip；离开隐藏。 */
export function subscribeOverviewCrosshair(
  chart: IChartApi,
  tooltip: HTMLDivElement,
  container: HTMLElement,
  formatLines: (time: string) => string[],
): () => void {
  const handler = (param: MouseEventParams<Time>) => {
    if (!param.time || !param.point) {
      tooltip.style.display = 'none';
      return;
    }
    renderTooltipLines(tooltip, formatLines(String(param.time)), param.point, container);
  };
  chart.subscribeCrosshairMove(handler);
  return () => chart.unsubscribeCrosshairMove(handler);
}

/** chart 容器自适应：ResizeObserver 拉伸宽度、固定高度由样式给出；返回断开函数。 */
export function observeContainerResize(chart: IChartApi, container: HTMLElement): () => void {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      chart.applyOptions({ width: Math.max(width, 1), height: Math.max(height, 1) });
    }
  });
  observer.observe(container);
  return () => observer.disconnect();
}

/**
 * 市场全景 chart 生命周期 hook：挂载时创建 chart 并执行 setup（组装 series/tooltip/resize，
 * 可返回额外清理函数），卸载时先执行 setup 清理再移除 chart。
 */
export function useOverviewChartLifecycle(
  containerRef: RefObject<HTMLDivElement | null>,
  setupChart: (chart: IChartApi, container: HTMLElement) => (() => void) | void,
): void {
  const setupRef = useRef(setupChart);
  // 声明在生命周期 effect 之前：每次渲染后先同步最新 setup，再由挂载 effect 消费（仅挂载执行一次）。
  useEffect(() => {
    setupRef.current = setupChart;
  }, [setupChart]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const chart = createOverviewChart(container);
    const extraCleanup = setupRef.current(chart, container);
    return () => {
      extraCleanup?.();
      chart.remove();
    };
    // 仅挂载/卸载时执行；series 组装通过 setupRef 读取最新实现。
  }, [containerRef]);
}
