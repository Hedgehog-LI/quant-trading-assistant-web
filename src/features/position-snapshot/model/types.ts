import type { EntityId } from '../../../shared/types/domain';

export type SnapshotStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELED';
export type SnapshotSourceType = 'MANUAL' | 'IMAGE_RECOGNITION' | 'CSV_IMPORT';
export type PositionMarketType = 'SH' | 'SZ' | 'BJ' | 'UNKNOWN';

export interface PositionSnapshotItemInput {
  symbol: string;
  name?: string;
  marketType?: PositionMarketType;
  holdingQuantity: number;
  availableQuantity?: number;
  costPrice: number;
  currentPrice: number;
  remark?: string;
}

export interface PositionSnapshotItem extends PositionSnapshotItemInput {
  id: EntityId;
  snapshotId: EntityId;
  marketType: PositionMarketType;
  availableQuantity: number;
  costAmount: number;
  marketValue: number;
  unrealizedPnl: number;
  pnlRate: number;
  positionRatio: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PositionSnapshotSaveInput {
  snapshotDate: string;
  snapshotTime: string;
  snapshotName?: string;
  sourceType: SnapshotSourceType;
  snapshotStatus: Exclude<SnapshotStatus, 'CANCELED'>;
  remark?: string;
  items: PositionSnapshotItemInput[];
}

export type PositionSnapshotUpdateInput = Omit<
  PositionSnapshotSaveInput,
  'sourceType' | 'snapshotStatus'
>;

export interface PositionSnapshotSummary {
  id: EntityId;
  snapshotDate: string;
  snapshotTime: string;
  snapshotName?: string;
  sourceType: SnapshotSourceType;
  snapshotStatus: SnapshotStatus;
  totalCostAmount: number;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalPnlRate: number;
  positionCount: number;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PositionSnapshotDetail extends PositionSnapshotSummary {
  items: PositionSnapshotItem[];
}

export interface PositionSnapshotFilter {
  fromDate?: string;
  toDate?: string;
  status?: SnapshotStatus;
  sourceType?: SnapshotSourceType;
  includeCanceled?: boolean;
}
