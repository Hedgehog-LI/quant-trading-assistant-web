import { Button, Popconfirm, Space, Table, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { formatDateTime } from '../../../shared/utils/date';
import { formatMoney, formatPercent } from '../../../shared/utils/number';
import { pnlColor, PNL_COLOR_HEX } from '../../portfolio/model/types';
import { SNAPSHOT_SOURCE_META } from '../model/meta';
import type { PositionSnapshotSummary, SnapshotSourceType } from '../model/types';
import { PositionSnapshotStatusTag } from './PositionSnapshotStatusTag';

interface Props {
  items: PositionSnapshotSummary[];
  loading: boolean;
  onView: (id: string | number) => void;
  onEdit: (id: string | number) => void;
  onConfirm: (id: string | number) => Promise<void>;
  onCancel: (id: string | number) => Promise<void>;
}

export function PositionSnapshotHistoryTable({
  items,
  loading,
  onView,
  onEdit,
  onConfirm,
  onCancel,
}: Props) {
  const columns: ColumnsType<PositionSnapshotSummary> = [
    {
      title: '快照时间',
      dataIndex: 'snapshotTime',
      width: 150,
      fixed: 'left',
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '名称',
      dataIndex: 'snapshotName',
      width: 180,
      ellipsis: true,
      render: (value?: string) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'snapshotStatus',
      width: 90,
      render: (status) => <PositionSnapshotStatusTag status={status} />,
    },
    {
      title: '来源',
      dataIndex: 'sourceType',
      width: 100,
      render: (sourceType: SnapshotSourceType) => SNAPSHOT_SOURCE_META[sourceType],
    },
    { title: '持仓数', dataIndex: 'positionCount', width: 80, align: 'right' },
    {
      title: '总成本',
      dataIndex: 'totalCostAmount',
      width: 120,
      align: 'right',
      render: formatMoney,
    },
    {
      title: '总市值',
      dataIndex: 'totalMarketValue',
      width: 120,
      align: 'right',
      render: formatMoney,
    },
    {
      title: '浮动盈亏',
      dataIndex: 'totalUnrealizedPnl',
      width: 120,
      align: 'right',
      render: (value: number) => (
        <span style={{ color: PNL_COLOR_HEX[pnlColor(value)], fontWeight: 600 }}>
          {formatMoney(value)}
        </span>
      ),
    },
    {
      title: '盈亏比例',
      dataIndex: 'totalPnlRate',
      width: 100,
      align: 'right',
      render: (value: number) => (
        <span style={{ color: PNL_COLOR_HEX[pnlColor(value)] }}>{formatPercent(value)}</span>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 180,
      ellipsis: true,
      render: (value?: string) => value || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="查看详情">
            <Button aria-label="查看详情" type="text" icon={<EyeOutlined />} onClick={() => onView(record.id)} />
          </Tooltip>
          {record.snapshotStatus === 'DRAFT' && (
            <>
              <Tooltip title="编辑草稿">
                <Button aria-label="编辑草稿" type="text" icon={<EditOutlined />} onClick={() => onEdit(record.id)} />
              </Tooltip>
              <Popconfirm title="确认这份持仓快照？" okText="确认" cancelText="取消" onConfirm={() => onConfirm(record.id)}>
                <Tooltip title="确认快照">
                  <Button aria-label="确认快照" type="text" icon={<CheckCircleOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          {record.snapshotStatus !== 'CANCELED' && (
            <Popconfirm
              title="作废这份持仓快照？"
              description="作废后不会出现在默认历史列表中。"
              okText="确认作废"
              cancelText="取消"
              onConfirm={() => onCancel(record.id)}
            >
              <Tooltip title="作废快照">
                <Button aria-label="作废快照" type="text" danger icon={<StopOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table<PositionSnapshotSummary>
      rowKey={(record) => String(record.id)}
      dataSource={items}
      columns={columns}
      loading={loading}
      size="small"
      pagination={{ pageSize: 15, showSizeChanger: true }}
      scroll={{ x: 1450 }}
      locale={{ emptyText: '暂无符合条件的持仓快照' }}
    />
  );
}
