import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MarketAssetCatalogItem } from '../model/types';

const { Text } = Typography;

const MARKET_OPTIONS = [
  { label: '全部', value: '' },
  { label: 'A 股', value: 'CN' },
  { label: '港股', value: 'HK' },
  { label: '美股', value: 'US' },
];

function marketMatchesApi(value: string): string | undefined {
  return value || undefined;
}

function coverage(item: MarketAssetCatalogItem): string {
  const daily = item.firstDailyDate && item.lastDailyDate
    ? `日 K ${item.firstDailyDate} 至 ${item.lastDailyDate}` : null;
  const minute = item.firstMinuteTime && item.lastMinuteTime
    ? `分钟 K ${item.firstMinuteTime.slice(0, 10)} 至 ${item.lastMinuteTime.slice(0, 10)}` : null;
  return [daily, minute].filter(Boolean).join('；') || '-';
}

export function MarketAssetCatalog({
  items,
  total,
  page,
  size,
  loading,
  market,
  keyword,
  onMarketChange,
  onKeywordChange,
  onPageChange,
  onOpen,
  onRefresh,
  onCollect,
}: {
  items: MarketAssetCatalogItem[];
  total: number;
  page: number;
  size: number;
  loading: boolean;
  market: string;
  keyword: string;
  onMarketChange: (market?: string) => void;
  onKeywordChange: (keyword: string) => void;
  onPageChange: (page: number, size: number) => void;
  onOpen: (symbol: string) => void;
  onRefresh: () => void;
  onCollect: () => void;
}) {
  const columns: ColumnsType<MarketAssetCatalogItem> = [
    {
      title: '证券',
      key: 'security',
      fixed: 'left',
      width: 210,
      render: (_, item) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{item.security.displayName}</Text>
          <Text type="secondary">{item.security.canonicalSymbol}</Text>
        </Space>
      ),
    },
    {
      title: '市场',
      dataIndex: ['security', 'market'],
      width: 90,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: '已入库数据',
      key: 'counts',
      width: 220,
      render: (_, item) => (
        <Space wrap>
          {item.dailyBarCount > 0 && <Tag color="blue">日 K {item.dailyBarCount.toLocaleString()} 条</Tag>}
          {item.minuteBarCount > 0 && <Tag color="cyan">分钟 K {item.minuteBarCount.toLocaleString()} 条 / {item.minuteIntervalCount} 粒度</Tag>}
        </Space>
      ),
    },
    {
      title: '覆盖范围',
      key: 'coverage',
      width: 330,
      render: (_, item) => <Text>{coverage(item)}</Text>,
    },
    {
      title: '最近入库',
      dataIndex: 'latestFetchedAt',
      width: 190,
      render: (value: string | null) => value ? value.replace('T', ' ').slice(0, 19) : '-',
    },
    {
      title: '',
      key: 'action',
      fixed: 'right',
      width: 56,
      render: (_, item) => (
        <Tooltip title="查看行情数据">
          <Button
            type="text"
            icon={<EyeOutlined />}
            aria-label={`查看 ${item.security.canonicalSymbol}`}
            data-testid={`open-asset-${item.security.canonicalSymbol}`}
            onClick={() => onOpen(item.security.canonicalSymbol)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Segmented
            value={market}
            options={MARKET_OPTIONS}
            onChange={(value) => onMarketChange(marketMatchesApi(String(value)))}
          />
          <Input.Search
            allowClear
            defaultValue={keyword}
            placeholder="按代码或名称筛选已入库资产"
            style={{ width: 280 }}
            onSearch={onKeywordChange}
          />
        </Space>
        <Tooltip title="刷新资产目录">
          <Button icon={<ReloadOutlined />} aria-label="刷新资产目录" onClick={onRefresh} />
        </Tooltip>
      </Space>

      <Table<MarketAssetCatalogItem>
        rowKey={(item) => item.security.canonicalSymbol}
        columns={columns}
        dataSource={items}
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ current: page, pageSize: size, total, showSizeChanger: true, onChange: onPageChange }}
        locale={{
          emptyText: (
            <Empty description="尚无已入库行情资产">
              <Button type="primary" onClick={onCollect}>去行情工作台</Button>
            </Empty>
          ),
        }}
      />
    </Space>
  );
}
