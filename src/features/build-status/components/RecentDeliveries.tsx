import { Button, Collapse, Tag, Timeline, Typography } from 'antd';
import type { BuildDeliveryRecord } from '../model/types';
import { DELIVERY_STAGE_LABEL } from '../model/meta';
import { RECENT_DELIVERIES_DEFAULT, RECENT_DELIVERIES_MAX } from '../model/selectors';

const STAGE_COLOR: Record<BuildDeliveryRecord['stage'], string> = {
  DESIGN: 'purple',
  AUTOMATION: 'cyan',
  RUNTIME: 'blue',
  DEPLOYED: 'green',
};

interface Props {
  deliveries: BuildDeliveryRecord[];
  showAll: boolean;
  onToggle: () => void;
}

interface DeliveryItemProps {
  record: BuildDeliveryRecord;
}

function CommitLink({ label, hash }: { label: string; hash?: string }) {
  if (!hash) {
    return null;
  }
  return (
    <span>
      {label} <Typography.Text code>{hash}</Typography.Text>
    </span>
  );
}

function DeliveryDetail({ record }: DeliveryItemProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <Typography.Text strong>摘要：</Typography.Text>
        <Typography.Text>{record.summary}</Typography.Text>
      </div>
      {record.modules.length > 0 && (
        <div>
          <Typography.Text strong>影响模块：</Typography.Text>
          {record.modules.map((m) => (
            <Tag key={m}>{m}</Tag>
          ))}
        </div>
      )}
      <div>
        <Typography.Text strong>修订证据：</Typography.Text>
        <CommitLink label="后端" hash={record.backendCommit} />
        {record.backendCommit && record.frontendCommit ? <span> · </span> : null}
        <CommitLink label="前端" hash={record.frontendCommit} />
        {!record.backendCommit && !record.frontendCommit ? (
          <Typography.Text type="secondary">无（纯文档/治理交付）</Typography.Text>
        ) : null}
      </div>
      <div>
        <Typography.Text strong>验收依据：</Typography.Text>
        <Typography.Text code>{record.acceptanceRef}</Typography.Text>
      </div>
      {record.limitations.length > 0 && (
        <div>
          <Typography.Text strong>当前限制：</Typography.Text>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {record.limitations.map((l) => (
              <li key={l}>
                <Typography.Text type="secondary">{l}</Typography.Text>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RecentDeliveries({ deliveries, showAll, onToggle }: Props) {
  const visible = showAll ? deliveries : deliveries.slice(0, RECENT_DELIVERIES_DEFAULT);
  const hasMore = deliveries.length > RECENT_DELIVERIES_DEFAULT;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Typography.Text type="secondary">
          默认展示最近 {RECENT_DELIVERIES_DEFAULT} 条，最多 {RECENT_DELIVERIES_MAX} 条；完整事实以验收日志为准。
        </Typography.Text>
        {hasMore && (
          <Button size="small" onClick={onToggle}>
            {showAll
              ? '收起'
              : deliveries.length >= RECENT_DELIVERIES_MAX
                ? `展开到 ${RECENT_DELIVERIES_MAX} 条`
                : `展开全部（${deliveries.length} 条）`}
          </Button>
        )}
      </div>
      <Timeline
        style={{ marginTop: 16 }}
        items={visible.map((record) => ({
          color: STAGE_COLOR[record.stage],
          children: (
            <div key={record.deliveredAt + record.title}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Typography.Text strong>{record.title}</Typography.Text>
                <Tag color={STAGE_COLOR[record.stage]}>{DELIVERY_STAGE_LABEL[record.stage]}</Tag>
                <Typography.Text type="secondary">{record.deliveredAt}</Typography.Text>
              </div>
              <Collapse
                size="small"
                style={{ marginTop: 8 }}
                items={[
                  {
                    key: 'detail',
                    label: '查看提交 / 验收依据 / 限制',
                    children: <DeliveryDetail record={record} />,
                  },
                ]}
              />
            </div>
          ),
        }))}
      />
    </div>
  );
}
