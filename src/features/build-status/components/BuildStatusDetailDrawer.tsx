import { Alert, Descriptions, Drawer, Progress, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { BuildStatusNode } from '../model/types';
import {
  DATA_OWNERSHIP_COLOR,
  DATA_OWNERSHIP_LABEL,
  MATURITY_COLOR,
  MATURITY_LABEL,
  PRIORITY_COLOR,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../model/meta';

interface Props {
  node: BuildStatusNode | null;
  onClose: () => void;
}

interface DetailBlockProps {
  title: string;
  children: ReactNode;
}

function DetailBlock({ title, children }: DetailBlockProps) {
  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '12px 16px' }}>
      <Typography.Text strong>{title}</Typography.Text>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

function TextListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <DetailBlock title={title}>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </DetailBlock>
  );
}

export function BuildStatusDetailDrawer({ node, onClose }: Props) {
  return (
    <Drawer
      title={node ? node.title : '建设详情'}
      open={!!node}
      onClose={onClose}
      size="large"
      destroyOnClose
    >
      {node && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Space wrap>
            <Tag color={PRIORITY_COLOR[node.priority]}>{node.priority}</Tag>
            <Tag color={STATUS_COLOR[node.status]}>{STATUS_LABEL[node.status]}</Tag>
            <Tag color={MATURITY_COLOR[node.maturity]}>
              {node.maturity} {MATURITY_LABEL[node.maturity]}
            </Tag>
            <Tag color={DATA_OWNERSHIP_COLOR[node.dataOwnership]}>
              {DATA_OWNERSHIP_LABEL[node.dataOwnership]}
            </Tag>
          </Space>

          <div>
            <Typography.Text type="secondary">建设进度</Typography.Text>
            <Progress percent={node.progress} />
          </div>

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="用户价值">{node.productValue}</Descriptions.Item>
            <Descriptions.Item label="后端状态">{node.backendState}</Descriptions.Item>
            <Descriptions.Item label="前端状态">{node.frontendState}</Descriptions.Item>
          </Descriptions>

          <TextListBlock title="当前证据" items={node.currentEvidence} />
          <TextListBlock title="下一步动作" items={node.nextActions} />

          {node.risks.length > 0 && (
            <Alert
              type="warning"
              title="风险提示"
              description={
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {node.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              }
              showIcon
            />
          )}

          <DetailBlock title="关联文档">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {node.docLinks.map((link) => (
                <div key={link.path}>
                  <Typography.Text strong>{link.label}</Typography.Text>
                  <Typography.Text code copyable style={{ marginLeft: 8 }}>
                    {link.path}
                  </Typography.Text>
                </div>
              ))}
            </div>
          </DetailBlock>
        </div>
      )}
    </Drawer>
  );
}
