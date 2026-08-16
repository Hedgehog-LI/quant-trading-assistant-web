/**
 * 回补任务详情抽屉：计数统计 + 分片表（chunkIndex/status/attempts/counts/lastError）
 * + 操作按钮（启动/继续、暂停、重试失败分片）。
 *
 * 状态纪律：RUNNING 时禁用启动（后端 DATA_FOUNDATION_BACKFILL_RUNNING 语义）、
 * 非 RUNNING 禁用暂停、无失败分片禁用重试；操作失败展示后端 message，不伪造成功。
 * 分片 lastErrorMessage 完整可见（失败原因必须可追溯）。
 */
import { Alert, Button, Descriptions, Drawer, Empty, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  useBackfillChunks,
  useBackfillTask,
  usePauseBackfillTask,
  useRetryFailedChunks,
  useRunBackfillTask,
} from '../hooks/useDataFoundation';
import { CHUNK_STATUS_COLOR, TASK_STATUS_COLOR, formatCount, tagColor } from '../model/format';
import type { BackfillChunk } from '../model/types';

const { Text } = Typography;

export interface BackfillTaskDrawerProps {
  taskId: number | null;
  onClose: () => void;
}

export function BackfillTaskDrawer({ taskId, onClose }: BackfillTaskDrawerProps) {
  const task = useBackfillTask(taskId);
  const chunks = useBackfillChunks(taskId);
  const runTask = useRunBackfillTask();
  const pauseTask = usePauseBackfillTask();
  const retryTask = useRetryFailedChunks();

  const data = task.data ?? null;
  const status = data?.status ?? '';
  const isRunning = status === 'RUNNING';
  const failedChunks = data?.failedChunks ?? 0;
  const actionPending = runTask.isPending || pauseTask.isPending || retryTask.isPending;
  const actionError = runTask.error ?? pauseTask.error ?? retryTask.error;

  const chunkColumns: ColumnsType<BackfillChunk> = [
    { title: '#', dataIndex: 'chunkIndex', width: 56 },
    { title: '状态', dataIndex: 'status', width: 110, render: (status: string) => (
      <Tag color={tagColor(CHUNK_STATUS_COLOR, status)}>{status}</Tag>
    ) },
    { title: '重试', dataIndex: 'attempts', width: 64, render: (value: number | null) => formatCount(value) },
    { title: '写入/更新/跳过/失败', key: 'chunk-counts', width: 170, render: (_, chunk) => (
      <span>
        {formatCount(chunk.insertedCount)} / {formatCount(chunk.updatedCount)} /{' '}
        {formatCount(chunk.skippedCount)} / {formatCount(chunk.failedCount)}
      </span>
    ) },
    { title: '证券数', key: 'chunk-symbols', width: 90, render: (_, chunk) => formatCount(chunk.symbols?.length ?? null) },
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
              { key: 'status', label: '状态', children: <Tag color={tagColor(TASK_STATUS_COLOR, status)} data-testid="task-detail-status">{status}</Tag> },
              { key: 'window', label: '窗口', children: `${data.startDate ?? '--'} ~ ${data.endDate ?? '--'}` },
              { key: 'provider', label: 'Provider', children: data.providerCode },
              { key: 'caliber', label: '频率/复权', children: `${data.frequency} / ${data.adjustType}` },
              { key: 'planned', label: '计划/成功/失败/跳过', children: `${formatCount(data.plannedCount)} / ${formatCount(data.successCount)} / ${formatCount(data.failCount)} / ${formatCount(data.skipCount)}` },
              { key: 'writes', label: '写入/更新', children: `${formatCount(data.insertedCount)} / ${formatCount(data.updatedCount)}` },
              { key: 'chunks', label: '分片（成功/失败/总数）', children: `${formatCount(data.succeededChunks)} / ${formatCount(data.failedChunks)} / ${formatCount(data.totalChunks)}` },
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
              disabled={isRunning}
              loading={runTask.isPending}
              onClick={() => taskId != null && runTask.mutate(taskId)}
              data-testid="backfill-run-btn"
            >
              {isRunning ? '执行中' : '启动 / 继续'}
            </Button>
            <Button
              disabled={!isRunning}
              loading={pauseTask.isPending}
              onClick={() => taskId != null && pauseTask.mutate(taskId)}
              data-testid="backfill-pause-btn"
            >
              暂停
            </Button>
            <Button
              disabled={failedChunks <= 0 || isRunning}
              loading={retryTask.isPending}
              onClick={() => taskId != null && retryTask.mutate(taskId)}
              data-testid="backfill-retry-btn"
            >
              重试失败分片（{formatCount(data.failedChunks)}）
            </Button>
          </Space>

          <Typography.Paragraph strong>
            分片明细{actionPending ? '（操作执行中…）' : ''}
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
              scroll={{ x: 640, y: 360 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分片" /> }}
            />
          )}
        </>
      )}
    </Drawer>
  );
}
