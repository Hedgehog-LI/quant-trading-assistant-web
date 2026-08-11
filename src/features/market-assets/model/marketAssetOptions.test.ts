import { describe, expect, it } from 'vitest';
import type { MarketAssetCombination } from './types';
import {
  buildAdjustTypeOptions,
  buildDataSourceOptions,
  buildIntervalOptions,
  buildRangePresets,
  formatDaily,
  formatMinute,
  formatRangeParam,
  isValidCombo,
  matchPreset,
  parseRangeParam,
  pickDefaultCombo,
  resolveCombo,
  validateRange,
} from './marketAssetOptions';

function combo(overrides: Partial<MarketAssetCombination> = {}): MarketAssetCombination {
  return {
    interval: overrides.interval ?? '1D',
    dataSource: overrides.dataSource ?? 'LONGPORT',
    adjustType: overrides.adjustType ?? 'NONE',
    barCount: overrides.barCount ?? 20,
    firstBarTime: overrides.firstBarTime ?? '2026-07-01',
    lastBarTime: overrides.lastBarTime ?? '2026-07-31',
    latestFetchedAt: overrides.latestFetchedAt ?? null,
    watermarkTime: overrides.watermarkTime ?? null,
    freshness: overrides.freshness ?? null,
  };
}

describe('时间参数格式化', () => {
  it('日 K：本地日期 YYYY-MM-DD', () => {
    expect(formatDaily(new Date(2026, 7, 10, 12, 0))).toBe('2026-08-10');
    expect(formatRangeParam(new Date(2026, 7, 10, 12, 0), '1D')).toBe('2026-08-10');
  });

  it('分钟 K：带 +08:00 offset 的 ISO', () => {
    const s = formatMinute(new Date(2026, 7, 10, 12, 30));
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
  });

  it('parseRangeParam 分钟 round-trip 不依赖本地时区', () => {
    const d = new Date(2026, 7, 10, 12, 30);
    const iso = formatMinute(d);
    expect(parseRangeParam(iso, '5M')).toBe(d.getTime());
  });

  it('parseRangeParam 非法返回 null', () => {
    expect(parseRangeParam('not-a-date', '1D')).toBeNull();
    expect(parseRangeParam('', '1D')).toBeNull();
  });
});

describe('validateRange', () => {
  it('倒置范围非法', () => {
    expect(validateRange('1D', '2026-08-31', '2026-08-01')).toBe('开始时间晚于结束时间');
  });

  it('不可解析非法', () => {
    expect(validateRange('1D', 'bad', '2026-08-31')).toBe('时间格式不合法');
  });

  it('超过自然日上限非法（1D 超 3650 日）', () => {
    expect(validateRange('1D', '2000-01-01', '2026-08-31')).toMatch(/最多支持/);
  });

  it('1M 超 5 交易日近似上限（7 自然日）非法', () => {
    expect(validateRange('1M', '2026-08-01T09:30:00+08:00', '2026-08-31T15:00:00+08:00')).toMatch(/5 个交易日/);
  });

  it('合法范围返回 null', () => {
    expect(validateRange('1D', '2026-08-01', '2026-08-31')).toBeNull();
    expect(validateRange('5M', '2026-08-10T09:30:00+08:00', '2026-08-10T15:00:00+08:00')).toBeNull();
  });
});

describe('buildRangePresets', () => {
  it('日 K 提供 1/3/6 月、1/3 年', () => {
    const presets = buildRangePresets('1D', new Date(2026, 7, 10));
    expect(presets.map((p) => p.key)).toEqual(['1M', '3M', '6M', '1Y', '3Y']);
  });

  it('分钟 K 提供 当日/近5/近20 交易日；1M 不含近20', () => {
    const minute = buildRangePresets('5M', new Date(2026, 7, 10));
    expect(minute.map((p) => p.key)).toEqual(['TODAY', '5D', '20D']);
    const oneMinute = buildRangePresets('1M', new Date(2026, 7, 10));
    expect(oneMinute.map((p) => p.key)).toEqual(['TODAY', '5D']);
  });

  it('matchPreset 命中预设，自定义范围返回 null', () => {
    const presets = buildRangePresets('1D', new Date(2026, 7, 10));
    const preset = presets[0];
    expect(matchPreset(presets, preset.from, preset.to)).toBe(preset.key);
    expect(matchPreset(presets, '2026-01-01', '2026-02-01')).toBeNull();
  });
});

