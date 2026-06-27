import Decimal from 'decimal.js';
import type { PositionSnapshotItemInput } from '../model/types';

const SCALE = 6;

export interface CalculatedSnapshotItem extends PositionSnapshotItemInput {
  availableQuantity: number;
  costAmount: number;
  marketValue: number;
  unrealizedPnl: number;
  pnlRate: number;
  positionRatio: number;
  sortOrder: number;
}

export interface CalculatedSnapshot {
  items: CalculatedSnapshotItem[];
  totalCostAmount: number;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalPnlRate: number;
  positionCount: number;
}

function rounded(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(SCALE, Decimal.ROUND_HALF_UP).toNumber();
}

function ratio(part: Decimal, total: Decimal): number {
  if (total.isZero()) return 0;
  return rounded(part.div(total));
}

export function calculatePositionSnapshot(items: PositionSnapshotItemInput[]): CalculatedSnapshot {
  let totalCost = new Decimal(0);
  let totalMarketValue = new Decimal(0);

  const calculated = items.map((item, index) => {
    const quantity = new Decimal(item.holdingQuantity || 0);
    const costAmount = new Decimal(item.costPrice || 0).mul(quantity);
    const marketValue = new Decimal(item.currentPrice || 0).mul(quantity);
    const unrealizedPnl = marketValue.minus(costAmount);
    totalCost = totalCost.plus(costAmount);
    totalMarketValue = totalMarketValue.plus(marketValue);
    return {
      ...item,
      availableQuantity: item.availableQuantity ?? item.holdingQuantity,
      costAmount: rounded(costAmount),
      marketValue: rounded(marketValue),
      unrealizedPnl: rounded(unrealizedPnl),
      pnlRate: ratio(unrealizedPnl, costAmount),
      positionRatio: 0,
      sortOrder: index,
    };
  });

  const totalPnl = totalMarketValue.minus(totalCost);
  return {
    items: calculated.map((item) => ({
      ...item,
      positionRatio: ratio(new Decimal(item.marketValue), totalMarketValue),
    })),
    totalCostAmount: rounded(totalCost),
    totalMarketValue: rounded(totalMarketValue),
    totalUnrealizedPnl: rounded(totalPnl),
    totalPnlRate: ratio(totalPnl, totalCost),
    positionCount: items.length,
  };
}
