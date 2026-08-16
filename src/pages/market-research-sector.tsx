/**
 * 板块详情（P1.10-A 既有能力，路由保留）：市场雷达改版为市场全景后，本页继续提供
 * 稳定板块身份的相对强弱历史详情；数据来自既有 market-research feature API。
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Alert, Button, Card, Flex, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { SectorHistoryChart } from '../features/market-research/components/SectorHistoryChart';
import { getMarketResearchSectorDetail } from '../features/market-research/api/marketResearchApi';
import type { ResearchMarket } from '../features/market-research/model/types';
import { getSettings } from '../features/settings/api/settingsApi';
import './market-research.css';

const { Title, Text } = Typography;

function percent(value: number | null | undefined, signed = false): string {
  if (value == null) return '--';
  return `${signed && value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function timeText(value: string | null | undefined): string {
  if (!value) return '--';
  return value.replace('T', ' ').slice(0, 19);
}

export function MarketResearchSectorPage() {
  const navigate = useNavigate();
  const { sectorId } = useParams();
  const [params] = useSearchParams();
  const market = (params.get('market') as ResearchMarket) || 'CN';
  const windowDays = Number(params.get('window')) || 1;
  const id = Number(sectorId);
  const detail = useQuery({
    queryKey: ['market-research', 'sector', id, market, windowDays, getSettings().apiMode],
    queryFn: () => getMarketResearchSectorDetail(id, market, windowDays, 50),
    enabled: Number.isFinite(id),
    retry: false,
  });
  const data = detail.data;

  return (
    <div className="market-research-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Button type="text" icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/market-research`)}>返回市场全景</Button>
        {detail.isError && (
          <Alert type="warning" showIcon title="暂无可用研究结果"
            description="请先完成板块收盘排行采集，再生成研究结果。" />
        )}
        <Card loading={detail.isLoading}>
          {data && (
            <>
              <Flex justify="space-between" align="flex-start" wrap gap={12}>
                <div>
                  <Title level={3}>{data.sectorName}</Title>
                  <Space wrap>
                    <Tag>{data.market}</Tag>
                    <Tag color={data.qualityStatus === 'OK' ? 'green' : 'orange'}>{data.qualityStatus}</Tag>
                    <Text type="secondary">{data.scopeDescription}</Text>
                  </Space>
                </div>
                <Space wrap>
                  <Text>{data.windowDays === 1 ? '当日强度' : `窗口 ${data.windowDays} 日`}</Text>
                  <Text>覆盖 {percent(data.coverageRate)}</Text>
                  <Text>来源 {timeText(data.sourceQuoteTime)}</Text>
                </Space>
              </Flex>
            </>
          )}
        </Card>
        <Card title={windowDays === 1 ? '每日强度历史' : '相对强弱历史'}
          extra={<Text type="secondary">百分位越高表示在同一排行样本内相对更强</Text>}>
          <SectorHistoryChart points={data?.history ?? []} oneDay={windowDays === 1} />
        </Card>
        <Alert type="info" showIcon title="当前详情只展示已验证证据"
          description="板块成交活跃度、真实资金流和板块内候选扫描尚未接入；这里不会用空数据生成结论。" />
      </Space>
    </div>
  );
}
