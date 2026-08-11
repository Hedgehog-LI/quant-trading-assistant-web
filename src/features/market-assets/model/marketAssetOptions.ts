/**
 * P1.9-A 行情资产：查询选项、快捷范围、范围校验与默认组合选择。
 *
 * - 枚举/选项集中定义（不与页面散落魔法字符串）；
 * - 快捷范围：日 K 用自然月/年，分钟 K 用当日/近 N 交易日（自然日近似，安全余量取整）；
 * - 后端范围上限（设计 §4.2）：1D=10 年、60M=365 日、30M=180 日、15M=90 日、
 *   5M=30 日；1M 受“最多 5 个交易日”约束，前端以 7 自然日近似（5 个工作日，节假日更少，不会超过后端上限）；
 * - 默认组合：优先 1D+LONGPORT+NONE，其次最新可用分钟粒度（按 INTERVAL_VALUES 粒度从细到粗）。
 */
import type { MarketAssetCombination } from './types';

export const INTERVAL_VALUES = ['1D', '60M', '30M', '15M', '5M', '1M'] as const;
export const ADJUST_TYPE_VALUES = ['NONE', 'QF', 'HF'] as const;
export const DATA_SOURCE_VALUES = ['LONGPORT', 'CSV', 'MANUAL'] as const;

export type IntervalValue = (typeof INTERVAL_VALUES)[number];
export type AdjustTypeValue = (typeof ADJUST_TYPE_VALUES)[number];
export type DataSourceValue = (typeof DATA_SOURCE_VALUES)[number];

export interface Option {
  value: string;
  label: string;
}

export const INTERVAL_OPTIONS: Option[] = [
  { value: '1D', label: '日 K' },
  { value: '60M', label: '60 分' },
  { value: '30M', label: '30 分' },
  { value: '15M', label: '15 分' },
  { value: '5M', label: '5 分' },
  { value: '1M', label: '1 分' },
];

export const ADJUST_TYPE_OPTIONS: Option[] = [
  { value: 'NONE', label: '不复权' },
  { value: 'QF', label: '前复权' },
  { value: 'HF', label: '后复权' },
];

export const DATA_SOURCE_OPTIONS: Option[] = [
  { value: 'LONGPORT', label: 'LongPort' },
  { value: 'CSV', label: 'CSV 导入' },
  { value: 'MANUAL', label: '手工录入' },
];

export const isInterval = (v: string): v is IntervalValue =>
  (INTERVAL_VALUES as readonly string[]).includes(v);
export const isAdjustType = (v: string): v is AdjustTypeValue =>
  (ADJUST_TYPE_VALUES as readonly string[]).includes(v);
export const isDataSource = (v: string): v is DataSourceValue =>
  (DATA_SOURCE_VALUES as readonly string[]).includes(v);

/** 后端单次最多返回 bars 数（超限 truncated）。 */
export const MAX_SERIES_BARS = 2000;

/** 范围上限（自然日）。1M 以 7 自然日近似“5 个交易日”。 */
const RANGE_LIMIT_NATURAL_DAYS: Record<string, number> = {
  '1D': 3650,
  '60M': 365,
  '30M': 180,
  '15M': 90,
  '5M': 30,
  '1M': 7,
};

