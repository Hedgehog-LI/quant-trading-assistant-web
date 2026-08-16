/**
 * 回补任务列表：状态 Tag（中文标签：排队中/执行中/已暂停/部分失败/已失败/已成功，
 * title 保留原始状态码）+ 计数（null 显示 '--'）+ 分页 + 刷新 + 详情入口。
 * PARTIAL_FAILED 等中间态明确标色，不伪装成成功；不展示假进度百分比。
 */
import { Alert, Button, Empty, Skeleton, Space, Table, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { formatCount, formatDateTime, tagColor, TASK_STATUS_COLOR, taskStatusLabel } from '../model/format';
import type { BackfillTask } from '../model/types';

const { Text } = Typography;

export interface BackfillTaskTableProps {
  tasks: BackfillTask[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: Error | null;
  refreshing: boolean;
  onRefresh: () => void;
  onPageChange: (page: number, pageSize: number) => void;
  onOpenDetail: (task: BackfillTask) => void;
}

export function BackfillTaskTable({
  tasks, total, page, pageSize, loading, error, refreshing,
  onRefresh, onPageChange, onOpenDetail,
}: BackfillTaskTableProps) {
  const columns: ColumnsType<BackfillTask> = [
    { title: 'ID', dataIndex: 'id', width: 64 },
    { title: '数据集', dataIndex: 'datasetCode', width: 150 },
    { title: '窗口', key: 'window', width: 200, render: (_, task) => (
      <span>{task.startDate ?? '--'} ~ {task.endDate ?? '--'}</span>
    ) },
    { title: '状态', dataIndex: 'status', width: 110, render: (status: string) => (
      <Tag
        color={tagColor(TASK_STATUS_COLOR, status)}
        title={status}
        data-testid={`task-status-${status}`}
      >
        {taskStatusLabel(status)}
      </Tag>
    ) },
    { title: '计划/成功/失败/跳过', key: 'counts', width: 170, render: (_, task) => (
      <Space size={4}>
        <Text>{formatCount(task.plannedCount)}</Text>
        <Text type="secondary">/</Text>
        <Text>{formatCount(task.successCount)}</Text>
        <Text type="secondary">/</Text>
        <Text type={((task.failCount ?? 0) > 0) ? 'danger' : undefined}>{formatCount(task.failCount)}</Text>
        <Text type="secondary">/</Text>
        <Text>{formatCount(task.skipCount)}</Text>
      </Space>
    ) },
    { title: '写入/更新', key: 'writes', width: 120, render: (_, task) => (
      <span>{formatCount(task.insertedCount)} / {formatCount(task.updatedCount)}</span>
    ) },
    { title: '创建时间', dataIndex: 'createdAt', width: 140, render: (value: string | null) => formatDateTime(value) },
    { title: '操作', key: 'action', width: 90, render: (_, task) => (
      <Button size="small" onClick={() => onOpenDetail(task)} data-testid={`task-detail-btn-${task.id}`}>
        详情
      </Button>
    ) },
  ];

  return (
    <div className="df-task-table">
      <div className="df-panel-toolbar">
        <Space>
          <Typography.Text strong>回补任务</Typography.Text>
          <Text type="secondary">共 {total} 条</Text>
        </Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={refreshing}
          data-testid="backfill-refresh"
        >
          刷新
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          title="回补任务列表加载失败"
          description={error.message}
          style={{ marginBottom: 12 }}
          data-testid="backfill-list-error"
        />
      )}

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <Table<BackfillTask>
          rowKey="id"
          columns={columns}
          dataSource={tasks}
          size="small"
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无回补任务" /> }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: onPageChange,
          }}
          scroll={{ x: 960 }}
        />
      )}
    </div>
  );
}
