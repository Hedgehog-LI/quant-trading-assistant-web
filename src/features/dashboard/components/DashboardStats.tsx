import { Row, Col, Statistic, Card, Tag, List, Alert, Typography } from 'antd';
import {
  StarOutlined,
  FileTextOutlined,
  BookOutlined,
  FormOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { DashboardSummary } from '../../../shared/types/domain';
import { formatPrice } from '../../../shared/utils/number';

interface Props {
  summary: DashboardSummary;
}

export function DashboardStats({ summary }: Props) {
  return (
    <div>
      <Alert
        type="info"
        message="本系统只做交易辅助记录、风控计算和复盘，不自动交易，不连接券商。"
        style={{ marginBottom: 16 }}
        showIcon
      />

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="启用自选股" value={summary.enabledWatchlistCount} prefix={<StarOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="今日计划" value={summary.activePlanCount} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="今日交易" value={summary.todayJournalCount} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="待复盘" value={summary.pendingReviewCount} prefix={<FormOutlined />} />
          </Card>
        </Col>
      </Row>

      {summary.riskWarnings.length > 0 && (
        <Alert
          type="warning"
          message="风险提醒"
          style={{ marginTop: 16 }}
          icon={<WarningOutlined />}
          showIcon
          description={
            <List
              size="small"
              dataSource={summary.riskWarnings}
              renderItem={(item) => <List.Item>{item}</List.Item>}
            />
          }
        />
      )}

      {summary.highAttentionStocks.length > 0 && (
        <Card title="高关注自选股" size="small" style={{ marginTop: 16 }}>
          <List
            size="small"
            dataSource={summary.highAttentionStocks.slice(0, 5)}
            renderItem={(item) => (
              <List.Item>
                <strong>{item.symbol}</strong> {item.name}
                {item.stopLossPrice ? (
                  <Tag color="red" style={{ marginLeft: 8 }}>止损 {formatPrice(item.stopLossPrice)}</Tag>
                ) : null}
              </List.Item>
            )}
          />
        </Card>
      )}

      {summary.todayPlans.length > 0 && (
        <Card title="今日计划" size="small" style={{ marginTop: 16 }}>
          <List
            size="small"
            dataSource={summary.todayPlans.slice(0, 5)}
            renderItem={(plan) => (
              <List.Item>
                <strong>{plan.symbol}</strong> {plan.name}
                <Tag color={plan.allowedToTrade ? 'blue' : 'default'} style={{ marginLeft: 8 }}>
                  {plan.allowedToTrade ? '允许交易' : '暂不交易'}
                </Tag>
                {plan.buyCondition && (
                  <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                    {plan.buyCondition}
                  </Typography.Text>
                )}
              </List.Item>
            )}
          />
        </Card>
      )}

      {summary.pendingReviewJournals.length > 0 && (
        <Card title="待复盘交易" size="small" style={{ marginTop: 16 }}>
          <List
            size="small"
            dataSource={summary.pendingReviewJournals.slice(0, 5)}
            renderItem={(j) => (
              <List.Item>
                {j.tradeDate} <strong>{j.symbol}</strong> {j.side === 'BUY' ? '买入' : '卖出'} {j.price} x {j.quantity}
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
}
