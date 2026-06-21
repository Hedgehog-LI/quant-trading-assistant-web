/**
 * 持仓与盈亏 FIFO 计算器（mock 模式核心）。
 *
 * 纯函数、无副作用、不访问 localStorage：输入 TradeFlowItem[] + priceMap + 计算日，
 * 输出当前持仓 / 已结算交易 / 汇总统计。
 *
 * 算法与后端 FifoCalculatorManager 逐字段对齐：
 *  - 排序：trade_date ASC → trade_time ASC（空值排到当日最晚）→ journalId ASC
 *  - 买入批次 unitCost = (price×quantity + totalFee) / quantity
 *  - 卖出 FIFO 配对，realizedPnl = 卖出净收入 − 配对买入成本
 *  - 精度 6 位小数 HALF_UP
 *  - 超卖：abnormal，保留 break 之前已配对的 closedTrades，统计字段置零，不抛异常
 *
 * decimal.js：使用显式 ROUND_HALF_UP helper，**不修改全局 Decimal.set**，
 * 以免影响 risk 模块的计算行为。
 */
import Decimal from 'decimal.js';
import dayjs from 'dayjs';
import type { TradeJournal, TradeSide } from '../../../shared/types/domain';
import { normalizeTotalFee } from '../../../shared/utils/fee';
import type {
  BuyLot,
  ClosedTrade,
  JournalId,
  PortfolioCalcResult,
  PortfolioPosition,
  PortfolioSummary,
  SymbolCalcResult,
  TradeFlowItem,
} from '../model/types';

const DECIMAL_SCALE = 6;
const ROUND = Decimal.ROUND_HALF_UP;

export const PORTFOLIO_DISCLAIMER =
  '持仓账本基于手工录入的交易记录按 FIFO 规则实时计算，当前价为手工维护，仅供复盘参考，不构成投资建议。';

// ============ decimal helpers（显式 HALF_UP，不动全局） ============

function toNum(d: Decimal): number {
  return d.toDecimalPlaces(DECIMAL_SCALE, ROUND).toNumber();
}

function round6(d: Decimal): Decimal {
  return d.toDecimalPlaces(DECIMAL_SCALE, ROUND);
}

