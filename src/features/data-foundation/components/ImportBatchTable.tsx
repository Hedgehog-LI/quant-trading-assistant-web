/**
 * 最近导入批次表：计数（null 显示 '--'）+ 状态 Tag + 错误行报告摘要。
 * rejected>0 的新增/拒绝计数以 danger 色提示；错误报告为空 JSON 时显示 '--'。
 */
import { Alert, Empty, Skeleton, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { errorReportHasErrors, formatCount, formatDateTime, summarizeJson } from '../model/format';
import type { ImportBatch } from '../model/types';

export interface ImportBatchTableProps {
  batches: ImportBatch[];
  loading: boolean;
  error: Error | null;
}

export function ImportBatchTable({ batches, loading, error }: ImportBatchTableProps) {
  const columns: ColumnsType<ImportBatch> = buildColumns();

  if (error) {
    return (
      <Alert
        type="error" showIcon title="导入批次加载失败"
        description={error.message}
        data-testid="import-batches-error"
      />
    );
  }

  if (loading) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  return (
    <Table<ImportBatch>
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={batches}
      pagination={false}
      scroll={{ x: 900 }}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无导入批次" /> }}
    />
  );
}

function buildColumns(): ColumnsType<ImportBatch> {
  return [
    { title: '批次', dataIndex: 'id', width: 70 },
    { title: '类型', dataIndex: 'importKind', width: 190 },
    { title: '文件', dataIndex: 'fileName', width: 170, render: (value: string | null) => value ?? '--' },
    { title: '新增/更新/跳过/拒绝', key: 'counts', width: 170, render: (_, batch) => (
      <span>
        {formatCount(batch.insertedCount)} / {formatCount(batch.updatedCount)} /{' '}
        {formatCount(batch.skippedCount)} / {formatCount(batch.rejectedCount)}
      </span>
    ) },
    { title: '状态', dataIndex: 'status', width: 110, render: (status: string) => (
      <Tag color={status === 'COMPLETED' ? 'success' : 'default'}>{status}</Tag>
    ) },
    { title: '创建时间', dataIndex: 'createdAt', width: 140, render: (value: string | null) => formatDateTime(value) },
    { title: '错误报告', key: 'error-report', render: (_, batch) => {
      if (!errorReportHasErrors(batch.errorReportJson)) {
        return <Typography.Text type="secondary">--</Typography.Text>;
      }
      return (
        <Typography.Text type="danger" style={{ fontSize: 12 }} data-testid={`import-error-${batch.id}`}>
          {summarizeJson(batch.errorReportJson)}
        </Typography.Text>
      );
    } },
  ];
}
