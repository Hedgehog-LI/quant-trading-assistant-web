/**
 * 数据中心查询/变更 hooks：TanStack Query，retry:false（失败立即进入 error 态，禁止静默重试）。
 *
 * 轮询纪律（异步执行契约）：只有存在活跃任务（PENDING/QUEUED/RUNNING）时才以 2s 轮询
 * 任务列表/任务详情/分片；进入终态或 PAUSED 后 refetchInterval 返回 false 自动停止；
 * 不使用手写 setInterval，组件卸载由 Query 取消订阅兜底（无残留定时器）。
 *
 * 数据中心仅消费真实后端数据：apiMode=mock 时全部查询禁用（不发起任何请求）、
 * 变更保持可调用但由页面在 mock 模式下不渲染入口；本层不提供任何本地合成数据。
 * 操作成功后按语义 invalidate 相应 query key（避免重复 invalidate 形成请求风暴）。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings } from '../../settings/api/settingsApi';
import {
  createBackfillTask,
  createDataset,
  createDatasetVersion,
  getBackfillTask,
  getReleasedVersion,
  listBackfillChunks,
  listBackfillTasks,
  listCoverage,
  listDatasets,
  listDatasetVersions,
  listImportBatches,
  listQualityResults,
  pauseBackfillTask,
  publishVersion,
  retryFailedChunks,
  runBackfillTask,
  runQualityCheck,
  uploadImportSnapshot,
  type BackfillTaskQuery,
  type ImportBatchQuery,
} from '../api/dataFoundationApi';
import {
  TASK_POLL_INTERVAL_MS,
  isActiveBackfillStatus,
} from '../model/format';
import type {
  CreateBackfillTaskInput,
  CreateDatasetInput,
  CreateDatasetVersionInput,
  ImportKind,
} from '../model/types';

/** mock 模式下不发起任何请求（数据中心无本地演示数据）。 */
function remoteEnabled(): boolean {
  return getSettings().apiMode === 'remote';
}

export function useFoundationDatasets() {
  return useQuery({
    queryKey: ['data-foundation', 'datasets'],
    queryFn: listDatasets,
    enabled: remoteEnabled(),
    retry: false,
  });
}

export function useDatasetVersions(datasetCode: string | null) {
  return useQuery({
    queryKey: ['data-foundation', 'versions', datasetCode],
    queryFn: () => listDatasetVersions(datasetCode as string),
    enabled: remoteEnabled() && Boolean(datasetCode),
    retry: false,
  });
}

export function useReleasedVersion(datasetCode: string | null) {
  return useQuery({
    queryKey: ['data-foundation', 'released', datasetCode],
    queryFn: () => getReleasedVersion(datasetCode as string),
    enabled: remoteEnabled() && Boolean(datasetCode),
    retry: false,
  });
}

export function useBackfillTaskList(query: BackfillTaskQuery) {
  return useQuery({
    queryKey: ['data-foundation', 'backfill-tasks', query.status ?? '', query.page, query.pageSize],
    queryFn: () => listBackfillTasks(query),
    enabled: remoteEnabled(),
    retry: false,
    // 仅当前页存在活跃任务时轮询；终态/暂停即停止（不永久轮询）。
    refetchInterval: (queryResult) =>
      (queryResult.state.data?.items ?? []).some((task) => isActiveBackfillStatus(task.status))
        ? TASK_POLL_INTERVAL_MS
        : false,
  });
}

export function useBackfillTask(id: number | null) {
  return useQuery({
    queryKey: ['data-foundation', 'backfill-task', id],
    queryFn: () => getBackfillTask(id as number),
    enabled: remoteEnabled() && id != null,
    retry: false,
    // 按任务自身状态决定轮询：QUEUED/RUNNING/PENDING 每 2s；终态或 PAUSED 停止。
    refetchInterval: (queryResult) =>
      isActiveBackfillStatus(queryResult.state.data?.status) ? TASK_POLL_INTERVAL_MS : false,
  });
}

export function useBackfillChunks(id: number | null, poll: boolean) {
  return useQuery({
    queryKey: ['data-foundation', 'backfill-chunks', id],
    queryFn: () => listBackfillChunks(id as number),
    enabled: remoteEnabled() && id != null,
    retry: false,
    // poll 由抽屉按任务状态计算传入；抽屉关闭（id=null）查询禁用即不轮询。
    refetchInterval: poll ? TASK_POLL_INTERVAL_MS : false,
  });
}

export function useQualityResults(versionId: number | null) {
  return useQuery({
    queryKey: ['data-foundation', 'quality', versionId],
    queryFn: () => listQualityResults(versionId as number),
    enabled: remoteEnabled() && versionId != null,
    retry: false,
  });
}

export function useCoverage(versionId: number | null) {
  return useQuery({
    queryKey: ['data-foundation', 'coverage', versionId],
    queryFn: () => listCoverage(versionId as number),
    enabled: remoteEnabled() && versionId != null,
    retry: false,
  });
}

export function useImportBatches(query: ImportBatchQuery) {
  return useQuery({
    queryKey: ['data-foundation', 'imports', query.kind ?? '', query.page, query.pageSize],
    queryFn: () => listImportBatches(query),
    enabled: remoteEnabled(),
    retry: false,
  });
}

// ---------------------------------------------------------------- 变更

export function useCreateBackfillTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBackfillTaskInput) => createBackfillTask(input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'backfill-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'versions'] });
    },
  });
}

export function useCreateDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDatasetInput) => createDataset(input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'datasets'] });
    },
  });
}

export function useCreateDatasetVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { datasetCode: string; body: CreateDatasetVersionInput }) =>
      createDatasetVersion(input.datasetCode, input.body),
    retry: false,
    onSuccess: (version) => {
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'versions', version.datasetCode] });
    },
  });
}

export function useRunBackfillTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => runBackfillTask(id),
    retry: false,
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'backfill-task', id] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'backfill-chunks', id] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'backfill-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'versions'] });
    },
  });
}

export function usePauseBackfillTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => pauseBackfillTask(id),
    retry: false,
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'backfill-task', id] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'backfill-chunks', id] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'backfill-tasks'] });
    },
  });
}

export function useRetryFailedChunks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => retryFailedChunks(id),
    retry: false,
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'backfill-task', id] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'backfill-chunks', id] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'backfill-tasks'] });
    },
  });
}

export function useRunQualityCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: number) => runQualityCheck(versionId),
    retry: false,
    onSuccess: (_data, versionId) => {
      // 质量检查改变版本状态（QUALIFIED/REJECTED）并刷新覆盖水位：
      // 一次性刷新版本、质量、覆盖与当前发布版本，不重复 invalidate。
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'quality', versionId] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'coverage', versionId] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'versions'] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'released'] });
    },
  });
}

export function usePublishVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: number) => publishVersion(versionId),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'versions'] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'released'] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'datasets'] });
    },
  });
}

export function useUploadImportSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: ImportKind | string; file: File; datasetVersionId?: number }) =>
      uploadImportSnapshot(input.kind, input.file, input.datasetVersionId),
    retry: false,
    onSuccess: () => {
      // 导入成功后刷新批次与版本侧数据（版本行数/覆盖/质量随导入变化）。
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'imports'] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'versions'] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'coverage'] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'quality'] });
    },
  });
}
