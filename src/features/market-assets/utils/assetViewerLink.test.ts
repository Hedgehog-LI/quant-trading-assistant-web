import { describe, expect, it } from 'vitest';
import type { MarketDataSyncPlan, StockDailyBar, StockMinuteBar } from '../../../shared/types/domain';
import {
  buildAssetViewerQuery,
  dailyBarToAssetViewerParams,
  minuteBarToAssetViewerParams,
  planToAssetViewerParams,
} from './assetViewerLink';

function plan(overrides: Partial<MarketDataSyncPlan>): MarketDataSyncPlan {
  return {
    id: '1',
    planName: '测试计划',
    taskType: 'DAILY_BAR_BACKFILL',
    provider: 'LONGPORT',
    scopeJson: JSON.stringify({ symbols: ['SH.600519'], startDate: '2026-01-01', endDate: '2026-06-30' }),
    adjustType: 'NONE',
    triggerType: 'MANUAL',
    includeAuction: false,
    enabled: true,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

describe('buildAssetViewerQuery', () => {
  it('只编码非空参数，可安全用于 navigate', () => {
    const q = buildAssetViewerQuery({
      symbol: 'SH.600519',
      interval: '1D',
      dataSource: 'LONGPORT',
      adjustType: 'NONE',
      from: '2026-01-01',
      to: '2026-06-30',
    });
    expect(q).toBe('symbol=SH.600519&interval=1D&dataSource=LONGPORT&adjustType=NONE&from=2026-01-01&to=2026-06-30');
  });

  it('无 from/to 时不带范围参数', () => {
    const q = buildAssetViewerQuery({ symbol: 'SZ.000001', interval: '5M', dataSource: 'LONGPORT', adjustType: 'NONE' });
    expect(q).toBe('symbol=SZ.000001&interval=5M&dataSource=LONGPORT&adjustType=NONE');
  });
});

describe('planToAssetViewerParams', () => {
  it('日 K 计划：interval=1D，范围直传', () => {
    const p = planToAssetViewerParams(plan({}));
    expect(p).toEqual({
      symbol: 'SH.600519',
      interval: '1D',
      dataSource: 'LONGPORT',
      adjustType: 'NONE',
      from: '2026-01-01',
      to: '2026-06-30',
    });
  });

  it('分钟 K 计划：用 intervalType，日期转 +08:00 交易时段', () => {
    const p = planToAssetViewerParams(plan({ taskType: 'MINUTE_BAR_BACKFILL', intervalType: '5M',
      scopeJson: JSON.stringify({ symbols: ['SH.600519'], startDate: '2026-01-01', endDate: '2026-01-10' }) }));
    expect(p?.interval).toBe('5M');
    expect(p?.from).toBe('2026-01-01T09:30:00+08:00');
    expect(p?.to).toBe('2026-01-10T15:00:00+08:00');
  });

  it('分钟范围超过 5M 上限时省略 from/to', () => {
    const p = planToAssetViewerParams(
      plan({ taskType: 'MINUTE_BAR_BACKFILL', intervalType: '5M',
        scopeJson: JSON.stringify({ symbols: ['SH.600519'], startDate: '2026-01-01', endDate: '2026-12-31' }) }),
    );
    expect(p?.interval).toBe('5M');
    expect(p?.from).toBeUndefined();
    expect(p?.to).toBeUndefined();
  });

  it('scopeJson 非法返回 null', () => {
    expect(planToAssetViewerParams(plan({ scopeJson: 'not-json' }))).toBeNull();
  });

  it('无标的首返回 null', () => {
    expect(planToAssetViewerParams(plan({ scopeJson: JSON.stringify({}) }))).toBeNull();
  });

  it('无日期范围返回 null（历史 scope 只有 symbol）→ 省略 from/to', () => {
    const p = planToAssetViewerParams(plan({ scopeJson: JSON.stringify({ symbols: ['SH.600519'] }) }));
    expect(p?.symbol).toBe('SH.600519');
    expect(p?.from).toBeUndefined();
    expect(p?.to).toBeUndefined();
  });
});

describe('minuteBarToAssetViewerParams', () => {
  it('tradeDate 当日 09:30 → 15:00（+08:00）', () => {
    const bar: StockMinuteBar = {
      id: '1', canonicalSymbol: 'SH.600519', tradeDate: '2026-07-17',
      barStartTime: '2026-07-17T09:30:00+08:00', barEndTime: '2026-07-17T09:35:00+08:00',
      intervalType: '5M', openPrice: 100, highPrice: 101, lowPrice: 99, closePrice: 100.5,
      volume: 1000, amount: 100000, adjustType: 'NONE', dataSource: 'LONGPORT', qualityStatus: 'VALID', fetchedAt: '2026-07-17T09:35:00',
    };
    expect(minuteBarToAssetViewerParams(bar)).toEqual({
      symbol: 'SH.600519', interval: '5M', dataSource: 'LONGPORT', adjustType: 'NONE',
      from: '2026-07-17T09:30:00+08:00', to: '2026-07-17T15:00:00+08:00',
    });
  });
});

describe('dailyBarToAssetViewerParams', () => {
  it('单日日 K 记录', () => {
    const bar: StockDailyBar = {
      id: '1', canonicalSymbol: 'SZ.000001', tradeDate: '2026-07-01',
      adjustType: 'QF', dataSource: 'CSV',
      openPrice: 10, highPrice: 10.5, lowPrice: 9.9, closePrice: 10.2, volume: 1000, amount: 10200,
    };
    expect(dailyBarToAssetViewerParams(bar)).toEqual({
      symbol: 'SZ.000001', interval: '1D', dataSource: 'CSV', adjustType: 'QF',
      from: '2026-07-01', to: '2026-07-01',
    });
  });
});
