import { Tag } from 'antd';
import { SNAPSHOT_STATUS_META } from '../model/meta';
import type { SnapshotStatus } from '../model/types';

export function PositionSnapshotStatusTag({ status }: { status: SnapshotStatus }) {
  const meta = SNAPSHOT_STATUS_META[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}
