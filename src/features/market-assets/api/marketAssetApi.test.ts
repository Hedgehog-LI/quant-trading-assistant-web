import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll } from '../../../shared/api/localStorageClient';
import { saveSettings } from '../../settings/api/settingsApi';
import {
  getMarketAssetAvailability,
  getMarketAssetRelatedTasks,
  getMarketAssetSeries,
} from './marketAssetApi';

describe('marketAssetApi mock（LOCAL_DEMO）', () => {
  beforeEach(() => {
    clearAll();
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
  });

  it('availability 返回证券与组合覆盖，不伪造采集成功（watermark/latestFetchedAt 为 null）', async () => {
    const r = await getMarketAssetAvailability('SH.600519');
    expect(r.security.canonicalSymbol).toBe('SH.600519');
    expect(r.security.displayName).toBe('贵州茅台');
    expect(r.combinations.length).toBeGreaterThan(0);
    for (const c of r.combinations) {
      expect(c.interval).toBeTruthy();
      expect(c.dataSource).toBe('LONGPORT');
      expect(c.adjustType).toBe('NONE');
      expect(c.barCount).toBeGreaterThan(0);
      expect(c.firstBarTime).toBeTruthy();
      expect(c.lastBarTime).toBeTruthy();
      expect(c.watermarkTime).toBeNull();
      expect(c.latestFetchedAt).toBeNull();
    }
  });

  it('availability 未知证券抛出业务错误', async () => {
    await expect(getMarketAssetAvailability('XX.000000')).rejects.toThrow('证券不存在');
  });

  it('series 日 K：business-day 时间、覆盖率 UNKNOWN、不伪造水位', async () => {
    const r = await getMarketAssetSeries({
      canonicalSymbol: 'SH.600519',
      interval: '1D',
      from: '2026-07-01',
      to: '2026-07-31',
      adjustType: 'NONE',
      dataSource: 'LONGPORT',
    });
    expect(r.bars.length).toBeGreaterThan(0);
    expect(r.bars.every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.time))).toBe(true);
    expect(r.quality.coverageStatus).toBe('UNKNOWN');
    expect(r.quality.expectedBarCount).toBeNull();
    expect(r.quality.missingBarCount).toBeNull();
    expect(r.availability.watermarkTime).toBeNull();
    expect(r.availability.latestFetchedAt).toBeNull();
    // 摘要与首末 bar 一致
    expect(r.summary.actualBarCount).toBe(r.bars.length);
    expect(r.summary.firstOpen).toBe(r.bars[0].open);
    expect(r.summary.lastClose).toBe(r.bars[r.bars.length - 1].close);
    expect(r.summary.totalVolume).toBe(
      r.bars.reduce((sum, b) => sum + b.volume, 0),
    );
  });

  it('series 分钟 K：时间带 +08:00 offset，qualityStatus=VALID', async () => {
    const r = await getMarketAssetSeries({
      canonicalSymbol: 'SH.600519',
      interval: '5M',
      from: '2026-07-17T09:30:00+08:00',
      to: '2026-07-17T15:00:00+08:00',
      adjustType: 'NONE',
      dataSource: 'LONGPORT',
    });
    expect(r.bars.length).toBeGreaterThan(0);
    expect(r.bars.every((b) => /\+\d{2}:\d{2}$/.test(b.time))).toBe(true);
    expect(r.bars.every((b) => b.qualityStatus === 'VALID')).toBe(true);
  });

  it('series 超范围时截断为 200 条并标记 truncated', async () => {
    const r = await getMarketAssetSeries({
      canonicalSymbol: 'SH.600519',
      interval: '1D',
      from: '2015-01-01',
      to: '2030-12-31',
      adjustType: 'NONE',
      dataSource: 'LONGPORT',
    });
    expect(r.bars.length).toBe(200);
    expect(r.quality.truncated).toBe(true);
    expect(r.quality.reasonCodes).toContain('TRUNCATED');
  });

  it('series 未知证券抛出业务错误', async () => {
    await expect(
      getMarketAssetSeries({
        canonicalSymbol: 'XX.000000',
        interval: '1D',
        from: '2026-07-01',
        to: '2026-07-31',
        adjustType: 'NONE',
        dataSource: 'LONGPORT',
      }),
    ).rejects.toThrow('证券不存在');
  });

  it('related-tasks 只给出一条显式 LOCAL_DEMO 计划，不伪造真实采集记录', async () => {
    const r = await getMarketAssetRelatedTasks('SH.600519');
    expect(r.plans).toHaveLength(1);
    expect(r.plans[0].name).toContain('LOCAL_DEMO');
    expect(r.plans[0].status).toBe('DISABLED');
    expect(r.plans[0].errorMessage).toContain('演示数据');
    expect(r.runs).toHaveLength(0);
  });
});
