import { describe, expect, it, beforeEach } from 'vitest';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';
import { searchSecurities } from './securityDirectoryApi';

describe('securityDirectoryApi mock', () => {
  beforeEach(() => {
    clearAll();
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
  });

  it('searchSecurities mock 与 remote 同形：相同关键词返回字段一致且排名一致', async () => {
    const r = await searchSecurities({ q: 'ylgf' });
    expect(r.catalogStatus).toBe('READY');
    expect(r.catalogUpdatedAt).toBe('2026-07-29T10:00:00');
    expect(r.stale).toBe(false);
    expect(r.degraded).toBe(false);
    expect(r.items.length).toBeGreaterThan(0);
    const top = r.items[0];
    // 同形：每个 SecuritySummary 字段都存在
    expect(top).toEqual(expect.objectContaining({
      canonicalSymbol: expect.any(String),
      symbol: expect.any(String),
      displayName: expect.any(String),
      market: expect.any(String),
      securityType: expect.any(String),
      listStatus: expect.any(String),
      matchedBy: expect.any(String),
    }));
    // 排名：拼音首字母 ylgf 精确命中 SH.603308，matchedBy=PINYIN_ABBR_PREFIX
    expect(top.canonicalSymbol).toBe('SH.603308');
    expect(top.matchedBy).toBe('PINYIN_ABBR_PREFIX');
  });

  it('中文≥1 字符、英文/数字≥2 字符才触发搜索；阈值以下不调用', async () => {
    // 中文单字触发
    const cn = await searchSecurities({ q: '应' });
    expect(cn.items.some((i) => i.canonicalSymbol === 'SH.603308')).toBe(true);
    // 单个拉丁字符不触发 → 空结果
    const oneLatin = await searchSecurities({ q: 'A' });
    expect(oneLatin.items.length).toBe(0);
    // 两个拉丁字符触发（命中 US.AAPL：symbol AAPL 的 displayName 'Apple Inc.' 含 'AP'... 用 'AP' 前缀命中 displayName）
    const twoLatin = await searchSecurities({ q: 'AP' });
    expect(twoLatin.items.length).toBeGreaterThan(0);
    expect(twoLatin.items.some((i) => i.canonicalSymbol === 'US.AAPL')).toBe(true);
  });

  it('默认 limit=20 且 markets/types/includeDelisted 筛选正确传递', async () => {
    // 默认 limit=20 截断：seed 有 25 个 样本N + 其它，'样本' 前缀匹配 >20 条
    const all = await searchSecurities({ q: '样本' });
    expect(all.items.length).toBe(20);
    // markets 筛选
    const hkOnly = await searchSecurities({ q: '速腾', markets: ['HK'] });
    expect(hkOnly.items.some((i) => i.canonicalSymbol === 'HK.02498')).toBe(true);
    const noMatch = await searchSecurities({ q: '速腾', markets: ['US'] });
    expect(noMatch.items.length).toBe(0);
    // types 筛选
    const etf = await searchSecurities({ q: '沪深300ETF', types: ['ETF'] });
    expect(etf.items.some((i) => i.securityType === 'ETF')).toBe(true);
    // includeDelisted
    const hidden = await searchSecurities({ q: '退市样本' });
    expect(hidden.items.length).toBe(0);
    const shown = await searchSecurities({ q: '退市样本', includeDelisted: true });
    expect(shown.items.some((i) => i.canonicalSymbol === 'SH.600001' && i.listStatus === 'DELISTED')).toBe(true);
  });
});
