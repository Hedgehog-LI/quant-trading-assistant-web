/**
 * P1.9-A 行情资产只读 API：availability / series / related-tasks。
 *
 * mock 与 remote 同形。mock 为固定小样本的确定性演示数据（LOCAL_DEMO）：
 * - 只覆盖有限证券，时间均为演示窗口；
 * - 不伪造真实采集成功：watermarkTime / latestFetchedAt / fetchedAt 均为 null，
 *   覆盖率标 UNKNOWN，related-tasks 仅给出一条显式 LOCAL_DEMO 的计划；
 * - 生成逻辑确定性（无随机），支持按 from/to 范围生成并受 200 bars 上限约束。
 *
 * remote 走新只读 API；remote 空数据不回退 mock（由 pick 直接决定数据源）。
 */
import { client } from '../../../shared/api/client';
import { unwrap } from '../../../shared/api/unwrappers';
import { getSettings } from '../../settings/api/settingsApi';
import type {
  MarketAssetAvailability,
  MarketAssetBar,
  MarketAssetRelatedTasks,
  MarketAssetRelatedTaskItem,
  MarketAssetSecurity,
  MarketAssetSeries,
  MarketAssetSeriesParams,
} from '../model/types';

const MAX_MOCK_BARS = 200;
const STORAGE_OFFSET_MS = 8 * 3600 * 1000;

const MOCK_SECURITIES: Record<string, MarketAssetSecurity> = {
  'SH.600519': { canonicalSymbol: 'SH.600519', displayName: '贵州茅台', market: 'SH', currency: 'CNY', timeZone: 'Asia/Shanghai' },
  'SZ.000001': { canonicalSymbol: 'SZ.000001', displayName: '平安银行', market: 'SZ', currency: 'CNY', timeZone: 'Asia/Shanghai' },
  'HK.00700': { canonicalSymbol: 'HK.00700', displayName: '腾讯控股', market: 'HK', currency: 'HKD', timeZone: 'Asia/Hong_Kong' },
  'US.AAPL': { canonicalSymbol: 'US.AAPL', displayName: 'Apple Inc.', market: 'US', currency: 'USD', timeZone: 'America/New_York' },
};

