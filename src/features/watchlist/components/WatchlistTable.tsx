import { Table, Tag, Button, Space, Popconfirm } from 'antd';
import { EditOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { WatchlistItem, TradeStyle, AttentionLevel } from '../../../shared/types/domain';
import { TRADE_STYLE_MAP, ATTENTION_LEVEL_MAP } from '../model/options';
import { formatPrice } from '../../../shared/utils/number';
import { formatDate } from '../../../shared/utils/date';

interface Props {
  items: WatchlistItem[];
  onEdit: (item: WatchlistItem) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
}

export function WatchlistTable({ items, onEdit, onToggleEnabled }: Props) {
  const columns: ColumnsType<WatchlistItem> = [
    {
      title: '代码',
      dataIndex: 'symbol',
      width: 100,
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 120,
    },
    {
      title: '交易风格',
      dataIndex: 'tradeStyle',
      width: 90,
      render: (v: string) => {
        const opt = TRADE_STYLE_MAP.get(v as TradeStyle);
        return opt ? <Tag color={opt.color}>{opt.label}</Tag> : '-';
      },
    },
    {
      title: '关注级别',
      dataIndex: 'attentionLevel',
      width: 90,
      render: (v: string) => {
        const opt = ATTENTION_LEVEL_MAP.get(v as AttentionLevel);
        return opt ? <Tag color={opt.color}>{opt.label}</Tag> : '-';
      },
    },
    {
      title: '支撑位',
      dataIndex: 'supportPrice',
      width: 100,
      align: 'right',
      render: (v: number) => formatPrice(v),
    },
    {
      title: '压力位',
      dataIndex: 'resistancePrice',
      width: 100,
      align: 'right',
      render: (v: number) => formatPrice(v),
    },
    {
      title: '止损位',
      dataIndex: 'stopLossPrice',
      width: 100,
      align: 'right',
      render: (v: number) => formatPrice(v),
    },
    {
      title: '关注理由',
      dataIndex: 'watchReason',
      width: 180,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (v: boolean) =>
        v ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 120,
      render: (v: string) => formatDate(v),
    },
    {
      title: '操作',
      width: 140,
      render: (_: unknown, record: WatchlistItem) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
            编辑
          </Button>
          {record.enabled ? (
            <Popconfirm
              title="确定停用该自选股？"
              onConfirm={() => onToggleEnabled(record.id, false)}
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                停用
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => onToggleEnabled(record.id, true)}
            >
              启用
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table<WatchlistItem>
      rowKey="id"
      dataSource={items}
      columns={columns}
      size="small"
      pagination={{ pageSize: 20, showSizeChanger: true }}
      scroll={{ x: 1200 }}
    />
  );
}
