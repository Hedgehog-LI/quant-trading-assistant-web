/**
 * 市场全景（MR-1B，/market-research 正式改版）。
 *
 * 消费 MR-1A 正式 API GET /api/v1/market-research/overview，按机构化研究顺序呈现五类核心证据：
 * 基准趋势与回撤 → 成交活跃度/价格冲击代理 → 市场广度 → 行业成交占比迁移 → 数据质量。
 * 旧"市场雷达"结构已被本页替换；板块详情路由保留（market-research-sector.tsx）。
 * 状态纪律：loading/error/NO_DATA/DEGRADED 全覆盖；null 显示 '--' 或断点，禁止 0 冒充；
 * remote 失败不回退 mock；行业迁移阻断时渲染明确空态而非伪图。
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActivityLiquidityChart } from '../features/market-overview/components/ActivityLiquidityChart';
import { BenchmarkTrendChart } from '../features/market-overview/components/BenchmarkTrendChart';
import { BreadthChart } from '../features/market-overview/components/BreadthChart';
import { IndustryMigrationChart } from '../features/market-overview/components/IndustryMigrationChart';
import { OverviewContextBar } from '../features/market-overview/components/OverviewContextBar';
import { QualityPanel } from '../features/market-overview/components/QualityPanel';
import { useMarketOverview } from '../features/market-overview/hooks/useMarketOverview';
import type { OverviewMarket } from '../features/market-overview/api/marketOverviewApi';
import './market-overview.css';

const { Title, Text } = Typography;

/** 默认窗口：最近 90 个自然日（覆盖一个季度；无数据时用户调整范围）。 */
function defaultRange(): { start: string; end: string } {
  const end = dayjs();
  return { start: end.subtract(89, 'day').format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') };
}

export function MarketResearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const fallback = defaultRange();
  const start = searchParams.get('start') ?? fallback.start;
  const end = searchParams.get('end') ?? fallback.end;
  const market: OverviewMarket = 'CN';
  const [pendingRange, setPendingRange] = useState<{ start: string; end: string }>({ start, end });

  const overview = useMarketOverview(market, start, end);
  const data = overview.data;
  const metadata = data?.metadata ?? null;
  const loading = overview.isLoading;
  const noData = metadata?.qualityStatus === 'NO_DATA';

  const commitRange = (nextStart: string, nextEnd: string) => {
    setPendingRange({ start: nextStart, end: nextEnd });
    setSearchParams({ start: nextStart, end: nextEnd });
  };

  const refresh = async () => {
    await overview.refetch();
  };

  const invalidateAndRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['market-overview'] });
  };

  const migrationBlocked = data?.quality.qualityFindings.some(
    (finding) => finding.code === 'INDUSTRY_MIGRATION_BLOCKED',
  ) ?? false;
  const blockedFinding = data?.quality.qualityFindings.find(
    (finding) => finding.code === 'INDUSTRY_MIGRATION_BLOCKED',
  );

  return (
    <div className="market-overview-page">
      <div className="overview-page-header">
        <Title level={3}>市场全景</Title>
        <Text type="secondary">
          趋势与回撤 → 成交活跃度 → 市场广度 → 行业交易注意力迁移；自上而下核对证据后再下结论。
        </Text>
      </div>

      <OverviewContextBar
        start={pendingRange.start}
        end={pendingRange.end}
        onSearch={commitRange}
        onRefresh={() => void (overview.isFetching ? undefined : refresh())}
        refreshing={overview.isFetching}
        metadata={metadata}
        loading={loading}
      />

      {overview.isError && (
        <Alert
          type="error" showIcon
          title="市场全景数据加载失败"
          description={overview.error instanceof Error ? overview.error.message : '请检查后端连接后重试。'}
          action={<Button icon={<ReloadOutlined />} onClick={() => void invalidateAndRefresh()}>重试</Button>}
          style={{ marginBottom: 14 }}
        />
      )}

      {loading && (
        <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>
      )}

      {!loading && overview.isError && (
        <Card>
          <Empty description="市场全景暂不可用：请确认后端已启动并重试。" />
        </Card>
      )}

      {!loading && !overview.isError && noData && (
        <Card>
          <Empty
            data-testid="overview-no-data"
            description="窗口内没有基准指数日 K（NO_DATA）：无法推导交易日，未渲染任何图表。请调整日期范围到已有数据的区间。"
          />
        </Card>
      )}

      {!loading && !overview.isError && data && !noData && (
        <>
          <Card
            className="overview-section"
            title={<Space size={8}>基准趋势与回撤<span className="overview-section__hint">{metadata?.benchmarkSymbol} · MA20/MA60 与成交额、回撤分面共享时间轴</span></Space>}
            extra={<Text type="secondary">null 指标为断点</Text>}
          >
            <BenchmarkTrendChart series={data.benchmarkSeries} />
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card
                className="overview-section"
                title={<Space size={8}>流动性与交易活跃度<span className="overview-section__hint">样本域成交额 · 20/60 日中位 · 活跃度比值 · 成交扩散</span></Space>}
              >
                <ActivityLiquidityChart activity={data.activitySeries} liquidityDays={data.liquidityProxySeries.days} />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card
                className="overview-section"
                title={<Space size={8}>市场广度<span className="overview-section__hint">上涨占比 · 涨跌家数 · A/D 线 · 高于 MA20 占比</span></Space>}
              >
                <BreadthChart series={data.breadthSeries} />
              </Card>
            </Col>
          </Row>

          <Card
            className="overview-section"
            title={<Space size={8}>行业成交占比迁移<span className="overview-section__hint">每日 Top-8 + 其他 · 交易注意力迁移，不是资金净流入</span></Space>}
          >
            {migrationBlocked ? (
              <Empty
                data-testid="overview-migration-blocked"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={`行业成交占比迁移已阻断（INDUSTRY_MIGRATION_BLOCKED）：${blockedFinding?.message ?? '行业映射覆盖严重不足'}；不渲染行业图。`}
              />
            ) : data.industryTurnoverMigration.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="窗口内没有行业成交占比数据" />
            ) : (
              <IndustryMigrationChart rows={data.industryTurnoverMigration} />
            )}
          </Card>

          <Card className="overview-section" title="数据质量与可解释状态">
            <QualityPanel quality={data.quality} qualityStatus={metadata?.qualityStatus ?? 'OK'} />
          </Card>
        </>
      )}
    </div>
  );
}
