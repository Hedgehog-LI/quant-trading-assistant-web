import { Table, Tag, Button, Space, Spin, Alert, Empty, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { EntityId, TradePlan, PlanStatus } from '../../../shared/types/domain';
import { PLAN_STATUS_MAP } from '../model/options';
import { formatPrice, formatPercent } from '../../../shared/utils/number';

interface Props {
  items: TradePlan[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  onEdit: (item: TradePlan) => void;
  onUpdateStatus: (id: EntityId, status: TradePlan['planStatus']) => void;
  onRemove: (id: EntityId) => void;
}

export function TradePlanTable({ items, loading, error, isEmpty, onEdit, onUpdateStatus, onRemove }: Props) {
  const columns: ColumnsType<TradePlan> = [
    {
      title: '股票代码',
      dataIndex: 'symbol',
      width: 100,
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'planStatus',
      width: 90,
      render: (v: string) => {
        const opt = PLAN_STATUS_MAP.get(v as PlanStatus);
        return opt ? <Tag color={opt.color}>{opt.label}</Tag> : v;
      },
    },
    {
      title: '允许交易',
      dataIndex: 'allowedToTrade',
      width: 80,
      render: (v: boolean) => v ? <Tag color="blue">是</Tag> : <Tag color="default">否</Tag>,
    },
    {
      title: '止损价',
      dataIndex: 'stopLossPrice',
      width: 90,
      align: 'right',
      render: (v: number) => formatPrice(v),
    },
    {
      title: '止盈价',
      dataIndex: 'takeProfitPrice',
      width: 90,
      align: 'right',
      render: (v: number) => formatPrice(v),
    },
    {
      title: '计划仓位',
      dataIndex: 'plannedPositionRatio',
      width: 90,
      align: 'right',
      render: (v: number) => formatPercent(v),
    },
    {
      title: '买入条件',
      dataIndex: 'buyCondition',
      width: 160,
      ellipsis: true,
    },
    {
      title: '操作',
      width: 240,
      render: (_: unknown, record: TradePlan) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
            编辑
          </Button>
          {record.planStatus === 'DRAFT' && (
            <Button type="link" size="small" onClick={() => onUpdateStatus(record.id, 'ACTIVE')}>
              激活
            </Button>
          )}
          {record.planStatus === 'ACTIVE' && (
            <Button type="link" size="small" onClick={() => onUpdateStatus(record.id, 'DONE')}>
              完成
            </Button>
          )}
          {(record.planStatus === 'DRAFT' || record.planStatus === 'ACTIVE') && (
            <Button type="link" size="small" danger onClick={() => onUpdateStatus(record.id, 'CANCELLED')}>
              取消
            </Button>
          )}
          <Popconfirm
            title="确定删除该交易计划？"
            description="删除后不可恢复"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => onRemove(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return <Alert type="error" showIcon message="加载失败" description={error} />;
  }

  if (isEmpty) {
    return <Empty description="暂无交易计划" />;
  }

  return (
    <Table<TradePlan>
      rowKey="id"
      dataSource={items}
      columns={columns}
      size="small"
      pagination={{ pageSize: 20 }}
      scroll={{ x: 1000 }}
    />
  );
}
