import { Button, Descriptions, Drawer, Popconfirm, Space, Table, Tag } from 'antd';
import { CheckCircleOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { formatDateTime } from '../../../shared/utils/date';
import { formatMoney, formatPercent, formatPrice } from '../../../shared/utils/number';
import { pnlColor, PNL_COLOR_HEX } from '../../portfolio/model/types';
import { MARKET_TYPE_META, SNAPSHOT_SOURCE_META } from '../model/meta';
import type { PositionMarketType, PositionSnapshotDetail, PositionSnapshotItem } from '../model/types';
import { PositionSnapshotStatusTag } from './PositionSnapshotStatusTag';

interface Props {
  open: boolean;
  snapshot: PositionSnapshotDetail | null;
  loading: boolean;
  onClose: () => void;
  onEdit: (snapshot: PositionSnapshotDetail) => void;
  onConfirm: (id: string | number) => Promise<void>;
  onCancel: (id: string | number) => Promise<void>;
}

export function PositionSnapshotDetailDrawer({
  open,
  snapshot,
  loading,
  onClose,
  onEdit,
  onConfirm,
  onCancel,
}: Props) {
  const columns: ColumnsType<PositionSnapshotItem> = [
    { title: '代码', dataIndex: 'symbol', width: 90, fixed: 'left', render: (value) => <strong>{value}</strong> },
    { title: '名称', dataIndex: 'name', width: 100, render: (value?: string) => value || '-' },
    { title: '市场', dataIndex: 'marketType', width: 70, render: (value: PositionMarketType) => MARKET_TYPE_META[value] },
    { title: '持仓', dataIndex: 'holdingQuantity', width: 80, align: 'right' },
    { title: '可用', dataIndex: 'availableQuantity', width: 80, align: 'right' },
    { title: '成本价', dataIndex: 'costPrice', width: 100, align: 'right', render: formatPrice },
    { title: '当前价', dataIndex: 'currentPrice', width: 100, align: 'right', render: formatPrice },
    { title: '持仓成本', dataIndex: 'costAmount', width: 120, align: 'right', render: formatMoney },
    { title: '当前市值', dataIndex: 'marketValue', width: 120, align: 'right', render: formatMoney },
    {
      title: '浮动盈亏',
      dataIndex: 'unrealizedPnl',
      width: 110,
      align: 'right',
      render: (value: number) => <span style={{ color: PNL_COLOR_HEX[pnlColor(value)] }}>{formatMoney(value)}</span>,
    },
    {
      title: '盈亏比例',
      dataIndex: 'pnlRate',
      width: 100,
      align: 'right',
      render: (value: number) => <span style={{ color: PNL_COLOR_HEX[pnlColor(value)] }}>{formatPercent(value)}</span>,
    },
    { title: '仓位占比', dataIndex: 'positionRatio', width: 100, align: 'right', render: formatPercent },
    { title: '备注', dataIndex: 'remark', width: 160, ellipsis: true, render: (value?: string) => value || '-' },
  ];

  return (
    <Drawer
      title="持仓快照详情"
      open={open}
      onClose={onClose}
      size="min(1100px, 96vw)"
      loading={loading}
      footer={snapshot ? (
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          {snapshot.snapshotStatus === 'DRAFT' && (
            <>
              <Button icon={<EditOutlined />} onClick={() => onEdit(snapshot)}>编辑草稿</Button>
              <Popconfirm title="确认这份持仓快照？" okText="确认" cancelText="取消" onConfirm={() => onConfirm(snapshot.id)}>
                <Button type="primary" icon={<CheckCircleOutlined />}>确认快照</Button>
              </Popconfirm>
            </>
          )}
          {snapshot.snapshotStatus !== 'CANCELED' && (
            <Popconfirm
              title="作废这份持仓快照？"
              description="作废后不会出现在默认历史列表中。"
              okText="确认作废"
              cancelText="取消"
              onConfirm={() => onCancel(snapshot.id)}
            >
              <Button danger icon={<StopOutlined />}>作废</Button>
            </Popconfirm>
          )}
        </Space>
      ) : null}
    >
      {snapshot && (
        <>
          <Descriptions
            size="small"
            bordered
            column={{ xs: 1, sm: 2, lg: 4 }}
            items={[
              { key: 'name', label: '名称', children: snapshot.snapshotName || '-' },
              { key: 'time', label: '快照时间', children: formatDateTime(snapshot.snapshotTime) },
              { key: 'status', label: '状态', children: <PositionSnapshotStatusTag status={snapshot.snapshotStatus} /> },
              { key: 'source', label: '来源', children: <Tag>{SNAPSHOT_SOURCE_META[snapshot.sourceType]}</Tag> },
              { key: 'count', label: '持仓数量', children: `${snapshot.positionCount} 只` },
              { key: 'cost', label: '总成本', children: formatMoney(snapshot.totalCostAmount) },
              { key: 'value', label: '总市值', children: formatMoney(snapshot.totalMarketValue) },
              {
                key: 'pnl',
                label: '浮动盈亏',
                children: <strong style={{ color: PNL_COLOR_HEX[pnlColor(snapshot.totalUnrealizedPnl)] }}>
                  {formatMoney(snapshot.totalUnrealizedPnl)} / {formatPercent(snapshot.totalPnlRate)}
                </strong>,
              },
              { key: 'remark', label: '备注', span: 'filled', children: snapshot.remark || '-' },
            ]}
          />
          <Table<PositionSnapshotItem>
            rowKey={(record) => String(record.id)}
            dataSource={snapshot.items}
            columns={columns}
            size="small"
            pagination={false}
            scroll={{ x: 1350 }}
            style={{ marginTop: 16 }}
          />
        </>
      )}
    </Drawer>
  );
}
