import { beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../../../shared/api/client';
import { clearAll } from '../../../shared/api/localStorageClient';
import { saveSettings } from '../../settings/api/settingsApi';
import {
  calculateMarketResearch,
  getMarketResearchRadar,
  getMarketResearchRankingHistory,
  getMarketResearchReadiness,
  getMarketResearchSectorDetail,
} from './marketResearchApi';

describe('marketResearchApi', () => {
  beforeEach(() => {
    clearAll();
    vi.restoreAllMocks();
  });

  it('mock 使用虚构板块并持续标记 LOCAL_DEMO', async () => {
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });

    const radar = await getMarketResearchRadar('CN', 20);

    expect(radar.parameterHash).toBe('LOCAL_DEMO');
    expect(radar.reasonCodes).toContain('LOCAL_DEMO');
    expect(radar.sectors).toHaveLength(8);
    expect(radar.sectors.every((sector) => sector.leadingSymbol?.startsWith('DEMO.'))).toBe(true);
    expect(JSON.stringify(radar)).not.toContain('贵州茅台');
  });

  it('mock 随市场切换虚构证券身份，不串用 CN 标识', async () => {
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });

    const radar = await getMarketResearchRadar('HK', 20);
    const detail = await getMarketResearchSectorDetail(9001, 'US', 20);

    expect(radar.sectors.every((sector) => sector.providerSectorId.startsWith('DEMO/HK/'))).toBe(true);
    expect(radar.sectors.every((sector) => sector.leadingSymbol?.startsWith('DEMO.HK'))).toBe(true);
    expect(detail.providerSectorId).toMatch(/^DEMO\/US\//);
    expect(detail.leadingSymbol).toMatch(/^DEMO\.US/);
  });

  it('一日 mock 不伪造发布批次或持续性指标', async () => {
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });

    const radar = await getMarketResearchRadar('CN', 1);
    const rankingHistory = await getMarketResearchRankingHistory('CN', 1);
    const detail = await getMarketResearchSectorDetail(9001, 'CN', 1);

    expect(radar.publicationBatchId).toBeNull();
    expect(radar.rotationAvailable).toBe(false);
    expect(radar.sectors.every((sector) => sector.meanRankPercentile == null)).toBe(true);
    expect(radar.sectors.every((sector) => sector.consecutiveLeadingDays == null)).toBe(true);
    expect(radar.sectors.every((sector) => sector.consecutiveLaggingDays == null)).toBe(true);
    expect(rankingHistory.sectors.flatMap((sector) => sector.points)
      .every((point) => point.publicationBatchId == null && point.meanRankPercentile == null)).toBe(true);
    expect(detail.history.every((point) => point.publicationBatchId == null)).toBe(true);
    expect(detail.history.every((point) => point.meanRankPercentile == null)).toBe(true);
  });

  it('remote 只调用 market-research 后端接口并透传窗口', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const get = vi.spyOn(client, 'get').mockResolvedValue({
      data: { success: true, code: 'SUCCESS', data: {} },
    });
    const post = vi.spyOn(client, 'post').mockResolvedValue({
      data: { success: true, code: 'SUCCESS', data: {} },
    });

    await getMarketResearchReadiness('HK');
    await getMarketResearchRadar('HK', 50);
    await getMarketResearchSectorDetail(17, 'HK', 50, 30);
    await calculateMarketResearch('HK', 50);

    expect(get).toHaveBeenCalledWith('/market-research/readiness', { params: { market: 'HK' } });
    expect(get).toHaveBeenCalledWith('/market-research/radar', { params: { market: 'HK', window: 50 } });
    expect(get).toHaveBeenCalledWith('/market-research/sectors/17', {
      params: { market: 'HK', window: 50, days: 30 },
    });
    expect(post).toHaveBeenCalledWith('/market-research/calculations', undefined, {
      params: { market: 'HK', window: 50 },
    });
  });
});