export const DAY_MS = 24 * 3600 * 1000;
const CN_OFFSET_MS = 8 * 3600 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 日 K 时间参数：本地日期 YYYY-MM-DD。 */
export function formatDaily(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 分钟 K 时间参数：按存储时区 +08:00 的 ISO（无夏令时）。 */
export function formatMinute(date: Date): string {
  const d = new Date(date.getTime() + CN_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
    + `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+08:00`;
}

/** 按 interval 生成 from/to 请求参数。 */
export function formatRangeParam(date: Date, interval: string): string {
  return interval === '1D' ? formatDaily(date) : formatMinute(date);
}

/** 解析请求参数时间 → 毫秒；日 K 按 UTC 解析（business-day），分钟按 ISO 解析。非法返回 null。 */
export function parseRangeParam(value: string, interval: string): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const ms = interval === '1D'
    ? (() => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        if (!m) return Number.NaN;
        return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      })()
    : Date.parse(/[+-]\d{2}:?\d{2}$/.test(trimmed) ? trimmed : `${trimmed}+08:00`);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * 校验范围。非法返回错误文案（用于禁用查询并在页面上提示），合法返回 null。
 * 倒置、不可解析、超过自然日上限均视为非法。
 */
export function validateRange(
  interval: string,
  from: string,
  to: string,
): string | null {
  const fromMs = parseRangeParam(from, interval);
  const toMs = parseRangeParam(to, interval);
  if (fromMs == null || toMs == null) return '时间格式不合法';
  if (fromMs > toMs) return '开始时间晚于结束时间';
  const days = (toMs - fromMs) / DAY_MS;
  const limit = RANGE_LIMIT_NATURAL_DAYS[interval];
  if (limit != null && days > limit) {
    if (interval === '1M') return '1 分钟粒度最多覆盖约 5 个交易日，请缩短范围';
    return `${interval} 粒度最多支持 ${limit} 个自然日，请缩短范围`;
  }
  return null;
}

// ---------- 快捷范围 ----------

export const DAILY_PRESET_KEYS = ['1M', '3M', '6M', '1Y', '3Y'] as const;
export const MINUTE_PRESET_KEYS = ['TODAY', '5D', '20D'] as const;

export type DailyPresetKey = (typeof DAILY_PRESET_KEYS)[number];
export type MinutePresetKey = (typeof MINUTE_PRESET_KEYS)[number];

export interface RangePreset {
  key: string;
  label: string;
  from: string;
  to: string;
}

const DAILY_PRESET_LABEL: Record<DailyPresetKey, string> = {
  '1M': '1 月',
  '3M': '3 月',
  '6M': '6 月',
  '1Y': '1 年',
  '3Y': '3 年',
};

const MINUTE_PRESET_LABEL: Record<MinutePresetKey, string> = {
  TODAY: '当日',
  '5D': '近 5 交易日',
  '20D': '近 20 交易日',
};

function dailyPresetRange(key: DailyPresetKey, now: Date): { from: Date; to: Date } {
  const days: Record<DailyPresetKey, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '3Y': 1095 };
  return { from: new Date(now.getTime() - days[key] * DAY_MS), to: now };
}

function minutePresetRange(key: MinutePresetKey, now: Date): { from: Date; to: Date } {
  const days: Record<MinutePresetKey, number> = { TODAY: 0, '5D': 7, '20D': 28 };
  const from = new Date(now.getTime() - days[key] * DAY_MS);
  return { from, to: now };
}

/** 指定 interval 可用的快捷范围预设（1M 不提供近 20 交易日，超出其 5 交易日上限）。 */
export function buildRangePresets(interval: string, now: Date): RangePreset[] {
  if (interval === '1D') {
    return DAILY_PRESET_KEYS.map((key) => {
      const { from, to } = dailyPresetRange(key, now);
      return { key, label: DAILY_PRESET_LABEL[key], from: formatDaily(from), to: formatDaily(to) };
    });
  }
  const minuteKeys = interval === '1M'
    ? (MINUTE_PRESET_KEYS as readonly MinutePresetKey[]).filter((k) => k !== '20D')
    : MINUTE_PRESET_KEYS;
  return minuteKeys.map((key) => {
    const { from, to } = minutePresetRange(key, now);
    return { key, label: MINUTE_PRESET_LABEL[key], from: formatMinute(from), to: formatMinute(to) };
  });
}

/** 当前 from/to 命中的快捷预设 key；命中自定义范围（含时间微调）返回 null。 */
export function matchPreset(presets: RangePreset[], from: string, to: string): string | null {
  return presets.find((p) => p.from === from && p.to === to)?.key ?? null;
}

// ---------- 默认组合 ----------

const DEFAULT_DATA_SOURCE = 'LONGPORT';
const DEFAULT_ADJUST_TYPE = 'NONE';

