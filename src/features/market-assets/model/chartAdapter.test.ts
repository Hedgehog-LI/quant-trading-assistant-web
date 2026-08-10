import { describe, expect, it } from 'vitest';
import type { MarketAssetBar } from './types';
import {
  CANDLE_DOWN_COLOR,
  CANDLE_FLAT_COLOR,
  CANDLE_UP_COLOR,
  isUpBar,
  toCandles,
  toChartTime,
  toNumber,
  toVolumeHistogram,
} from './chartAdapter';

function bar(overrides: Partial<MarketAssetBar> = {}): MarketAssetBar {
  return {
    time: overrides.time ?? '2026-07-17T09:30:00+08:00',
    open: overrides.open ?? '10.00',
    high: overrides.high ?? '11.00',
    low: overrides.low ?? '9.50',
    close: overrides.close ?? '10.50',
    volume: overrides.volume ?? 1000,
    amount: overrides.amount ?? '10500.00',
    qualityStatus: overrides.qualityStatus ?? 'VALID',
    fetchedAt: overrides.fetchedAt ?? null,
  };
}

describe('toChartTime', () => {
  it('日 K：保留 YYYY-MM-DD business-day 字符串', () => {
    expect(toChartTime('2026-07-17', '1D')).toBe('2026-07-17');
  });

  it('日 K 非法格式返回 null', () => {
    expect(toChartTime('2026/07/17', '1D')).toBeNull();
  });

  it('分钟 K 带 offset：转换为真实 UTCTimestamp（epoch 秒）', () => {
    const t = toChartTime('2026-07-17T09:30:00+08:00', '5M');
    expect(typeof t).toBe('number');
    expect(t).toBe(Math.floor(Date.parse('2026-07-17T09:30:00+08:00') / 1000));
  });

  it('分钟 K 缺 offset（裸本地时间）：按存储时区 +08:00 折算', () => {
    const t = toChartTime('2026-07-17T09:30:00', '5M');
    expect(t).toBe(Math.floor(Date.parse('2026-07-17T09:30:00+08:00') / 1000));
  });

  it('分钟 K 非法时间返回 null', () => {
    expect(toChartTime('not-a-time', '5M')).toBeNull();
  });
});

describe('toCandles', () => {
  it('把 BigDecimal 字符串转为数值，时间/OHLC 齐全', () => {
    const candles = toCandles([bar()], '5M');
    expect(candles).toHaveLength(1);
    expect(candles[0]).toEqual({
      time: Math.floor(Date.parse('2026-07-17T09:30:00+08:00') / 1000),
      open: 10,
      high: 11,
      low: 9.5,
      close: 10.5,
    });
  });

  it('OHLC 非法字符串的 bar 被跳过', () => {
    const candles = toCandles([bar({ open: 'abc' })], '5M');
    expect(candles).toHaveLength(0);
  });

  it('空数组返回空数组', () => {
    expect(toCandles([], '5M')).toHaveLength(0);
  });
});

describe('toVolumeHistogram / isUpBar 颜色口径', () => {
  it('上涨（close>=open）用红色，下跌用绿色，平盘用中性灰', () => {
    const up = toVolumeHistogram([bar({ open: '10.00', close: '10.50' })], '5M');
    expect(up[0].color).toBe(CANDLE_UP_COLOR);
    const down = toVolumeHistogram([bar({ open: '10.50', close: '10.00' })], '5M');
    expect(down[0].color).toBe(CANDLE_DOWN_COLOR);
    const flat = toVolumeHistogram([bar({ open: '10.00', close: '10.00' })], '5M');
    expect(flat[0].color).toBe(CANDLE_FLAT_COLOR);
  });

  it('isUpBar 按 close>=open 判断', () => {
    expect(isUpBar({ open: '10.00', close: '10.00' })).toBe(true);
    expect(isUpBar({ open: '10.00', close: '10.01' })).toBe(true);
    expect(isUpBar({ open: '10.00', close: '9.99' })).toBe(false);
  });
});

describe('toNumber', () => {
  it('合法数字字符串转为 number', () => {
    expect(toNumber('123.45')).toBe(123.45);
    expect(toNumber('0')).toBe(0);
  });
  it('null/undefined/空串/非法返回 null', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('  ')).toBeNull();
    expect(toNumber('abc')).toBeNull();
  });
});
