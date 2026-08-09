import { Alert, Descriptions, Drawer, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { BuildStatusNode } from '../model/types';
import {
  DELIVERY_STATUS_COLOR,
  DELIVERY_STATUS_LABEL,
  PRIORITY_COLOR,
  VALIDATION_STAGE_COLOR,
  VALIDATION_STAGE_LABEL,
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
  if (items.length === 0) {
    return null;
  }
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
            <Tag color={DELIVERY_STATUS_COLOR[node.deliveryStatus]}>
              {DELIVERY_STATUS_LABEL[node.deliveryStatus]}
            </Tag>
            <Tag color={VALIDATION_STAGE_COLOR[node.validationStage]}>
              {VALIDATION_STAGE_LABEL[node.validationStage]}
            </Tag>
            <Typography.Text type="secondary">更新于 {node.lastUpdatedAt}</Typography.Text>
          </Space>

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="用户价值">{node.productValue}</Descriptions.Item>
            <Descriptions.Item label="后端状态">{node.backendState}</Descriptions.Item>
            <Descriptions.Item label="前端状态">{node.frontendState}</Descriptions.Item>
          </Descriptions>

          <TextListBlock title="已交付内容" items={node.deliveredContent} />
          <TextListBlock title="完成标准" items={node.completionCriteria} />
          <TextListBlock title="剩余工作" items={node.remainingWork} />
          <TextListBlock title="下一动作" items={node.nextActions} />
          <TextListBlock title="当前限制 / 未验证边界" items={node.limitations} />

          {(node.acceptanceRef || node.backendCommit || node.frontendCommit) && (
            <DetailBlock title="提交与验收证据">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {node.backendCommit && (
                  <div>
                    <Typography.Text type="secondary">后端提交：</Typography.Text>
                    <Typography.Text code>{node.backendCommit}</Typography.Text>
                  </div>
                )}
                {node.frontendCommit && (
                  <div>
                    <Typography.Text type="secondary">前端提交：</Typography.Text>
                    <Typography.Text code>{node.frontendCommit}</Typography.Text>
                  </div>
                )}
                {node.acceptanceRef && (
                  <div>
                    <Typography.Text type="secondary">验收依据：</Typography.Text>
                    <Typography.Text code>{node.acceptanceRef}</Typography.Text>
                  </div>
                )}
              </div>
            </DetailBlock>
          )}

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

          {node.docLinks.length > 0 && (
            <DetailBlock title="关联文档（仓库相对路径）">
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
          )}
        </div>
      )}
    </Drawer>
  );
}
