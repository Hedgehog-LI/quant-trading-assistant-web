/**
 * 数据底座 API adapter（仅 remote，/api/v1/market-data/data-foundation/*）。
 *
 * - 统一响应 {success,code,data,message} 由 shared unwrappers 解包；
 *   业务失败（DATA_FOUNDATION_* 错误码）直接抛 ApiRequestError，页面展示 message，禁止伪造成功。
 * - 数据中心仅消费真实后端数据：apiMode=mock 时由 useDataFoundation 禁用全部查询/变更，
 *   页面提示切换后端模式；本层不提供任何本地合成数据，remote 失败也不回退 mock。
 * - CSV 导入用 FormData（字段名 file），不手动设置 Content-Type，
 *   由浏览器带 boundary 自动生成；kind 为 URL 查询参数（后端 @RequestParam）。
 */
import { client } from '../../../shared/api/client';
import { unwrap, unwrapNullable, unwrapVoid } from '../../../shared/api/unwrappers';
import type {
  BackfillChunk,
  BackfillTask,
  CoverageWatermark,
  CreateBackfillTaskInput,
  CreateDatasetInput,
  CreateDatasetVersionInput,
  Dataset,
  DatasetVersion,
  ImportBatch,
  ImportKind,
  QualityResult,
} from '../model/types';

const BASE = '/market-data/data-foundation';

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface BackfillTaskQuery {
  status?: string;
  page: number;
  pageSize: number;
}

export interface ImportBatchQuery {
  kind?: string;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------- 数据集与版本

export function listDatasets(): Promise<Dataset[]> {
  return unwrap<Dataset[]>(client.get(`${BASE}/datasets`));
}

/** 创建数据集定义（首期冻结组合：TENCENT_PUBLIC/IMPORT_CSV_DAILY × NONE 复权 × CN × DAILY × 1D）。 */
export function createDataset(input: CreateDatasetInput): Promise<Dataset> {
  return unwrap<Dataset>(client.post(`${BASE}/datasets`, input));
}

/** 手动创建数据集版本（仅 IMPORT_* 数据集；body：startDate/endDate）。 */
export function createDatasetVersion(
  datasetCode: string,
  input: CreateDatasetVersionInput,
): Promise<DatasetVersion> {
  return unwrap<DatasetVersion>(
    client.post(`${BASE}/datasets/${encodeURIComponent(datasetCode)}/versions`, input),
  );
}

export function listDatasetVersions(datasetCode: string): Promise<DatasetVersion[]> {
  return unwrap<DatasetVersion[]>(client.get(`${BASE}/datasets/${encodeURIComponent(datasetCode)}/versions`));
}

/** 当前发布版本；未发布返回 null（后端 data=null 是合法语义）。 */
export function getReleasedVersion(datasetCode: string): Promise<DatasetVersion | null> {
  return unwrapNullable<DatasetVersion>(
    client.get(`${BASE}/datasets/${encodeURIComponent(datasetCode)}/released`),
  );
}

// ---------------------------------------------------------------- 回补任务

export function listBackfillTasks(query: BackfillTaskQuery): Promise<PageResult<BackfillTask>> {
  return unwrap<PageResult<BackfillTask>>(client.get(`${BASE}/backfill-tasks`, {
    params: { status: query.status || undefined, page: query.page, pageSize: query.pageSize },
  }));
}

export function getBackfillTask(id: number): Promise<BackfillTask> {
  return unwrap<BackfillTask>(client.get(`${BASE}/backfill-tasks/${id}`));
}

export function listBackfillChunks(id: number): Promise<BackfillChunk[]> {
  return unwrap<BackfillChunk[]>(client.get(`${BASE}/backfill-tasks/${id}/chunks`));
}

export function createBackfillTask(input: CreateBackfillTaskInput): Promise<BackfillTask> {
  return unwrap<BackfillTask>(client.post(`${BASE}/backfill-tasks`, input));
}

/** 启动或继续（断点续跑：跳过终态分片）；RUNNING 中重复启动由后端业务错误拒绝。 */
export function runBackfillTask(id: number): Promise<BackfillTask> {
  return unwrap<BackfillTask>(client.post(`${BASE}/backfill-tasks/${id}/run`));
}

/** 暂停无返回体（ApiResponse&lt;Void&gt;，data=null 合法）。 */
export function pauseBackfillTask(id: number): Promise<void> {
  return unwrapVoid(client.post(`${BASE}/backfill-tasks/${id}/pause`));
}

/** 重试失败分片（FAILED→PENDING 后继续执行）。 */
export function retryFailedChunks(id: number): Promise<BackfillTask> {
  return unwrap<BackfillTask>(client.post(`${BASE}/backfill-tasks/${id}/chunks/retry`));
}

// ---------------------------------------------------------------- 质量与发布

export function runQualityCheck(versionId: number): Promise<QualityResult[]> {
  return unwrap<QualityResult[]>(client.post(`${BASE}/dataset-versions/${versionId}/quality-check`));
}

export function listQualityResults(versionId: number): Promise<QualityResult[]> {
  return unwrap<QualityResult[]>(client.get(`${BASE}/dataset-versions/${versionId}/quality`));
}

export function listCoverage(versionId: number): Promise<CoverageWatermark[]> {
  return unwrap<CoverageWatermark[]>(client.get(`${BASE}/dataset-versions/${versionId}/coverage`));
}

/** 发布 QUALIFIED 版本；质量 FAIL/空数据由后端 DATA_FOUNDATION_QUALITY_GATE_FAILED 拒绝。 */
export function publishVersion(versionId: number): Promise<DatasetVersion> {
  return unwrap<DatasetVersion>(client.post(`${BASE}/dataset-versions/${versionId}/publish`));
}

// ---------------------------------------------------------------- CSV 导入

/**
 * 上传导入文件：kind 走查询参数，文件走 multipart 字段名 file（Content-Type 由浏览器生成）。
 * datasetVersionId 为契约新增可选参数：DAILY_BAR 导入必须关联导入类数据集版本；
 * 其他 kind 不传（undefined 被 axios 参数序列化剔除）。
 */
export function uploadImportSnapshot(
  kind: ImportKind | string,
  file: File,
  datasetVersionId?: number,
): Promise<ImportBatch> {
  const formData = new FormData();
  formData.append('file', file);
  return unwrap<ImportBatch>(client.post(`${BASE}/imports`, formData, {
    params: { kind, datasetVersionId },
  }));
}

export function listImportBatches(query: ImportBatchQuery): Promise<ImportBatch[]> {
  return unwrap<ImportBatch[]>(client.get(`${BASE}/imports`, {
    params: { kind: query.kind || undefined, page: query.page, pageSize: query.pageSize },
  }));
}

export function getImportBatch(id: number): Promise<ImportBatch> {
  return unwrap<ImportBatch>(client.get(`${BASE}/imports/${id}`));
}
