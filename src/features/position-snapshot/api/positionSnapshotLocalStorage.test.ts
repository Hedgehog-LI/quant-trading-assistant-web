import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll } from '../../../shared/api/localStorageClient';
import {
  cancelLocalPositionSnapshot,
  confirmLocalPositionSnapshot,
  createLocalPositionSnapshot,
  getLatestLocalPositionSnapshot,
  listLocalPositionSnapshots,
  updateLocalPositionSnapshot,
} from './positionSnapshotLocalStorage';
import type { PositionSnapshotSaveInput } from '../model/types';

function request(overrides: Partial<PositionSnapshotSaveInput> = {}): PositionSnapshotSaveInput {
  return {
    snapshotDate: '2026-06-27',
    snapshotTime: '2026-06-27T15:05:00',
    snapshotName: '收盘持仓',
    sourceType: 'MANUAL',
    snapshotStatus: 'DRAFT',
    items: [
      {
        symbol: ' 300750 ',
        name: '宁德时代',
        marketType: 'SZ',
        holdingQuantity: 100,
        availableQuantity: 80,
        costPrice: 10,
        currentPrice: 12,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => clearAll());

describe('positionSnapshotLocalStorage', () => {
  it('创建草稿时标准化代码并计算金额', () => {
    const result = createLocalPositionSnapshot(request());
    expect(result.snapshotStatus).toBe('DRAFT');
    expect(result.items[0].symbol).toBe('300750');
    expect(result.totalCostAmount).toBe(1000);
    expect(result.totalMarketValue).toBe(1200);
    expect(result.totalPnlRate).toBe(0.2);
    expect(listLocalPositionSnapshots()).toHaveLength(1);
  });

  it('更新草稿整批覆盖明细并重新计算', () => {
    const created = createLocalPositionSnapshot(request());
    const updated = updateLocalPositionSnapshot(created.id, {
      snapshotDate: '2026-06-27',
      snapshotTime: '2026-06-27T15:10:00',
      snapshotName: '修正版',
      items: [{ symbol: '000001', holdingQuantity: 200, costPrice: 8, currentPrice: 9 }],
    });
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].symbol).toBe('000001');
    expect(updated.totalUnrealizedPnl).toBe(200);
  });

  it('确认后禁止编辑但允许作废', () => {
    const created = createLocalPositionSnapshot(request());
    const confirmed = confirmLocalPositionSnapshot(created.id);
    expect(confirmed.snapshotStatus).toBe('CONFIRMED');
    expect(() => updateLocalPositionSnapshot(created.id, {
      snapshotDate: '2026-06-27',
      snapshotTime: '2026-06-27T15:05:00',
      items: [],
    })).toThrow('只有草稿');
    expect(cancelLocalPositionSnapshot(created.id).snapshotStatus).toBe('CANCELED');
  });

  it('默认隐藏作废快照，显式状态可以查询', () => {
    const created = createLocalPositionSnapshot(request());
    cancelLocalPositionSnapshot(created.id);
    expect(listLocalPositionSnapshots()).toHaveLength(0);
    expect(listLocalPositionSnapshots({ status: 'CANCELED' })).toHaveLength(1);
  });

  it('latest 只返回最新已确认快照', () => {
    createLocalPositionSnapshot(request({
      snapshotStatus: 'CONFIRMED',
      snapshotDate: '2026-06-26',
      snapshotTime: '2026-06-26T15:00:00',
    }));
    const latest = createLocalPositionSnapshot(request({ snapshotStatus: 'CONFIRMED' }));
    createLocalPositionSnapshot(request({ snapshotTime: '2026-06-27T16:00:00' }));
    expect(getLatestLocalPositionSnapshot()?.id).toBe(latest.id);
  });

  it('标准化后重复的股票代码会被拒绝', () => {
    expect(() => createLocalPositionSnapshot(request({
      items: [
        { symbol: '300750', holdingQuantity: 100, costPrice: 10, currentPrice: 12 },
        { symbol: ' 300750 ', holdingQuantity: 50, costPrice: 11, currentPrice: 12 },
      ],
    }))).toThrow('不能重复');
  });
});
