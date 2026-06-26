import { Card, Col, Progress, Row, Statistic, Tag, Typography } from 'antd';
import type { BuildSummaryCard } from '../model/types';
import { STATUS_COLOR, STATUS_LABEL } from '../model/meta';

interface Props {
  cards: BuildSummaryCard[];
}

export function BuildStatusSummary({ cards }: Props) {
  return (
    <Row gutter={[16, 16]}>
      {cards.map((card) => (
        <Col key={card.title} xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title={card.title} value={card.value} />
            <Tag color={STATUS_COLOR[card.status]} style={{ marginTop: 8 }}>
              {STATUS_LABEL[card.status]}
            </Tag>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, minHeight: 44 }}>
              {card.description}
            </Typography.Paragraph>
            <Progress
              percent={card.status === 'DONE' ? 100 : card.status === 'RISK' ? 62 : 45}
              showInfo={false}
              size="small"
              status={card.status === 'RISK' ? 'exception' : 'active'}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
