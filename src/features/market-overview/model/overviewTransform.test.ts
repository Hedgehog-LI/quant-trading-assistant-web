import { describe, expect, it } from 'vitest';
import {
  dash,
  formatIlliquidity,
  formatMoney,
  formatPercent,
  formatSignedPercent,
} from './formatters';
import {
  OTHER_INDUSTRY_CODE,
  buildMigrationTooltipRows,
  toActivityChartData,
  toBenchmarkChartData,
  toBreadthChartData,
  toMigrationChartData,
} from './overviewTransform';
import type {
  ActivityPoint,
  BenchmarkPoint,
  BreadthPoint,
  IndustryMigrationRow,
  LiquidityProxyPoint,
} from './types';

describe('formatters', () => {
  it('金额自动使用 万/亿 单位，null 返回 null', () => {
    expect(formatMoney(1.23e8)).toBe('1.23亿');
    expect(formatMoney(4567.8e4)).toBe('4567.80万');
    expect(formatMoney(890)).toBe('890元');
    expect(formatMoney(null)).toBeNull();
    expect(formatMoney(Number.NaN)).toBeNull();
  });

  it('比率转百分比与带符号百分比；null 返回 null（禁止 0 冒充）', () => {
    expect(formatPercent(0.1234)).toBe('12.3%');
    expect(formatPercent(-0.0256, 2)).toBe('-2.56%');
    expect(formatSignedPercent(0.005)).toBe('+0.5%');
    expect(formatSignedPercent(-0.005)).toBe('-0.5%');
    expect(formatPercent(null)).toBeNull();
  });

  it('日频价格冲击代理使用科学计数；dash 统一占位', () => {
    expect(formatIlliquidity(3.1234e-8)).toBe('3.12e-8');
    expect(formatIlliquidity(null)).toBeNull();
    expect(dash(null)).toBe('--');
    expect(dash('1.2万')).toBe('1.2万');
  });
});

