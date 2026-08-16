/**
 * 数据底座（V2.1 / mdf_*）API 类型：逐字段对齐后端 `marketdata.foundation.vo`
 * （DataFoundationController，/api/v1/market-data/data-foundation/*）。
 *
 * 数值为 JSON number（Long/Integer/BigDecimal 序化）；日期为 YYYY-MM-DD 字符串、
 * 时间为 ISO 字符串。未发生的计数字段可能为 null：页面必须显示 '--'，
 * 禁止把 null 当 0 展示。状态机取值见后端 FoundationConstants。
 */

// ---- 数据集版本状态机（DRAFT→BACKFILLING→QUALIFYING→QUALIFIED/REJECTED→RELEASED/RETIRED） ----
export type DatasetVersionStatus =
  | 'DRAFT'
  | 'BACKFILLING'
  | 'QUALIFYING'
  | 'QUALIFIED'
  | 'REJECTED'
  | 'RELEASED'
  | 'RETIRED';

// ---- 回补任务状态机 ----
export type BackfillTaskStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PAUSED'
  | 'SUCCEEDED'
  | 'PARTIAL_FAILED'
  | 'FAILED';

// ---- 回补分片状态机 ----
export type BackfillChunkStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

// ---- 质量检查结果状态（13 检查族共用） ----
export type QualityCheckStatus = 'OK' | 'WARN' | 'FAIL';

// ---- CSV 导入通道 kind（POST /imports?kind=） ----
export type ImportKind =
  | 'UNIVERSE_SNAPSHOT'
  | 'TRADING_CALENDAR'
  | 'DAILY_BAR'
  | 'INDUSTRY_TAXONOMY'
  | 'INDUSTRY_MEMBERSHIP_PIT';

export interface Dataset {
  id: number;
  datasetCode: string;
  datasetName: string;
  marketCode: string;
  barType: string;
  frequency: string;
  providerCode: string;
  adjustType: string;
  unitCaliber: string | null;
  description: string | null;
  /** 当前发布版本指针（无发布为 null）。 */
  currentVersionId: number | null;
  createdAt: string | null;
}

export interface DatasetVersion {
  id: number;
  datasetId: number | null;
  datasetCode: string;
  versionCode: string;
  status: DatasetVersionStatus | string;
  startDate: string | null;
  endDate: string | null;
  sourceProvider: string | null;
  sourceNote: string | null;
  rowCount: number | null;
  qualifiedAt: string | null;
  releasedAt: string | null;
  createdAt: string | null;
  isCurrentReleased: boolean | null;
}

export interface BackfillTask {
  id: number;
  datasetCode: string;
  datasetVersionId: number | null;
  marketCode: string;
  providerCode: string;
  frequency: string;
  adjustType: string;
  startDate: string | null;
  endDate: string | null;
  chunkSize: number | null;
  status: BackfillTaskStatus | string;
  plannedCount: number | null;
  successCount: number | null;
  failCount: number | null;
  skipCount: number | null;
  insertedCount: number | null;
  updatedCount: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
  /** 可选的显式证券池（逗号分隔导入）；null 表示全数据集证券池。 */
  symbols: string[] | null;
  totalChunks: number | null;
  succeededChunks: number | null;
  failedChunks: number | null;
}

export interface BackfillChunk {
  id: number;
  taskId: number | null;
  chunkIndex: number | null;
  symbols: string[] | null;
  startDate: string | null;
  endDate: string | null;
  status: BackfillChunkStatus | string;
  attempts: number | null;
  insertedCount: number | null;
  updatedCount: number | null;
  skippedCount: number | null;
  failedCount: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface QualityResult {
  datasetVersionId: number | null;
  checkCode: string;
  status: QualityCheckStatus | string;
  affectedCount: number | null;
  /** 检查明细 JSON 字符串（后端原样返回，页面做摘要展开）。 */
  detailJson: string | null;
  checkedAt: string | null;
}

export interface CoverageWatermark {
  datasetVersionId: number | null;
  canonicalSymbol: string;
  firstDate: string | null;
  lastDate: string | null;
  rowCount: number | null;
  expectedDays: number | null;
  coveredDays: number | null;
  /** 覆盖率（0..1 小数）；不可计算为 null，显示 '--'。 */
  coverageRatio: number | null;
  calculatedAt: string | null;
}

export interface ImportBatch {
  id: number;
  importKind: ImportKind | string;
  providerCode: string | null;
  fileName: string | null;
  fileHash: string | null;
  insertedCount: number | null;
  updatedCount: number | null;
  skippedCount: number | null;
  rejectedCount: number | null;
  /** 当前批次只有 COMPLETED；失败由统一异常响应返回，不落批次。 */
  status: string;
  /** 错误行报告 JSON 字符串（可展开查看）。 */
  errorReportJson: string | null;
  createdAt: string | null;
}

/** 创建回补任务入参（对齐后端 CreateBackfillTaskDTO；日期 YYYY-MM-DD）。 */
export interface CreateBackfillTaskInput {
  datasetCode: string;
  marketCode: string;
  providerCode: string;
  frequency: string;
  adjustType: string;
  startDate: string;
  endDate: string;
  symbols?: string[];
  chunkSize?: number;
}
