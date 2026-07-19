import { beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../../../shared/api/client';
import { clearAll } from '../../../shared/api/localStorageClient';
import { saveSettings } from '../../settings/api/settingsApi';
import { createSectorWatch, getIndustryPeers, listIndustryRankings, listSectorWatches,
  refreshSectorWatch } from './sectorCatalogApi';

describe('sectorCatalogApi', () => {
  beforeEach(() => {
    clearAll();
    vi.restoreAllMocks();
  });

  it('mock 模式返回明确标记的演示数据', async () => {
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
    const ranks = await listIndustryRankings({ market: 'HK', indicator: 'popularity' });
    expect(ranks[0].market).toBe('HK');
    expect(ranks[0].providerCode).toBe('LOCAL_DEMO');

    const peer = await getIndustryPeers('HK', ranks[0].providerSectorId);
    expect(peer.providerCode).toBe('LOCAL_DEMO');
  });

  it('remote 模式调用后端行业排行并透传查询参数', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const get = vi.spyOn(client, 'get').mockResolvedValue({
      data: { success: true, code: 'SUCCESS', data: [] },
    });

    await listIndustryRankings({ market: 'US', indicator: 'leading-gainer', limit: 10 });
    expect(get).toHaveBeenCalledWith('/market-data/sector-catalog/industry-rankings', {
      params: { market: 'US', indicator: 'leading-gainer', limit: 10, sortType: 'single' },
    });
  });

  it('mock 模式可持久化行业关注', async () => {
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
    const rank = (await listIndustryRankings({ market: 'CN', indicator: 'leading-gainer' }))[0];

    await createSectorWatch({ market: 'CN', providerSectorId: rank.providerSectorId,
      trackingSymbol: 'SH.512480' });
    const watches = await listSectorWatches('CN');

    expect(watches).toHaveLength(1);
    expect(watches[0].trackingSymbol).toBe('SH.512480');
    expect(watches[0].latestSnapshot?.dataSource).toBe('LOCAL_DEMO');
  });

  it('remote 模式刷新持久化行业关注', async () => {
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
    const post = vi.spyOn(client, 'post').mockResolvedValue({
      data: { success: true, code: 'SUCCESS', data: { id: 7 } },
    });

    await refreshSectorWatch(7);

    expect(post).toHaveBeenCalledWith('/market-data/sector-catalog/watches/7/refresh');
  });
});
