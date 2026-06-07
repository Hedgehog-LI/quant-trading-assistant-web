/**
 * 领域类型定义。
 * 所有枚举使用联合类型（tsconfig erasableSyntaxOnly 禁止 enum）。
 * 字段与后端 API 对齐，前端不自创语义。
 */

// ============ 联合类型枚举 ============

export type MarketType = 'A_SHARE' | 'HK' | 'US' | 'ETF' | 'OTHER';
export type TradeStyle = 'SHORT_TERM' | 'DO_T' | 'SWING' | 'OBSERVE';
export type AttentionLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'DONE' | 'CANCELLED';
export type TradeSide = 'BUY' | 'SELL';
export type ReviewStatus = 'PENDING' | 'REVIEWED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type EmotionTag = 'CALM' | 'FOMO' | 'FEAR' | 'REVENGE' | 'HESITATION';
export type MistakeTag =
  | 'CHASE_HIGH'
  | 'PANIC_SELL'
  | 'NO_STOP_LOSS'
  | 'OVERSIZED_POSITION'
  | 'NO_PLAN'
  | 'BROKE_RULE';

// ============ 领域模型 ============

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  market?: MarketType;
  groupName?: string;
  watchReason?: string;
  tradeStyle?: TradeStyle;
  attentionLevel?: AttentionLevel;
  supportPrice?: number;
  resistancePrice?: number;
  stopLossPrice?: number;
  riskNote?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TradePlan {
  id: string;
  planDate: string;
  symbol: string;
  name?: string;
  planStatus: PlanStatus;
  buyCondition?: string;
  sellCondition?: string;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  plannedPositionRatio?: number;
  maxLossAmount?: number;
  allowedToTrade: boolean;
  riskNote?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradeJournal {
  id: string;
  tradeDate: string;
  tradeTime?: string;
  symbol: string;
  name?: string;
  side: TradeSide;
  price: number;
  quantity: number;
  amount?: number;
  positionRatio?: number;
  planId?: string;
  reason?: string;
  planStopLoss?: number;
  planTakeProfit?: number;
  followedPlan?: boolean;
  emotionTags: EmotionTag[];
  mistakeTags: MistakeTag[];
  actualResult?: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewNote {
  id: string;
  reviewDate: string;
  symbol?: string;
  title: string;
  marketContext?: string;
  planSummary?: string;
  actionSummary?: string;
  rightThings?: string;
  wrongThings?: string;
  ruleChanges?: string;
  nextActions?: string;
  linkedJournalIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ============ 风控计算 ============

export interface RiskCalculationInput {
  totalCapital: number;
  riskPercent: number;
  buyPrice: number;
  stopLossPrice: number;
  maxPositionRatio: number;
  lotSize: number;
}

export interface RiskCalculationResult {
  riskAmount: number;
  perShareRisk: number;
  riskBasedQuantity: number;
  positionCapQuantity: number;
  finalQuantity: number;
  estimatedLoss: number;
  positionAmount: number;
  positionRatio: number;
  riskLevel: RiskLevel;
  warnings: string[];
  disclaimer: string;
}

// ============ Dashboard 聚合 ============

export interface DashboardSummary {
  date: string;
  enabledWatchlistCount: number;
  activePlanCount: number;
  todayJournalCount: number;
  pendingReviewCount: number;
  todayReviewCount: number;
  riskWarnings: string[];
  highAttentionStocks: WatchlistItem[];
  todayPlans: TradePlan[];
  pendingReviewJournals: TradeJournal[];
}

// ============ Settings ============

export interface AppSettings {
  apiMode: 'mock' | 'remote';
  apiBaseUrl: string;
}
