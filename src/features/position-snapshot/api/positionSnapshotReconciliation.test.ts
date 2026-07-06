import { describe, it, expect } from 'vitest';
import { reconcileSnapshot } from './positionSnapshotReconciliation';
import type { PositionSnapshotDetail, PositionSnapshotItem } from '../model/types';
import type { TradeJournal } from '../../../shared/types/domain';

function snapItem(symbol: string, qty: number, costPrice: number): PositionSnapshotItem {
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
    marketValue: qty * costPrice,
    unrealizedPnl: 0,
    pnlRate: 0,
    positionRatio: 0,
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
  };
}

function snap(date: string, items: PositionSnapshotItem[]): PositionSnapshotDetail {
  return {
    id: '1',
    snapshotDate: date,
    snapshotTime: `${date}T15:00:00`,
    snapshotName: 's',
    sourceType: 'MANUAL',
    snapshotStatus: 'CONFIRMED',
    totalCostAmount: items.reduce((s, i) => s + i.costAmount, 0),
    totalMarketValue: items.reduce((s, i) => s + i.marketValue, 0),
    totalUnrealizedPnl: 0,
    totalPnlRate: 0,
    positionCount: items.length,
    remark: undefined,
    createdAt: '',
    updatedAt: '',
    items,
  };
}

function journal(date: string, symbol: string, side: 'BUY' | 'SELL', qty: number, time?: string): TradeJournal {
  return {
    id: `${symbol}-${date}-${side}`,
    tradeDate: date,
    tradeTime: time,
    symbol,
    name: symbol,
    side,
    price: 10,
    quantity: qty,
    amount: 10 * qty,
    reviewStatus: 'PENDING',
    emotionTags: [],
    mistakeTags: [],
    createdAt: '',
    updatedAt: '',
  };
}

function journalFee(
  date: string,
  symbol: string,
  side: 'BUY' | 'SELL',
  qty: number,
  totalFee: number,
  time?: string,
): TradeJournal {
  return { ...journal(date, symbol, side, qty, time), totalFee };
}