describe('默认组合与选项', () => {
  it('优先 1D+LONGPORT+NONE', () => {
    const combos = [combo({ interval: '5M' }), combo({ interval: '1D' }), combo({ interval: '60M' })];
    expect(pickDefaultCombo(combos)?.interval).toBe('1D');
  });

  it('无日 K 时选最小分钟粒度', () => {
    const combos = [combo({ interval: '60M' }), combo({ interval: '5M' })];
    expect(pickDefaultCombo(combos)?.interval).toBe('5M');
  });

  it('空组合返回 null', () => {
    expect(pickDefaultCombo([])).toBeNull();
  });

  it('interval 选项按标准顺序去重；来源只列存在组合', () => {
    const combos = [
      combo({ interval: '5M' }),
      combo({ interval: '1D' }),
      combo({ interval: '5M', dataSource: 'CSV', adjustType: 'QF' }),
      combo({ interval: '60M' }),
    ];
    expect(buildIntervalOptions(combos).map((o) => o.value)).toEqual(['1D', '60M', '5M']);
    expect(buildDataSourceOptions(combos, '5M').map((o) => o.value)).toEqual(['LONGPORT', 'CSV']);
  });

  it('无组合时回退全量选项', () => {
    expect(buildDataSourceOptions([], '5M').length).toBeGreaterThan(0);
    expect(buildAdjustTypeOptions([], '5M', 'LONGPORT').length).toBeGreaterThan(0);
  });
});

describe('组合原子性', () => {
  const combos = [
    combo({ interval: '5M', dataSource: 'LONGPORT', adjustType: 'NONE' }),
    combo({ interval: '5M', dataSource: 'CSV', adjustType: 'QF' }),
    combo({ interval: '1D', dataSource: 'LONGPORT', adjustType: 'NONE' }),
    combo({ interval: '1D', dataSource: 'LONGPORT', adjustType: 'HF' }),
  ];

  it('复权选项按 interval+source 原子过滤：只列真实存在组合', () => {
    expect(buildAdjustTypeOptions(combos, '5M', 'LONGPORT').map((o) => o.value)).toEqual(['NONE']);
    expect(buildAdjustTypeOptions(combos, '5M', 'CSV').map((o) => o.value)).toEqual(['QF']);
    expect(buildAdjustTypeOptions(combos, '1D', 'LONGPORT').map((o) => o.value)).toEqual(['NONE', 'HF']);
    // 5M 不存在 LONGPORT/QF、CSV/NONE、LONGPORT/HF 等非法交叉组合
    expect(isValidCombo(combos, '5M', 'LONGPORT', 'QF')).toBe(false);
    expect(isValidCombo(combos, '5M', 'CSV', 'NONE')).toBe(false);
    expect(isValidCombo(combos, '5M', 'LONGPORT', 'HF')).toBe(false);
  });

  it('isValidCombo 只认完整 tuple；空组合一律 false', () => {
    expect(isValidCombo(combos, '5M', 'LONGPORT', 'NONE')).toBe(true);
    expect(isValidCombo(combos, '1D', 'LONGPORT', 'HF')).toBe(true);
    expect(isValidCombo(combos, '1D', 'CSV', 'NONE')).toBe(false);
    expect(isValidCombo([], '5M', 'LONGPORT', 'NONE')).toBe(false);
  });

  it('resolveCombo：合法 tuple 原样返回', () => {
    expect(resolveCombo(combos, '5M', 'LONGPORT', 'NONE')).toEqual({ interval: '5M', dataSource: 'LONGPORT', adjustType: 'NONE' });
  });

  it('resolveCombo：同 source 自动选合法复权（不得产生 LONGPORT/QF）', () => {
    expect(resolveCombo(combos, '5M', 'LONGPORT', 'QF')).toEqual({ interval: '5M', dataSource: 'LONGPORT', adjustType: 'NONE' });
  });

  it('resolveCombo：切换来源自动选该 interval+source 的合法组合', () => {
    expect(resolveCombo(combos, '5M', 'CSV', 'NONE')).toEqual({ interval: '5M', dataSource: 'CSV', adjustType: 'QF' });
  });

  it('resolveCombo：同 interval 无 source 匹配时选该 interval 首个组合', () => {
    expect(resolveCombo(combos, '5M', 'MANUAL', 'NONE')).toEqual({ interval: '5M', dataSource: 'LONGPORT', adjustType: 'NONE' });
  });

  it('resolveCombo：interval 无任何组合时回退默认组合', () => {
    expect(resolveCombo(combos, '30M', 'LONGPORT', 'NONE')).toEqual({ interval: '1D', dataSource: 'LONGPORT', adjustType: 'NONE' });
  });
});
