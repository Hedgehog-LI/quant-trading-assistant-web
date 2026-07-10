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

/** 持仓快照对比明细变化类型（v0.1.1） */
export type SnapshotChangeType = 'NEW' | 'INCREASED' | 'REDUCED' | 'CLOSED' | 'UNCHANGED';
/** 持仓快照与账本对账状态（v0.1.1） */
export type ReconciliationStatus = 'MATCHED' | 'QUANTITY_MISMATCH' | 'SNAPSHOT_ONLY' | 'LEDGER_ONLY';
/** 工作台待办码（v0.1.1） */
export type DashboardTodoCode =
  | 'PENDING_REVIEW'
  | 'UNLINKED_TRADE_PLAN'
  | 'TRADE_AGAINST_PLAN'
  | 'MISSING_STOP_LOSS'
  | 'STALE_POSITION_SNAPSHOT'
  | 'POSITION_RECONCILIATION_MISMATCH';
/** 工作台待办级别（v0.1.1） */
export type DashboardTodoLevel = 'INFO' | 'WARNING' | 'RISK';

/**
 * 实体 ID 类型。
 * - mock 模式：前端 generateId 生成的 UUID 字符串。
 * - remote 模式：后端数据库主键 Long（数字）。
 * 两种模式运行时不混用；React key、JSON 序列化、字符串化均兼容。
 */
export type EntityId = string | number;

// ============ 领域模型 ============

export interface WatchlistItem {
  id: EntityId;
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
  id: EntityId;
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
  id: EntityId;
  tradeDate: string;
  tradeTime?: string;
  symbol: string;
  name?: string;
  side: TradeSide;
  price: number;
  quantity: number;
  amount?: number;
  /** 佣金 */
  commissionFee?: number;
  /** 印花税 */
  stampTax?: number;
  /** 过户费 */
  transferFee?: number;
  /** 其他费用 */
  otherFee?: number;
  /** 总费用：填写后优先使用；为空时按 commissionFee+stampTax+transferFee+otherFee 合计 */
  totalFee?: number;
  positionRatio?: number;
  planId?: EntityId;
  /** 关联计划的计划日期（remote 模式由后端返回，mock 模式可空） */
  planDate?: string;
  /** 关联计划的状态（remote 模式由后端返回） */
  planStatus?: PlanStatus;
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
  id: EntityId;
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
  linkedJournalIds: EntityId[];
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

export interface DashboardTodo {
  code: DashboardTodoCode;
  level: DashboardTodoLevel;
  title: string;
  description: string;
  count: number;
  targetPath: string;
}

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
  /** 结构化待办列表（v0.1.1 新增；remote 由后端聚合返回，mock 由纯函数计算） */
  todos?: DashboardTodo[];
}

// ============ 持仓快照对比与对账（v0.1.1） ============

export interface PositionSnapshotComparisonItem {
  symbol: string;
  name?: string;
  changeType: SnapshotChangeType;
  baseQuantity?: number;
  targetQuantity?: number;
  quantityDelta: number;
  baseCostPrice?: number;
  targetCostPrice?: number;
  marketValueDelta: number;
  unrealizedPnlDelta: number;
}

export interface PositionSnapshotComparison {
  baseSnapshotId: EntityId;
  targetSnapshotId: EntityId;
  baseSnapshotTime: string;
  targetSnapshotTime: string;
  baseStatus: string;
  targetStatus: string;
  totalCostDelta: number;
  totalMarketValueDelta: number;
  totalUnrealizedPnlDelta: number;
  positionCountDelta: number;
  items: PositionSnapshotComparisonItem[];
}

export interface PositionSnapshotReconciliationItem {
  symbol: string;
  name?: string;
  status: ReconciliationStatus;
  snapshotQuantity: number;
  ledgerQuantity: number;
  quantityDifference: number;
  snapshotCostPrice?: number;
  ledgerAverageCost?: number;
}

export interface PositionSnapshotReconciliation {
  snapshotId: EntityId;
  snapshotTime: string;
  matchedCount: number;
  mismatchCount: number;
  hasMismatch: boolean;
  warnings: string[];
  items: PositionSnapshotReconciliationItem[];
}

// ============ Settings ============

export interface AppSettings {
  apiMode: 'mock' | 'remote';
  apiBaseUrl: string;
}

// ============ Market Data（v0.2.0 行情基础） ============

export interface StockBasic {
  id: EntityId;
  canonicalSymbol: string;
  symbol: string;
  name?: string;
  market: string;
  listDate?: string;
  delisted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockDailyBar {
  id: EntityId;
  canonicalSymbol: string;
  tradeDate: string;
  adjustType: string;
  dataSource: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
  amount: number;
  fetchedAt?: string;
}

export interface DailyBarImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export type StockMarket = 'SH' | 'SZ' | 'BJ';
export type AdjustType = 'NONE' | 'QF' | 'HF';

export interface ProviderStatus {
  providerCode: string;
  configured: boolean;
  reachable: boolean;
  lastError?: string | null;
  lastSuccessAt?: string | null;
}

export interface StockQuoteSnapshot {
  id: EntityId;
  canonicalSymbol: string;
  quoteTime: string;
  currentPrice: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  preClosePrice?: number;
  volume: number;
  amount: number;
  tradeStatus?: string;
  dataSource: string;
  fetchedAt: string;
}

export interface MarketDataSyncTask {
  id: EntityId;
  taskType: string;
  provider: string;
  scopeJson: string;
  status: string;
  totalCount?: number;
  successCount?: number;
  failCount?: number;
  insertedCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  startedAt?: string;
  finishedAt?: string;
  lastErrorCode?: string;
  errorSummaryJson?: string;
  createdAt: string;
}

export interface MarketDataAlert {
  id: EntityId;
  alertType: string;
  severity: string;
  canonicalSymbol?: string;
  quoteTime?: string;
  tradeDate?: string;
  provider: string;
  taskId?: number;
  message: string;
  triggerValueJson?: string;
  resolved: boolean;
  createdAt: string;
}
