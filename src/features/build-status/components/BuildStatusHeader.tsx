import { Col, Descriptions, Row, Tag, Typography } from 'antd';
import type { BuildStatusSnapshot } from '../model/types';

interface Props {
  snapshot: BuildStatusSnapshot;
}

/**
 * 状态基线：看板数据截至时间、前后端基线提交、当前建设阶段、最近一次交付。
 * 这是静态发布快照，不是实时研发管理系统。
 */
export function BuildStatusHeader({ snapshot }: Props) {
  const latestDelivery = snapshot.recentDeliveries[0];

  return (
    <div>
      <Row gutter={[16, 8]} align="middle">
        <Col xs={24} lg={16}>
          <Descriptions
            column={{ xs: 1, sm: 2, lg: 4 }}
            size="small"
            bordered
            items={[
              { key: 'snapshotAt', label: '数据截至', children: snapshot.snapshotAt },
              {
                key: 'backend',
                label: '后端基线',
                children: <Typography.Text code>{snapshot.backendCommit}</Typography.Text>,
              },
              {
                key: 'frontend',
                label: '前端基线',
                children: <Typography.Text code>{snapshot.frontendCommit}</Typography.Text>,
              },
              {
                key: 'releaseStage',
                label: '当前阶段',
                children: <Tag color="blue">{snapshot.releaseStage}</Tag>,
              },
            ]}
          />
        </Col>
        <Col xs={24} lg={8}>
          {latestDelivery ? (
            <Descriptions
              column={1}
              size="small"
              items={[
                {
                  key: 'latest',
                  label: '最近一次交付',
                  children: `${latestDelivery.title}（${latestDelivery.deliveredAt}）`,
                },
              ]}
            />
          ) : null}
        </Col>
      </Row>
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        静态发布快照 · 随版本发布的项目元数据，非实时研发管理系统；完整事实以
        docs/development/DEVELOPMENT_LOG.md 与 docs/acceptance/ACCEPTANCE_LOG.md 为准。
      </Typography.Text>
    </div>
  );
}
