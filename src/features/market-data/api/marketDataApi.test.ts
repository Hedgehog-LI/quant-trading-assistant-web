import { describe, expect, it, beforeEach } from 'vitest';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';
import {
  addStock, deleteStock, getStocks, importDailyBars, updateStock, getDailyBars,
} from './marketDataApi';

beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
});

const CSV_HEADER = 'canonical_symbol,trade_date,open,high,low,close,volume,amount,adjust_type\n';

function csv(rows: string[]): string {
  return CSV_HEADER + rows.join('\n') + '\n';
}

describe('marketDataApi mock', () => {
  // ===== 证券 CRUD =====
  it('新增 + 查询证券', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '贵州茅台' });
    const result = await getStocks();
    expect(result.total).toBe(1);
    expect(result.items[0].canonicalSymbol).toBe('SH.600519');
  });

  it('重复 canonical 拒绝', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    await expect(addStock({ symbol: '600519', market: 'SH' })).rejects.toThrow();
  });

  it('编辑证券名称', async () => {
    const s = await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    const updated = await updateStock(s.id, { name: '贵州茅台' });
    expect(updated?.name).toBe('贵州茅台');
  });

  it('删除无日 K 的证券', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    await deleteStock('SH.600519');
    const result = await getStocks();
    expect(result.total).toBe(0);
  });

  it('删除有日 K 的证券被拒绝', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    const file = new File([csv(['SH.600519,2026-07-01,1680,1695,1678,1690,25000,42250000,NONE'])], 't.csv');
    await importDailyBars(file);
    await expect(deleteStock('SH.600519')).rejects.toThrow();
  });

  // ===== CSV 导入 =====
  it('正常导入两条', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    const file = new File([csv([
      'SH.600519,2026-07-01,1680,1695,1678,1690,25000,42250000,NONE',
      'SH.600519,2026-07-02,1690,1700,1685,1695,22000,37290000,NONE',
    ])], 't.csv');
    const result = await importDailyBars(file);
    expect(result.inserted).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('幂等重复导入 skipped', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    const data = csv(['SH.600519,2026-07-01,1680,1695,1678,1690,25000,42250000,NONE']);
    await importDailyBars(new File([data], 't.csv'));
    const r2 = await importDailyBars(new File([data], 't.csv'));
    expect(r2.skipped).toBe(1);
    expect(r2.inserted).toBe(0);
  });

  it('内容变化时 updated', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    await importDailyBars(new File([csv(['SH.600519,2026-07-01,1680,1695,1678,1690,25000,42250000,NONE'])], 't.csv'));
    const r2 = await importDailyBars(new File([csv(['SH.600519,2026-07-01,1690,1700,1685,1695,22000,37290000,NONE'])], 't.csv'));
    expect(r2.updated).toBe(1);
  });

  it('同文件重复一致 skipped', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    const row = 'SH.600519,2026-07-01,1680,1695,1678,1690,25000,42250000,NONE';
    const r = await importDailyBars(new File([csv([row, row])], 't.csv'));
    expect(r.inserted).toBe(1);
    expect(r.skipped).toBe(1);
  });

  it('同文件重复冲突 failed', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    const r = await importDailyBars(new File([csv([
      'SH.600519,2026-07-01,1680,1695,1678,1690,25000,42250000,NONE',
      'SH.600519,2026-07-01,9999,9999,9999,9999,99999,999999999,NONE',
    ])], 't.csv'));
    expect(r.failed).toBe(1);
    expect(r.inserted).toBe(0);
  });

  it('未知股票 failed', async () => {
    const r = await importDailyBars(new File([csv(['SH.999999,2026-07-01,1680,1695,1678,1690,25000,42250000,NONE'])], 't.csv'));
    expect(r.failed).toBe(1);
    expect(r.errors[0].message).toContain('证券不存在');
  });

  it('OHLC 校验失败', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    const r = await importDailyBars(new File([csv(['SH.600519,2026-07-01,1700,1690,1680,1695,25000,42250000,NONE'])], 't.csv'));
    expect(r.failed).toBe(1);
    expect(r.errors[0].message).toContain('high');
  });

  it('错误表头 rejected', async () => {
    const r = await importDailyBars(new File([Buffer.from('foo,bar\nx,y\n')], 't.csv'));
    expect(r.failed).toBe(1);
    expect(r.errors[0].message).toContain('表头');
  });

  it('空文件 rejected', async () => {
    const r = await importDailyBars(new File([''], 'empty.csv'));
    expect(r.failed).toBe(1);
    expect(r.errors[0].message).toContain('空');
  });

  // ===== 查询 =====
  it('查询日 K 分页', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    await importDailyBars(new File([csv([
      'SH.600519,2026-07-01,1680,1695,1678,1690,25000,42250000,NONE',
      'SH.600519,2026-07-02,1690,1700,1685,1695,22000,37290000,NONE',
      'SH.600519,2026-07-03,1695,1710,1690,1705,18000,30690000,NONE',
    ])], 't.csv'));
    const page1 = await getDailyBars({ canonicalSymbol: 'SH.600519' }, 1, 2);
    expect(page1.total).toBe(3);
    expect(page1.items.length).toBe(2);
    const page2 = await getDailyBars({ canonicalSymbol: 'SH.600519' }, 2, 2);
    expect(page2.items.length).toBe(1);
  });

  // ===== 额外校验测试 =====

  it('非法数字 failed', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    const r = await importDailyBars(new File([csv(['SH.600519,2026-07-01,abc,1695,1678,1690,25000,42250000,NONE'])], 't.csv'));
    expect(r.failed).toBe(1);
    expect(r.errors[0].message).toContain('open');
  });

  it('非法日期 failed', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    const r = await importDailyBars(new File([csv(['SH.600519,2026-13-45,1680,1695,1678,1690,25000,42250000,NONE'])], 't.csv'));
    expect(r.failed).toBe(1);
    expect(r.errors[0].message).toContain('日期');
  });

  it('表头列顺序错误 rejected', async () => {
    const wrongCsv = 'trade_date,canonical_symbol,open,high,low,close,volume,amount,adjust_type\n2026-07-01,SH.600519,1680,1695,1678,1690,25000,42250000,NONE\n';
    const r = await importDailyBars(new File([wrongCsv], 't.csv'));
    expect(r.failed).toBe(1);
    expect(r.errors[0].message).toContain('表头');
  });

  it('表头列数不匹配 rejected', async () => {
    const wrongCsv = 'canonical_symbol,trade_date,open,high,low,close,volume,amount\nSH.600519,2026-07-01,1680,1695,1678,1690,25000,42250000\n';
    const r = await importDailyBars(new File([wrongCsv], 't.csv'));
    expect(r.failed).toBe(1);
    expect(r.errors[0].message).toContain('表头列数');
  });

  it('空文件 rejected', async () => {
    const r = await importDailyBars(new File([''], 'empty.csv'));
    expect(r.failed).toBe(1);
    expect(r.errors[0].message).toContain('空');
  });

  it('日期范围 + 复权类型 + 来源筛选', async () => {
    await addStock({ symbol: '600519', market: 'SH', name: '茅台' });
    await importDailyBars(new File([csv([
      'SH.600519,2026-07-01,1680,1695,1678,1690,25000,42250000,NONE',
      'SH.600519,2026-07-02,1690,1700,1685,1695,22000,37290000,NONE',
      'SH.600519,2026-07-03,1695,1710,1690,1705,18000,30690000,NONE',
    ])], 't.csv'));
    // 日期范围
    const range = await getDailyBars({ canonicalSymbol: 'SH.600519', fromDate: '2026-07-02', toDate: '2026-07-02' });
    expect(range.total).toBe(1);
    // 复权类型
    const adj = await getDailyBars({ canonicalSymbol: 'SH.600519', adjustType: 'NONE' });
    expect(adj.total).toBe(3);
    const adjEmpty = await getDailyBars({ canonicalSymbol: 'SH.600519', adjustType: 'QF' });
    expect(adjEmpty.total).toBe(0);
    // 来源
    const src = await getDailyBars({ canonicalSymbol: 'SH.600519', dataSource: 'CSV' });
    expect(src.total).toBe(3);
  });
});
