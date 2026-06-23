import { describe, it, expect, beforeEach } from 'vitest';
import { getAllSnapshots, upsertSnapshot, getLatestPriceBySymbol } from './portfolioLocalStorage';
import { clearAll } from '../../../shared/api/localStorageClient';

beforeEach(() => {
  clearAll();
});

describe('portfolioLocalStorage', () => {
  it('新增手工当前价快照', () => {
    const snap = upsertSnapshot({ symbol: '000001', name: '平安银行', currentPrice: 11.5, priceDate: '2026-01-12' });
    expect(snap.symbol).toBe('000001');
    expect(snap.currentPrice).toBe(11.5);
    expect(snap.id).toBeTruthy();
    expect(getAllSnapshots()).toHaveLength(1);
  });

  it('symbol 自动转大写', () => {
    upsertSnapshot({ symbol: ' sz000001 ', currentPrice: 11.5, priceDate: '2026-01-12' });
    expect(getAllSnapshots()[0].symbol).toBe('SZ000001');
  });

  it('相同 symbol + priceDate 覆盖价格', () => {
    upsertSnapshot({ symbol: '000001', currentPrice: 11.5, priceDate: '2026-01-12' });
    const updated = upsertSnapshot({ symbol: '000001', currentPrice: 12.0, priceDate: '2026-01-12' });
    expect(updated.currentPrice).toBe(12.0);
    expect(getAllSnapshots()).toHaveLength(1); // 覆盖而非新增
  });

  it('相同 symbol 不同 priceDate 各自保留', () => {
    upsertSnapshot({ symbol: '000001', currentPrice: 11.5, priceDate: '2026-01-12' });
    upsertSnapshot({ symbol: '000001', currentPrice: 12.0, priceDate: '2026-01-13' });
    expect(getAllSnapshots()).toHaveLength(2);
  });

  it('getLatestPriceBySymbol 取每个 symbol 最新 priceDate 的价格', () => {
    upsertSnapshot({ symbol: '000001', currentPrice: 11.5, priceDate: '2026-01-12' });
    upsertSnapshot({ symbol: '000001', currentPrice: 12.0, priceDate: '2026-01-13' });
    upsertSnapshot({ symbol: '000002', currentPrice: 20.0, priceDate: '2026-01-10' });

    const map = getLatestPriceBySymbol();
    expect(map.get('000001')).toBe(12.0); // 最新日期
    expect(map.get('000002')).toBe(20.0);
  });

  it('空数据返回空 Map', () => {
    expect(getLatestPriceBySymbol().size).toBe(0);
  });
});
