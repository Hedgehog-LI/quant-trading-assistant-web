/**
 * P1.9-A 区间摘要卡片：展示后端统一计算的窗口摘要，前端只格式化。
 * 涨跌颜色遵循 A 股口径：上涨红、下跌绿、平盘中性灰。
 */
import { Card, Col, Row, Skeleton, Statistic, Typography } from 'antd';
import { formatMoney, formatPrice } from '../../../shared/utils/number';
import type { MarketAssetSeriesSummary } from '../model/types';

const { Text } = Typography;

const UP_COLOR = '#f5222d';
const DOWN_COLOR = '#52c41a';
const FLAT_COLOR = '#8c8c8c';

interface Props {
  summary: MarketAssetSeriesSummary | null;
  loading: boolean;
}

function changeColor(value: number | null): string {
  if (value == null) return FLAT_COLOR;
  if (value > 0) return UP_COLOR;
  if (value < 0) return DOWN_COLOR;
  return FLAT_COLOR;
}

export function MarketAssetSummary({ summary, loading }: Props) {
  if (loading && !summary) {
    return (
      <Card size="small">
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }
  if (!summary) return null;

  const change = Number(summary.absoluteChange ?? 0);
  const rate = summary.changeRate != null ? Number(summary.changeRate) : null;

  const stat = (title: string, value: string | number) => (
    <Col xs={12} sm={8} md={6} lg={4}>
      <Statistic title={title} value={value} />
    </Col>
  );

  return (
    <Card size="small">
      <Row gutter={[16, 12]} align="top">
        {stat('开盘', formatPrice(Number(summary.firstOpen ?? 0)))}
        {stat('收盘', formatPrice(Number(summary.lastClose ?? 0)))}
        <Col xs={12} sm={8} md={6} lg={4}>
          <Statistic
            title="区间涨跌"
            value={formatPrice(Number(summary.absoluteChange ?? 0))}
            valueStyle={{ color: changeColor(change) }}
          />
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Statistic
            title="涨跌幅"
            value={rate == null ? '--' : `${(rate * 100).toFixed(2)}%`}
            valueStyle={{ color: changeColor(rate) }}
          />
        </Col>
        {stat('最高', formatPrice(Number(summary.highestHigh ?? 0)))}
        {stat('最低', formatPrice(Number(summary.lowestLow ?? 0)))}
        {stat('成交量', formatMoney(summary.totalVolume))}
        {stat('成交额', formatMoney(Number(summary.totalAmount ?? 0)))}
        {stat('K 线条数', summary.actualBarCount)}
      </Row>
      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
        涨跌为所选数据窗口的价格变化，不是投资收益，不含分红、手续费或持仓成本。
      </Text>
    </Card>
  );
}
