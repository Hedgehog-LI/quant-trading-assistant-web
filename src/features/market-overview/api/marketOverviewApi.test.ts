import { beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../../../shared/api/client';
import { clearAll } from '../../../shared/api/localStorageClient';
import { saveSettings } from '../../settings/api/settingsApi';
import { getMarketOverview } from './marketOverviewApi';
import type { MarketOverview } from '../model/types';

function okResponse(data: MarketOverview) {
  return { data: { success: true, code: 'SUCCESS', data } };
}

/** 最小合法 Overview 夹具（字段对齐 MarketOverviewVO 契约）。 */
function minimalOverview(qualityStatus: MarketOverview['metadata']['qualityStatus']): MarketOverview {
  return {
    metadata: {
      market: 'CN', startDate: '2026-07-01', endDate: '2026-07-31', dataAsOf: '2026-07-31',
      dataScope: 'SAMPLE', sampleSize: 150, benchmarkSymbol: 'SH.000001',
      providerCodes: ['SINA_PUBLIC', 'TENCENT_PUBLIC'], taxonomyCode: 'SINA_INDUSTRY',
      barCoverage: 0.893333, membershipCoverage: 0.673333, qualifiedTradingDays: 131,
      qualityStatus, limitations: ['不是全市场'], unavailableMetrics: ['OFFICIAL_MONEY_FLOW'],
    },
    benchmarkSeries: [{
      tradeDate: '2026-07-01', closePrice: 3050, dailyReturn: 0.001, amount: 3e10,
      ma20: 3011.5, ma60: null, drawdown: 0,
    }],
    activitySeries: [{
      tradeDate: '2026-07-01', marketTurnover: 3.9e11, turnoverMedian20: 3.9e11,
      turnoverMedian60: null, activityRatio: 1.01, activeStockRatio: 0.4, validStocks: 150,
    }],
    breadthSeries: [{
      tradeDate: '2026-07-01', advancingStocks: 78, decliningStocks: 61, flatStocks: 11,
      validStocks: 150, advanceRatio: 0.52, adLine: 17, aboveMa20Stocks: 60, aboveMa20Ratio: 0.4,
    }],
    liquidityProxySeries: {
      unit: '1/元', caliber: '日频价格冲击代理',
      days: [{ tradeDate: '2026-07-01', medianIlliquidity: 3.1e-8, p90Illiquidity: 1.1e-7, qualifiedStocks: 150, zeroAmountRows: 0 }],
    },
    industryTurnoverMigration: [{
      tradeDate: '2026-07-01', industryCode: 'new_blhy', industryName: '玻璃行业', turnover: 1.2e8,
      turnoverShare: 0.0312, previousDayShareChange: 0.0005, median20Share: 0.03,
      median20ShareChange: 0.0012, rank: 3, coveredStocks: 8,
    }],
    quality: {
      coverageGap: { uncoveredSampleStocks: 49, uncoveredTurnoverAmount: 1.2e10, symbols: ['BJ.920099'] },
      providerAttribution: [{ dataset: 'benchmarkDailyBar', providers: ['TENCENT_PUBLIC'] }],
      qualityFindings: [], assumptions: [], unavailableMetrics: ['OFFICIAL_MONEY_FLOW'],
    },
  };
}

describe('marketOverviewApi', () => {
  beforeEach(() => {
    clearAll();
    vi.restoreAllMocks();
  });

  it('remote 调用正式 overview 接口并透传 market/start/end', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const get = vi.spyOn(client, 'get').mockResolvedValue(okResponse(minimalOverview('OK')));

    const overview = await getMarketOverview('CN', '2026-07-01', '2026-07-31');

    expect(get).toHaveBeenCalledWith('/market-research/overview', {
      params: { market: 'CN', start: '2026-07-01', end: '2026-07-31' },
    });
    expect(overview.metadata.qualityStatus).toBe('OK');
    expect(overview.benchmarkSeries[0].ma60).toBeNull();
  });

  it('remote DEGRADED 与 NO_DATA 按原样透传（含 null 指标与阻断空迁移）', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const degraded = minimalOverview('DEGRADED');
    degraded.industryTurnoverMigration = [];
    degraded.quality.qualityFindings = [{
      code: 'INDUSTRY_MIGRATION_BLOCKED', severity: 'WARN', message: '行业映射覆盖严重不足', affectedCount: 49,
    }];
    const noData = minimalOverview('NO_DATA');
    noData.benchmarkSeries = [];
    noData.metadata.dataAsOf = null;
    noData.metadata.barCoverage = null;
    vi.spyOn(client, 'get')
      .mockResolvedValueOnce(okResponse(degraded))
      .mockResolvedValueOnce(okResponse(noData));

    const degradedResult = await getMarketOverview('CN', '2026-07-01', '2026-07-31');
    const noDataResult = await getMarketOverview('CN', '2025-01-01', '2025-01-10');

    expect(degradedResult.metadata.qualityStatus).toBe('DEGRADED');
    expect(degradedResult.industryTurnoverMigration).toEqual([]);
    expect(degradedResult.quality.qualityFindings[0].code).toBe('INDUSTRY_MIGRATION_BLOCKED');
    expect(noDataResult.metadata.qualityStatus).toBe('NO_DATA');
    expect(noDataResult.benchmarkSeries).toEqual([]);
    expect(noDataResult.metadata.barCoverage).toBeNull();
  });

  it('remote 失败直接抛错，禁止回退 mock 演示数据', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    vi.spyOn(client, 'get').mockRejectedValue(new Error('Network Error'));

    await expect(getMarketOverview('CN', '2026-07-01', '2026-07-31')).rejects.toThrow('Network Error');
  });

  it('remote 业务失败（success=false）抛 ApiRequestError，不返回演示数据', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    vi.spyOn(client, 'get').mockResolvedValue({
      data: { success: false, code: 'VALIDATION_ERROR', message: 'market 不能为空' },
    });

    await expect(getMarketOverview('CN', '2026-07-01', '2026-07-31')).rejects.toThrow('market 不能为空');
  });

  it('mock 仅返回虚构行业与 DEMO 基准的演示数据，并标记 LOCAL_DEMO', async () => {
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });

    const overview = await getMarketOverview('CN', '2026-07-01', '2026-07-31');

    expect(overview.metadata.benchmarkSymbol).toBe('DEMO.IDX01');
    expect(overview.industryTurnoverMigration.every((row) => row.industryCode.startsWith('DEM_') || row.industryCode === 'OTHER')).toBe(true);
    expect(overview.quality.qualityFindings.some((finding) => finding.code === 'LOCAL_DEMO')).toBe(true);
    expect(JSON.stringify(overview)).not.toContain('贵州茅台');
  });
});
