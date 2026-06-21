/**
 * 交易账本（持仓与盈亏）领域类型。
 *
 * 字段与后端 PORTFOLIO_API.md / VO 对齐：
 * - ClosedTrade   <-> ClosedTradeVO
 * - PortfolioPosition <-> PositionVO
 * - PortfolioSummary  <-> PortfolioSummaryVO
 * - PriceSnapshot <-> PriceSnapshotVO
 *
 * 约定：
 * - 所有金额字段为 number，后端 BigDecimal（6 位小数）直接接收。
 * - 语义上"未计算/无数据"用 null（对齐后端 JSON null），不用 undefined。
 * - returnPoint / unrealizedReturnPoint / averageReturnPoint 均为**百分点**（20.0 = 20%），
 *   展示时用 formatPointPercent，禁止再 ×100。
 * - journalId 在 mock 模式为 UUID 字符串，remote 模式为后端 Long（number），
 *   全程仅做相等比较，不做类型转换，故用联合类型 JournalId。
 */

import type { TradeSide } from '../../../shared/types/domain';

/** 交易流水 id：mock 为 UUID 字符串，remote 为后端 Long（number）。 */
export type JournalId = string | number;

// ============ 手工当前价 ============

export interface PriceSnapshotInput {
  /** 股票代码（保存时 trim + 大写） */
  symbol: string;
  /** 股票名称 */
  name?: string;
  /** 手工当前价，> 0 */
  currentPrice: number;
  /** 价格日期 YYYY-MM-DD */
  priceDate: string;
  /** 备注 */
  note?: string;
}

export interface PriceSnapshot extends PriceSnapshotInput {
  /** mock 为 UUID 字符串；remote 为后端 Long（number） */
  id: JournalId;
  createdAt: string;
  updatedAt: string;
}

// ============ 当前持仓 ============

export interface PortfolioPosition {
  symbol: string;
  name?: string;
  /** 当前持仓数量（剩余） */
  quantity: number;
  /** 平均成本（含买入费用摊）；quantity 为 0 时为 null */
  averageCost: number | null;
  /** 持仓成本合计 */
  costAmount: number;
  /** 手工当前价；未维护时为 null */
  currentPrice: number | null;
  /** 估算市值；未维护当前价时为 null */
  marketValue: number | null;
  /** 估算浮动盈亏；未维护当前价时为 null */
  unrealizedPnl: number | null;
  /** 浮动收益率（百分点）；未维护当前价时为 null */
  unrealizedReturnPoint: number | null;
  /** 剩余持仓中最早买入日期 */
  firstBuyDate: string;
  /** today - firstBuyDate */
  holdingDays: number;
  /** 告警提示（如未维护当前价） */
  warnings: string[];
}

// ============ 已结算交易 ============

export interface ClosedTrade {
  symbol: string;
  name?: string;
  /** 买入日期（多批次时取最早） */
  buyDate: string;
  /** 卖出日期 */
  sellDate: string;
  /** 持有天数（sellDate - buyDate） */
  holdingDays: number;
  /** 配对数量 */
  quantity: number;
  /** 买入均价（含买入费用摊） */
  buyAveragePrice: number;
  /** 卖出均价 */
  sellAveragePrice: number;
  /** 配对买入成本合计 */
  costAmount: number;
  /** 卖出毛收入（price × quantity） */
  sellAmount: number;
  /** 本笔总费用（买入费用按比例摊 + 卖出费用） */
  totalFee: number;
  /** 已实现盈亏（卖出净收入 - 配对买入成本） */
  realizedPnl: number;
  /** 收益率（百分点，realizedPnl / costAmount × 100） */
  returnPoint: number;
  /** 是否盈利（realizedPnl > 0） */
  profitable: boolean;
  /** 配对的买入交易记录 id 列表（可能多批） */
  buyJournalIds: JournalId[];
  /** 卖出交易记录 id */
  sellJournalId: JournalId;
}

// ============ 汇总统计 ============

