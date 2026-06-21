import { describe, it, expect } from 'vitest';
import { toFlowItems, calculateAll } from './portfolioCalculator';
import type { TradeJournal } from '../../../shared/types/domain';

const TODAY = '2026-06-21';

function makeJournal(
  p: Partial<TradeJournal> &
    Pick<TradeJournal, 'id' | 'tradeDate' | 'symbol' | 'side' | 'price' | 'quantity'>,
): TradeJournal {
  return {
    name: undefined,
    emotionTags: [],
    mistakeTags: [],
    reviewStatus: 'PENDING',
    createdAt: '',
    updatedAt: '',
    ...p,
  };
}

function calc(journals: TradeJournal[], prices: Array<[string, number]> = []) {
  return calculateAll(toFlowItems(journals), new Map(prices), TODAY);
}

describe('portfolioCalculator', () => {
  it('单笔买入生成持仓，平均成本含费用摊销', () => {
    const r = calc([
      makeJournal({
        id: '1',
        tradeDate: '2026-01-01',
        symbol: '000001',
        side: 'BUY',
        price: 10,
        quantity: 100,
        commissionFee: 10,
      }),
    ]);
    // totalFee 归一化 = 10；lotTotalCost = 1010；unitCost = 10.1
    expect(r.positions).toHaveLength(1);
    const pos = r.positions[0];
    expect(pos.quantity).toBe(100);
    expect(pos.costAmount).toBeCloseTo(1010, 6);
    expect(pos.averageCost).toBeCloseTo(10.1, 6);
    expect(pos.firstBuyDate).toBe('2026-01-01');
    expect(pos.currentPrice).toBeNull();
    expect(pos.unrealizedPnl).toBeNull();
    expect(pos.warnings.join()).toContain('未维护当前价');
  });

  it('买入后全部卖出，生成已结算交易', () => {
    const r = calc([
      makeJournal({ id: '1', tradeDate: '2026-01-01', symbol: '000001', side: 'BUY', price: 10, quantity: 100 }),
      makeJournal({ id: '2', tradeDate: '2026-01-11', symbol: '000001', side: 'SELL', price: 12, quantity: 100 }),
    ]);
    expect(r.positions).toHaveLength(0);
    expect(r.closedTrades).toHaveLength(1);
    const c = r.closedTrades[0];
    expect(c.realizedPnl).toBeCloseTo(200, 6);
    expect(c.returnPoint).toBeCloseTo(20, 6);
    expect(c.holdingDays).toBe(10);
    expect(c.profitable).toBe(true);
    expect(c.buyDate).toBe('2026-01-01');
    expect(c.sellDate).toBe('2026-01-11');
  });

  it('分批买入后卖出，FIFO 跨批次正确配对', () => {
    const r = calc([
      makeJournal({ id: '1', tradeDate: '2026-01-01', symbol: '000002', side: 'BUY', price: 10, quantity: 100 }),
      makeJournal({ id: '2', tradeDate: '2026-01-02', symbol: '000002', side: 'BUY', price: 12, quantity: 200 }),
      makeJournal({ id: '3', tradeDate: '2026-01-11', symbol: '000002', side: 'SELL', price: 13, quantity: 250 }),
    ]);
    expect(r.closedTrades).toHaveLength(1);
    const c = r.closedTrades[0];
    // FIFO：lot1 100@10 cost 1000，lot2 取 150@12 cost 1800 → costSum 2800
    expect(c.quantity).toBe(250);
    expect(c.costAmount).toBeCloseTo(2800, 6);
    expect(c.realizedPnl).toBeCloseTo(450, 6); // 3250 − 2800
    expect(c.returnPoint).toBeCloseTo(16.071428, 4);
    expect(c.holdingDays).toBe(10); // sellDate − 最早买入日 lot1
    // 剩余 lot2 50
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].quantity).toBe(50);
    expect(r.positions[0].costAmount).toBeCloseTo(600, 6);
    expect(r.positions[0].averageCost).toBeCloseTo(12, 6);
  });

  it('清仓后持仓为空', () => {
    const r = calc([
      makeJournal({ id: '1', tradeDate: '2026-01-01', symbol: '000003', side: 'BUY', price: 10, quantity: 100 }),
      makeJournal({ id: '2', tradeDate: '2026-01-02', symbol: '000003', side: 'SELL', price: 11, quantity: 100 }),
    ]);
    expect(r.positions).toHaveLength(0);
    expect(r.closedTrades).toHaveLength(1);
  });

  it('卖出超过持仓：abnormal 不抛异常，break 前的 closedTrades 保留，summary 置零', () => {
    const r = calc([
      makeJournal({ id: '1', tradeDate: '2026-01-01', symbol: '000004', side: 'BUY', price: 10, quantity: 200 }),
      makeJournal({ id: '2', tradeDate: '2026-01-05', symbol: '000004', side: 'SELL', price: 12, quantity: 100 }),
      makeJournal({ id: '3', tradeDate: '2026-01-10', symbol: '000004', side: 'SELL', price: 15, quantity: 200 }),
    ]);
    // 第二笔卖出（200）超过剩余持仓（100）→ abnormal，但第一笔卖出（100）已结算，保留
    expect(r.closedTrades).toHaveLength(1);
    expect(r.closedTrades[0].quantity).toBe(100);
    // 超卖清空 → position 为空
    expect(r.positions).toHaveLength(0);
    // summary 不统计 abnormal 股票
    expect(r.summary.realizedPnl).toBe(0);
    expect(r.summary.closedTradeCount).toBe(0);
    expect(r.summary.warnings.join()).toContain('卖出超过持仓');
  });

  it('费用影响 realizedPnl：totalFee 优先于明细合计', () => {
    const r = calc([
      makeJournal({ id: '1', tradeDate: '2026-01-01', symbol: '000005', side: 'BUY', price: 10, quantity: 100, totalFee: 5 }),
      makeJournal({ id: '2', tradeDate: '2026-01-11', symbol: '000005', side: 'SELL', price: 12, quantity: 100, totalFee: 3 }),
    ]);
    // lotTotalCost 1005；sellNetIncome 1197；realizedPnl = 1197 − 1005 = 192
    const c = r.closedTrades[0];
    expect(c.costAmount).toBeCloseTo(1005, 6);
    expect(c.realizedPnl).toBeCloseTo(192, 6);
    expect(c.totalFee).toBeCloseTo(8, 6); // 买入费用摊 5 + 卖出费用 3
  });

  it('未填 totalFee 时按明细合计归一化费用', () => {
    const r = calc([
      makeJournal({ id: '1', tradeDate: '2026-01-01', symbol: '000006', side: 'BUY', price: 10, quantity: 100, commissionFee: 2, stampTax: 3 }),
      makeJournal({ id: '2', tradeDate: '2026-01-11', symbol: '000006', side: 'SELL', price: 12, quantity: 100, commissionFee: 1, otherFee: 2 }),
    ]);
    // 买入 totalFee 归一化 5；卖出 totalFee 归一化 3 → 同 totalFee 显式填写场景
    expect(r.closedTrades[0].realizedPnl).toBeCloseTo(192, 6);
  });

  it('当前价影响浮盈；未维护价为 null 且不计入汇总', () => {
    const r1 = calc(
      [makeJournal({ id: '1', tradeDate: '2026-01-01', symbol: '000007', side: 'BUY', price: 10, quantity: 100 })],
      [['000007', 12]],
    );
    expect(r1.positions[0].currentPrice).toBe(12);
    expect(r1.positions[0].marketValue).toBeCloseTo(1200, 6);
    expect(r1.positions[0].unrealizedPnl).toBeCloseTo(200, 6);
    expect(r1.positions[0].unrealizedReturnPoint).toBeCloseTo(20, 6);
    expect(r1.summary.unrealizedPnl).toBeCloseTo(200, 6);
    expect(r1.summary.currentMarketValue).toBeCloseTo(1200, 6);

    const r2 = calc([
      makeJournal({ id: '1', tradeDate: '2026-01-01', symbol: '000007', side: 'BUY', price: 10, quantity: 100 }),
    ]);
    expect(r2.positions[0].currentPrice).toBeNull();
    expect(r2.positions[0].unrealizedPnl).toBeNull();
    expect(r2.summary.unrealizedPnl).toBe(0); // 未维护价不计入
    expect(r2.summary.currentMarketValue).toBe(0);
    expect(r2.positions[0].warnings.join()).toContain('未维护当前价');
  });

  it('summary 胜率/平均收益率/平均持仓天数（盈亏平衡不计 win/loss）', () => {
    const r = calc([
      // A 盈利：realizedPnl 200，returnPoint 20，holdingDays 10
      makeJournal({ id: '1', tradeDate: '2026-01-01', symbol: 'A', side: 'BUY', price: 10, quantity: 100 }),
      makeJournal({ id: '2', tradeDate: '2026-01-11', symbol: 'A', side: 'SELL', price: 12, quantity: 100 }),
      // B 亏损：realizedPnl −200，returnPoint −10，holdingDays 5
      makeJournal({ id: '3', tradeDate: '2026-01-01', symbol: 'B', side: 'BUY', price: 20, quantity: 100 }),
      makeJournal({ id: '4', tradeDate: '2026-01-06', symbol: 'B', side: 'SELL', price: 18, quantity: 100 }),
      // C 盈亏平衡：realizedPnl 0，returnPoint 0，holdingDays 2
      makeJournal({ id: '5', tradeDate: '2026-01-01', symbol: 'C', side: 'BUY', price: 10, quantity: 100 }),
      makeJournal({ id: '6', tradeDate: '2026-01-03', symbol: 'C', side: 'SELL', price: 10, quantity: 100 }),
    ]);
    expect(r.summary.closedTradeCount).toBe(3);
    expect(r.summary.winCount).toBe(1);
    expect(r.summary.lossCount).toBe(1);
    expect(r.summary.winRate).toBeCloseTo(1 / 3, 6);
    expect(r.summary.averageReturnPoint).toBeCloseTo(10 / 3, 4); // (20 − 10 + 0) / 3
    expect(r.summary.averageHoldingDays).toBeCloseTo(17 / 3, 4); // (10 + 5 + 2) / 3
    expect(r.summary.realizedPnl).toBeCloseTo(0, 6); // 200 − 200 + 0
  });

  it('无已结算交易时 winRate=0 且有提示', () => {
    const r = calc([
      makeJournal({ id: '1', tradeDate: '2026-01-01', symbol: 'A', side: 'BUY', price: 10, quantity: 100 }),
    ]);
    expect(r.summary.closedTradeCount).toBe(0);
    expect(r.summary.winRate).toBe(0);
    expect(r.summary.warnings.join()).toContain('暂无已结算交易');
  });

  it('排序口径：同日带时间的买入先于不带时间（空值排到当日最晚）', () => {
    // 同一天：09:00@12 与 无时间@10；空值排最晚 → 09:00@12 先买先卖
    const r = calc([
      makeJournal({ id: 'late', tradeDate: '2026-01-01', symbol: 'X', side: 'BUY', price: 10, quantity: 100, tradeTime: '' }),
      makeJournal({ id: 'early', tradeDate: '2026-01-01', symbol: 'X', side: 'BUY', price: 12, quantity: 100, tradeTime: '09:00' }),
      makeJournal({ id: 'sell', tradeDate: '2026-01-02', symbol: 'X', side: 'SELL', price: 13, quantity: 100 }),
    ]);
    // 卖 100 配对最早的批次（09:00@12）→ costSum 1200
    expect(r.closedTrades[0].costAmount).toBeCloseTo(1200, 6);
    expect(r.closedTrades[0].buyJournalIds).toEqual(['early']);
    // 剩余无时间@10 100
    expect(r.positions[0].averageCost).toBeCloseTo(10, 6);
  });
});
