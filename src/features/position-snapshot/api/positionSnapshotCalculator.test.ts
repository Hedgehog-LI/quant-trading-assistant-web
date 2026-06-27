import { describe, expect, it } from 'vitest';
import { calculatePositionSnapshot } from './positionSnapshotCalculator';

describe('calculatePositionSnapshot', () => {
  it('按后端口径计算明细与汇总', () => {
    const result = calculatePositionSnapshot([
      { symbol: '300750', holdingQuantity: 100, availableQuantity: 80, costPrice: 10, currentPrice: 12 },
      { symbol: '600519', holdingQuantity: 50, costPrice: 20, currentPrice: 18 },
    ]);

    expect(result.totalCostAmount).toBe(2000);
    expect(result.totalMarketValue).toBe(2100);
    expect(result.totalUnrealizedPnl).toBe(100);
    expect(result.totalPnlRate).toBe(0.05);
    expect(result.items[0]).toMatchObject({
      costAmount: 1000,
      marketValue: 1200,
      unrealizedPnl: 200,
      pnlRate: 0.2,
      positionRatio: 0.571429,
    });
    expect(result.items[1].availableQuantity).toBe(50);
    expect(result.items[1].positionRatio).toBe(0.428571);
  });

  it('总成本和总市值为零时比例返回零', () => {
    const result = calculatePositionSnapshot([
      { symbol: '000001', holdingQuantity: 100, costPrice: 0, currentPrice: 0 },
    ]);
    expect(result.totalPnlRate).toBe(0);
    expect(result.items[0].pnlRate).toBe(0);
    expect(result.items[0].positionRatio).toBe(0);
  });

  it('空仓快照返回全零汇总', () => {
    expect(calculatePositionSnapshot([])).toEqual({
      items: [],
      totalCostAmount: 0,
      totalMarketValue: 0,
      totalUnrealizedPnl: 0,
      totalPnlRate: 0,
      positionCount: 0,
    });
  });
});
