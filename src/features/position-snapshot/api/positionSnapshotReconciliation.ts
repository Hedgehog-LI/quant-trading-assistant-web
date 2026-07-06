/**
 * 持仓快照与 FIFO 账本对账纯计算（mock 模式使用，与后端 PositionSnapshotReconciliationManager 口径一致）。
 *
 * 真正 FIFO（多买/部分卖/全卖/超卖）：
 * - 买入形成批次，卖出按 FIFO 从最早批次扣减。
 * - 卖出超过可用批次 → oversold，视为异常（QUANTITY_MISMATCH + warning），剩余持仓按 0。
 * - 平均成本 = 剩余批次成本合计 / 剩余数量。
 *
 * 时间口径：
 * - tradeDate < snapshotDate 全部纳入；
 * - 同日且 tradeTime 为空默认纳入（+warning）；
 * - 同日且 tradeTime 非空，tradeTime <= snapshotTime 纳入。
 *
 * status：MATCHED / QUANTITY_MISMATCH / SNAPSHOT_ONLY / LEDGER_ONLY，以数量为准。
 * 成本差异只展示不判错。负持仓/超卖绝不判定为 MATCHED。
 */
import type {
  PositionSnapshotReconciliation,
  PositionSnapshotReconciliationItem,
  ReconciliationStatus,
  TradeJournal,
} from '../../../shared/types/domain';
import type { PositionSnapshotDetail } from '../model/types';

const STATUS_ORDER: Record<ReconciliationStatus, number> = {
  QUANTITY_MISMATCH: 0,
  SNAPSHOT_ONLY: 1,
  LEDGER_ONLY: 2,
  MATCHED: 3,
};

const WARNING_SAME_DAY_NO_TIME = '存在与快照同日且 trade_time 缺失的交易，已默认纳入对账';
const OVERSOLD_WARNING = (symbol: string) => `账本存在超卖/数据不一致：${symbol}（卖出超过 FIFO 可用批次）`;

interface LedgerPosition {
  quantity: number;
  averageCost: number;
  oversold: boolean;
}

/** 按截止快照时间过滤并按时间正序排序。 */
function filterAndSort(journals: TradeJournal[], snapshotDate: string, snapshotTime: string): TradeJournal[] {
  return journals
    .filter((j) => {
      if (j.tradeDate < snapshotDate) return true;
      if (j.tradeDate === snapshotDate) {
        if (!j.tradeTime) return true;
        return j.tradeTime <= snapshotTime;
      }
      return false;
    })
    .sort((a, b) => {
      const d = a.tradeDate.localeCompare(b.tradeDate);
      if (d !== 0) return d;
      // 同日：tradeTime 为空排有 tradeTime 之后（与后端 CASE WHEN trade_time IS NULL THEN 1 ELSE 0 END ASC 一致）
      const aNull = a.tradeTime ? 0 : 1;
      const bNull = b.tradeTime ? 0 : 1;
      if (aNull !== bNull) return aNull - bNull;
      // 都有 time：先按 time 升序；time 相同则继续按 ID（与后端 trade_time ASC, id ASC 一致）
      if (a.tradeTime && b.tradeTime) {
        const tc = a.tradeTime.localeCompare(b.tradeTime);
        if (tc !== 0) return tc;
      }
      // 都无 time 或 time 相同：ID 升序稳定排序（与后端 id ASC 一致）
      return String(a.id).localeCompare(String(b.id));
    });
}

/** 按后端 fillFees 规则归一总费用：totalFee 优先；否则四项求和（各 null→0）。 */
function normalizeTotalFee(j: TradeJournal): number {
  if (j.totalFee !== undefined && j.totalFee !== null) return j.totalFee;
  return (j.commissionFee ?? 0) + (j.stampTax ?? 0) + (j.transferFee ?? 0) + (j.otherFee ?? 0);
}

