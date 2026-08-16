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

/**
 * 数据集创建首期冻结组合（后端首期支持的 provider × 复权，避免随意输入）：
 * TENCENT_PUBLIC=腾讯公共源线上回补（实验性）；IMPORT_CSV_DAILY=CSV 导入通道。
 * 复权首期仅 NONE；market=CN、barType=DAILY、frequency=1D 固定。
 */
export const DATASET_PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'TENCENT_PUBLIC', label: 'TENCENT_PUBLIC（腾讯公共源·实验性）' },
  { value: 'IMPORT_CSV_DAILY', label: 'IMPORT_CSV_DAILY（CSV 导入·日 K）' },
];

/** 在线回补唯一支持的首期 Provider（回补表单数据集下拉只展示该类数据集）。 */
export const ONLINE_BACKFILL_PROVIDER = 'TENCENT_PUBLIC';

/** 导入类 Provider 前缀（该类数据集只用于 CSV 导入通道，不进入回补下拉）。 */
export const IMPORT_PROVIDER_PREFIX = 'IMPORT_';

/** 今天（本地时区 YYYY-MM-DD；结束日期晚于今天的提示用，最终校验以后端为准）。 */
export function todayDateString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** datasetCode 校验：大写字母/数字/下划线，3-64 位。 */
export function isValidDatasetCode(value: string): boolean {
  return /^[A-Z][A-Z0-9_]{2,63}$/.test(value);
}

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
  QUEUED: 'processing',
  RUNNING: 'processing',
  PAUSED: 'warning',
  SUCCEEDED: 'success',
  PARTIAL_FAILED: 'warning',
  FAILED: 'error',
};

/** 任务状态中文标签（要求明确区分 排队中/执行中/已暂停/部分失败/已失败/已成功）。 */
export const TASK_STATUS_LABEL: Record<string, string> = {
  PENDING: '待启动',
  QUEUED: '排队中',
  RUNNING: '执行中',
  PAUSED: '已暂停',
  SUCCEEDED: '已成功',
  PARTIAL_FAILED: '部分失败',
  FAILED: '已失败',
};

/** 状态中文标签（未知状态回退原始 code，不伪造语义）。 */
export function taskStatusLabel(status: string | null | undefined): string {
  if (!status) return '--';
  return TASK_STATUS_LABEL[status] ?? status;
}

/** 需要轮询的活跃任务状态（PENDING/QUEUED/RUNNING；终态与 PAUSED 停止轮询）。 */
const ACTIVE_BACKFILL_STATUSES = new Set(['PENDING', 'QUEUED', 'RUNNING']);

export function isActiveBackfillStatus(status: string | null | undefined): boolean {
  return status != null && ACTIVE_BACKFILL_STATUSES.has(status);
}

/** 任务轮询间隔（ms）；仅活跃状态返回 2000，其余 false（不永久轮询）。 */
export const TASK_POLL_INTERVAL_MS = 2000;

/** 血缘状态正常取值（契约未冻结全集；null=后端未提供不告警，非正常值视为异常）。 */
const LINEAGE_NORMAL_STATUSES = new Set(['OK', 'VERIFIED']);

export function isLineageStatusAbnormal(status: string | null | undefined): boolean {
  if (!status) return false;
  return !LINEAGE_NORMAL_STATUSES.has(status.toUpperCase());
}

/** contentHash 缩短展示（前 8 + … + 后 4；title 保留完整值）。 */
export function shortenHash(value: string | null | undefined): string {
  if (!value) return '--';
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

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
