import { Table, Tag, Space, Input, DatePicker } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { ClosedTrade } from '../model/types';
import type { ClosedTradeFilter } from '../api/portfolioApi';
import { pnlColor, PNL_COLOR_HEX } from '../model/types';
import { formatMoney, formatPrice, formatPointPercent } from '../../../shared/utils/number';

interface Props {
  closedTrades: ClosedTrade[];
  filters: ClosedTradeFilter;
  setFilters: (f: Partial<ClosedTradeFilter>) => void;
}

/** 已结算交易表 + 筛选条（股票代码 + 卖出日期区间）。收益率列醒目展示。 */
export function ClosedTradeTable({ closedTrades, filters, setFilters }: Props) {
  const columns: ColumnsType<ClosedTrade> = [
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
    { title: '买入日期', dataIndex: 'buyDate', width: 100 },
    { title: '卖出日期', dataIndex: 'sellDate', width: 100 },
    { title: '持有天数', dataIndex: 'holdingDays', width: 80, align: 'right' },
    { title: '数量', dataIndex: 'quantity', width: 80, align: 'right' },
    {
      title: '买入均价',
      dataIndex: 'buyAveragePrice',
      width: 90,
      align: 'right',
      render: (v: number) => formatPrice(v),
    },
    {
      title: '卖出均价',
      dataIndex: 'sellAveragePrice',
      width: 90,
      align: 'right',
      render: (v: number) => formatPrice(v),
    },
    {
      title: '成本',
      dataIndex: 'costAmount',
      width: 100,
      align: 'right',
      render: (v: number) => formatMoney(v),
    },
    {
      title: '收入',
      dataIndex: 'sellAmount',
      width: 100,
      align: 'right',
      render: (v: number) => formatMoney(v),
    },
    {
      title: '费用',
      dataIndex: 'totalFee',
      width: 90,
      align: 'right',
      render: (v: number) => formatMoney(v),
    },
    {
      title: '实现盈亏',
      dataIndex: 'realizedPnl',
      width: 110,
      align: 'right',
      render: (v: number) => <span style={{ color: PNL_COLOR_HEX[pnlColor(v)] }}>{formatMoney(v)}</span>,
    },
    {
      title: '赚了几个点',
      dataIndex: 'returnPoint',
      width: 110,
      align: 'right',
      render: (v: number) => (
        <span style={{ color: PNL_COLOR_HEX[pnlColor(v)], fontWeight: 600 }}>{formatPointPercent(v)}</span>
      ),
    },
    {
      title: '是否盈利',
      dataIndex: 'realizedPnl',
      width: 80,
      render: (v: number) => {
        const c = pnlColor(v);
        if (c === 'red') return <Tag color="red">盈利</Tag>;
        if (c === 'green') return <Tag color="green">亏损</Tag>;
        return <Tag>持平</Tag>;
      },
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索代码"
          prefix={<SearchOutlined />}
          value={filters.symbol ?? ''}
          onChange={(e) => setFilters({ symbol: e.target.value })}
          style={{ width: 180 }}
          allowClear
        />
        <DatePicker
          placeholder="卖出起始"
          value={filters.fromDate ? dayjs(filters.fromDate) : null}
          onChange={(d) => setFilters({ fromDate: d ? d.format('YYYY-MM-DD') : undefined })}
        />
        <DatePicker
          placeholder="卖出截止"
          value={filters.toDate ? dayjs(filters.toDate) : null}
          onChange={(d) => setFilters({ toDate: d ? d.format('YYYY-MM-DD') : undefined })}
        />
      </Space>
      <Table<ClosedTrade>
        rowKey={(r) => `${r.symbol}-${r.sellDate}-${r.sellJournalId}`}
        dataSource={closedTrades}
        columns={columns}
        size="small"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1400 }}
      />
    </div>
  );
}
