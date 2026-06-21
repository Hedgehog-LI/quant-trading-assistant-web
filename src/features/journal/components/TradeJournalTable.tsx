import { Table, Tag, Button } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TradeJournal, TradeSide, EmotionTag, ReviewStatus } from '../../../shared/types/domain';
import { TRADE_SIDE_MAP, REVIEW_STATUS_MAP, EMOTION_TAG_MAP } from '../model/options';
import { formatPrice, formatMoney } from '../../../shared/utils/number';
import { normalizeTotalFee } from '../../../shared/utils/fee';

interface Props {
  items: TradeJournal[];
  onEdit: (item: TradeJournal) => void;
}

export function TradeJournalTable({ items, onEdit }: Props) {
  const columns: ColumnsType<TradeJournal> = [
    {
      title: '日期',
      dataIndex: 'tradeDate',
      width: 100,
    },
    {
      title: '代码',
      dataIndex: 'symbol',
      width: 90,
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: '方向',
      dataIndex: 'side',
      width: 70,
      render: (v: string) => {
        const opt = TRADE_SIDE_MAP.get(v as TradeSide);
        return opt ? <Tag color={opt.color}>{opt.label}</Tag> : v;
      },
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 90,
      align: 'right',
      render: (v: number) => formatPrice(v),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 80,
      align: 'right',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 110,
      align: 'right',
      render: (v: number) => formatMoney(v),
    },
    {
      title: '总费用',
      key: 'totalFee',
      width: 90,
      align: 'right',
      render: (_: unknown, record: TradeJournal) => {
        const fee = normalizeTotalFee(record);
        return fee ? formatMoney(fee) : '-';
      },
    },
    {
      title: '情绪',
      dataIndex: 'emotionTags',
      width: 120,
      render: (tags: string[]) =>
        tags?.map((t) => {
          const opt = EMOTION_TAG_MAP.get(t as EmotionTag);
          return opt ? <Tag key={t} color={opt.color}>{opt.label}</Tag> : null;
        }),
    },
    {
      title: '复盘状态',
      dataIndex: 'reviewStatus',
      width: 80,
      render: (v: string) => {
        const opt = REVIEW_STATUS_MAP.get(v as ReviewStatus);
        return opt ? <Tag color={opt.color}>{opt.label}</Tag> : v;
      },
    },
    {
      title: '按计划',
      dataIndex: 'followedPlan',
      width: 70,
      render: (v: boolean | undefined) =>
        v === undefined ? '-' : v ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>,
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, record: TradeJournal) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <Table<TradeJournal>
      rowKey="id"
      dataSource={items}
      columns={columns}
      size="small"
      pagination={{ pageSize: 20 }}
      scroll={{ x: 1100 }}
    />
  );
}
