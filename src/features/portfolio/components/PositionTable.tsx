import { Table, Tag, Tooltip } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PortfolioPosition } from '../model/types';
import { pnlColor, PNL_COLOR_HEX } from '../model/types';
import { formatMoney, formatPrice, formatPointPercent } from '../../../shared/utils/number';

interface Props {
  positions: PortfolioPosition[];
}

/** 当前持仓表。未维护当前价时，市值/浮盈相关列显示「-」。 */
export function PositionTable({ positions }: Props) {
  const columns: ColumnsType<PortfolioPosition> = [
    {
      title: '代码',
      dataIndex: 'symbol',
      width: 90,
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 100,
      render: (v?: string) => v ?? '-',
    },
    { title: '数量', dataIndex: 'quantity', width: 80, align: 'right' },
    {
      title: '平均成本',
      dataIndex: 'averageCost',
      width: 100,
      align: 'right',
      render: (v: number | null) => (v == null ? '-' : formatPrice(v)),
    },
    {
      title: '持仓成本',
      dataIndex: 'costAmount',
      width: 110,
      align: 'right',
      render: (v: number) => formatMoney(v),
    },
    {
      title: '手工当前价',
      dataIndex: 'currentPrice',
      width: 100,
      align: 'right',
      render: (v: number | null) => (v == null ? '-' : formatPrice(v)),
    },
    {
      title: '估算市值',
      dataIndex: 'marketValue',
      width: 110,
      align: 'right',
      render: (v: number | null) => (v == null ? '-' : formatMoney(v)),
    },
    {
      title: '估算浮盈',
      dataIndex: 'unrealizedPnl',
      width: 110,
      align: 'right',
      render: (v: number | null) =>
        v == null ? '-' : <span style={{ color: PNL_COLOR_HEX[pnlColor(v)] }}>{formatMoney(v)}</span>,
    },
    {
      title: '浮盈点数',
      dataIndex: 'unrealizedReturnPoint',
      width: 100,
      align: 'right',
      render: (v: number | null) =>
        v == null ? (
          '-'
        ) : (
          <span style={{ color: PNL_COLOR_HEX[pnlColor(v)], fontWeight: 600 }}>{formatPointPercent(v)}</span>
        ),
    },
    { title: '首次买入', dataIndex: 'firstBuyDate', width: 110 },
    { title: '持有天数', dataIndex: 'holdingDays', width: 90, align: 'right' },
    {
      title: '提示',
      dataIndex: 'warnings',
      width: 70,
      render: (ws: string[]) =>
        ws.length > 0 ? (
          <Tooltip title={ws.join('；')}>
            <Tag color="orange">
              <WarningOutlined />
            </Tag>
          </Tooltip>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <Table<PortfolioPosition>
      rowKey="symbol"
      dataSource={positions}
      columns={columns}
      size="small"
      pagination={{ pageSize: 20 }}
      scroll={{ x: 1200 }}
    />
  );
}
