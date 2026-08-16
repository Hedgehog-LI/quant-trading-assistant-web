/**
 * 数据中心展示格式化与状态标色。
 *
 * 状态纪律：null 计数一律显示 '--'，禁止把 null 当 0；
 * 覆盖率显示百分比；状态 Tag 颜色集中维护，未知状态回退默认色（不伪造语义）。
 */
import type {
  BackfillChunkStatus,
  BackfillTaskStatus,
  DatasetVersionStatus,
  QualityCheckStatus,
} from './types';

/** null/undefined 数字显示 '--'（后端未发生的计数字段合法为 null）。 */
export function formatCount(value: number | null | undefined): string {
  return value == null ? '--' : String(value);
}

/** 0..1 小数 → 百分比；不可计算显示 '--'。 */
export function formatRatioPercent(value: number | null | undefined): string {
  if (value == null) return '--';
  return `${(value * 100).toFixed(2)}%`;
}

/** ISO 时间 → YYYY-MM-DD HH:mm；null 显示 '--'。 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '--';
  return value.length >= 16 ? `${value.slice(0, 10)} ${value.slice(11, 16)}` : value;
}

/** detailJson/errorReportJson 摘要：截断展示前 120 字符（完整内容由展开行查看）。 */
export function summarizeJson(raw: string | null | undefined): string {
  if (!raw) return '--';
  const text = raw.trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

/** 错误报告是否包含真实错误行（{"errors":[]} 视为无错误；解析失败时保守视为有内容需展示）。 */
export function errorReportHasErrors(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  try {
    const parsed = JSON.parse(raw) as { errors?: unknown[] } | null;
    if (parsed && Array.isArray(parsed.errors)) return parsed.errors.length > 0;
  } catch {
    // 非预期结构：原样展示，不吞错误。
  }
  return true;
}

/** 校验并解析逗号/空白分隔的 symbols 输入；空输入返回 undefined（不下发字段）。 */
export function parseSymbolsInput(raw: string | null | undefined): string[] | undefined {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return undefined;
  const symbols = trimmed
    .split(/[\s,，;；]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  return symbols.length > 0 ? symbols : undefined;
}

/** 严格校验 YYYY-MM-DD 且为真实日历日。 */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function compareDateString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 回补窗口最早日期（后端 FoundationConstants.EARLIEST_START_DATE，MR-1 输入边界）。 */
export const EARLIEST_START_DATE = '2021-01-01';

/** 每分片证券数上限（后端 FoundationConstants.MAX_CHUNK_SIZE）。 */
export const MAX_CHUNK_SIZE = 500;

export const VERSION_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default',
  BACKFILLING: 'processing',
  QUALIFYING: 'processing',
  QUALIFIED: 'cyan',
  REJECTED: 'error',
  RELEASED: 'success',
  RETIRED: 'default',
};

export const TASK_STATUS_COLOR: Record<string, string> = {
  PENDING: 'default',
  RUNNING: 'processing',
  PAUSED: 'warning',
  SUCCEEDED: 'success',
  PARTIAL_FAILED: 'warning',
  FAILED: 'error',
};

export const CHUNK_STATUS_COLOR: Record<string, string> = {
  PENDING: 'default',
  RUNNING: 'processing',
  SUCCEEDED: 'success',
  FAILED: 'error',
  SKIPPED: 'default',
};

export const QUALITY_STATUS_COLOR: Record<string, string> = {
  OK: 'success',
  WARN: 'warning',
  FAIL: 'error',
};

/** 状态着色（未知状态回退 default，不伪造语义）。 */
export function tagColor(
  map: Record<string, string>,
  status: DatasetVersionStatus | BackfillTaskStatus | BackfillChunkStatus | QualityCheckStatus | string,
): string {
  return map[status] ?? 'default';
}
