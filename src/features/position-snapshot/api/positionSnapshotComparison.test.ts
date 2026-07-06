import { describe, it, expect } from 'vitest';
import { compareSnapshots } from './positionSnapshotComparison';
import type { PositionSnapshotDetail, PositionSnapshotItem } from '../model/types';

function item(symbol: string, qty: number, costPrice: number, marketValue: number): PositionSnapshotItem {
  return {
    id: symbol,
    snapshotId: '',
    symbol,
    name: symbol,
    marketType: 'SH',
    holdingQuantity: qty,
    availableQuantity: qty,
    costPrice,
    currentPrice: costPrice,
    costAmount: qty * costPrice,
    marketValue,
    unrealizedPnl: marketValue - qty * costPrice,
    pnlRate: 0,
    positionRatio: 0,
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
  };
}

function snap(id: string, date: string, items: PositionSnapshotItem[]): PositionSnapshotDetail {
  return {
    id,
    snapshotDate: date,
    snapshotTime: `${date}T15:00:00`,
    snapshotName: 's',
    sourceType: 'MANUAL',
    snapshotStatus: 'CONFIRMED',
    totalCostAmount: items.reduce((s, i) => s + i.costAmount, 0),
    totalMarketValue: items.reduce((s, i) => s + i.marketValue, 0),
    totalUnrealizedPnl: items.reduce((s, i) => s + i.unrealizedPnl, 0),
    totalPnlRate: 0,
    positionCount: items.length,
    remark: undefined,
    createdAt: '',
    updatedAt: '',
    items,
  };
}

describe('compareSnapshots', () => {
  it('覆盖五种 changeType', () => {
    const base = snap('1', '2026-07-04', [
      item('INC', 100, 10, 1000),
      item('RED', 100, 10, 1000),
      item('CLO', 100, 10, 1000),
      item('UNCH', 100, 10, 1000),
    ]);
    const target = snap('2', '2026-07-05', [
      item('NEW', 100, 10, 1000),
      item('INC', 200, 10, 2000),
      item('RED', 50, 10, 500),
      item('UNCH', 100, 10, 1000),
    ]);
    const result = compareSnapshots(base, target);
    const map = new Map(result.items.map((i) => [i.symbol, i.changeType]));
    expect(map.get('NEW')).toBe('NEW');
    expect(map.get('INC')).toBe('INCREASED');
    expect(map.get('RED')).toBe('REDUCED');
    expect(map.get('CLO')).toBe('CLOSED');
    expect(map.get('UNCH')).toBe('UNCHANGED');
  });

  it('正确计算数量与金额 delta', () => {
    const base = snap('1', '2026-07-04', [item('A', 100, 10, 1000)]);
    const target = snap('2', '2026-07-05', [item('A', 200, 10, 2500)]);
    const result = compareSnapshots(base, target);
    expect(result.items[0].quantityDelta).toBe(100);
    expect(result.items[0].marketValueDelta).toBe(1500);
    expect(result.totalMarketValueDelta).toBe(1500);
    expect(result.positionCountDelta).toBe(0);
  });

  it('稳定排序：changeType 优先', () => {
    const base = snap('1', '2026-07-04', [item('UNCH', 100, 10, 1000)]);
    const target = snap('2', '2026-07-05', [
      item('UNCH', 100, 10, 1000),
      item('NEW1', 100, 10, 1000),
    ]);
    const result = compareSnapshots(base, target);
    // NEW 应排在 UNCHANGED 之前
    expect(result.items[0].changeType).toBe('NEW');
    expect(result.items[1].changeType).toBe('UNCHANGED');
  });

  it('非 CONFIRMED 快照抛错', () => {
    const base = { ...snap('1', '2026-07-04', []), snapshotStatus: 'DRAFT' as const };
    const target = snap('2', '2026-07-05', []);
    expect(() => compareSnapshots(base, target)).toThrow('已确认');
  });

  it('同一快照抛错', () => {
    const s = snap('1', '2026-07-04', []);
    expect(() => compareSnapshots(s, s)).toThrow('早于');
  });

  it('基准晚于目标抛错', () => {
    const base = snap('1', '2026-07-05', []);
    const target = snap('2', '2026-07-04', []);
    expect(() => compareSnapshots(base, target)).toThrow('早于');
  });
});
