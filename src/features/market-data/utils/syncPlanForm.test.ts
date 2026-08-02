import { describe, expect, it } from 'vitest';
import { buildPlanInput, fallbackConfigurationErrors, planToDraft, type SyncPlanDraft } from './syncPlanForm';
import type { MarketDataSyncPlan } from '../../../shared/types/domain';

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

describe('syncPlanForm 旧 scopeJson 兼容', () => {
  it('旧 scopeJson {symbols:[...]} 计划可被 planToDraft 解析展示不报错', () => {
    // 旧结构化 scopeJson: {symbols:[...], startDate, endDate}
    const structuredPlan: MarketDataSyncPlan = {
      id: 'p-legacy-1',
      planName: '旧计划-结构化',
      taskType: 'DAILY_BAR_BACKFILL',
      provider: 'LONGPORT',
      scopeJson: JSON.stringify({
        symbols: ['SH.600519', 'HK.02498'],
        startDate: '2026-07-01',
        endDate: '2026-07-10',
      }),
      adjustType: 'NONE',
      triggerType: 'MANUAL',
      includeAuction: false,
      enabled: true,
      createdAt: '',
      updatedAt: '',
    };

    const draft = planToDraft(structuredPlan);
    expect(draft.symbols).toBe('SH.600519, HK.02498');
    expect(draft.startDate).toBe('2026-07-01');
    expect(draft.endDate).toBe('2026-07-10');

    // 旧单标的 scopeJson: {canonicalSymbol:'SH.600519'}
    const singleSymbolPlan: MarketDataSyncPlan = {
      id: 'p-legacy-2',
      planName: '旧计划-单标的',
      taskType: 'DAILY_BAR_BACKFILL',
      provider: 'LONGPORT',
      scopeJson: JSON.stringify({ canonicalSymbol: 'SH.600519' }),
      adjustType: 'NONE',
      triggerType: 'MANUAL',
      includeAuction: false,
      enabled: true,
      createdAt: '',
      updatedAt: '',
    };

    const singleDraft = planToDraft(singleSymbolPlan);
    expect(singleDraft.symbols).toBe('SH.600519');
  });

  it('结构化 scope builder 生成正确 scopeJson 且与旧格式读取兼容', () => {
    const draft: SyncPlanDraft = {
      planName: '计划-结构化',
      taskType: 'DAILY_BAR_BACKFILL',
      provider: 'LONGPORT',
      symbols: 'SH.600519, HK.02498',
      startDate: '2026-07-01',
      endDate: '2026-07-10',
      adjustType: 'NONE',
    };

    const input = buildPlanInput(draft);

    expect(JSON.parse(input.scopeJson)).toEqual({
      symbols: ['SH.600519', 'HK.02498'],
      startDate: '2026-07-01',
      endDate: '2026-07-10',
    });

    // 读兼容：把生成的 scopeJson 装回一个计划，再走 planToDraft，应能完整还原。
    const roundTripPlan: MarketDataSyncPlan = {
      id: 'p-rt',
      planName: draft.planName,
      taskType: draft.taskType,
      provider: draft.provider,
      scopeJson: input.scopeJson,
      adjustType: draft.adjustType ?? 'NONE',
      triggerType: 'MANUAL',
      includeAuction: false,
      enabled: true,
      createdAt: '',
      updatedAt: '',
    };

    const roundTripped = planToDraft(roundTripPlan);
    expect(roundTripped.symbols).toBe('SH.600519, HK.02498');
    expect(roundTripped.startDate).toBe('2026-07-01');
    expect(roundTripped.endDate).toBe('2026-07-10');
  });
});
