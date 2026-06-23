import { Table, Button, Tag, Empty, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { EntityId, ReviewNote } from '../../../shared/types/domain';

interface Props {
  items: ReviewNote[];
  onEdit: (item: ReviewNote) => void;
  onRemove: (id: EntityId) => void;
}

export function ReviewTable({ items, onEdit, onRemove }: Props) {
  const columns: ColumnsType<ReviewNote> = [
    {
      title: '日期',
      dataIndex: 'reviewDate',
      width: 100,
    },
    {
      title: '股票',
      dataIndex: 'symbol',
      width: 90,
      render: (v: string | undefined) => v ? <strong>{v}</strong> : <Tag>每日总复盘</Tag>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 180,
      ellipsis: true,
    },
    {
      title: '市场环境',
      dataIndex: 'marketContext',
      width: 180,
      ellipsis: true,
    },
    {
      title: '做对了什么',
      dataIndex: 'rightThings',
      width: 160,
      ellipsis: true,
    },
    {
      title: '做错了什么',
      dataIndex: 'wrongThings',
      width: 160,
      ellipsis: true,
    },
    {
      title: '关联交易',
      dataIndex: 'linkedJournalIds',
      width: 90,
      render: (ids: EntityId[]) => ids?.length > 0 ? `${ids.length} 条` : '-',
    },
    {
      title: '操作',
      width: 130,
      render: (_: unknown, record: ReviewNote) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除该复盘记录？"
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

  return (
    <Table<ReviewNote>
      rowKey="id"
      dataSource={items}
      columns={columns}
      size="small"
      pagination={{ pageSize: 20 }}
      scroll={{ x: 1000 }}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无复盘记录" /> }}
    />
  );
}
