/**
 * 持仓快照对比纯计算（mock 模式使用，与后端 PositionSnapshotComparisonManager 口径一致）。
 *
 * - 合并键：symbol trim+大写。
 * - 缺失侧数量/金额按 0 参与 delta。
 * - changeType：NEW / INCREASED / REDUCED / CLOSED / UNCHANGED。
 * - 排序：changeType 序 -> 目标市值降序 -> symbol 升序。
 */
import type {
  PositionSnapshotComparison,
  PositionSnapshotComparisonItem,
  SnapshotChangeType,
} from '../../../shared/types/domain';
import type { PositionSnapshotDetail } from '../model/types';

const CHANGE_TYPE_ORDER: Record<SnapshotChangeType, number> = {
  NEW: 0,
  INCREASED: 1,
  REDUCED: 2,
  CLOSED: 3,
  UNCHANGED: 4,
};

interface ItemRow extends PositionSnapshotComparisonItem {
  /** 用于排序的目标市值，不暴露给 UI。 */
  _targetMarketValue: number;
}

export function compareSnapshots(
  base: PositionSnapshotDetail,
  target: PositionSnapshotDetail,
): PositionSnapshotComparison {
  // 与后端 PositionSnapshotComparisonManager 对齐：仅 CONFIRMED，基准严格早于目标
  if (base.snapshotStatus !== 'CONFIRMED' || target.snapshotStatus !== 'CONFIRMED') {
    throw new Error('持仓快照对比仅支持已确认快照');
  }
  if (
    String(base.id) === String(target.id) ||
    !(base.snapshotTime < target.snapshotTime)
  ) {
    throw new Error('基准快照时间必须严格早于目标快照时间');
  }

  const baseMap = new Map(base.items.map((i) => [i.symbol.toUpperCase(), i]));
  const targetMap = new Map(target.items.map((i) => [i.symbol.toUpperCase(), i]));
  const symbols = new Set<string>([...baseMap.keys(), ...targetMap.keys()]);

  const rows: ItemRow[] = [];
  for (const symbol of symbols) {
    const b = baseMap.get(symbol);
    const t = targetMap.get(symbol);
    const baseQty = b?.holdingQuantity ?? 0;
    const targetQty = t?.holdingQuantity ?? 0;

    let changeType: SnapshotChangeType;
    if (!b && t) changeType = 'NEW';
    else if (b && !t) changeType = 'CLOSED';
    else if (targetQty > baseQty) changeType = 'INCREASED';
    else if (targetQty < baseQty) changeType = 'REDUCED';
    else changeType = 'UNCHANGED';

    rows.push({
      symbol,
      name: t?.name ?? b?.name,
      changeType,
      baseQuantity: b ? baseQty : undefined,
      targetQuantity: t ? targetQty : undefined,
      quantityDelta: targetQty - baseQty,
      baseCostPrice: b?.costPrice,
      targetCostPrice: t?.costPrice,
      marketValueDelta: (t?.marketValue ?? 0) - (b?.marketValue ?? 0),
      unrealizedPnlDelta: (t?.unrealizedPnl ?? 0) - (b?.unrealizedPnl ?? 0),
      _targetMarketValue: t?.marketValue ?? 0,
    });
  }

  rows.sort(
    (a, b) =>
      CHANGE_TYPE_ORDER[a.changeType] - CHANGE_TYPE_ORDER[b.changeType] ||
      b._targetMarketValue - a._targetMarketValue ||
      a.symbol.localeCompare(b.symbol),
  );

  const items: PositionSnapshotComparisonItem[] = rows.map((row) => {
    const { _targetMarketValue, ...rest } = row;
    void _targetMarketValue;
    return rest;
  });

  return {
    baseSnapshotId: base.id,
    targetSnapshotId: target.id,
    baseSnapshotTime: base.snapshotTime,
    targetSnapshotTime: target.snapshotTime,
    baseStatus: base.snapshotStatus,
    targetStatus: target.snapshotStatus,
    totalCostDelta: target.totalCostAmount - base.totalCostAmount,
    totalMarketValueDelta: target.totalMarketValue - base.totalMarketValue,
    totalUnrealizedPnlDelta: target.totalUnrealizedPnl - base.totalUnrealizedPnl,
    positionCountDelta: target.positionCount - base.positionCount,
    items,
  };
}