describe('reconcileSnapshot', () => {
  it('MATCHED：快照与账本数量一致', () => {
    const s = snap('2026-07-05', [snapItem('A', 100, 10)]);
    const result = reconcileSnapshot(s, [journal('2026-07-04', 'A', 'BUY', 100)]);
    expect(result.hasMismatch).toBe(false);
    expect(result.matchedCount).toBe(1);
    expect(result.items[0].status).toBe('MATCHED');
  });

  it('QUANTITY_MISMATCH：数量不一致', () => {
    const s = snap('2026-07-05', [snapItem('A', 200, 10)]);
    const result = reconcileSnapshot(s, [journal('2026-07-04', 'A', 'BUY', 100)]);
    expect(result.items[0].status).toBe('QUANTITY_MISMATCH');
    expect(result.items[0].quantityDifference).toBe(100);
    expect(result.hasMismatch).toBe(true);
  });

  it('SNAPSHOT_ONLY：快照有账本无', () => {
    const s = snap('2026-07-05', [snapItem('A', 100, 10)]);
    const result = reconcileSnapshot(s, []);
    expect(result.items[0].status).toBe('SNAPSHOT_ONLY');
  });

  it('LEDGER_ONLY：账本有快照无', () => {
    const s = snap('2026-07-05', []);
    const result = reconcileSnapshot(s, [journal('2026-07-04', 'A', 'BUY', 100)]);
    expect(result.items[0].status).toBe('LEDGER_ONLY');
  });

  it('同日 trade_time 缺失产生 warning', () => {
    const s = snap('2026-07-05', [snapItem('A', 100, 10)]);
    const result = reconcileSnapshot(s, [journal('2026-07-05', 'A', 'BUY', 100)]);
    expect(result.warnings.some((w) => w.includes('trade_time 缺失'))).toBe(true);
  });

  it('截止时间过滤：tradeDate 晚于快照日不纳入', () => {
    const s = snap('2026-07-05', [snapItem('A', 100, 10)]);
    // 7 月 6 日（晚于快照）的买入不应纳入账本 -> 快照 100 vs 账本 0 -> SNAPSHOT_ONLY
    const result = reconcileSnapshot(s, [journal('2026-07-06', 'A', 'BUY', 100)]);
    expect(result.items[0].status).toBe('SNAPSHOT_ONLY');
  });

  it('超卖：卖超过买视为 QUANTITY_MISMATCH + warning', () => {
    const s = snap('2026-07-05', [snapItem('A', 100, 10)]);
    const result = reconcileSnapshot(s, [
      journal('2026-07-04', 'A', 'BUY', 100),
      journal('2026-07-04', 'A', 'SELL', 200),
    ]);
    expect(result.items[0].status).toBe('QUANTITY_MISMATCH');
    expect(result.warnings.some((w) => w.includes('超卖'))).toBe(true);
    expect(result.hasMismatch).toBe(true);
  });

  it('FIFO 多买部分卖：剩余数量与快照一致 MATCHED', () => {
    const s = snap('2026-07-05', [snapItem('A', 150, 10)]);
    const result = reconcileSnapshot(s, [
      journal('2026-07-02', 'A', 'BUY', 100),
      journal('2026-07-03', 'A', 'BUY', 100),
      journal('2026-07-04', 'A', 'SELL', 50),
    ]);
    expect(result.items[0].status).toBe('MATCHED');
    expect(result.items[0].ledgerQuantity).toBe(150);
  });

  it('FIFO 平均成本：多次买入加权', () => {
    const s = snap('2026-07-05', [snapItem('A', 200, 11)]);
    const result = reconcileSnapshot(s, [
      journal('2026-07-02', 'A', 'BUY', 100),
      journal('2026-07-03', 'A', 'BUY', 100),
    ]);
    // journal helper price=10，两次买入加权平均成本 10
    expect(result.items[0].ledgerAverageCost).toBe(10);
  });

  it('全部卖出后账本无持仓：SNAPSHOT_ONLY', () => {
    const s = snap('2026-07-05', [snapItem('A', 100, 10)]);
    const result = reconcileSnapshot(s, [
      journal('2026-07-02', 'A', 'BUY', 100),
      journal('2026-07-03', 'A', 'SELL', 100),
    ]);
    expect(result.items[0].status).toBe('SNAPSHOT_ONLY');
    expect(result.items[0].ledgerQuantity).toBe(0);
  });

  it('FIFO 手续费进成本：averageCost 含 totalFee', () => {
    const s = snap('2026-07-05', [snapItem('A', 100, 11)]);
    const result = reconcileSnapshot(s, [journalFee('2026-07-04', 'A', 'BUY', 100, 50)]);
    // unitCost = (price*qty + totalFee)/qty = (10*100 + 50)/100 = 10.5
    expect(result.items[0].ledgerAverageCost).toBeCloseTo(10.5, 6);
  });

  it('同日 null tradeTime 排有时间之后，顺序稳定且默认纳入', () => {
    const s = snap('2026-07-05', [snapItem('A', 100, 10)]);
    const result = reconcileSnapshot(s, [
      journal('2026-07-05', 'A', 'BUY', 50, '2026-07-05T09:00:00'),
      journal('2026-07-05', 'A', 'BUY', 50),
    ]);
    expect(result.items[0].ledgerQuantity).toBe(100);
    expect(result.warnings.some((w) => w.includes('trade_time 缺失'))).toBe(true);
  });

  it('超卖后停止计算：后续 BUY 不被计入', () => {
    const s = snap('2026-07-05', [snapItem('A', 100, 10)]);
    const result = reconcileSnapshot(s, [
      journal('2026-07-02', 'A', 'BUY', 100),
      journal('2026-07-03', 'A', 'SELL', 150),
      journal('2026-07-04', 'A', 'BUY', 50),
    ]);
    expect(result.items[0].status).toBe('QUANTITY_MISMATCH');
    expect(result.items[0].ledgerQuantity).toBe(0);
    expect(result.warnings.some((w) => w.includes('超卖'))).toBe(true);
  });

  it('同 tradeDate 同 tradeTime：输入反序仍按 ID 升序决定顺序', () => {
    const s = snap('2026-07-05', [snapItem('A', 100, 10)]);
    const buy = journal('2026-07-04', 'A', 'BUY', 100, '2026-07-04T10:00:00');
    const sell = journal('2026-07-04', 'A', 'SELL', 100, '2026-07-04T10:00:00');
    // 输入数组反序 [sell, buy]；id ASC 让 BUY(id 'A-...-BUY' 字典序 < SELL) 先处理 → 正常清仓，不超卖
    const result = reconcileSnapshot(s, [sell, buy]);
    expect(result.items[0].ledgerQuantity).toBe(0);
    expect(result.warnings.some((w) => w.includes('超卖'))).toBe(false);
  });
});
