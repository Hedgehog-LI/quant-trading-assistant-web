import { Row, Col, Card, Statistic, Alert, Empty } from 'antd';
import type { PortfolioSummary } from '../model/types';
import { pnlColor, PNL_COLOR_HEX } from '../model/types';
import { formatMoney, formatPercent, formatPointPercent } from '../../../shared/utils/number';

interface Props {
  summary: PortfolioSummary | null;
}

/**
 * 账本概览：盈亏 / 成本市值 / 统计指标卡片 + 数据告警。
 * 盈亏按 A 股习惯着色（盈利红、亏损绿）。
 */
export function PortfolioSummaryCards({ summary }: Props) {
  if (!summary) {
    return <Empty description="暂无汇总数据" />;
  }
  const hex = (v: number) => PNL_COLOR_HEX[pnlColor(v)];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="累计已实现盈亏" value={formatMoney(summary.realizedPnl)} valueStyle={{ color: hex(summary.realizedPnl) }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="当前浮动盈亏" value={formatMoney(summary.unrealizedPnl)} valueStyle={{ color: hex(summary.unrealizedPnl) }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="总盈亏" value={formatMoney(summary.totalPnl)} valueStyle={{ color: hex(summary.totalPnl) }} />
          </Card>
        </Col>

        <Col span={8}>
          <Card size="small">
            <Statistic title="当前持仓成本" value={formatMoney(summary.currentCost)} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="估算市值" value={formatMoney(summary.currentMarketValue)} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="已结算次数" value={summary.closedTradeCount} />
          </Card>
        </Col>

        <Col span={8}>
          <Card size="small">
            <Statistic title="胜率" value={formatPercent(summary.winRate)} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="平均收益率" value={formatPointPercent(summary.averageReturnPoint)} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="平均持仓天数" value={`${summary.averageHoldingDays.toFixed(1)} 天`} />
          </Card>
        </Col>
      </Row>

      {summary.warnings.length > 0 && (
        <Alert
          type="warning"
          title="数据提示"
          description={
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {summary.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          }
          style={{ marginTop: 16 }}
          showIcon
        />
      )}
    </div>
  );
}