function seedFor(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    h = (h * 31 + symbol.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function intervalMinutes(interval: string): number {
  switch (interval) {
    case '1M': return 1;
    case '5M': return 5;
    case '15M': return 15;
    case '30M': return 30;
    default: return 60;
  }
}

/** 分钟 ISO → 瞬时毫秒；裸本地时间按存储时区 +08:00 折算。 */
function instantMs(raw: string): number {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw) ? raw : `${raw}+08:00`;
  const ms = new Date(normalized).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function dayUtcMs(raw: string): number {
  const [y, m, d] = raw.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return Date.UTC(y, m - 1, d);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function fmt(value: number): string {
  return value.toFixed(2);
}

function formatYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 瞬时毫秒 → 存储时区（Asia/Shanghai，无 DST）墙钟 ISO，带 +08:00。 */
function isoShanghai(ms: number): string {
  const d = new Date(ms + STORAGE_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    + `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+08:00`;
}

/** 确定性生成演示 K 线（LOCAL_DEMO）：按范围生成，受 200 上限约束。 */
function generateMockBars(params: MarketAssetSeriesParams): { bars: MarketAssetBar[]; truncated: boolean } {
  const seed = seedFor(params.canonicalSymbol);
  const base = 60 + (seed % 140);
  const isDaily = params.interval === '1D';
  const stepMs = (isDaily ? 1440 : intervalMinutes(params.interval)) * 60_000;
  const start = isDaily ? dayUtcMs(params.from) : instantMs(params.from);
  const end = isDaily ? dayUtcMs(params.to) : instantMs(params.to);
  const bars: MarketAssetBar[] = [];
  let price = base;
  let i = 0;
  let t = start;
  for (; t <= end && bars.length < MAX_MOCK_BARS; t += stepMs, i += 1) {
    const open = price;
    const close = round2(open + Math.sin(seed * 0.1 + i * 0.7) * (base * 0.01));
    const high = round2(Math.max(open, close) + base * 0.004);
    const low = round2(Math.min(open, close) - base * 0.004);
    const volume = 500 + ((seed + i * 7919) % 9000);
    bars.push({
      time: isDaily ? formatYmd(t) : isoShanghai(t),
      open: fmt(open),
      high: fmt(high),
      low: fmt(low),
      close: fmt(close),
      volume,
      amount: fmt(volume * close),
      qualityStatus: 'VALID',
      fetchedAt: null,
    });
    price = close;
  }
  const totalEstimate = end >= start ? Math.floor((end - start) / stepMs) + 1 : 0;
  return { bars, truncated: totalEstimate > MAX_MOCK_BARS };
}

function summarize(bars: MarketAssetBar[]) {
  if (bars.length === 0) {
    return { firstOpen: null, lastClose: null, absoluteChange: null, changeRate: null, highestHigh: null, lowestLow: null, totalVolume: 0, totalAmount: null };
  }
  const firstOpen = Number(bars[0].open);
  const lastClose = Number(bars[bars.length - 1].close);
  const absoluteChange = round2(lastClose - firstOpen);
  let changeRate: number | null = null;
  if (firstOpen !== 0) {
    changeRate = Math.round((absoluteChange / firstOpen) * 1e10) / 1e10;
  }
  let highestHigh = Number(bars[0].high);
  let lowestLow = Number(bars[0].low);
  let totalVolume = 0;
  let totalAmount = 0;
  for (const bar of bars) {
    highestHigh = Math.max(highestHigh, Number(bar.high));
    lowestLow = Math.min(lowestLow, Number(bar.low));
    totalVolume += bar.volume;
    totalAmount += Number(bar.amount ?? 0);
  }
  return {
    firstOpen: fmt(firstOpen),
    lastClose: fmt(lastClose),
    absoluteChange: fmt(absoluteChange),
    changeRate: changeRate === null ? null : String(changeRate),
    highestHigh: fmt(highestHigh),
    lowestLow: fmt(lowestLow),
    totalVolume,
    totalAmount: fmt(totalAmount),
  };
}

const mockApi = {
  getAvailability: async (canonicalSymbol: string): Promise<MarketAssetAvailability> => {
    const security = MOCK_SECURITIES[canonicalSymbol];
    if (!security) {
      throw new Error('证券不存在');
    }
    const seed = seedFor(canonicalSymbol);
    const combos = [
      { interval: '1D', dataSource: 'LONGPORT', adjustType: 'NONE', count: 20 },
      { interval: '5M', dataSource: 'LONGPORT', adjustType: 'NONE', count: 48 },
      { interval: '60M', dataSource: 'LONGPORT', adjustType: 'NONE', count: 4 },
    ];
    return {
      security,
      combinations: combos.map(({ interval, dataSource, adjustType, count }) => ({
        interval,
        dataSource,
        adjustType,
        barCount: count + (seed % 3),
        firstBarTime: interval === '1D' ? '2026-07-01' : `2026-07-17T${interval === '60M' ? '10:00' : '09:30'}:00+08:00`,
        lastBarTime: interval === '1D' ? '2026-07-31' : `2026-07-17T${interval === '60M' ? '15:00' : '15:00'}:00+08:00`,
        latestFetchedAt: null,
        watermarkTime: null,
      })),
    };
  },

  getSeries: async (params: MarketAssetSeriesParams): Promise<MarketAssetSeries> => {
    const security = MOCK_SECURITIES[params.canonicalSymbol];
    if (!security) {
      throw new Error('证券不存在');
    }
    const { bars, truncated } = generateMockBars(params);
    const summary = summarize(bars);
    return {
      security,
      query: {
        interval: params.interval,
        from: params.from,
        to: params.to,
        adjustType: params.adjustType,
        dataSource: params.dataSource,
      },
      availability: {
        firstBarTime: bars.length ? bars[0].time : null,
        lastBarTime: bars.length ? bars[bars.length - 1].time : null,
        latestFetchedAt: null,
        watermarkTime: null,
      },
      quality: {
        coverageStatus: 'UNKNOWN',
        actualBarCount: bars.length,
        expectedBarCount: null,
        missingBarCount: null,
        suspectBarCount: 0,
        truncated,
        reasonCodes: truncated ? ['TRUNCATED'] : [],
      },
      summary: {
        ...summary,
        actualBarCount: bars.length,
      },
      bars,
    };
  },

  getRelatedTasks: async (canonicalSymbol: string): Promise<MarketAssetRelatedTasks> => {
    const security = MOCK_SECURITIES[canonicalSymbol];
    if (!security) {
      throw new Error('证券不存在');
    }
    const samplePlan: MarketAssetRelatedTaskItem = {
      kind: 'PLAN',
      id: -1,
      name: 'LOCAL_DEMO 样例计划',
      taskType: 'MOCK',
      intervalType: '5M',
      status: 'DISABLED',
      startDate: null,
      endDate: null,
      startedAt: null,
      finishedAt: null,
      errorCode: null,
      errorMessage: '演示数据，不代表真实采集计划',
    };
    return { security, plans: [samplePlan], runs: [] };
  },
};

const remoteApi = {
  getAvailability: (canonicalSymbol: string) =>
    unwrap<MarketAssetAvailability>(
      client.get(`/market-data/assets/${encodeURIComponent(canonicalSymbol)}/availability`),
    ),
  getSeries: (params: MarketAssetSeriesParams) =>
    unwrap<MarketAssetSeries>(
      client.get(`/market-data/assets/${encodeURIComponent(params.canonicalSymbol)}/series`, {
        params: {
          interval: params.interval,
          from: params.from,
          to: params.to,
          adjustType: params.adjustType,
          dataSource: params.dataSource,
        },
      }),
    ),
  getRelatedTasks: (canonicalSymbol: string, interval?: string) =>
    unwrap<MarketAssetRelatedTasks>(
      client.get(`/market-data/assets/${encodeURIComponent(canonicalSymbol)}/related-tasks`, {
        params: interval ? { interval } : {},
      }),
    ),
};

function pick<T>(mock: T, remote: T): T {
  return getSettings().apiMode === 'remote' ? remote : mock;
}

export function getMarketAssetAvailability(canonicalSymbol: string) {
  return pick(mockApi.getAvailability, remoteApi.getAvailability)(canonicalSymbol);
}

export function getMarketAssetSeries(params: MarketAssetSeriesParams) {
  return pick(mockApi.getSeries, remoteApi.getSeries)(params);
}

export function getMarketAssetRelatedTasks(canonicalSymbol: string, interval?: string) {
  return pick(mockApi.getRelatedTasks, remoteApi.getRelatedTasks)(canonicalSymbol, interval);
}
