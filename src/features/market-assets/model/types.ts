/**
 * P1.9-A 行情资产只读 API 响应类型（与后端 marketdata.asset VO 对齐）。
 *
 * 后端 ApiResponse 使用 NON_NULL 序列化，null 字段会被省略；类型里仍声明为
 * `string | null`，消费方用 `??` 兜底。金额/价格/时间均与后端一致：
 * - 金额/价格：BigDecimal 十进制字符串；
 * - 分钟时间：带 offset 的 ISO-8601；日 K 时间：YYYY-MM-DD。
 */

export interface MarketAssetSecurity {
  canonicalSymbol: string;
  displayName: string;
  market: string;
  currency: string;
  timeZone: string;
}

export interface MarketAssetCombination {
  interval: string;
  dataSource: string;
  adjustType: string;
  barCount: number;
  firstBarTime: string | null;
  lastBarTime: string | null;
  latestFetchedAt: string | null;
  watermarkTime: string | null;
  /** FRESH / STALE / UNKNOWN：无权威日历或无法判断时为 UNKNOWN。 */
  freshness: string | null;
}

export interface MarketAssetAvailability {
  security: MarketAssetSecurity;
  combinations: MarketAssetCombination[];
}

export interface MarketAssetCatalogItem {
  security: MarketAssetSecurity;
  dailyBarCount: number;
  minuteBarCount: number;
  minuteIntervalCount: number;
  firstDailyDate: string | null;
  lastDailyDate: string | null;
  firstMinuteTime: string | null;
  lastMinuteTime: string | null;
  latestFetchedAt: string | null;
}

export interface MarketAssetCatalogPage {
  items: MarketAssetCatalogItem[];
  total: number;
  page: number;
  size: number;
}

export interface MarketAssetCatalogFilter {
  market?: string;
  keyword?: string;
  page?: number;
  size?: number;
}

export type MarketAssetCoverageStatus = 'VERIFIED' | 'PARTIAL' | 'UNKNOWN' | string;

export interface MarketAssetSeriesQuery {
  interval: string;
  from: string;
  to: string;
  adjustType: string;
  dataSource: string;
}

export interface MarketAssetSeriesAvailability {
  firstBarTime: string | null;
  lastBarTime: string | null;
  latestFetchedAt: string | null;
  watermarkTime: string | null;
}

export interface MarketAssetSeriesQuality {
  coverageStatus: MarketAssetCoverageStatus;
  actualBarCount: number;
  expectedBarCount: number | null;
  missingBarCount: number | null;
  suspectBarCount: number;
  truncated: boolean;
  reasonCodes: string[];
  /** FRESH / STALE / UNKNOWN：无权威日历或无法判断时为 UNKNOWN。 */
  freshness: string | null;
  /** 无法判定新鲜度时的原因；判定成功时为 null。 */
  freshnessDetail: string | null;
}

export interface MarketAssetSeriesSummary {
  firstOpen: string | null;
  lastClose: string | null;
  absoluteChange: string | null;
  changeRate: string | null;
  highestHigh: string | null;
  lowestLow: string | null;
  totalVolume: number;
  totalAmount: string | null;
  actualBarCount: number;
}

export interface MarketAssetBar {
  time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
  amount: string | null;
  qualityStatus: string | null;
  fetchedAt: string | null;
}

export interface MarketAssetSeries {
  security: MarketAssetSecurity;
  query: MarketAssetSeriesQuery;
  availability: MarketAssetSeriesAvailability;
  quality: MarketAssetSeriesQuality;
  summary: MarketAssetSeriesSummary;
  bars: MarketAssetBar[];
}

export interface MarketAssetRelatedTaskItem {
  kind: 'PLAN' | 'RUN' | string;
  id: number;
  name: string;
  taskType: string | null;
  intervalType: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface MarketAssetRelatedTasks {
  security: MarketAssetSecurity;
  plans: MarketAssetRelatedTaskItem[];
  runs: MarketAssetRelatedTaskItem[];
}

export interface MarketAssetSeriesParams {
  canonicalSymbol: string;
  interval: string;
  from: string;
  to: string;
  adjustType: string;
  dataSource: string;
}
