export type ResearchMarket = 'CN' | 'HK' | 'US';
export type RotationState = 'LEADING' | 'IMPROVING' | 'WEAKENING' | 'LAGGING' | 'INSUFFICIENT_DATA';

export interface MarketResearchReadiness {
  market: ResearchMarket;
  scope: string;
  scopeDescription: string;
  latestCloseBatchId: number | null;
  asOfDate: string | null;
  sourceQuoteTime: string | null;
  actualItemCount: number | null;
  expectedItemCount: number | null;
  isTruncated: boolean | null;
  coverageRate: number | null;
  qualityStatus: string;
  reasonCodes: string[];
}

export interface MarketResearchSector {
  sectorId: number;
  sectorName: string;
  providerSectorId: string;
  sectorReturn: number | null;
  benchmarkReturn: number | null;
  relativeReturn: number | null;
  rsRankPercentile: number | null;
  currentRank: number | null;
  previousRank: number | null;
  meanRankPercentile: number | null;
  rankPercentileStdDev: number | null;
  topBucketOccupancyRate: number | null;
  consecutiveLeadingDays: number | null;
  consecutiveLaggingDays: number | null;
  rankPercentileChange: number | null;
  rotationState: RotationState;
  leadingName: string | null;
  leadingSymbol: string | null;
  evidence: string[];
  reasonCodes: string[];
}

export interface MarketResearchRadar {
  publicationBatchId: number | null;
  sourceBatchId: number | null;
  strengthCalculationRunId: number | null;
  momentumCalculationRunId: number | null;
  analysisMode: 'ONE_DAY_STRENGTH' | 'MULTI_DAY_ROTATION';
  rotationAvailable: boolean;
  market: ResearchMarket;
  asOfDate: string;
  strengthWindowDays: number;
  momentumWindowDays: number;
  scope: string;
  scopeDescription: string;
  strengthFormulaCode: string;
  momentumFormulaCode: string | null;
  formulaVersion: string;
  parameterHash: string | null;
  qualityStatus: string;
  reasonCodes: string[];
  sourceQuoteTime: string | null;
  publishedAt: string | null;
  actualItemCount: number;
  expectedItemCount: number;
  coverageRate: number | null;
  flowMetricNature: 'UNAVAILABLE' | 'ESTIMATED' | 'PROVIDER_REPORTED';
  capitalFlow: number | null;
  sectors: MarketResearchSector[];
}

export interface MarketResearchHistoryPoint {
  asOfDate: string;
  publicationBatchId: number | null;
  sourceBatchId: number | null;
  rsRankPercentile: number | null;
  currentRank: number | null;
  meanRankPercentile: number | null;
  qualityStatus: string;
}

export interface MarketResearchSectorHistory {
  sectorId: number;
  sectorName: string;
  points: MarketResearchHistoryPoint[];
}

export interface MarketResearchRankingHistory {
  market: ResearchMarket;
  windowDays: number;
  scope: string;
  sectors: MarketResearchSectorHistory[];
}

export interface MarketResearchSectorDetail {
  sectorId: number;
  sectorName: string;
  providerSectorId: string;
  taxonomyVersion: string;
  market: ResearchMarket;
  windowDays: number;
  analysisMode: 'ONE_DAY_STRENGTH' | 'MULTI_DAY_ROTATION';
  rotationAvailable: boolean;
  scope: string;
  scopeDescription: string;
  leadingName: string | null;
  leadingSymbol: string | null;
  trackingSymbol: string | null;
  history: MarketResearchHistoryPoint[];
  sourceQuoteTime: string | null;
  actualItemCount: number;
  expectedItemCount: number;
  coverageRate: number | null;
  qualityStatus: string;
  reasonCodes: string[];
}

export interface MarketResearchCalculation {
  publicationBatchId: number;
  asOfDate: string;
  strengthWindowDays: number;
  momentumWindowDays: number;
  status: string;
  sectorCount: number;
  reused: boolean;
}
