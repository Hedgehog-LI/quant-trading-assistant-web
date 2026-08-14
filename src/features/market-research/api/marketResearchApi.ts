import { client } from '../../../shared/api/client';
import { unwrap } from '../../../shared/api/unwrappers';
import { getSettings } from '../../settings/api/settingsApi';
import type {
  MarketResearchCalculation,
  MarketResearchRadar,
  MarketResearchRankingHistory,
  MarketResearchReadiness,
  MarketResearchSector,
  MarketResearchSectorDetail,
  MarketResearchSectorHistory,
  ResearchMarket,
  RotationState,
} from '../model/types';

const DEMO_NAMES = ['云启材料', '新域制造', '星桥软件', '远澜设备', '明川医药', '青岚消费', '辰光能源', '衡岳服务'];
const DEMO_STATES: RotationState[] = [
  'LEADING', 'LEADING', 'IMPROVING', 'IMPROVING', 'WEAKENING', 'WEAKENING', 'LAGGING', 'LAGGING',
];
const DEMO_RS = [0.93, 0.84, 0.69, 0.57, 0.76, 0.63, 0.28, 0.12];
const DEMO_MOMENTUM = [0.09, 0.04, 0.15, 0.08, -0.13, -0.07, -0.05, -0.12];

function demoSectors(market: ResearchMarket): MarketResearchSector[] {
  return DEMO_NAMES.map((sectorName, index) => ({
    sectorId: 9001 + index,
    sectorName,
    providerSectorId: `DEMO/${market}/${String(index + 1).padStart(3, '0')}`,
    sectorReturn: [0.064, 0.047, 0.031, 0.019, 0.026, 0.008, -0.021, -0.039][index],
    benchmarkReturn: 0.012,
    relativeReturn: [0.052, 0.035, 0.019, 0.007, 0.014, -0.004, -0.033, -0.051][index],
    rsRankPercentile: DEMO_RS[index],
    currentRank: index + 1,
    previousRank: [2, 1, 6, 7, 3, 4, 5, 8][index],
    meanRankPercentile: DEMO_RS[index] - DEMO_MOMENTUM[index] / 2,
    rankPercentileStdDev: [0.05, 0.07, 0.11, 0.13, 0.16, 0.12, 0.09, 0.06][index],
    topBucketOccupancyRate: [1, 0.8, 0.6, 0.4, 0.6, 0.2, 0, 0][index],
    consecutiveLeadingDays: index < 2 ? 3 - index : 0,
    consecutiveLaggingDays: index > 5 ? index - 5 : 0,
    rankPercentileChange: DEMO_MOMENTUM[index],
    rotationState: DEMO_STATES[index],
    leadingName: `示例成分 ${index + 1}`,
    leadingSymbol: `DEMO.${market}${String(index + 1).padStart(3, '0')}`,
    evidence: [
      `相对强弱百分位 ${(DEMO_RS[index] * 100).toFixed(0)}%`,
      `窗口位次变化 ${DEMO_MOMENTUM[index] >= 0 ? '+' : ''}${(DEMO_MOMENTUM[index] * 100).toFixed(0)}%`,
    ],
    reasonCodes: ['LOCAL_DEMO'],
  }));
}

function demoHistory(sectorId: number, oneDay = false): MarketResearchSectorHistory {
  const index = Math.max(0, Math.min(DEMO_NAMES.length - 1, sectorId - 9001));
  const offsets = [-0.18, -0.11, -0.15, -0.06, -0.02, 0.04, 0.01, 0.08, 0.05, 0.1];
  return {
    sectorId,
    sectorName: DEMO_NAMES[index],
    points: offsets.map((offset, pointIndex) => ({
      asOfDate: `2026-08-${String(pointIndex + 3).padStart(2, '0')}`,
      publicationBatchId: oneDay ? null : 7000 + pointIndex,
      sourceBatchId: 7000 + pointIndex,
      rsRankPercentile: Math.max(0.04, Math.min(0.96, DEMO_RS[index] + offset)),
      currentRank: Math.max(1, Math.round((1 - Math.max(0.04, Math.min(0.96, DEMO_RS[index] + offset))) * 8)),
      meanRankPercentile: oneDay ? null : DEMO_RS[index] - 0.04,
      qualityStatus: 'OK',
    })),
  };
}