/** 从 availability 组合中挑选默认组合：优先 1D+LONGPORT+NONE，其次最新可用分钟粒度。 */
export function pickDefaultCombo(combos: MarketAssetCombination[]): MarketAssetCombination | null {
  if (combos.length === 0) return null;
  const daily = combos.find(
    (c) => c.interval === '1D' && c.dataSource === DEFAULT_DATA_SOURCE && c.adjustType === DEFAULT_ADJUST_TYPE,
  );
  if (daily) return daily;
  const minuteCombos = combos
    .filter((c) => c.interval !== '1D')
    .sort((a, b) => INTERVAL_VALUES.indexOf(b.interval as IntervalValue) - INTERVAL_VALUES.indexOf(a.interval as IntervalValue));
  return minuteCombos[0] ?? combos[0];
}

/** 从 availability 组合构建“可选区间”选项（按 INTERVAL_VALUES 顺序去重）。 */
export function buildIntervalOptions(combos: MarketAssetCombination[]): Option[] {
  const seen = new Set<string>();
  const options: Option[] = [];
  for (const interval of INTERVAL_VALUES) {
    if (!seen.has(interval) && combos.some((c) => c.interval === interval)) {
      seen.add(interval);
      const opt = INTERVAL_OPTIONS.find((o) => o.value === interval);
      if (opt) options.push(opt);
    }
  }
  return options;
}

/** 指定区间可用的来源选项（按标准顺序去重；无组合时回退全量）。 */
export function buildDataSourceOptions(combos: MarketAssetCombination[], interval: string): Option[] {
  const ofInterval = combos.filter((c) => c.interval === interval);
  if (ofInterval.length === 0) return DATA_SOURCE_OPTIONS;
  return DATA_SOURCE_OPTIONS.filter((o) => ofInterval.some((c) => c.dataSource === o.value));
}

/**
 * 指定区间 + 来源可用的复权选项（组合原子性：只列该 interval+source 实际存在的 adjustType）。
 * interval+source 无组合时回退到该 interval 的复权集合，避免下拉为空。
 */
export function buildAdjustTypeOptions(
  combos: MarketAssetCombination[],
  interval: string,
  dataSource: string,
): Option[] {
  const ofSource = combos.filter((c) => c.interval === interval && c.dataSource === dataSource);
  if (ofSource.length > 0) {
    return ADJUST_TYPE_OPTIONS.filter((o) => ofSource.some((c) => c.adjustType === o.value));
  }
  const ofInterval = combos.filter((c) => c.interval === interval);
  if (ofInterval.length === 0) return ADJUST_TYPE_OPTIONS;
  return ADJUST_TYPE_OPTIONS.filter((o) => ofInterval.some((c) => c.adjustType === o.value));
}

/**
 * 组合原子性校验：interval/dataSource/adjustType 是否构成真实存在的完整组合。
 * 空组合（availability 未加载或证券未采集）一律 false，series 不发起。
 */
export function isValidCombo(
  combos: MarketAssetCombination[],
  interval: string,
  dataSource: string,
  adjustType: string,
): boolean {
  return combos.some((c) => c.interval === interval && c.dataSource === dataSource && c.adjustType === adjustType);
}

/**
 * 组合原子性选择：当前 tuple 合法则原样返回；否则自动选择合法完整组合。
 * 优先级：同 interval+source 的首个 → 同 interval 的首个 → 默认组合。
 */
export function resolveCombo(
  combos: MarketAssetCombination[],
  interval: string,
  dataSource: string,
  adjustType: string,
): { interval: string; dataSource: string; adjustType: string } {
  if (isValidCombo(combos, interval, dataSource, adjustType)) {
    return { interval, dataSource, adjustType };
  }
  const sameSource = combos.find((c) => c.interval === interval && c.dataSource === dataSource);
  if (sameSource) {
    return { interval: sameSource.interval, dataSource: sameSource.dataSource, adjustType: sameSource.adjustType };
  }
  const sameInterval = combos.find((c) => c.interval === interval);
  if (sameInterval) {
    return { interval: sameInterval.interval, dataSource: sameInterval.dataSource, adjustType: sameInterval.adjustType };
  }
  const fallback = pickDefaultCombo(combos);
  if (fallback) {
    return { interval: fallback.interval, dataSource: fallback.dataSource, adjustType: fallback.adjustType };
  }
  return { interval, dataSource, adjustType };
}
