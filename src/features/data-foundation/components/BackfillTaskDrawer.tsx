/**
 * 回补任务详情抽屉：计数统计 + 分片表（chunkIndex/状态/attempts/窗口/证券数/计数/lastError）
 * + 操作按钮（启动/继续、暂停、重试失败分片）。
 *
 * 异步执行契约：run 快速返回（QUEUED/RUNNING）后任务详情与分片按 2s 轮询，
 * 终态或 PAUSED 自动停止；抽屉关闭即停止轮询。QUEUED 与 RUNNING 均可暂停；
 * 启动按钮在 QUEUED/RUNNING/SUCCEEDED 禁用（防止重复启动，后端 claim 亦会拒绝）。
 * 不展示假进度百分比：只展示真实分片状态计数（成功/失败/总数）。
 * 分片 lastErrorMessage 完整可见（失败原因必须可追溯）。
 */
import { useRef } from 'react';
import { Alert, Button, Descriptions, Drawer, Empty, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  useBackfillChunks,
  useBackfillTask,
  usePauseBackfillTask,
  useRetryFailedChunks,
  useRunBackfillTask,
} from '../hooks/useDataFoundation';
import {
  CHUNK_STATUS_COLOR,
  TASK_STATUS_COLOR,
  formatCount,
  isActiveBackfillStatus,
  tagColor,
  taskStatusLabel,
} from '../model/format';
import type { BackfillChunk } from '../model/types';

const { Text } = Typography;

export interface BackfillTaskDrawerProps {
  taskId: number | null;
  onClose: () => void;
}