function demoRadar(market: ResearchMarket, windowDays: number): MarketResearchRadar {
  const oneDay = windowDays === 1;
  const sectors = demoSectors(market).map((sector, index) => oneDay ? {
    ...sector,
    currentRank: index + 1,
    previousRank: null,
    meanRankPercentile: null,
    rankPercentileStdDev: null,
    topBucketOccupancyRate: null,
    consecutiveLeadingDays: null,
    consecutiveLaggingDays: null,
    rankPercentileChange: null,
    rotationState: 'INSUFFICIENT_DATA' as RotationState,
    evidence: [
      `当日涨跌 ${((sector.sectorReturn ?? 0) * 100).toFixed(1)}%`,
      `当日强度百分位 ${((sector.rsRankPercentile ?? 0) * 100).toFixed(0)}%`,
    ],
    reasonCodes: ['ONE_DAY_STRENGTH_ONLY', 'ROTATION_REQUIRES_5_DAYS'],
  } : sector);
  return {
    publicationBatchId: oneDay ? null : 7009,
    sourceBatchId: 7009,
    strengthCalculationRunId: oneDay ? null : 7101,
    momentumCalculationRunId: oneDay ? null : 7102,
    analysisMode: oneDay ? 'ONE_DAY_STRENGTH' : 'MULTI_DAY_ROTATION',
    rotationAvailable: !oneDay,
    market,
    asOfDate: '2026-08-12',
    strengthWindowDays: windowDays,
    momentumWindowDays: oneDay ? 0 : 5,
    scope: 'RANKED_UNIVERSE',
    scopeDescription: '排行样本，不代表全市场',
    strengthFormulaCode: 'RELATIVE_STRENGTH',
    momentumFormulaCode: oneDay ? null : 'ROTATION_PERSISTENCE',
    formulaVersion: 'v1',
    parameterHash: oneDay ? null : 'LOCAL_DEMO',
    qualityStatus: 'OK',
    reasonCodes: ['LOCAL_DEMO', 'CAPITAL_FLOW_UNAVAILABLE'],
    sourceQuoteTime: '2026-08-12T15:10:00',
    publishedAt: oneDay ? null : '2026-08-12T15:12:00',
    actualItemCount: sectors.length,
    expectedItemCount: 100,
    coverageRate: sectors.length / 100,
    flowMetricNature: 'UNAVAILABLE',
    capitalFlow: null,
    sectors,
  };
}

export function getMarketResearchReadiness(market: ResearchMarket): Promise<MarketResearchReadiness> {
  if (getSettings().apiMode === 'mock') {
    const radar = demoRadar(market, 20);
    return Promise.resolve({ market, scope: radar.scope, scopeDescription: radar.scopeDescription,
      latestCloseBatchId: 7009, asOfDate: radar.asOfDate, sourceQuoteTime: radar.sourceQuoteTime,
      actualItemCount: radar.actualItemCount, expectedItemCount: radar.expectedItemCount,
      isTruncated: false, coverageRate: radar.coverageRate, qualityStatus: 'OK', reasonCodes: ['LOCAL_DEMO'] });
  }
  return unwrap<MarketResearchReadiness>(client.get('/market-research/readiness', { params: { market } }));
}

export function getMarketResearchRadar(market: ResearchMarket, windowDays: number): Promise<MarketResearchRadar> {
  if (getSettings().apiMode === 'mock') return Promise.resolve(demoRadar(market, windowDays));
  return unwrap<MarketResearchRadar>(client.get('/market-research/radar', { params: { market, window: windowDays } }));
}

export function getMarketResearchRankingHistory(
  market: ResearchMarket, windowDays: number, days = 20,
): Promise<MarketResearchRankingHistory> {
  if (getSettings().apiMode === 'mock') {
    return Promise.resolve({ market, windowDays, scope: 'RANKED_UNIVERSE',
      sectors: demoSectors(market).map((sector) => demoHistory(sector.sectorId, windowDays === 1)) });
  }
  return unwrap<MarketResearchRankingHistory>(client.get('/market-research/sectors/ranking-history', {
    params: { market, window: windowDays, days },
  }));
}

export function getMarketResearchSectorDetail(
  sectorId: number, market: ResearchMarket, windowDays: number, days = 20,
): Promise<MarketResearchSectorDetail> {
  if (getSettings().apiMode === 'mock') {
    const sectors = demoSectors(market);
    const sector = sectors.find((item) => item.sectorId === sectorId) ?? sectors[0];
    return Promise.resolve({ sectorId: sector.sectorId, sectorName: sector.sectorName,
      providerSectorId: sector.providerSectorId, taxonomyVersion: 'LOCAL_DEMO_V1', market, windowDays,
      analysisMode: windowDays === 1 ? 'ONE_DAY_STRENGTH' : 'MULTI_DAY_ROTATION',
      rotationAvailable: windowDays !== 1,
      scope: 'RANKED_UNIVERSE', scopeDescription: '排行样本，不代表全市场',
      leadingName: sector.leadingName, leadingSymbol: sector.leadingSymbol, trackingSymbol: null,
      history: demoHistory(sector.sectorId, windowDays === 1).points, sourceQuoteTime: '2026-08-12T15:10:00',
      actualItemCount: 8, expectedItemCount: 100, coverageRate: 0.08,
      qualityStatus: 'OK', reasonCodes: ['LOCAL_DEMO'] });
  }
  return unwrap<MarketResearchSectorDetail>(client.get(`/market-research/sectors/${sectorId}`, {
    params: { market, window: windowDays, days },
  }));
}

export function calculateMarketResearch(
  market: ResearchMarket, windowDays: number,
): Promise<MarketResearchCalculation> {
  if (getSettings().apiMode === 'mock') {
    return Promise.resolve({ publicationBatchId: 7009, asOfDate: '2026-08-12',
      strengthWindowDays: windowDays, momentumWindowDays: 5, status: 'PUBLISHED',
      sectorCount: 8, reused: true });
  }
  return unwrap<MarketResearchCalculation>(client.post('/market-research/calculations', undefined, {
    params: { market, window: windowDays },
  }));
}
