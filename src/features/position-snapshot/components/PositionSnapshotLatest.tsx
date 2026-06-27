import { Button, Empty, Popconfirm, Space, Statistic, Tag, Typography } from 'antd';
import { CheckCircleOutlined, EyeOutlined, StopOutlined } from '@ant-design/icons';
import { formatDateTime } from '../../../shared/utils/date';
import { formatMoney, formatPercent } from '../../../shared/utils/number';
import { pnlColor, PNL_COLOR_HEX } from '../../portfolio/model/types';
import { SNAPSHOT_SOURCE_META } from '../model/meta';
import type { PositionSnapshotDetail } from '../model/types';
import { PositionSnapshotStatusTag } from './PositionSnapshotStatusTag';

interface Props {
  snapshot: PositionSnapshotDetail | null;
  onView: (id: string | number) => void;
  onConfirm: (id: string | number) => Promise<void>;
  onCancel: (id: string | number) => Promise<void>;
}

export function PositionSnapshotLatest({ snapshot, onView, onConfirm, onCancel }: Props) {
  return (
    <section className="position-snapshot-latest" aria-labelledby="latest-snapshot-title">
      <div className="position-snapshot-section-heading">
        <div>
          <Typography.Title id="latest-snapshot-title" level={5} style={{ margin: 0 }}>
            最近已确认快照
          </Typography.Title>
          {snapshot && (
            <Typography.Text type="secondary">
              {snapshot.snapshotName || formatDateTime(snapshot.snapshotTime)}
            </Typography.Text>
          )}
        </div>
        {snapshot && (
          <Space wrap>
            <PositionSnapshotStatusTag status={snapshot.snapshotStatus} />
            <Tag>{SNAPSHOT_SOURCE_META[snapshot.sourceType]}</Tag>
            <Button size="small" icon={<EyeOutlined />} onClick={() => onView(snapshot.id)}>
              查看详情
            </Button>
            {snapshot.snapshotStatus === 'DRAFT' && (
              <Popconfirm title="确认这份持仓快照？" okText="确认" cancelText="取消" onConfirm={() => onConfirm(snapshot.id)}>
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}>确认</Button>
              </Popconfirm>
            )}
            {snapshot.snapshotStatus !== 'CANCELED' && (
              <Popconfirm
                title="作废这份持仓快照？"
                description="作废后不会出现在默认历史列表中。"
                okText="确认作废"
                cancelText="取消"
                onConfirm={() => onCancel(snapshot.id)}
              >
                <Button size="small" danger icon={<StopOutlined />}>作废</Button>
              </Popconfirm>
            )}
          </Space>
        )}
      </div>

      {!snapshot ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已确认持仓快照" />
      ) : (
        <div className="position-snapshot-stat-grid">
          <Statistic title="快照时间" value={formatDateTime(snapshot.snapshotTime)} />
          <Statistic title="持仓数量" value={snapshot.positionCount} suffix="只" />
          <Statistic title="总成本" value={formatMoney(snapshot.totalCostAmount)} />
          <Statistic title="总市值" value={formatMoney(snapshot.totalMarketValue)} />
          <Statistic
            title="浮动盈亏"
            value={formatMoney(snapshot.totalUnrealizedPnl)}
            styles={{ content: { color: PNL_COLOR_HEX[pnlColor(snapshot.totalUnrealizedPnl)] } }}
          />
          <Statistic
            title="盈亏比例"
            value={formatPercent(snapshot.totalPnlRate)}
            styles={{ content: { color: PNL_COLOR_HEX[pnlColor(snapshot.totalPnlRate)] } }}
          />
        </div>
      )}
    </section>
  );
}
