import { Card, Progress, Typography } from 'antd';
import type { BuildCapability } from '../model/types';

interface Props {
  capabilities: BuildCapability[];
}

export function BuildStatusCapabilityBars({ capabilities }: Props) {
  return (
    <Card title="理财工作台能力成熟度" size="small">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {capabilities.map((item) => (
          <div key={item.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <Typography.Text strong>{item.title}</Typography.Text>
              <Typography.Text type="secondary">{item.score}%</Typography.Text>
            </div>
            <Progress percent={item.score} size="small" showInfo={false} />
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              当前：{item.current}；目标：{item.target}
            </Typography.Paragraph>
          </div>
        ))}
      </div>
    </Card>
  );
}
