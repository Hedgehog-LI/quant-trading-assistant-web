/**
 * MR-1A 市场全景 API adapter。
 *
 * - remote：GET /market-research/overview?market=&start=&end=（同源 /api/v1，由 shared client 提供）；
 *   失败直接抛错，禁止回退 mock。
 * - mock：仅本地开发演示；行业代码用 DEM_ 前缀虚构、基准为 DEMO.IDX01，携带 LOCAL_DEMO
 *   finding，不与 remote 数据混合。
 */
import { client } from '../../../shared/api/client';
import { unwrap } from '../../../shared/api/unwrappers';
import { getSettings } from '../../settings/api/settingsApi';
import type {
  ActivityPoint,
  BenchmarkPoint,
  BreadthPoint,
  IndustryMigrationRow,
  MarketOverview,
} from '../model/types';

export type OverviewMarket = 'CN';

const DEMO_INDUSTRIES = [
  { code: 'DEM_A', name: '演示材料' },
  { code: 'DEM_B', name: '演示制造' },
  { code: 'DEM_C', name: '演示软件' },
  { code: 'DEM_D', name: '演示医药' },
  { code: 'DEM_E', name: '演示能源' },
  { code: 'DEM_F', name: '演示消费' },
  { code: 'DEM_G', name: '演示设备' },
  { code: 'DEM_H', name: '演示服务' },
];