function D(value: number | string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** 除法，分母为 0 时返回 0（防御性，保证不抛异常）。 */
function div(a: number | Decimal, b: number | Decimal): Decimal {
  const denom = D(b);
  if (denom.isZero()) return new Decimal(0);
  return D(a).div(denom);
}

/** 小数比率转百分点（×100），6 位小数。 */
function toPercent(ratio: Decimal): Decimal {
  return round6(ratio.times(100));
}

function diffDays(from: string, to: string): number {
  return dayjs(to).startOf('day').diff(dayjs(from).startOf('day'), 'day');
}

// ============ 排序 ============

/** trade_time 空值排到当日最晚（'' 视为最大）。 */
function cmpTimeNullsLast(a: string, b: string): number {
  if (a === '' && b === '') return 0;
  if (a === '') return 1;
  if (b === '') return -1;
  return a.localeCompare(b);
}

function cmpId(a: JournalId, b: JournalId): number {
  const sa = String(a);
  const sb = String(b);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

/** 按 FIFO 稳定排序：trade_date ASC → trade_time ASC（空最晚）→ journalId ASC。 */
function sortFlows(flows: TradeFlowItem[]): TradeFlowItem[] {
  return [...flows].sort(
    (a, b) =>
      a.tradeDate.localeCompare(b.tradeDate) ||
      cmpTimeNullsLast(a.tradeTime, b.tradeTime) ||
      cmpId(a.journalId, b.journalId),
  );
}

// ============ TradeJournal → TradeFlowItem ============

/**
 * 将交易记录转为计算器输入。
 * 集中处理：symbol 大写、tradeTime 空值、totalFee 归一化（totalFee 优先，否则明细合计）。
 */
export function toFlowItems(journals: TradeJournal[]): TradeFlowItem[] {
  return journals.map((j) => ({
    journalId: j.id,
    tradeDate: j.tradeDate,
    tradeTime: (j.tradeTime ?? '').trim(),
    symbol: (j.symbol ?? '').trim().toUpperCase(),
    name: j.name,
    side: j.side,
    price: j.price,
    quantity: j.quantity,
    totalFee: normalizeTotalFee(j),
  }));
}

// ============ 已结算交易组装 ============

interface Matched {
  lot: BuyLot;
  take: number;
}

function buildClosedTrade(
  sellFlow: TradeFlowItem,
  matched: Matched[],
  sellFee: Decimal,
  symbol: string,
  name: string | undefined,
): ClosedTrade {
  let matchedQty = 0;
  let costSum = new Decimal(0);
  let buyFeeAllocated = new Decimal(0);
  let earliestBuyDate: string | null = null;
  const buyJournalIds: JournalId[] = [];

  for (const m of matched) {
    matchedQty += m.take;
    costSum = costSum.plus(D(m.lot.unitCost).times(D(m.take)));
    // 买入费用按数量比例摊销（仅用于 totalFee 展示）
    const allocated = div(D(m.lot.buyFee).times(D(m.take)), D(m.lot.originalQty));
    buyFeeAllocated = buyFeeAllocated.plus(round6(allocated));
    buyJournalIds.push(m.lot.journalId);
    if (earliestBuyDate === null || m.lot.buyDate < earliestBuyDate) {
      earliestBuyDate = m.lot.buyDate;
    }
  }
  costSum = round6(costSum);
  buyFeeAllocated = round6(buyFeeAllocated);

  const sellGross = D(sellFlow.price).times(D(sellFlow.quantity));
  const sellNetIncome = round6(sellGross.minus(sellFee));
  const totalFee = round6(buyFeeAllocated.plus(sellFee));
  const realizedPnl = sellNetIncome.minus(costSum);
  const returnPoint = toPercent(div(realizedPnl, costSum));
  const holdingDays = diffDays(earliestBuyDate as string, sellFlow.tradeDate);
  const buyAveragePrice = toNum(div(costSum, D(matchedQty)));

  return {
    symbol,
    name,
    buyDate: earliestBuyDate as string,
    sellDate: sellFlow.tradeDate,
    holdingDays,
    quantity: matchedQty,
    buyAveragePrice,
    sellAveragePrice: sellFlow.price,
    costAmount: toNum(costSum),
    sellAmount: toNum(sellGross),
    totalFee: toNum(totalFee),
    realizedPnl: toNum(realizedPnl),
    returnPoint: toNum(returnPoint),
    profitable: realizedPnl.gt(0),
    buyJournalIds,
    sellJournalId: sellFlow.journalId,
  };
}

// ============ 单 symbol 计算 ============

/**
 * 计算单只股票的持仓与已结算交易。
 * @param symbol  股票代码
 * @param flows   该股票流水（函数内部会排序）
 * @param currentPrice 手工当前价（null 表示未维护）
 * @param today   计算日（用于持仓天数）
 */
export function calculateSymbol(
  symbol: string,
  flows: TradeFlowItem[],
  currentPrice: number | null,
  today: string,
): SymbolCalcResult {
  const sorted = sortFlows(flows);
  const openLots: BuyLot[] = []; // 数组模拟 deque，头部消费
  const closedTrades: ClosedTrade[] = [];
  const warnings: string[] = [];
  let abnormal = false;
  let name: string | undefined;

  for (const flow of sorted) {
    if (flow.name) name = flow.name;

    if (flow.side === ('BUY' as TradeSide)) {
      const fee = D(flow.totalFee);
      const grossCost = D(flow.price).times(D(flow.quantity));
      const lotTotalCost = round6(grossCost.plus(fee));
      const unitCost = toNum(div(lotTotalCost, D(flow.quantity)));
      openLots.push({
        journalId: flow.journalId,
        originalQty: flow.quantity,
        remainingQty: flow.quantity,
        unitCost,
        buyFee: flow.totalFee,
        buyDate: flow.tradeDate,
      });
    } else if (flow.side === ('SELL' as TradeSide)) {
      const sellFee = D(flow.totalFee);
      let qtyToMatch = flow.quantity;
      const matched: Matched[] = [];
      while (qtyToMatch > 0 && openLots.length > 0) {
        const lot = openLots[0];
        const take = Math.min(lot.remainingQty, qtyToMatch);
        matched.push({ lot, take });
        qtyToMatch -= take;
        lot.remainingQty -= take;
        if (lot.remainingQty === 0) openLots.shift();
      }
      if (qtyToMatch > 0) {
        // 卖出超过持仓：数据异常，停止该股票后续计算（与后端一致）
        abnormal = true;
        warnings.push(`${symbol} 存在卖出超过持仓的记录，已停止该股票后续计算`);
        break;
      }
      closedTrades.push(buildClosedTrade(flow, matched, sellFee, symbol, name));
    }
  }

  // 已结算交易统计（基于本 symbol 的 closedTrades）
  let realizedPnlSum = new Decimal(0);
  let sumReturnPoint = new Decimal(0);
  let sumHoldingDays = 0;
  let winCount = 0;
  let lossCount = 0;
  for (const c of closedTrades) {
    realizedPnlSum = realizedPnlSum.plus(D(c.realizedPnl));
    sumReturnPoint = sumReturnPoint.plus(D(c.returnPoint));
    sumHoldingDays += c.holdingDays;
    if (c.profitable) winCount++;
    else if (c.realizedPnl < 0) lossCount++;
  }

  // 组装当前持仓
  let posQty = 0;
  for (const lot of openLots) posQty += lot.remainingQty;

  let position: PortfolioPosition | null = null;
  let unrealizedForSummary = 0;
  let marketValueForSummary = 0;
  let currentCostForSummary = 0;

  if (posQty > 0) {
    let costAmount = new Decimal(0);
    let firstBuyDate: string | null = null;
    for (const lot of openLots) {
      costAmount = costAmount.plus(D(lot.unitCost).times(D(lot.remainingQty)));
      if (firstBuyDate === null || lot.buyDate < firstBuyDate) firstBuyDate = lot.buyDate;
    }
    costAmount = round6(costAmount);
    const averageCost = toNum(div(costAmount, D(posQty)));
    const holdingDays = diffDays(firstBuyDate as string, today);
    currentCostForSummary = toNum(costAmount);

    if (currentPrice == null) {
      warnings.push(`${symbol} 未维护当前价，浮盈/市值暂未计算`);
      position = {
        symbol,
        name,
        quantity: posQty,
        averageCost,
        costAmount: toNum(costAmount),
        currentPrice: null,
        marketValue: null,
        unrealizedPnl: null,
        unrealizedReturnPoint: null,
        firstBuyDate: firstBuyDate as string,
        holdingDays,
        warnings: [...warnings],
      };
    } else {
      const marketValue = D(currentPrice).times(D(posQty));
      const unrealizedPnl = marketValue.minus(costAmount);
      const unrealizedReturnPoint = toPercent(div(unrealizedPnl, costAmount));
      marketValueForSummary = toNum(marketValue);
      unrealizedForSummary = toNum(unrealizedPnl);
      position = {
        symbol,
        name,
        quantity: posQty,
        averageCost,
        costAmount: toNum(costAmount),
        currentPrice,
        marketValue: toNum(marketValue),
        unrealizedPnl: toNum(unrealizedPnl),
        unrealizedReturnPoint: toNum(unrealizedReturnPoint),
        firstBuyDate: firstBuyDate as string,
        holdingDays,
        warnings: [...warnings],
      };
    }
  }

  // 异常时统计字段全部置零（不污染汇总），但 closedTrades 列表保留
  if (abnormal) {
    unrealizedForSummary = 0;
    marketValueForSummary = 0;
    currentCostForSummary = 0;
  }

  return {
    symbol,
    name,
    position,
    closedTrades,
    abnormal,
    warnings: [...warnings],
    realizedPnlForSummary: abnormal ? 0 : toNum(realizedPnlSum),
    unrealizedPnlForSummary: unrealizedForSummary,
    currentCostForSummary,
    currentMarketValueForSummary: marketValueForSummary,
    sumReturnPointForStats: abnormal ? 0 : toNum(sumReturnPoint),
    sumHoldingDaysForStats: abnormal ? 0 : sumHoldingDays,
    closedTradeCountForStats: abnormal ? 0 : closedTrades.length,
    winCountForStats: abnormal ? 0 : winCount,
    lossCountForStats: abnormal ? 0 : lossCount,
  };
}

// ============ 汇总 ============

function ratioOf(part: number, total: number): Decimal {
  if (total === 0) return new Decimal(0);
  return new Decimal(part).div(new Decimal(total));
}

/** 汇总统计：胜率、平均收益率、平均持仓天数按已结算交易笔数等权。 */
export function summarize(perSymbol: SymbolCalcResult[]): PortfolioSummary {
  let realizedPnl = new Decimal(0);
  let unrealizedPnl = new Decimal(0);
  let currentCost = new Decimal(0);
  let currentMarketValue = new Decimal(0);
  let sumReturnPoint = new Decimal(0);
  let sumHoldingDays = 0;
  let closedCount = 0;
  let winCount = 0;
  let lossCount = 0;
  const warnings: string[] = [];

  for (const r of perSymbol) {
    realizedPnl = realizedPnl.plus(D(r.realizedPnlForSummary));
    unrealizedPnl = unrealizedPnl.plus(D(r.unrealizedPnlForSummary));
    currentCost = currentCost.plus(D(r.currentCostForSummary));
    currentMarketValue = currentMarketValue.plus(D(r.currentMarketValueForSummary));
    sumReturnPoint = sumReturnPoint.plus(D(r.sumReturnPointForStats));
    sumHoldingDays += r.sumHoldingDaysForStats;
    closedCount += r.closedTradeCountForStats;
    winCount += r.winCountForStats;
    lossCount += r.lossCountForStats;
    warnings.push(...r.warnings);
  }

  const totalPnl = round6(realizedPnl.plus(unrealizedPnl));
  const winRate = ratioOf(winCount, closedCount);
  const averageReturnPoint = closedCount > 0 ? toNum(div(sumReturnPoint, new Decimal(closedCount))) : 0;
  const averageHoldingDays =
    closedCount > 0 ? toNum(div(new Decimal(sumHoldingDays), new Decimal(closedCount))) : 0;

  if (closedCount === 0) {
    warnings.push('暂无已结算交易');
  }

  return {
    realizedPnl: toNum(realizedPnl),
    unrealizedPnl: toNum(unrealizedPnl),
    totalPnl: toNum(totalPnl),
    currentCost: toNum(currentCost),
    currentMarketValue: toNum(currentMarketValue),
    closedTradeCount: closedCount,
    winCount,
    lossCount,
    winRate: toNum(winRate),
    averageReturnPoint,
    averageHoldingDays,
    warnings,
    disclaimer: PORTFOLIO_DISCLAIMER,
  };
}

// ============ 全量计算 ============

/**
 * 计算全部股票（按 symbol 分组），返回持仓、已结算交易、汇总。
 * @param items    全量已归一化流水
 * @param priceMap symbol -> 最新手工当前价（null 表示整体未维护）
 * @param today    计算日
 */
export function calculateAll(
  items: TradeFlowItem[],
  priceMap: Map<string, number> | null,
  today: string,
): PortfolioCalcResult {
  // 按 symbol 分组，保持流入顺序
  const bySymbol = new Map<string, TradeFlowItem[]>();
  for (const item of items) {
    const arr = bySymbol.get(item.symbol);
    if (arr) arr.push(item);
    else bySymbol.set(item.symbol, [item]);
  }

  const perSymbol: SymbolCalcResult[] = [];
  for (const [symbol, flows] of bySymbol) {
    const currentPrice = priceMap?.get(symbol) ?? null;
    perSymbol.push(calculateSymbol(symbol, flows, currentPrice, today));
  }

  const summary = summarize(perSymbol);
  const positions = perSymbol
    .map((r) => r.position)
    .filter((p): p is PortfolioPosition => p !== null);
  // closedTrades 含所有 symbol（含 abnormal break 之前已配对的），与后端 allClosedTrades 一致
  const closedTrades = perSymbol.flatMap((r) => r.closedTrades);

  return { positions, closedTrades, summary };
}
