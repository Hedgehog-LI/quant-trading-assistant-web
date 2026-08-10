/**
 * P1.9-A 图表数据适配器：把后端 Series 响应的 BigDecimal 字符串 / 时区
 * 转换为 lightweight-charts 5.2 所需的数据结构，是唯一处理图表转换的地方。
 *
 * 约定（与后端存储口径一致）：
 * - 日 K：time 为 `YYYY-MM-DD`（business-day 字符串）；
 * - 分钟 K：time 为带 offset 的 ISO-8601 瞬时，转为真实 UTCTimestamp（epoch 秒）；
 *   若缺少 offset（裸本地时间），按存储时区 Asia/Shanghai（+08:00）折算。
 * - 行情口径：上涨红、下跌绿，平盘中性灰（见 CANDLE_* 常量，A 股红涨绿跌）。
 * - 价格/金额字符串用 Number() 转换；无效值返回 null，由组件兜底展示。
 */
import type { CandlestickData, HistogramData, Time, UTCTimestamp } from 'lightweight-charts';
import type { MarketAssetBar } from './types';

/** 存储时区偏移（Asia/Shanghai，无夏令时）：8 小时。 */
const STORAGE_OFFSET_MS = 8 * 3600 * 1000;

/** 上涨红（Antd red） */
export const CANDLE_UP_COLOR = '#f5222d';
/** 下跌绿（Antd green） */
export const CANDLE_DOWN_COLOR = '#52c41a';
/** 平盘中性灰（Antd gray） */
export const CANDLE_FLAT_COLOR = '#bfbfbf';

/** 是否为上涨 bar（close >= open）；用于成交量着色。 */
export function isUpBar(bar: { open: string; close: string }): boolean {
  return Number(bar.close) >= Number(bar.open);
}

/** 字符串 → 数字；空串/非法返回 null。 */
export function toNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 解析 ISO 瞬时 → epoch 秒；裸本地时间按 +08:00 折算。非法返回 null。 */
function parseUtcSeconds(time: string): UTCTimestamp | null {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(time) ? time : `${time}+08:00`;
  const ms = new Date(normalized).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000) as UTCTimestamp;
}

/**
 * 后端 bar time → lightweight-charts Time。
 * - 日 K（无 `T`）：返回 `YYYY-MM-DD` business-day 字符串；
 * - 分钟 K：返回真实 UTCTimestamp；解析失败返回 null（组件跳过该 bar）。
 */
export function toChartTime(time: string, interval: string): Time | null {
  if (interval === '1D' && !time.includes('T')) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(time)) return null;
    return time;
  }
  return parseUtcSeconds(time);
}

/** K 线数组：日 K 与分钟 K 口径分离，不做拼接。 */
export function toCandles(bars: MarketAssetBar[], interval: string): CandlestickData[] {
  const candles: CandlestickData[] = [];
  for (const bar of bars) {
    const time = toChartTime(bar.time, interval);
    if (time == null) continue;
    const open = toNumber(bar.open);
    const high = toNumber(bar.high);
    const low = toNumber(bar.low);
    const close = toNumber(bar.close);
    if (open == null || high == null || low == null || close == null) continue;
    candles.push({ time, open, high, low, close });
  }
  return candles;
}

/** 成交量柱状图：上涨红、下跌绿、平盘中性灰。 */
export function toVolumeHistogram(bars: MarketAssetBar[], interval: string): HistogramData[] {
  const histogram: HistogramData[] = [];
  for (const bar of bars) {
    const time = toChartTime(bar.time, interval);
    if (time == null) continue;
    const value = toNumber(String(bar.volume));
    if (value == null) continue;
    // 口径：上涨红、下跌绿、平盘中性灰（先判平盘，避免 flat 落入上涨红）
    const color = Number(bar.close) === Number(bar.open)
      ? CANDLE_FLAT_COLOR
      : isUpBar(bar) ? CANDLE_UP_COLOR : CANDLE_DOWN_COLOR;
    histogram.push({ time, value, color });
  }
  return histogram;
}

/** 暴露给组件：分钟 ISO 是否可直接被 JS Date 解析（便于 tooltip 展示原始时间）。 */
export function hasOffset(time: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(time);
}

/** 兼容旧工具（如误把本地 ISO 传入）按存储时区折算为瞬时毫秒；非法返回 null。 */
export function toInstantMs(time: string): number | null {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(time) ? time : `${time}+08:00`;
  const ms = new Date(normalized).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** 与 toInstantMs 配套：仅用于把已解析的 epoch 秒渲染为带时区的展示文本。 */
export function toShanghaiDisplay(ms: number): string {
  const d = new Date(ms + STORAGE_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    + ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
