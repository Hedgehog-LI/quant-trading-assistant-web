/**
 * P1.9-A 原始数据表：与图表同源（同一响应），按时间倒序展示，避免再次请求口径漂移。
 */
import { Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MarketAssetBar } from '../model/types';

const { Text } = Typography;

interface Props {
  bars: MarketAssetBar[] | null;
  loading: boolean;
}

const columns: ColumnsType<MarketAssetBar> = [
  { title: '时间', dataIndex: 'time', key: 'time', width: 180, fixed: 'left', sorter: (a, b) => a.time.localeCompare(b.time), defaultSortOrder: 'descend' },
  { title: '开盘', dataIndex: 'open', key: 'open', width: 100, align: 'right' },
  { title: '最高', dataIndex: 'high', key: 'high', width: 100, align: 'right' },
  { title: '最低', dataIndex: 'low', key: 'low', width: 100, align: 'right' },
  { title: '收盘', dataIndex: 'close', key: 'close', width: 100, align: 'right' },
  { title: '成交量', dataIndex: 'volume', key: 'volume', width: 110, align: 'right', render: (v: number) => v.toLocaleString('zh-CN') },
  { title: '成交额', dataIndex: 'amount', key: 'amount', width: 130, align: 'right', render: (v: string | null) => v ?? '--' },
  {
    title: '质量',
    dataIndex: 'qualityStatus',
    key: 'qualityStatus',
    width: 90,
    render: (status: string | null) =>
      status ? <Tag color={status === 'VALID' ? 'green' : status === 'SUSPECT' ? 'orange' : 'default'}>{status}</Tag> : '--',
  },
  { title: '抓取时间', dataIndex: 'fetchedAt', key: 'fetchedAt', width: 180, render: (v: string | null) => v ?? '--' },
];

export function MarketAssetTable({ bars, loading }: Props) {
  const rows = bars ?? [];
  return (
    <div data-testid="asset-raw-table">
      <Table<MarketAssetBar>
        rowKey={(row) => row.time}
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
        scroll={{ x: 1000 }}
        locale={{
          emptyText: <Text type="secondary">所选范围无记录</Text>,
        }}
      />
    </div>
  );
}
