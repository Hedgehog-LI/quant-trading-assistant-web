import { Card, Tag, Typography } from 'antd';
import { MATURITY_COLOR, MATURITY_LABEL, PRIORITY_COLOR, STATUS_COLOR, STATUS_LABEL } from '../model/meta';
import type { BuildMaturity, BuildPriority, BuildStatus } from '../model/types';

const priorities: BuildPriority[] = ['P0', 'P1', 'P2', 'P3'];
const statuses: BuildStatus[] = ['DONE', 'IN_PROGRESS', 'TODO', 'RISK', 'BLOCKED'];
const maturities: BuildMaturity[] = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5'];

export function BuildStatusLegend() {
  return (
    <Card title="图例" size="small">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <Typography.Text type="secondary">优先级：</Typography.Text>
          {priorities.map((priority) => (
            <Tag key={priority} color={PRIORITY_COLOR[priority]}>
              {priority}
            </Tag>
          ))}
        </div>
        <div>
          <Typography.Text type="secondary">状态：</Typography.Text>
          {statuses.map((status) => (
            <Tag key={status} color={STATUS_COLOR[status]}>
              {STATUS_LABEL[status]}
            </Tag>
          ))}
        </div>
        <div>
          <Typography.Text type="secondary">成熟度：</Typography.Text>
          {maturities.map((maturity) => (
            <Tag key={maturity} color={MATURITY_COLOR[maturity]}>
              {maturity} {MATURITY_LABEL[maturity]}
            </Tag>
          ))}
        </div>
      </div>
    </Card>
  );
}
