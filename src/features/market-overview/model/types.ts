/**
 * MR-1A 市场全景 API 类型：逐字段对齐后端 `MarketOverviewVO`（docs/api/MARKET_RESEARCH_API.md §8）。
 * 数值为 JSON number（BigDecimal 序化）；所有可空指标为 `number | null`，
 * null 一律表示"该日该指标不可计算"，页面必须显示断点或 '--'，禁止当作 0。
 */

export type OverviewQualityStatus = 'OK' | 'DEGRADED' | 'NO_DATA';

export interface MarketOverviewMetadata {
  market: string;
  startDate: string;
  endDate: string;
  /** 数据截至交易日（窗口内最后一个有基准日 K 的交易日；无数据为 null）。 */
  dataAsOf: string | null;
  /** 数据范围；当前必须是 SAMPLE（Top-N 样本，不代表全市场）。 */
  dataScope: string;
  sampleSize: number;
  benchmarkSymbol: string;
  providerCodes: string[];
  taxonomyCode: string;
  /** M-22 窗口样本日 K 覆盖率（小数，0..1）；低于 0.90 触发 LOW_BAR_COVERAGE WARN。 */
  barCoverage: number | null;
  /** M-22 行业映射覆盖率（小数）；低于 0.90 触发 WARN，低于 0.50 行业迁移阻断为空。 */
  membershipCoverage: number | null;
  /** 真实合格交易日数（当日有基准且样本覆盖 ≥0.90）；中期结论门禁 ≥120。 */
  qualifiedTradingDays: number;
  qualityStatus: OverviewQualityStatus;
  limitations: string[];
  unavailableMetrics: string[];
}

export interface BenchmarkPoint {
  tradeDate: string;
  closePrice: number | null;
  dailyReturn: number | null;
  amount: number | null;
  ma20: number | null;
  ma60: number | null;
  /** 回撤（≤0 小数，相对窗口内累计峰值）。 */
  drawdown: number | null;
}

export interface ActivityPoint {
  tradeDate: string;
  /** 样本域市场成交额（元），非全市场口径。 */
  marketTurnover: number | null;
  turnoverMedian20: number | null;
  turnoverMedian60: number | null;
  /** 活跃度比值 = marketTurnover / turnoverMedian20。 */
  activityRatio: number | null;
  /** 成交扩散：当日成交额高于自身前 20 日中位数的证券占比。 */
  activeStockRatio: number | null;
  validStocks: number;
}

export interface BreadthPoint {
  tradeDate: string;
  advancingStocks: number;
  decliningStocks: number;
  flatStocks: number;
  validStocks: number;
  advanceRatio: number | null;
  /** 累计 A/D 线；出现空有效池后中断为 null。 */
  adLine: number | null;
  aboveMa20Stocks: number;
  aboveMa20Ratio: number | null;
}

export interface LiquidityProxyPoint {
  tradeDate: string;
  medianIlliquidity: number | null;
  p90Illiquidity: number | null;
  qualifiedStocks: number;
  zeroAmountRows: number;
}

export interface LiquidityProxySeries {
  unit: string;
  caliber: string;
  days: LiquidityProxyPoint[];
}

export interface IndustryMigrationRow {
  tradeDate: string;
  industryCode: string;
  industryName: string;
  turnover: number | null;
  /** 行业成交额 / 覆盖域总成交额（0..1 小数）；是"交易注意力"占比，不是资金流入。 */
  turnoverShare: number | null;
  previousDayShareChange: number | null;
  median20Share: number | null;
  median20ShareChange: number | null;
  /** 当日按成交额降序名次（1..8）；OTHER 聚合为 null。 */
  rank: number | null;
  coveredStocks: number;
}

export interface CoverageGap {
  uncoveredSampleStocks: number;
  uncoveredTurnoverAmount: number;
  symbols: string[];
}

export interface ProviderAttribution {
  dataset: string;
  providers: string[];
}

export interface QualityFinding {
  code: string;
  severity: 'INFO' | 'WARN';
  message: string;
  affectedCount: number;
}

export interface MarketOverviewQuality {
  coverageGap: CoverageGap;
  providerAttribution: ProviderAttribution[];
  qualityFindings: QualityFinding[];
  assumptions: string[];
  unavailableMetrics: string[];
}

export interface MarketOverview {
  metadata: MarketOverviewMetadata;
  benchmarkSeries: BenchmarkPoint[];
  activitySeries: ActivityPoint[];
  breadthSeries: BreadthPoint[];
  liquidityProxySeries: LiquidityProxySeries;
  industryTurnoverMigration: IndustryMigrationRow[];
  quality: MarketOverviewQuality;
}
