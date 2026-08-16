/**
 * 数据中心查询/变更 hooks：TanStack Query，retry:false（失败立即进入 error 态，禁止静默重试）。
 *
 * 数据中心仅消费真实后端数据：apiMode=mock 时全部查询禁用（不发起任何请求）、
 * 变更保持可调用但由页面在 mock 模式下不渲染入口；本层不提供任何本地合成数据。
 * 操作成功后按语义 invalidate 相应 query key。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings } from '../../settings/api/settingsApi';
import {
  createBackfillTask,
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
import type { CreateBackfillTaskInput, ImportKind } from '../model/types';

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
  });
}

export function useBackfillTask(id: number | null) {
  return useQuery({
    queryKey: ['data-foundation', 'backfill-task', id],
    queryFn: () => getBackfillTask(id as number),
    enabled: remoteEnabled() && id != null,
    retry: false,
  });
}

export function useBackfillChunks(id: number | null) {
  return useQuery({
    queryKey: ['data-foundation', 'backfill-chunks', id],
    queryFn: () => listBackfillChunks(id as number),
    enabled: remoteEnabled() && id != null,
    retry: false,
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
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'quality', versionId] });
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'versions'] });
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
    mutationFn: (input: { kind: ImportKind | string; file: File }) =>
      uploadImportSnapshot(input.kind, input.file),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'imports'] });
    },
  });
}