export function BackfillTaskDrawer({ taskId, onClose }: BackfillTaskDrawerProps) {
  const task = useBackfillTask(taskId);
  const data = task.data ?? null;
  const status = data?.status ?? '';
  const polling = isActiveBackfillStatus(status);
  // 分片轮询跟随任务活跃状态；任务进入终态/暂停即停止。
  const chunks = useBackfillChunks(taskId, polling);
  const runTask = useRunBackfillTask();
  const pauseTask = usePauseBackfillTask();
  const retryTask = useRetryFailedChunks();
  // run 的同步防重复守卫：TanStack 状态通知经宏任务批处理，同步连击期间 isPending
  // 尚未重渲染；ref 在 mutate 调用点同步置位，onSettled 复位。
  const runInflightRef = useRef(false);

  const failedChunks = data?.failedChunks ?? 0;
  const actionPending = runTask.isPending || pauseTask.isPending || retryTask.isPending;
  const actionError = runTask.error ?? pauseTask.error ?? retryTask.error;
  // QUEUED/RUNNING 执行中不可再次启动；SUCCEEDED 无需启动。
  const runDisabled = status === 'QUEUED' || status === 'RUNNING' || status === 'SUCCEEDED';
  // QUEUED 与 RUNNING 均可暂停（异步执行契约）。
  const pauseDisabled = status !== 'QUEUED' && status !== 'RUNNING';

  const chunkColumns: ColumnsType<BackfillChunk> = [
    { title: '#', dataIndex: 'chunkIndex', width: 56 },
    { title: '状态', dataIndex: 'status', width: 110, render: (status: string) => (
      <Tag color={tagColor(CHUNK_STATUS_COLOR, status)}>{status}</Tag>
    ) },
    { title: '重试', dataIndex: 'attempts', width: 64, render: (value: number | null) => formatCount(value) },
    { title: '窗口', key: 'chunk-window', width: 180, render: (_, chunk) => (
      <span data-testid={`chunk-window-${chunk.chunkIndex}`}>
        {chunk.startDate ?? '--'} ~ {chunk.endDate ?? '--'}
      </span>
    ) },
    { title: '证券数', key: 'chunk-symbols', width: 90, render: (_, chunk) => formatCount(chunk.symbols?.length ?? null) },
    { title: '写入/更新/跳过/失败', key: 'chunk-counts', width: 170, render: (_, chunk) => (
      <span data-testid={`chunk-counts-${chunk.chunkIndex}`}>
        {formatCount(chunk.insertedCount)} / {formatCount(chunk.updatedCount)} /{' '}
        {formatCount(chunk.skippedCount)} / {formatCount(chunk.failedCount)}
      </span>
    ) },
    { title: '失败原因', key: 'last-error', render: (_, chunk) =>
      chunk.lastErrorMessage ? (
        <Text type="danger" data-testid={`chunk-error-${chunk.chunkIndex}`}>
          {chunk.lastErrorCode ? `[${chunk.lastErrorCode}] ` : ''}
          {chunk.lastErrorMessage}
        </Text>
      ) : (
        <Text type="secondary">--</Text>
      ),
    },
  ];

  return (
    <Drawer
      title={data ? `回补任务 #${data.id}（${data.datasetCode}）` : '回补任务详情'}
      open={taskId != null}
      onClose={onClose}
      size={720}
      destroyOnHidden
    >
      {task.isError && (
        <Alert
          type="error"
          showIcon
          title="任务详情加载失败"
          description={task.error instanceof Error ? task.error.message : '请重试。'}
          style={{ marginBottom: 12 }}
          data-testid="backfill-detail-error"
        />
      )}

      {task.isLoading && !data && <Typography.Paragraph>加载中…</Typography.Paragraph>}

      {data && (
        <>
          <Descriptions
            size="small"
            column={2}
            bordered
            items={[
              { key: 'status', label: '状态', children: (
                <Tag
                  color={tagColor(TASK_STATUS_COLOR, status)}
                  title={status}
                  data-testid="task-detail-status"
                >
                  {taskStatusLabel(status)}
                </Tag>
              ) },
              { key: 'window', label: '窗口', children: `${data.startDate ?? '--'} ~ ${data.endDate ?? '--'}` },
              { key: 'provider', label: 'Provider', children: data.providerCode },
              { key: 'caliber', label: '频率/复权', children: `${data.frequency} / ${data.adjustType}` },
              { key: 'planned', label: '计划/成功/失败/跳过', children: `${formatCount(data.plannedCount)} / ${formatCount(data.successCount)} / ${formatCount(data.failCount)} / ${formatCount(data.skipCount)}` },
              { key: 'writes', label: '写入/更新', children: `${formatCount(data.insertedCount)} / ${formatCount(data.updatedCount)}` },
              { key: 'chunks', label: '分片（成功/失败/总数）', children: (
                <span data-testid="task-chunk-progress">
                  {formatCount(data.succeededChunks)} / {formatCount(data.failedChunks)} / {formatCount(data.totalChunks)}
                </span>
              ) },
              { key: 'symbols', label: '显式证券数', children: formatCount(data.symbols?.length ?? null) },
            ]}
          />

          {(data.lastErrorMessage || data.lastErrorCode) && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              title="任务最近一次错误"
              description={`${data.lastErrorCode ? `[${data.lastErrorCode}] ` : ''}${data.lastErrorMessage ?? ''}`}
              data-testid="task-last-error"
            />
          )}

          {actionError && (
            <Alert
              type="error"
              showIcon
              style={{ marginTop: 12 }}
              title="操作失败"
              description={actionError instanceof Error ? actionError.message : '请重试。'}
              data-testid="backfill-action-error"
            />
          )}

          <Space style={{ margin: '12px 0' }} wrap>
            <Button
              type="primary"
              disabled={runDisabled}
              loading={runTask.isPending}
              onClick={() => {
                // 防重复启动：同步 ref 守卫 + isPending（loading 渲染前的连击兜底）。
                if (taskId == null || runTask.isPending || runInflightRef.current) return;
                runInflightRef.current = true;
                runTask.mutate(taskId, { onSettled: () => { runInflightRef.current = false; } });
              }}
              data-testid="backfill-run-btn"
            >
              启动 / 继续
            </Button>
            <Button
              disabled={pauseDisabled}
              loading={pauseTask.isPending}
              onClick={() => {
                if (taskId == null || pauseTask.isPending) return;
                pauseTask.mutate(taskId);
              }}
              data-testid="backfill-pause-btn"
            >
              暂停
            </Button>
            <Button
              disabled={failedChunks <= 0 || polling}
              loading={retryTask.isPending}
              onClick={() => {
                if (taskId == null || retryTask.isPending) return;
                retryTask.mutate(taskId);
              }}
              data-testid="backfill-retry-btn"
            >
              重试失败分片（{formatCount(data.failedChunks)}）
            </Button>
          </Space>

          <Typography.Paragraph strong>
            分片明细{polling ? '（执行中，每 2 秒自动刷新…）' : actionPending ? '（操作执行中…）' : ''}
          </Typography.Paragraph>
          {chunks.isLoading ? (
            <Typography.Paragraph>分片加载中…</Typography.Paragraph>
          ) : chunks.isError ? (
            <Alert
              type="error"
              showIcon
              title="分片加载失败"
              description={chunks.error instanceof Error ? chunks.error.message : '请重试。'}
              data-testid="backfill-chunks-error"
            />
          ) : (
            <Table<BackfillChunk>
              rowKey="id"
              size="small"
              columns={chunkColumns}
              dataSource={chunks.data ?? []}
              pagination={false}
              scroll={{ x: 820, y: 360 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分片" /> }}
            />
          )}
        </>
      )}
    </Drawer>
  );
}
