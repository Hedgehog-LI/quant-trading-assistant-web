/**
 * P1.9-A 相关采集计划与采集记录：按 symbol、粒度和时间范围展示“相关”任务。
 * 当前 bar 表无 task_id，只能称“相关采集记录”，不宣称某一 bar 的精确任务血缘。
 */
import { Skeleton, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MarketAssetRelatedTaskItem } from '../model/types';

const { Text } = Typography;

interface Props {
  data: { plans: MarketAssetRelatedTaskItem[]; runs: MarketAssetRelatedTaskItem[] } | null;
  loading: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  RUNNING: 'processing',
  SUCCESS: 'green',
  FAILED: 'red',
  ENABLED: 'blue',
  DISABLED: 'default',
  PENDING: 'default',
};

function statusTag(status: string | null): React.ReactNode {
  if (!status) return '--';
  return <Tag color={STATUS_COLOR[status] ?? 'default'}>{status}</Tag>;
}

const columns: ColumnsType<MarketAssetRelatedTaskItem> = [
  { title: '类型', dataIndex: 'kind', key: 'kind', width: 72, render: (kind: string) => (kind === 'PLAN' ? <Tag color="blue">计划</Tag> : <Tag color="green">记录</Tag>) },
  { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '任务类型', dataIndex: 'taskType', key: 'taskType', width: 100, render: (v: string | null) => v ?? '--' },
  { title: '粒度', dataIndex: 'intervalType', key: 'intervalType', width: 80, render: (v: string | null) => v ?? '--' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 96, render: statusTag },
  { title: '起止日期', key: 'date', width: 180, render: (_, row) => (row.startDate ?? '--') + ' ～ ' + (row.endDate ?? '--') },
  { title: '开始 / 结束', key: 'time', width: 220, render: (_, row) => `${row.startedAt ?? '--'} / ${row.finishedAt ?? '--'}` },
  {
    title: '错误',
    key: 'error',
    width: 180,
    render: (_, row) =>
      row.errorCode || row.errorMessage ? (
        <Text type="danger" style={{ fontSize: 12 }}>
          {[row.errorCode, row.errorMessage].filter(Boolean).join(' ')}
        </Text>
      ) : '--',
  },
];

function TableSection({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: MarketAssetRelatedTaskItem[];
  emptyText: string;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <Text strong>{title}</Text>
      <Table<MarketAssetRelatedTaskItem>
        rowKey={(row) => `${row.kind}-${row.id}`}
        columns={columns}
        dataSource={rows}
        pagination={rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
        scroll={{ x: 1080 }}
        locale={{ emptyText: <Text type="secondary">{emptyText}</Text> }}
        size="small"
        style={{ marginTop: 8 }}
      />
    </div>
  );
}

export function RelatedCollectionRuns({ data, loading }: Props) {
  if (loading && !data) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }
  if (!data) return null;

  return (
    <div data-testid="asset-related-tasks">
      <TableSection title="相关采集计划" rows={data.plans} emptyText="无相关采集计划" />
      <TableSection title="相关采集记录" rows={data.runs} emptyText="无相关采集记录" />
      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
        当前为按证券、粒度和时间范围匹配的相关记录，不代表单根 bar 的精确任务血缘。
      </Text>
    </div>
  );
}
