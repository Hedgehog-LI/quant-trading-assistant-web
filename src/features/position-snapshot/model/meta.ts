import type { PositionMarketType, SnapshotSourceType, SnapshotStatus } from './types';

export const SNAPSHOT_STATUS_OPTIONS: Array<{ value: SnapshotStatus; label: string }> = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'CONFIRMED', label: '已确认' },
  { value: 'CANCELED', label: '已作废' },
];

export const SNAPSHOT_STATUS_META: Record<SnapshotStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'gold' },
  CONFIRMED: { label: '已确认', color: 'green' },
  CANCELED: { label: '已作废', color: 'default' },
};

export const SNAPSHOT_SOURCE_META: Record<SnapshotSourceType, string> = {
  MANUAL: '手工录入',
  IMAGE_RECOGNITION: '图片识别',
  CSV_IMPORT: 'CSV 导入',
};

export const MARKET_TYPE_OPTIONS: Array<{ value: PositionMarketType; label: string }> = [
  { value: 'SH', label: '上交所' },
  { value: 'SZ', label: '深交所' },
  { value: 'BJ', label: '北交所' },
  { value: 'UNKNOWN', label: '未知' },
];

export const MARKET_TYPE_META: Record<PositionMarketType, string> = {
  SH: '上交所',
  SZ: '深交所',
  BJ: '北交所',
  UNKNOWN: '未知',
};