/** 自 baseDate 起生成 count 个交易日（跳过周末的确定性日历）。 */
function demoTradingDates(count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date('2026-06-01T00:00:00Z');
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** mock 演示数据：确定性正弦合成（明确虚构，不冒充真实行情）。 */
function demoOverview(start: string, end: string): MarketOverview {
  const dates = demoTradingDates(28);
  const benchmarkSeries: BenchmarkPoint[] = dates.map((date, index) => {
    const close = 3000 + 60 * Math.sin(index / 5) + index * 4;
    return {
      tradeDate: date,
      closePrice: Number(close.toFixed(2)),
      dailyReturn: index === 0 ? null : Number((Math.sin(index / 5) / 400).toFixed(6)),
      amount: Number((3.2e10 + 4e9 * Math.cos(index / 4)).toFixed(0)),
      ma20: index < 19 ? null : Number((3000 + index * 2).toFixed(2)),
      ma60: null,
      drawdown: Number(Math.min(0, Math.sin(index / 7) / 30).toFixed(6)),
    };
  });
  const activitySeries: ActivityPoint[] = dates.map((date, index) => {
    const turnover = 3.6e11 + 3e10 * Math.cos(index / 4);
    return {
      tradeDate: date,
      marketTurnover: Number(turnover.toFixed(0)),
      turnoverMedian20: index < 19 ? null : Number((3.55e11).toFixed(0)),
      turnoverMedian60: null,
      activityRatio: index < 19 ? null : Number((turnover / 3.55e11).toFixed(6)),
      activeStockRatio: Number((0.4 + 0.18 * Math.sin(index / 3)).toFixed(6)),
      validStocks: 150,
    };
  });
  const breadthSeries: BreadthPoint[] = dates.map((date, index) => {
    const advancing = Math.round(75 + 30 * Math.sin(index / 3));
    const declining = 150 - advancing - 11;
    return {
      tradeDate: date,
      advancingStocks: advancing,
      decliningStocks: declining,
      flatStocks: 11,
      validStocks: 150,
      advanceRatio: Number((advancing / 150).toFixed(6)),
      adLine: (advancing - declining) * (index + 1) / 6,
      aboveMa20Stocks: Math.round(60 + 25 * Math.cos(index / 5)),
      aboveMa20Ratio: Number(((60 + 25 * Math.cos(index / 5)) / 150).toFixed(6)),
    };
  });
  const industryTurnoverMigration: IndustryMigrationRow[] = dates.flatMap((date, index) =>
    DEMO_INDUSTRIES.map((industry, industryIndex): IndustryMigrationRow => {
      const share = 0.06 + 0.04 * Math.sin(index / 4 + industryIndex);
      return {
        tradeDate: date,
        industryCode: industry.code,
        industryName: industry.name,
        turnover: Number((share * 3.6e11).toFixed(0)),
        turnoverShare: Number(share.toFixed(6)),
        previousDayShareChange: index === 0 ? null : Number((0.008 * Math.cos(index + industryIndex)).toFixed(6)),
        median20Share: index < 19 ? null : Number((0.06 + 0.01 * Math.cos(industryIndex)).toFixed(6)),
        median20ShareChange: index < 19 ? null : Number((share - 0.06 - 0.01 * Math.cos(industryIndex)).toFixed(6)),
        rank: industryIndex + 1,
        coveredStocks: 12 - industryIndex,
      };
    }).concat(index % 3 === 0 ? [{
      tradeDate: date,
      industryCode: 'OTHER',
      industryName: '其他',
      turnover: Number((0.18 * 3.6e11).toFixed(0)),
      turnoverShare: 0.18,
      previousDayShareChange: null,
      median20Share: index < 19 ? null : 0.18,
      median20ShareChange: index < 19 ? null : 0,
      rank: null,
      coveredStocks: 30,
    }] : []),
  );
  return {
    metadata: {
      market: 'CN',
      startDate: start,
      endDate: end,
      dataAsOf: dates[dates.length - 1],
      dataScope: 'SAMPLE',
      sampleSize: 150,
      benchmarkSymbol: 'DEMO.IDX01',
      providerCodes: ['SINA_PUBLIC', 'TENCENT_PUBLIC'],
      taxonomyCode: 'SINA_INDUSTRY',
      barCoverage: 0.893333,
      membershipCoverage: 0.673333,
      qualifiedTradingDays: 131,
      qualityStatus: 'DEGRADED',
      limitations: [
        '当前为 Top-N 样本（最新快照流通市值前 150 只），不是全市场',
        '行业分类为 SINA_INDUSTRY 快照，不是 PIT 申万行业',
        '行业成分按抓取日快照聚合历史，存在时点穿越假设',
        '不提供官方口径全市场资金流（OFFICIAL_MONEY_FLOW=UNAVAILABLE）',
      ],
      unavailableMetrics: ['OFFICIAL_MONEY_FLOW'],
    },
    benchmarkSeries,
    activitySeries,
    breadthSeries,
    liquidityProxySeries: {
      unit: '1/元',
      caliber: '日频价格冲击代理（演示）',
      days: dates.map((date, index) => ({
        tradeDate: date,
        medianIlliquidity: 3e-8 * (1 + 0.2 * Math.sin(index / 3)),
        p90Illiquidity: 1.1e-7 * (1 + 0.2 * Math.cos(index / 3)),
        qualifiedStocks: 150,
        zeroAmountRows: 0,
      })),
    },
    industryTurnoverMigration,
    quality: {
      coverageGap: { uncoveredSampleStocks: 49, uncoveredTurnoverAmount: 1.2e10, symbols: ['DEMO.GAP1'] },
      providerAttribution: [
        { dataset: 'benchmarkDailyBar', providers: ['TENCENT_PUBLIC'] },
        { dataset: 'sampleDailyBar', providers: ['TENCENT_PUBLIC'] },
        { dataset: 'sampleUniverseSnapshot', providers: ['SINA_PUBLIC'] },
        { dataset: 'industryMembership', providers: ['SINA_PUBLIC'] },
      ],
      qualityFindings: [
        { code: 'LOCAL_DEMO', severity: 'INFO', message: '本地演示数据（虚构行业与合成曲线）', affectedCount: 0 },
        { code: 'LOW_MEMBERSHIP_COVERAGE', severity: 'WARN',
          message: '行业映射覆盖率 0.673333 低于告警阈值 0.90（未映射 49/150 只）', affectedCount: 49 },
      ],
      assumptions: ['LOCAL_DEMO 演示口径，不引用真实行情'],
      unavailableMetrics: ['OFFICIAL_MONEY_FLOW'],
    },
  };
}

export function getMarketOverview(
  market: OverviewMarket, start: string, end: string,
): Promise<MarketOverview> {
  if (getSettings().apiMode === 'mock') {
    return Promise.resolve(demoOverview(start, end));
  }
  return unwrap<MarketOverview>(client.get('/market-research/overview', {
    params: { market, start, end },
  }));
}
