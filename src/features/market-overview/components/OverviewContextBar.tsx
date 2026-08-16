/**
 * 研究上下文栏：市场(CN) + 日期范围 + 查询/刷新命令 + 数据边界紧凑标签
 * （数据截至、qualityStatus、样本数、日 K 覆盖、行业映射覆盖、合格交易日、Provider、SAMPLE 范围）。
 * 不堆免责声明：边界详情折叠进 Popover。
 */
import { Button, DatePicker, Popover, Space, Tag, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { dash, formatPercent } from '../model/formatters';
import type { MarketOverviewMetadata } from '../model/types';

const { Text } = Typography;

const STATUS_META: Record<string, { label: string; color: string }> = {
  OK: { label: 'OK', color: 'green' },
  DEGRADED: { label: 'DEGRADED', color: 'orange' },
  NO_DATA: { label: 'NO_DATA', color: 'red' },
};

interface Props {
  start: string;
  end: string;
  onSearch: (start: string, end: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  metadata: MarketOverviewMetadata | null;
  loading: boolean;
}

export function OverviewContextBar({ start, end, onSearch, onRefresh, refreshing, metadata, loading }: Props) {
  const [rangeStart, rangeEnd] = [dayjs(start), dayjs(end)];
  const status = metadata ? STATUS_META[metadata.qualityStatus] ?? { label: metadata.qualityStatus, color: 'default' } : null;

  return (
    <div className="overview-context-bar" data-testid="overview-context-bar">
      <Space wrap size={[12, 8]}>
        <Tag color="blue">CN</Tag>
        <DatePicker.RangePicker
          value={[rangeStart, rangeEnd]}
          allowClear={false}
          onChange={(values) => {
            if (values?.[0] && values?.[1]) {
              onSearch(values[0].format('YYYY-MM-DD'), values[1].format('YYYY-MM-DD'));
            }
          }}
          data-testid="overview-range-picker"
        />
        <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => onSearch(start, end)}>
          查询
        </Button>
        <Button icon={<ReloadOutlined />} loading={refreshing} onClick={onRefresh}>刷新</Button>
      </Space>
      {metadata && (
        <Space wrap size={[14, 6]} className="overview-context-bar__stats">
          <Text type="secondary">数据截至 <Text strong>{metadata.dataAsOf ?? '--'}</Text></Text>
          {status && <Tag color={status.color} data-testid="overview-quality-status">{status.label}</Tag>}
          <Text type="secondary">样本 <Text strong>{metadata.sampleSize}</Text></Text>
          <Text type="secondary">日K覆盖 <Text strong>{dash(formatPercent(metadata.barCoverage))}</Text></Text>
          <Text type="secondary">行业映射 <Text strong>{dash(formatPercent(metadata.membershipCoverage))}</Text></Text>
          <Text type="secondary">
            合格交易日 <Text strong>{metadata.qualifiedTradingDays}</Text>
            <Text type={metadata.qualifiedTradingDays >= 120 ? 'secondary' : 'warning'}>/120</Text>
          </Text>
          {metadata.providerCodes.map((provider) => (
            <Tag key={provider}>{provider}</Tag>
          ))}
          <Popover
            title={`${metadata.dataScope} 数据边界`}
            content={
              <ul className="overview-context-bar__limitations">
                {metadata.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
              </ul>
            }
          >
            <Tag color="geekblue" style={{ cursor: 'pointer' }}>{metadata.dataScope} · 边界详情</Tag>
          </Popover>
        </Space>
      )}
    </div>
  );
}
