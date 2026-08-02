import { describe, expect, it, beforeEach, vi } from 'vitest';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';
import { client } from '../../../shared/api/client';
import { searchSecurities, getSecurity } from './securityDirectoryApi';

describe('securityDirectoryApi remote', () => {
  beforeEach(() => {
    clearAll();
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
  });

  it('searchSecurities remote 调用 GET /market-data/securities/search 并解包 items 与目录元数据', async () => {
    const mockGet = vi.spyOn(client, 'get').mockResolvedValueOnce({
      data: {
        success: true, code: 'OK',
        data: {
          items: [{
            canonicalSymbol: 'SH.603308', symbol: '603308', displayName: '应流股份', name: '应流股份',
            nameCn: '应流股份', nameHk: null, nameEn: null, shortName: '应流股份',
            market: 'SH', exchange: 'SSE', currency: 'CNY', securityType: 'STOCK', listStatus: 'LISTED', matchedBy: 'PINYIN_ABBR_PREFIX',
          }],
          catalogStatus: 'READY', catalogUpdatedAt: '2026-07-29T10:00:00', stale: false, degraded: false,
        },
        timestamp: '',
      },
    });
    const r = await searchSecurities({ q: 'ylgf' });
    expect(mockGet).toHaveBeenCalledWith('/market-data/securities/search', expect.objectContaining({ params: expect.objectContaining({ q: 'ylgf' }) }));
    expect(r.items[0].canonicalSymbol).toBe('SH.603308');
    expect(r.catalogStatus).toBe('READY');
    expect(r.stale).toBe(false);
    mockGet.mockRestore();
  });

  it('getSecurity remote 调用 GET /market-data/securities/{canonicalSymbol} 并在 404 时抛错', async () => {
    // 成功路径
    const mockOk = vi.spyOn(client, 'get').mockResolvedValueOnce({
      data: {
        success: true, code: 'OK',
        data: {
          canonicalSymbol: 'SH.603308', symbol: '603308', displayName: '应流股份', name: '应流股份',
          market: 'SH', exchange: 'SSE', currency: 'CNY', securityType: 'STOCK', listStatus: 'LISTED', matchedBy: 'FORMAL_NAME_EXACT',
        },
        timestamp: '',
      },
    });
    const r = await getSecurity('SH.603308');
    expect(mockOk).toHaveBeenCalledWith('/market-data/securities/SH.603308');
    expect(r.canonicalSymbol).toBe('SH.603308');
    mockOk.mockRestore();

    // 404 失败路径：unwrap 在 success=false 或 data=null 时抛错
    const mockFail = vi.spyOn(client, 'get').mockResolvedValueOnce({
      data: { success: false, code: 'NOT_FOUND', message: '证券不存在', data: null, timestamp: '' },
    });
    await expect(getSecurity('SH.999999')).rejects.toThrow();
    mockFail.mockRestore();
  });
});