export interface PortfolioSummary {
  /** 已实现盈亏合计 */
  realizedPnl: number;
  /** 浮动盈亏合计（未维护当前价的股票不计入） */
  unrealizedPnl: number;
  /** 总盈亏 = 已实现 + 浮动 */
  totalPnl: number;
  /** 当前持仓成本合计 */
  currentCost: number;
  /** 当前持仓市值合计（未维护当前价的股票不计入） */
  currentMarketValue: number;
  /** 已结算交易数 */
  closedTradeCount: number;
  /** 盈利交易数（realizedPnl > 0） */
  winCount: number;
  /** 亏损交易数（realizedPnl < 0，盈亏平衡不计入） */
  lossCount: number;
  /** 胜率（0~1，winCount / closedTradeCount） */
  winRate: number;
  /** 平均收益率（百分点，按已结算交易笔数等权） */
  averageReturnPoint: number;
  /** 平均持仓天数（按已结算交易笔数等权） */
  averageHoldingDays: number;
  /** 告警提示（超卖、缺价、无已结算交易等） */
  warnings: string[];
  /** 免责声明 */
  disclaimer: string;
}

// ============ calculator 内部类型（供测试断言） ============

/** 已归一化的交易流水项：calculator 的输入契约。 */
export interface TradeFlowItem {
  journalId: JournalId;
  /** 交易日期 YYYY-MM-DD */
  tradeDate: string;
  /** 交易时间，空字符串 '' 表示未录入（排序时排到当日最晚） */
  tradeTime: string;
  symbol: string;
  name?: string;
  side: TradeSide;
  price: number;
  quantity: number;
  /** 已归一化的总费用（totalFee 优先，否则明细合计） */
  totalFee: number;
}

/** 买入批次（FIFO 扣减单位）。 */
export interface BuyLot {
  journalId: JournalId;
  originalQty: number;
  remainingQty: number;
  /** 单股成本（含买入费用摊） */
  unitCost: number;
  /** 该笔买入总费用（用于按比例摊销展示） */
  buyFee: number;
  buyDate: string;
}

/** 单股票计算结果。 */
export interface SymbolCalcResult {
  symbol: string;
  name?: string;
  /** 当前持仓；无剩余批次（含超卖清空）时为 null */
  position: PortfolioPosition | null;
  /** 已结算交易（超卖时保留 break 之前已配对的，与后端 allClosedTrades 一致） */
  closedTrades: ClosedTrade[];
  /** 是否存在卖出超过持仓的异常 */
  abnormal: boolean;
  warnings: string[];
  /** 以下为供 summarize 累加的统计字段，abnormal 时全部置零，不污染汇总 */
  realizedPnlForSummary: number;
  unrealizedPnlForSummary: number;
  currentCostForSummary: number;
  currentMarketValueForSummary: number;
  sumReturnPointForStats: number;
  sumHoldingDaysForStats: number;
  closedTradeCountForStats: number;
  winCountForStats: number;
  lossCountForStats: number;
}

/** 全量计算结果。 */
export interface PortfolioCalcResult {
  positions: PortfolioPosition[];
  closedTrades: ClosedTrade[];
  summary: PortfolioSummary;
}

// ============ 盈亏颜色（A 股习惯：红涨绿跌） ============

export type PnlColor = 'red' | 'green' | 'default';

/** 盈利/正收益：红色 */
export const PROFIT_COLOR: PnlColor = 'red';
/** 亏损/负收益：绿色 */
export const LOSS_COLOR: PnlColor = 'green';
/** 持平/无数据：灰色 */
export const NEUTRAL_COLOR: PnlColor = 'default';

/** 按盈亏值取颜色：>0 红、<0 绿、=0 或无数据 灰。 */
export function pnlColor(value: number | null | undefined): PnlColor {
  if (value == null || value === 0) return NEUTRAL_COLOR;
  return value > 0 ? PROFIT_COLOR : LOSS_COLOR;
}

/** PnlColor → CSS 色值（A 股习惯：盈利红、亏损绿）。供 Statistic valueStyle / 文字色使用。 */
export const PNL_COLOR_HEX: Record<PnlColor, string> = {
  red: '#cf1322',
  green: '#3f8600',
  default: 'rgba(0, 0, 0, 0.45)',
};
