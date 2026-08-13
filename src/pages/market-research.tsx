import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
  type TableColumnsType,
} from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { MarketHeatmap } from '../features/market-research/components/MarketHeatmap';
import { RotationMatrix } from '../features/market-research/components/RotationMatrix';
import { SectorHistoryChart } from '../features/market-research/components/SectorHistoryChart';
import {
  calculateMarketResearch,
  getMarketResearchRadar,
  getMarketResearchReadiness,
  getMarketResearchSectorDetail,
} from '../features/market-research/api/marketResearchApi';
import type {
  MarketResearchSector,
  ResearchMarket,
  RotationState,
} from '../features/market-research/model/types';
import { getSettings } from '../features/settings/api/settingsApi';
import './market-research.css';

const { Title, Text } = Typography;
const WINDOWS = [5, 10, 20, 50];
const STATE_META: Record<RotationState, { label: string; color: string }> = {
  LEADING: { label: '领先', color: 'red' },
  IMPROVING: { label: '改善', color: 'blue' },
  WEAKENING: { label: '转弱', color: 'orange' },
  LAGGING: { label: '落后', color: 'default' },
  INSUFFICIENT_DATA: { label: '样本不足', color: 'default' },
};

function percent(value: number | null | undefined, signed = false): string {
  if (value == null) return '--';
  return `${signed && value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function timeText(value: string | null | undefined): string {
  if (!value) return '--';
  return value.replace('T', ' ').slice(0, 19);
}

function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Alert
      type="warning"
      showIcon
      title="暂无可用研究结果"
      description={error instanceof Error ? error.message : '请先完成板块收盘排行采集，再生成研究结果。'}
      action={<Button icon={<ReloadOutlined />} onClick={retry}>重试</Button>}
    />
  );
}

function ResearchScopeBar({ market, windowDays }: { market: ResearchMarket; windowDays: number }) {
  const readiness = useQuery({
    queryKey: ['market-research', 'readiness', market, getSettings().apiMode],
    queryFn: () => getMarketResearchReadiness(market),
  });
  if (!readiness.data) return null;
  const data = readiness.data;
  return (
    <div className="research-scope-bar">
      <Space wrap size={[8, 6]}>
        <Tag color={data.qualityStatus === 'OK' ? 'green' : 'orange'}>{data.qualityStatus}</Tag>
        <Text>{data.scopeDescription}</Text>
        <Text type="secondary">窗口 {windowDays} 日强度 + 5 日动量</Text>
        <Text type="secondary">样本 {data.actualItemCount ?? 0}/{data.expectedItemCount ?? '--'}</Text>
        <Text type="secondary">来源时间 {timeText(data.sourceQuoteTime)}</Text>
      </Space>
    </div>
  );
}

function RadarSummary({ sectors }: { sectors: MarketResearchSector[] }) {
  const count = (state: RotationState) => sectors.filter((sector) => sector.rotationState === state).length;
  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} md={6}><Statistic title="领先" value={count('LEADING')} styles={{ content: { color: '#b42318' } }} /></Col>
      <Col xs={12} md={6}><Statistic title="改善" value={count('IMPROVING')} styles={{ content: { color: '#175cd3' } }} /></Col>
      <Col xs={12} md={6}><Statistic title="转弱" value={count('WEAKENING')} styles={{ content: { color: '#b54708' } }} /></Col>
      <Col xs={12} md={6}><Statistic title="落后" value={count('LAGGING')} styles={{ content: { color: '#475467' } }} /></Col>
    </Row>
  );
}

function SectorEvidence({ sector }: { sector: MarketResearchSector }) {
  return (
    <Space orientation="vertical" size={0} className="sector-evidence">
      {sector.evidence.slice(0, 2).map((item) => <Text key={item}>{item}</Text>)}
      <Text type="secondary">领涨样本：{sector.leadingName ?? '--'} {sector.leadingSymbol ?? ''}</Text>
    </Space>
  );
}

function sectorColumns(onOpen: (sector: MarketResearchSector) => void): TableColumnsType<MarketResearchSector> {
  return [
    { title: '排名', dataIndex: 'currentRank', width: 74, sorter: (a, b) => (a.currentRank ?? 999) - (b.currentRank ?? 999) },
    { title: '板块', dataIndex: 'sectorName', width: 150, render: (value, row) => <Button type="link" onClick={() => onOpen(row)}>{value}</Button> },
    {
      title: '状态', dataIndex: 'rotationState', width: 92,
      filters: Object.entries(STATE_META).map(([value, meta]) => ({ text: meta.label, value })),
      onFilter: (value, row) => row.rotationState === value,
      render: (value: RotationState) => <Tag color={STATE_META[value].color}>{STATE_META[value].label}</Tag>,
    },
    {
      title: 'RS 百分位', dataIndex: 'rsRankPercentile', width: 130,
      sorter: (a, b) => (a.rsRankPercentile ?? -1) - (b.rsRankPercentile ?? -1),
      render: (value: number | null) => <Progress percent={(value ?? 0) * 100} size="small" format={() => percent(value)} />,
    },
    {
      title: '短期变化', dataIndex: 'rankPercentileChange', width: 100,
      sorter: (a, b) => (a.rankPercentileChange ?? -1) - (b.rankPercentileChange ?? -1),
      render: (value: number | null) => <Text className={(value ?? 0) >= 0 ? 'research-up' : 'research-down'}>{percent(value, true)}</Text>,
    },
    {
      title: '头部占用', dataIndex: 'topBucketOccupancyRate', width: 100,
      sorter: (a, b) => (a.topBucketOccupancyRate ?? -1) - (b.topBucketOccupancyRate ?? -1),
      render: (value: number | null) => percent(value),
    },
    {
      title: '连续性', width: 96,
      render: (_, row) => row.consecutiveLeadingDays > 0
        ? `领 ${row.consecutiveLeadingDays} 日`
        : row.consecutiveLaggingDays > 0 ? `弱 ${row.consecutiveLaggingDays} 日` : '--',
    },
    { title: '证据', render: (_, row) => <SectorEvidence sector={row} /> },
  ];
}

export function MarketResearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [market, setMarket] = useState<ResearchMarket>(() => (searchParams.get('market') as ResearchMarket) || 'CN');
  const [windowDays, setWindowDays] = useState(() => Number(searchParams.get('window')) || 20);
  const mode = getSettings().apiMode;
  const radar = useQuery({
    queryKey: ['market-research', 'radar', market, windowDays, mode],
    queryFn: () => getMarketResearchRadar(market, windowDays),
    retry: false,
  });
  const calculation = useMutation({
    mutationFn: () => calculateMarketResearch(market, windowDays),
    onSuccess: async (result) => {
      message.success(result.reused ? '已复用同一数据批次的研究结果' : '研究结果已生成');
      await queryClient.invalidateQueries({ queryKey: ['market-research'] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : '生成研究结果失败'),
  });
  const sectors = radar.data?.sectors ?? [];
  const openSector = (sector: MarketResearchSector) => {
    navigate(`/market-research/sectors/${sector.sectorId}?market=${market}&window=${windowDays}`);
  };
  const changeScope = (nextMarket: ResearchMarket, nextWindow: number) => {
    setMarket(nextMarket);
    setWindowDays(nextWindow);
    setSearchParams({ market: nextMarket, window: String(nextWindow) });
  };

  return (
    <div className="market-research-page">
      {mode === 'mock' && <div className="research-demo-watermark" aria-hidden="true">LOCAL_DEMO</div>}
      <Flex justify="space-between" align="flex-start" wrap gap={12} className="research-page-header">
        <div>
          <Title level={3}>市场雷达</Title>
          <Text type="secondary">先看板块轮动方向，再进入板块核对证据。状态仅用于研究，不构成投资建议。</Text>
        </div>
        <Space wrap>
          <Segmented<ResearchMarket> value={market} options={['CN', 'HK', 'US']} onChange={(value) => changeScope(value, windowDays)} />
          <Select value={windowDays} style={{ width: 118 }} options={WINDOWS.map((value) => ({ value, label: `${value} 日强度` }))}
            onChange={(value) => changeScope(market, value)} />
          <Button icon={<ReloadOutlined />} onClick={() => void radar.refetch()}>刷新</Button>
          <Button type="primary" icon={<SyncOutlined />} loading={calculation.isPending} onClick={() => calculation.mutate()}>生成结果</Button>
        </Space>
      </Flex>

      {mode === 'mock' && <Alert type="warning" showIcon title="LOCAL_DEMO 演示研究数据" description="使用虚构板块和证券，不代表真实市场；切换后端模式后只展示数据库已发布结果。" />}
      <ResearchScopeBar market={market} windowDays={windowDays} />

      {radar.isError && <ErrorState error={radar.error} retry={() => void radar.refetch()} />}
      {!radar.isError && (
        <>
          <Card size="small" loading={radar.isLoading} className="research-summary-card">
            <RadarSummary sectors={sectors} />
          </Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={11}>
              <Card title="板块热力" extra={<Text type="secondary">等面积 · 颜色=窗口相对收益</Text>} className="research-panel">
                <MarketHeatmap sectors={sectors} onSelect={openSector} />
              </Card>
            </Col>
            <Col xs={24} xl={13}>
              <Card title="轮动矩阵" extra={<Text type="secondary">横轴=中期强度 · 纵轴=短期位次变化</Text>} className="research-panel">
                <RotationMatrix sectors={sectors} onSelect={openSector} />
              </Card>
            </Col>
          </Row>
          <Card title="板块排行与证据" className="research-table-card"
            extra={<Text type="secondary">截至 {radar.data?.asOfDate ?? '--'} · 来源 {timeText(radar.data?.sourceQuoteTime)}</Text>}>
            {sectors.length === 0 ? <Empty description="当前发布批次没有板块结果" /> : (
              <Table rowKey="sectorId" columns={sectorColumns(openSector)} dataSource={sectors}
                pagination={{ pageSize: 12, showSizeChanger: false }} scroll={{ x: 1050 }} size="small" />
            )}
          </Card>
          {radar.data?.flowMetricNature === 'UNAVAILABLE' && (
            <Alert type="info" showIcon title="当前没有可验证的真实资金流口径" description="本页使用相对强弱和排行持续性，不把成交活跃度或缺失值包装成资金流。" />
          )}
        </>
      )}
    </div>
  );
}

export function MarketResearchSectorPage() {
  const navigate = useNavigate();
  const { sectorId } = useParams();
  const [params] = useSearchParams();
  const market = (params.get('market') as ResearchMarket) || 'CN';
  const windowDays = Number(params.get('window')) || 20;
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
      {getSettings().apiMode === 'mock' && <div className="research-demo-watermark" aria-hidden="true">LOCAL_DEMO</div>}
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Button type="text" icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/market-research?market=${market}&window=${windowDays}`)}>返回市场雷达</Button>
        {detail.isError && <ErrorState error={detail.error} retry={() => void detail.refetch()} />}
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
                  <Text>窗口 {data.windowDays} 日</Text>
                  <Text>覆盖 {percent(data.coverageRate)}</Text>
                  <Text>来源 {timeText(data.sourceQuoteTime)}</Text>
                </Space>
              </Flex>
              <Row gutter={[12, 12]} className="sector-detail-stats">
                <Col xs={12} md={6}><Statistic title="领先样本" value={data.leadingName ?? '--'} /></Col>
                <Col xs={12} md={6}><Statistic title="领先代码" value={data.leadingSymbol ?? '--'} /></Col>
                <Col xs={12} md={6}><Statistic title="跟踪证券" value={data.trackingSymbol ?? '--'} /></Col>
                <Col xs={12} md={6}><Statistic title="有效样本" value={`${data.actualItemCount}/${data.expectedItemCount}`} /></Col>
              </Row>
            </>
          )}
        </Card>
        <Card title="相对强弱历史" extra={<Text type="secondary">百分位越高表示在同一排行样本内相对更强</Text>}>
          <SectorHistoryChart points={data?.history ?? []} />
        </Card>
        <Alert type="info" showIcon title="当前详情只展示已验证证据" description="板块成交活跃度、真实资金流和板块内候选扫描尚未接入；这里不会用空数据生成结论。" />
      </Space>
    </div>
  );
}