/** 单 symbol FIFO 持仓计算（买入批次含费用摊，卖出 FIFO 扣减；超卖即停止后续）。 */
function fifoPosition(flows: TradeJournal[]): LedgerPosition {
  interface Lot { quantity: number; unitCost: number; }
  const lots: Lot[] = [];
  let oversold = false;
  for (const f of flows) {
    if (oversold) break; // 超卖后停止该 symbol 后续计算（与后端 abnormal 语义一致）
    if (f.side === 'BUY') {
      // 与后端一致：lotTotalCost = price*qty + totalFee；unitCost = lotTotalCost/qty
      const lotTotalCost = f.price * f.quantity + normalizeTotalFee(f);
      const unitCost = lotTotalCost / f.quantity;
      lots.push({ quantity: f.quantity, unitCost });
    } else {
      let toSell = f.quantity;
      while (toSell > 0 && lots.length > 0) {
        const lot = lots[0];
        if (lot.quantity > toSell) {
          lot.quantity -= toSell;
          toSell = 0;
        } else {
          toSell -= lot.quantity;
          lots.shift();
        }
      }
      if (toSell > 0) {
        oversold = true;
      }
    }
  }
  const quantity = lots.reduce((s, l) => s + l.quantity, 0);
  const totalCost = lots.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const averageCost = quantity > 0 ? totalCost / quantity : 0;
  return { quantity, averageCost, oversold };
}

function computeLedger(
  journals: TradeJournal[],
  snapshotDate: string,
  snapshotTime: string,
): { positions: Map<string, LedgerPosition>; sameDayNullTime: boolean } {
  const filtered = filterAndSort(journals, snapshotDate, snapshotTime);
  const bySymbol = new Map<string, TradeJournal[]>();
  let sameDayNullTime = false;
  for (const j of filtered) {
    if (j.tradeDate === snapshotDate && !j.tradeTime) {
      sameDayNullTime = true;
    }
    const symbol = j.symbol.toUpperCase();
    if (!bySymbol.has(symbol)) bySymbol.set(symbol, []);
    bySymbol.get(symbol)!.push(j);
  }
  const positions = new Map<string, LedgerPosition>();
  for (const [symbol, flows] of bySymbol) {
    positions.set(symbol, fifoPosition(flows));
  }
  return { positions, sameDayNullTime };
}

export function reconcileSnapshot(
  snapshot: PositionSnapshotDetail,
  journals: TradeJournal[],
): PositionSnapshotReconciliation {
  const { positions: ledgerPositions, sameDayNullTime } = computeLedger(
    journals,
    snapshot.snapshotDate,
    snapshot.snapshotTime,
  );
  const snapshotMap = new Map(snapshot.items.map((i) => [i.symbol.toUpperCase(), i]));
  const symbols = new Set<string>([...snapshotMap.keys(), ...ledgerPositions.keys()]);

  const warnings: string[] = [];
  if (sameDayNullTime) {
    warnings.push(WARNING_SAME_DAY_NO_TIME);
  }

  const items: PositionSnapshotReconciliationItem[] = [];
  let matchedCount = 0;
  let mismatchCount = 0;
  for (const symbol of symbols) {
    const snapItem = snapshotMap.get(symbol);
    const ledger = ledgerPositions.get(symbol);
    const ledgerQty = ledger?.quantity ?? 0;
    const snapshotQty = snapItem?.holdingQuantity ?? 0;

    let status: ReconciliationStatus;
    if (ledger?.oversold) {
      // 超卖/数据异常绝不判定为 MATCHED
      status = 'QUANTITY_MISMATCH';
      warnings.push(OVERSOLD_WARNING(symbol));
    } else if (snapshotQty > 0 && ledgerQty > 0) {
      status = snapshotQty === ledgerQty ? 'MATCHED' : 'QUANTITY_MISMATCH';
    } else if (snapshotQty > 0 && ledgerQty === 0) {
      status = 'SNAPSHOT_ONLY';
    } else if (snapshotQty === 0 && ledgerQty > 0) {
      status = 'LEDGER_ONLY';
    } else {
      status = 'MATCHED';
    }

    if (status === 'MATCHED') matchedCount++;
    else mismatchCount++;

    items.push({
      symbol,
      name: snapItem?.name,
      status,
      snapshotQuantity: snapshotQty,
      ledgerQuantity: ledgerQty,
      quantityDifference: snapshotQty - ledgerQty,
      snapshotCostPrice: snapItem?.costPrice,
      ledgerAverageCost: ledger && ledger.quantity > 0 ? ledger.averageCost : undefined,
    });
  }

  items.sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.symbol.localeCompare(b.symbol),
  );

  return {
    snapshotId: snapshot.id,
    snapshotTime: snapshot.snapshotTime,
    matchedCount,
    mismatchCount,
    hasMismatch: mismatchCount > 0,
    warnings,
    items,
  };
}