describe('toBenchmarkChartData', () => {
  it('null 指标输出 whitespace 断点，不补 0；序列按日期升序', () => {
    const series: BenchmarkPoint[] = [
      { tradeDate: '2026-07-03', closePrice: 90, dailyReturn: null, amount: null, ma20: null, ma60: null, drawdown: -0.1 },
      { tradeDate: '2026-07-01', closePrice: 100, dailyReturn: 0.01, amount: 3e10, ma20: 98, ma60: null, drawdown: 0 },
      { tradeDate: '2026-07-02', closePrice: null, dailyReturn: 0.02, amount: 2e10, ma20: 99, ma60: 95, drawdown: -0.01 },
    ];
    const data = toBenchmarkChartData(series);

    expect(data.close.map((p) => (p as { time: string }).time)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    // 07-02 收盘 null → whitespace（无 value 字段）；07-03 成交额 null → whitespace。
    expect('value' in data.close[1]).toBe(false);
    expect((data.close[0] as { value: number }).value).toBe(100);
    expect('value' in data.amount[2]).toBe(false);
    expect('value' in data.ma60[0]).toBe(false);
    expect((data.drawdown[2] as { value: number }).value).toBe(-0.1);
  });
});

describe('toActivityChartData', () => {
  it('成交额柱/中位线与冲击代理线按日期对齐，null 断点', () => {
    const activity: ActivityPoint[] = [{
      tradeDate: '2026-07-01', marketTurnover: 1e11, turnoverMedian20: 0.9e11,
      turnoverMedian60: null, activityRatio: 1.11, activeStockRatio: null, validStocks: 150,
    }];
    const liquidity: LiquidityProxyPoint[] = [{
      tradeDate: '2026-07-01', medianIlliquidity: 2e-8, p90Illiquidity: null, qualifiedStocks: 150, zeroAmountRows: 1,
    }];
    const data = toActivityChartData(activity, liquidity);

    expect((data.turnover[0] as { value: number }).value).toBe(1e11);
    expect((data.turnoverMedian20[0] as { value: number }).value).toBe(0.9e11);
    expect('value' in data.turnoverMedian60[0]).toBe(false);
    expect('value' in data.activeStockRatio[0]).toBe(false);
    expect((data.medianIlliquidity[0] as { value: number }).value).toBe(2e-8);
    expect('value' in data.p90Illiquidity[0]).toBe(false);
  });
});

describe('toBreadthChartData', () => {
  it('上涨为正红柱、下跌为负绿柱，净额 0 断点；A/D null 断点', () => {
    const series: BreadthPoint[] = [
      { tradeDate: '2026-07-01', advancingStocks: 80, decliningStocks: 60, flatStocks: 10, validStocks: 150, advanceRatio: 0.53, adLine: 20, aboveMa20Stocks: 60, aboveMa20Ratio: 0.4 },
      { tradeDate: '2026-07-02', advancingStocks: 70, decliningStocks: 70, flatStocks: 10, validStocks: 150, advanceRatio: 0.47, adLine: null, aboveMa20Stocks: 55, aboveMa20Ratio: null },
    ];
    const data = toBreadthChartData(series);

    const up = data.advanceDecline[0] as { value: number; color: string };
    expect(up.value).toBe(20);
    expect(up.color).toBe('#f5222d');
    expect('value' in data.advanceDecline[1]).toBe(false);
    expect('value' in data.adLine[1]).toBe(false);
    expect('value' in data.aboveMa20Ratio[1]).toBe(false);
  });
});

describe('toMigrationChartData', () => {
  const rows: IndustryMigrationRow[] = [
    { tradeDate: '2026-07-01', industryCode: 'IND_B', industryName: '行业B', turnover: 500, turnoverShare: 0.5, previousDayShareChange: null, median20Share: 0.5, median20ShareChange: null, rank: 1, coveredStocks: 5 },
    { tradeDate: '2026-07-01', industryCode: 'IND_A', industryName: '行业A', turnover: 300, turnoverShare: 0.3, previousDayShareChange: null, median20Share: 0.3, median20ShareChange: null, rank: 2, coveredStocks: 3 },
    { tradeDate: '2026-07-01', industryCode: OTHER_INDUSTRY_CODE, industryName: '其他', turnover: 200, turnoverShare: 0.2, previousDayShareChange: null, median20Share: 0.2, median20ShareChange: null, rank: null, coveredStocks: 2 },
    // 07-02：IND_A 未进 Top-8 → 无行（注意力并入 OTHER），IND_B 份额下降。
    { tradeDate: '2026-07-02', industryCode: 'IND_B', industryName: '行业B', turnover: 300, turnoverShare: 0.3, previousDayShareChange: -0.2, median20Share: 0.4, median20ShareChange: -0.1, rank: 1, coveredStocks: 5 },
    { tradeDate: '2026-07-02', industryCode: OTHER_INDUSTRY_CODE, industryName: '其他', turnover: 700, turnoverShare: 0.7, previousDayShareChange: 0.5, median20Share: 0.45, median20ShareChange: 0.25, rank: null, coveredStocks: 9 },
  ];

  it('图层按合计成交额降序，OTHER 恒最后；命名行业当日缺行为 0（并入 OTHER 的真实语义）', () => {
    const chart = toMigrationChartData(rows);

    expect(chart.dates).toEqual(['2026-07-01', '2026-07-02']);
    expect(chart.layers.map((layer) => layer.industryCode)).toEqual(['IND_B', 'IND_A', OTHER_INDUSTRY_CODE]);
    const indA = chart.layers[1];
    expect(indA.points.map((point) => point.value)).toEqual([0.3, 0]);
    const other = chart.layers[2];
    expect(other.points.map((point) => point.value)).toEqual([0.2, 0.7]);
    expect(chart.rowByDateAndCode.get('2026-07-02|IND_B')?.previousDayShareChange).toBe(-0.2);
  });

  it('tooltip 行按占比降序，OTHER 与命名行业同场排序', () => {
    const chart = toMigrationChartData(rows);
    const firstDate = chart.dates[0];
    const byDate = new Map<string, IndustryMigrationRow>();
    for (const [key, row] of chart.rowByDateAndCode) {
      if (key.startsWith(`${firstDate}|`)) byDate.set(key, row);
    }

    const sorted = buildMigrationTooltipRows(byDate);
    expect(sorted.map((row) => row.industryCode)).toEqual(['IND_B', 'IND_A', OTHER_INDUSTRY_CODE]);
  });
});
