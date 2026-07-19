import { describe, expect, it } from 'vitest';
import { buildPlanInput, fallbackConfigurationErrors } from './syncPlanForm';

describe('syncPlanForm', () => {
  it('分钟补档生成 MANUAL + 日期 scope', () => {
    const input = buildPlanInput({ planName: '补档', taskType: 'MINUTE_BAR_BACKFILL', provider: 'LONGPORT',
      symbols: 'SH.603308', startDate: '2026-07-10', endDate: '2026-07-10', intervalType: '5M' });
    expect(input.triggerType).toBe('MANUAL');
    expect(JSON.parse(input.scopeJson)).toEqual({ symbols: ['SH.603308'], startDate: '2026-07-10', endDate: '2026-07-10' });
  });

  it('盘中刷新要求频率并生成 INTRADAY', () => {
    expect(() => buildPlanInput({ planName: '盘中', taskType: 'INTRADAY_MINUTE_REFRESH', provider: 'LONGPORT',
      symbols: 'SH.603308', intervalType: '1M' })).toThrow('采集频率');
    const input = buildPlanInput({ planName: '盘中', taskType: 'INTRADAY_MINUTE_REFRESH', provider: 'LONGPORT',
      symbols: 'SH.603308', intervalType: '1M', collectFrequency: '60S' });
    expect(input.triggerType).toBe('INTRADAY');
  });

  it('分钟任务拒绝港美股并识别历史非法组合', () => {
    expect(() => buildPlanInput({ planName: '港股', taskType: 'MINUTE_BAR_BACKFILL', provider: 'LONGPORT',
      symbols: 'HK.02498', startDate: '2026-07-10', endDate: '2026-07-10', intervalType: '5M' })).toThrow('SH/SZ/BJ');
    expect(fallbackConfigurationErrors({ id: 1, planName: '旧计划', taskType: 'MINUTE_BAR_BACKFILL', provider: 'LONGPORT',
      scopeJson: '{"symbols":["SH.603308"]}', intervalType: '5M', adjustType: 'NONE', triggerType: 'INTRADAY',
      includeAuction: false, enabled: true, createdAt: '', updatedAt: '' })).not.toHaveLength(0);
  });
});
