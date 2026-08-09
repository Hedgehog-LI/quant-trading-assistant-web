import { Card, Col, Progress, Row, Statistic, Tooltip, Typography } from 'antd';
import type { BuildOverviewStats } from '../model/selectors';

interface Props {
  stats: BuildOverviewStats;
}

interface OverviewItem {
  key: string;
  title: string;
  value: number;
  tip: string;
  color: string;
}

const VALUE_COLOR: Record<string, string> = {
  green: '#3f8600',
  blue: '#1677ff',
  gold: '#d48806',
  red: '#cf1322',
  default: 'rgba(0, 0, 0, 0.88)',
};

function buildItems(stats: BuildOverviewStats): OverviewItem[] {
  return [
    {
      key: 'deployed',
      title: '已部署可用',
      value: stats.deployed,
      tip: '叶子节点 validationStage=DEPLOYED，且有线上/部署冒烟证据',
      color: 'green',
    },
    {
      key: 'deliveredNotDeployed',
      title: '已验收待部署',
      value: stats.deliveredNotDeployed,
      tip: '叶子 deliveryStatus=DELIVERED，验证层级为运行/自动化验证，尚未部署',
      color: 'blue',
    },
    {
      key: 'inProgress',
      title: '建设中',
      value: stats.inProgress,
      tip: '叶子 deliveryStatus=IN_PROGRESS',
      color: 'gold',
    },
    {
      key: 'planned',
      title: '待开始',
      value: stats.planned,
      tip: '叶子 deliveryStatus=PLANNED 或 DESIGNED',
      color: 'default',
    },
    {
      key: 'blocked',
      title: '阻塞/风险',
      value: stats.blocked,
      tip: '叶子 deliveryStatus=BLOCKED；具体风险项见「当前行动区」',
      color: 'red',
    },
  ];
}

export function BuildStatusOverview({ stats }: Props) {
  const items = buildItems(stats);
  return (
    <div>
      <Row gutter={[12, 12]}>
        {items.map((item, index) => (
          <Col key={item.key} xs={12} sm={8} lg={index === 0 ? 8 : 4}>
            <Tooltip title={item.tip}>
              <Card size="small">
                <Statistic
                  title={item.title}
                  value={item.value}
                  valueStyle={{ color: VALUE_COLOR[item.color] }}
                />
              </Card>
            </Tooltip>
          </Col>
        ))}
      </Row>
      <Card size="small" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <Typography.Text strong>能力完成率</Typography.Text>
          <Typography.Text type="secondary">
            已验收 {stats.accepted} / 已纳入计划叶子 {stats.plannedTotal}（暂缓 {stats.deferred} 项不计入）
          </Typography.Text>
        </div>
        <Progress
          percent={stats.acceptanceRate}
          size="small"
          status={stats.acceptanceRate >= 70 ? 'success' : 'active'}
        />
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
          口径：已验收能力数 / 已纳入计划的叶子能力总数；「已验收」至少要求自动化验证通过。所有计数由叶子节点自动统计。
        </Typography.Text>
      </Card>
    </div>
  );
}
