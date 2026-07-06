/**
 * 行情数据 API（mock/remote 双模式）。
 * mock 使用 localStorage；remote 调用 /api/v1/market-data/*。
 */
import { client } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import { unwrap } from '../../../shared/api/unwrappers';
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import { getSettings } from '../../settings/api/settingsApi';
import type { StockBasic, StockDailyBar, DailyBarImportResult } from '../../../shared/types/domain';

const STOCK_KEY = 'stocks';
const BAR_KEY = 'stockDailyBars';

// ============ 类型 ============
export interface StockBasicInput {
  symbol: string;
  market: string;
  name?: string;
  listDate?: string;
  delisted?: boolean;
}

// ============ mock ============
function buildCanonical(market: string, symbol: string): string {
  return `${market.trim().toUpperCase()}.${symbol.trim()}`;
}

const mockApi = {
  async listStocks(market?: string, keyword?: string): Promise<StockBasic[]> {
    const all = getItem<StockBasic[]>(STOCK_KEY) ?? [];
    return all
      .filter((s) => !market || s.market === market)
      .filter((s) => !keyword || s.canonicalSymbol.includes(keyword) || (s.name ?? '').includes(keyword));
  },
  async createStock(input: StockBasicInput): Promise<StockBasic> {
    const all = getItem<StockBasic[]>(STOCK_KEY) ?? [];
    const canonical = buildCanonical(input.market, input.symbol);
    if (all.some((s) => s.canonicalSymbol === canonical)) throw new Error('证券已存在: ' + canonical);
    const now = new Date().toISOString();
    const stock: StockBasic = {
      ...input,
      canonicalSymbol: canonical,
      delisted: input.delisted ?? false,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    all.push(stock);
    setItem(STOCK_KEY, all);
    return stock;
  },
  async deleteStock(canonical: string): Promise<void> {
    const all = getItem<StockBasic[]>(STOCK_KEY) ?? [];
    setItem(STOCK_KEY, all.filter((s) => s.canonicalSymbol !== canonical));
  },
  async queryBars(canonical?: string, fromDate?: string, toDate?: string): Promise<StockDailyBar[]> {
    const all = getItem<StockDailyBar[]>(BAR_KEY) ?? [];
    return all
      .filter((b) => !canonical || b.canonicalSymbol === canonical)
      .filter((b) => !fromDate || b.tradeDate >= fromDate)
      .filter((b) => !toDate || b.tradeDate <= toDate)
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  },
  async importBars(file: File): Promise<DailyBarImportResult> {
    // mock CSV 解析（简化：与后端口径一致）
    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { inserted: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
    const headers = lines[0].split(',').map((h) => h.trim());
    const stocks = getItem<StockBasic[]>(STOCK_KEY) ?? [];
    const stockSet = new Set(stocks.map((s) => s.canonicalSymbol));
    const allBars = getItem<StockDailyBar[]>(BAR_KEY) ?? [];
    let inserted = 0, skipped = 0, failed = 0;
    const errors: { row: number; message: string }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',');
      const row: Record<string, string> = {};
      headers.forEach((h, j) => (row[h] = (vals[j] ?? '').trim()));
      const canonical = (row.canonical_symbol ?? '').toUpperCase();
      if (!stockSet.has(canonical)) {
        failed++;
        errors.push({ row: i + 1, message: '证券不存在: ' + canonical });
        continue;
      }
      const exists = allBars.some(
        (b) => b.canonicalSymbol === canonical && b.tradeDate === row.trade_date,
      );
      if (exists) {
        skipped++;
      } else {
        allBars.push({
          id: generateId(),
          canonicalSymbol: canonical,
          tradeDate: row.trade_date,
          adjustType: row.adjust_type ?? 'NONE',
          dataSource: 'CSV',
          openPrice: parseFloat(row.open),
          highPrice: parseFloat(row.high),
          lowPrice: parseFloat(row.low),
          closePrice: parseFloat(row.close),
          volume: parseInt(row.volume) || 0,
          amount: parseFloat(row.amount) || 0,
        });
        inserted++;
      }
    }
    setItem(BAR_KEY, allBars);
    return { inserted, updated: 0, skipped, failed, errors };
  },
};

// ============ remote ============
const remoteApi = {
  async listStocks(market?: string, keyword?: string): Promise<StockBasic[]> {
    return unwrap(
      client.get<ApiResponse<StockBasic[]>>('/market-data/stocks', {
        params: { market, keyword },
      }),
    );
  },
  async createStock(input: StockBasicInput): Promise<StockBasic> {
    return unwrap(client.post<ApiResponse<StockBasic>>('/market-data/stocks', input));
  },
  async deleteStock(canonical: string): Promise<void> {
    await client.delete(`/market-data/stocks/${encodeURIComponent(canonical)}`);
  },
  async queryBars(canonical?: string, fromDate?: string, toDate?: string): Promise<StockDailyBar[]> {
    return unwrap(
      client.get<ApiResponse<StockDailyBar[]>>('/market-data/daily-bars', {
        params: { canonicalSymbol: canonical, fromDate, toDate },
      }),
    );
  },
  async importBars(file: File): Promise<DailyBarImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return unwrap(
      client.post<ApiResponse<DailyBarImportResult>>('/market-data/daily-bars/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },
};

function pick<T>(mock: T, remote: T): T {
  return getSettings().apiMode === 'remote' ? remote : mock;
}

// ============ 具名导出 ============
export const getStocks = (market?: string, keyword?: string) =>
  pick(mockApi, remoteApi).listStocks(market, keyword);
export const addStock = (input: StockBasicInput) => pick(mockApi, remoteApi).createStock(input);
export const deleteStock = (canonical: string) => pick(mockApi, remoteApi).deleteStock(canonical);
export const getDailyBars = (canonical?: string, fromDate?: string, toDate?: string) =>
  pick(mockApi, remoteApi).queryBars(canonical, fromDate, toDate);
export const importDailyBars = (file: File) => pick(mockApi, remoteApi).importBars(file);
