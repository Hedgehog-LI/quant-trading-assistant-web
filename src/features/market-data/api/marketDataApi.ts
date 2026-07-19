/**
 * 行情数据 API（mock/remote 双模式）。
 * mock 使用 PapaParse 解析 CSV + localStorage；remote 调用 /api/v1/market-data/*。
 * 校验、原子性、幂等键语义与后端一致。
 */
import Papa from 'papaparse';
import { client } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import { unwrap, unwrapVoid } from '../../../shared/api/unwrappers';
import { getItem, setItem } from '../../../shared/api/localStorageClient';
import { generateId } from '../../../shared/utils/id';
import { getSettings } from '../../settings/api/settingsApi';
import { normalizeCanonicalSymbol } from '../utils/canonicalSymbol';
import type {
  StockBasic, StockDailyBar, DailyBarImportResult, EntityId,
  ProviderStatus, StockQuoteSnapshot, MarketDataSyncTask, MarketDataAlert,
} from '../../../shared/types/domain';

const STOCK_KEY = 'stocks';
const BAR_KEY = 'stockDailyBars';

const CSV_HEADERS = ['canonical_symbol', 'trade_date', 'open', 'high', 'low', 'close', 'volume', 'amount', 'adjust_type'];
const MAX_ROWS = 10000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ============ 类型 ============
export interface StockBasicInput {
  symbol: string;
  market: string;
  name?: string;
  listDate?: string;
  delisted?: boolean;
}
export interface StockBasicUpdate {
  name?: string;
  listDate?: string;
  delisted?: boolean;
}
export interface DailyBarFilter {
  canonicalSymbol?: string;
  fromDate?: string;
  toDate?: string;
  adjustType?: string;
  dataSource?: string;
  page?: number;
  size?: number;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

// ============ 共享校验 ============
function validateCanonical(s: string): string {
  return normalizeCanonicalSymbol(s);
}
function validateAdjust(t: string): string {
  const v = t.trim().toUpperCase();
  if (!['NONE', 'QF', 'HF'].includes(v)) throw new Error(`adjust_type 必须为 NONE/QF/HF: ${v}`);
  return v;
}
function validateOhlc(o: number, h: number, l: number, c: number): void {
  if (o <= 0 || h <= 0 || l <= 0 || c <= 0) throw new Error('OHLC 价格必须大于 0');
  if (h < o || h < c || h < l) throw new Error('high 不能小于其他价格');
  if (l > o || l > c || l > h) throw new Error('low 不能大于其他价格');
}
function validateDate(d: string): string {
  const trimmed = d.trim();
  // 严格 YYYY-MM-DD + 真实日期
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error(`日期格式不合法（需 YYYY-MM-DD）: ${trimmed}`);
  const date = new Date(trimmed + 'T00:00:00Z');
  if (isNaN(date.getTime())) throw new Error(`日期不真实: ${trimmed}`);
  // 验证 round-trip（避免 2026-13-45 等被 new Date 接受的情况）
  const parts = trimmed.split('-');
  if (date.getUTCFullYear() !== parseInt(parts[0]) ||
      date.getUTCMonth() + 1 !== parseInt(parts[1]) ||
      date.getUTCDate() !== parseInt(parts[2])) {
    throw new Error(`日期不真实: ${trimmed}`);
  }
  return trimmed;
}
function validateNumber(v: string, field: string): number {
  const n = parseFloat(v.trim());
  if (!Number.isFinite(n)) throw new Error(`${field} 不是合法数字: ${v}`);
  return n;
}
function validateInt(v: string, field: string): number {
  const n = parseInt(v.trim(), 10);
  if (!Number.isFinite(n)) throw new Error(`${field} 不是合法整数: ${v}`);
  return n;
}

function uniqueKey(b: { canonicalSymbol: string; tradeDate: string; adjustType: string; dataSource: string }): string {
  return `${b.canonicalSymbol}|${b.tradeDate}|${b.adjustType}|${b.dataSource}`;
}

// ============ mock ============
function buildCanonical(market: string, symbol: string): string {
  return normalizeCanonicalSymbol(`${market}.${symbol}`);
}

interface MockBar extends StockDailyBar {
  _key: string;
}

function readBars(): MockBar[] {
  const bars = getItem<StockDailyBar[]>(BAR_KEY) ?? [];
  return bars.map((b) => ({ ...b, _key: uniqueKey(b) }));
}
function writeBars(bars: MockBar[]): void {
  setItem(BAR_KEY, bars.map(({ _key, ...rest }) => rest as StockDailyBar));
}

const mockApi = {
  async listStocks(market?: string, keyword?: string, page = 1, size = 20): Promise<PageResult<StockBasic>> {
    const all = getItem<StockBasic[]>(STOCK_KEY) ?? [];
    const filtered = all
      .filter((s) => !market || s.market === market)
      .filter((s) => !keyword || s.canonicalSymbol.includes(keyword) || (s.name ?? '').includes(keyword));
    const offset = (page - 1) * size;
    return { items: filtered.slice(offset, offset + size), total: filtered.length, page, size };
  },
  async createStock(input: StockBasicInput): Promise<StockBasic> {
    const all = getItem<StockBasic[]>(STOCK_KEY) ?? [];
    const canonical = buildCanonical(input.market, input.symbol);
    if (all.some((s) => s.canonicalSymbol === canonical)) throw new Error('证券已存在: ' + canonical);
    const now = new Date().toISOString();
    const stock: StockBasic = {
      ...input, canonicalSymbol: canonical, delisted: input.delisted ?? false,
      id: generateId(), createdAt: now, updatedAt: now,
    };
    all.push(stock);
    setItem(STOCK_KEY, all);
    return stock;
  },
  async updateStock(id: EntityId, input: StockBasicUpdate): Promise<StockBasic | null> {
    const all = getItem<StockBasic[]>(STOCK_KEY) ?? [];
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...input, updatedAt: new Date().toISOString() };
    setItem(STOCK_KEY, all);
    return all[idx];
  },
  async deleteStock(canonical: string): Promise<void> {
    const bars = readBars();
    if (bars.some((b) => b.canonicalSymbol === canonical)) {
      throw new Error(`证券 ${canonical} 存在日 K 数据，不可删除`);
    }
    const all = getItem<StockBasic[]>(STOCK_KEY) ?? [];
    setItem(STOCK_KEY, all.filter((s) => s.canonicalSymbol !== canonical));
  },
  async queryBars(filter: DailyBarFilter, page = 1, size = 20): Promise<PageResult<StockDailyBar>> {
    const all = readBars();
    const filtered = all
      .filter((b) => !filter.canonicalSymbol || b.canonicalSymbol === filter.canonicalSymbol)
      .filter((b) => !filter.fromDate || b.tradeDate >= filter.fromDate)
      .filter((b) => !filter.toDate || b.tradeDate <= filter.toDate)
      .filter((b) => !filter.adjustType || b.adjustType === filter.adjustType)
      .filter((b) => !filter.dataSource || b.dataSource === filter.dataSource)
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
    const offset = (page - 1) * size;
    return {
      items: filtered.slice(offset, offset + size).map(({ _key: _k, ...rest }) => rest as StockDailyBar),
      total: filtered.length, page, size,
    };
  },
  async importBars(file: File): Promise<DailyBarImportResult> {
    // 1. 文件级校验
    if (file.size <= 0) {
      return { inserted: 0, updated: 0, skipped: 0, failed: 1, errors: [{ row: 0, message: '文件为空' }] };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { inserted: 0, updated: 0, skipped: 0, failed: 1, errors: [{ row: 0, message: `文件超过 ${MAX_FILE_SIZE} 字节限制` }] };
    }

    // 2. PapaParse 全量解析
    const text = await file.text();
    if (!text.trim()) {
      return { inserted: 0, updated: 0, skipped: 0, failed: 1, errors: [{ row: 0, message: '文件为空' }] };
    }
    const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

    // 3. PapaParse 解析错误
    if (result.errors.length > 0) {
      const errors = result.errors.slice(0, 50).map((e) => ({
        row: (e.row ?? 0) + 2, message: e.message,
      }));
      return { inserted: 0, updated: 0, skipped: 0, failed: errors.length, errors };
    }

    // 4. 表头严格校验（数量、名称、顺序完全一致）
    const actualHeaders = result.meta.fields ?? [];
    if (actualHeaders.length !== CSV_HEADERS.length) {
      return { inserted: 0, updated: 0, skipped: 0, failed: 1, errors: [{ row: 0, message: `表头列数不匹配，期望 ${CSV_HEADERS.length} 列，实际 ${actualHeaders.length} 列` }] };
    }
    for (let i = 0; i < CSV_HEADERS.length; i++) {
      if (actualHeaders[i] !== CSV_HEADERS[i]) {
        return { inserted: 0, updated: 0, skipped: 0, failed: 1, errors: [{ row: 0, message: `表头第 ${i + 1} 列不匹配，期望 ${CSV_HEADERS[i]}，实际 ${actualHeaders[i]}` }] };
      }
    }

    // 5. 行数限制
    if (result.data.length > MAX_ROWS) {
      return { inserted: 0, updated: 0, skipped: 0, failed: 1, errors: [{ row: MAX_ROWS + 1, message: `超过最大行数 ${MAX_ROWS}` }] };
    }

    // 6. 逐行解析校验
    const stocks = getItem<StockBasic[]>(STOCK_KEY) ?? [];
    const stockSet = new Set(stocks.map((s) => s.canonicalSymbol));
    const allBars = readBars();
    const barMap = new Map<string, MockBar>();
    allBars.forEach((b) => barMap.set(b._key, b));

    const errors: { row: number; message: string }[] = [];
    let inserted = 0, updated = 0, skipped = 0, failed = 0;
    const fileSeen = new Map<string, StockDailyBar>();

    result.data.forEach((row, i) => {
      const rowNum = i + 2;
      try {
        const canonicalSymbol = validateCanonical(row.canonical_symbol ?? '');
        const tradeDate = validateDate(row.trade_date ?? '');
        const adjustType = validateAdjust(row.adjust_type ?? 'NONE');
        const open = validateNumber(row.open ?? '', 'open');
        const high = validateNumber(row.high ?? '', 'high');
        const low = validateNumber(row.low ?? '', 'low');
        const close = validateNumber(row.close ?? '', 'close');
        const volume = validateInt(row.volume ?? '0', 'volume');
        const amount = validateNumber(row.amount ?? '0', 'amount');
        validateOhlc(open, high, low, close);
        if (volume < 0) throw new Error('volume 不能为负');
        if (amount < 0) throw new Error('amount 不能为负');
        if (!stockSet.has(canonicalSymbol)) throw new Error(`证券不存在: ${canonicalSymbol}`);

        const dataSource = 'CSV';
        const key = `${canonicalSymbol}|${tradeDate}|${adjustType}|${dataSource}`;
        const bar: StockDailyBar = {
          id: '', canonicalSymbol, tradeDate, adjustType, dataSource,
          openPrice: open, highPrice: high, lowPrice: low, closePrice: close,
          volume, amount,
        };

        // 文件内重复键
        if (fileSeen.has(key)) {
          const first = fileSeen.get(key)!;
          if (first.openPrice === open && first.highPrice === high && first.lowPrice === low
              && first.closePrice === close && first.volume === volume && first.amount === amount) {
            skipped++;
          } else {
            failed++;
            errors.push({ row: rowNum, message: `同一文件内幂等键冲突: ${key}` });
          }
          return;
        }
        fileSeen.set(key, bar);

        // DB existing
        const existing = barMap.get(key);
        if (!existing) {
          inserted++;
          barMap.set(key, { ...bar, id: generateId(), _key: key } as MockBar);
        } else {
          const sameData = existing.openPrice === open && existing.highPrice === high
            && existing.lowPrice === low && existing.closePrice === close
            && existing.volume === volume && existing.amount === amount;
          if (sameData) {
            skipped++;
          } else {
            updated++;
            Object.assign(existing, { openPrice: open, highPrice: high, lowPrice: low, closePrice: close, volume, amount });
          }
        }
      } catch (e) {
        failed++;
        errors.push({ row: rowNum, message: e instanceof Error ? e.message : '解析错误' });
      }
    });

    // 原子提交：有错误不写库
    if (failed > 0) {
      return { inserted: 0, updated: 0, skipped: 0, failed, errors };
    }
    writeBars(Array.from(barMap.values()));
    return { inserted, updated, skipped, failed: 0, errors: [] };
  },
};

// ============ remote ============
const remoteApi = {
  async listStocks(market?: string, keyword?: string, page?: number, size?: number): Promise<PageResult<StockBasic>> {
    return unwrap(client.get<ApiResponse<PageResult<StockBasic>>>('/market-data/stocks', {
      params: { market, keyword, page, size },
    }));
  },
  async createStock(input: StockBasicInput): Promise<StockBasic> {
    return unwrap(client.post<ApiResponse<StockBasic>>('/market-data/stocks', input));
  },
  async updateStock(id: EntityId, input: StockBasicUpdate): Promise<StockBasic> {
    return unwrap(client.put<ApiResponse<StockBasic>>(`/market-data/stocks/${id}`, input));
  },
  async deleteStock(canonical: string): Promise<void> {
    await unwrapVoid(client.delete<ApiResponse<unknown>>(`/market-data/stocks/${encodeURIComponent(canonical)}`));
  },
  async queryBars(filter: DailyBarFilter, page?: number, size?: number): Promise<PageResult<StockDailyBar>> {
    return unwrap(client.get<ApiResponse<PageResult<StockDailyBar>>>('/market-data/daily-bars', {
      params: { ...filter, page, size },
    }));
  },
  async importBars(file: File): Promise<DailyBarImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return unwrap(client.post<ApiResponse<DailyBarImportResult>>('/market-data/daily-bars/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },
};

function pick<T>(mock: T, remote: T): T {
  return getSettings().apiMode === 'remote' ? remote : mock;
}

// ============ 具名导出 ============
export const getStocks = (market?: string, keyword?: string, page?: number, size?: number) =>
  pick(mockApi, remoteApi).listStocks(market, keyword, page, size);
export const addStock = (input: StockBasicInput) => pick(mockApi, remoteApi).createStock(input);
export const updateStock = (id: EntityId, input: StockBasicUpdate) => pick(mockApi, remoteApi).updateStock(id, input);
export const deleteStock = (canonical: string) => pick(mockApi, remoteApi).deleteStock(canonical);
export const getDailyBars = (filter: DailyBarFilter, page?: number, size?: number) =>
  pick(mockApi, remoteApi).queryBars(filter, page, size);
export const importDailyBars = (file: File) => pick(mockApi, remoteApi).importBars(file);

// ============ Provider / Quote / Sync / Alert ============
const mockProvider: ProviderStatus = {
  providerCode: 'LONGPORT', configured: false, reachable: false,
  lastError: 'Mock 模式：LongPort 未配置', lastSuccessAt: null,
};

const providerApi = {
  async getStatus(): Promise<ProviderStatus> {
    return getSettings().apiMode === 'remote'
      ? unwrap(client.get<ApiResponse<ProviderStatus>>('/market-data/providers/LONGPORT/status'))
      : mockProvider;
  },
  async healthCheck(): Promise<ProviderStatus> {
    return getSettings().apiMode === 'remote'
      ? unwrap(client.post<ApiResponse<ProviderStatus>>('/market-data/providers/LONGPORT/health-check'))
      : mockProvider;
  },
  async fetchLatestQuotes(symbols: string[], persist: boolean): Promise<StockQuoteSnapshot[]> {
    if (getSettings().apiMode === 'remote') {
      return unwrap(client.post<ApiResponse<StockQuoteSnapshot[]>>('/market-data/quotes/latest',
        { canonicalSymbols: symbols, persist }));
    }
    return [];
  },
  async getQuoteSnapshots(canonicalSymbol?: string, dataSource?: string, page = 1, size = 20): Promise<PageResult<StockQuoteSnapshot>> {
    return getSettings().apiMode === 'remote'
      ? unwrap(client.get<ApiResponse<PageResult<StockQuoteSnapshot>>>('/market-data/quote-snapshots', { params: { canonicalSymbol, dataSource, page, size } }))
      : { items: [], total: 0, page, size };
  },
  async createDailyBarSync(taskType: string, provider: string, canonicalSymbol: string,
                          startDate?: string, endDate?: string, adjustType?: string): Promise<MarketDataSyncTask> {
    if (getSettings().apiMode === 'remote') {
      return unwrap(client.post<ApiResponse<MarketDataSyncTask>>('/market-data/sync-tasks/daily-bars',
        { taskType, provider, canonicalSymbol, startDate, endDate, adjustType }));
    }
    return {
      id: 'mock', taskType, provider, scopeJson: JSON.stringify({ canonicalSymbol, startDate, endDate, adjustType }),
      status: 'FAILED', createdAt: new Date().toISOString(),
    } as MarketDataSyncTask;
  },
  async getSyncTasks(status?: string, provider?: string, page = 1, size = 20): Promise<PageResult<MarketDataSyncTask>> {
    return getSettings().apiMode === 'remote'
      ? unwrap(client.get<ApiResponse<PageResult<MarketDataSyncTask>>>('/market-data/sync-tasks', { params: { status, provider, page, size } }))
      : { items: [], total: 0, page, size };
  },
  async getAlerts(resolved?: boolean, severity?: string, canonicalSymbol?: string, page = 1, size = 20): Promise<PageResult<MarketDataAlert>> {
    return getSettings().apiMode === 'remote'
      ? unwrap(client.get<ApiResponse<PageResult<MarketDataAlert>>>('/market-data/alerts', { params: { resolved, severity, canonicalSymbol, page, size } }))
      : { items: [], total: 0, page, size };
  },
  async resolveAlert(id: EntityId): Promise<MarketDataAlert> {
    return unwrap(client.patch<ApiResponse<MarketDataAlert>>(`/market-data/alerts/${id}/resolve`));
  },
};

export const getProviderStatus = () => providerApi.getStatus();
export const healthCheck = () => providerApi.healthCheck();
export const fetchLatestQuotes = (symbols: string[], persist: boolean) => providerApi.fetchLatestQuotes(symbols, persist);
export const getQuoteSnapshots = (canonicalSymbol?: string, dataSource?: string, page?: number, size?: number) =>
  providerApi.getQuoteSnapshots(canonicalSymbol, dataSource, page, size);
export const createDailyBarSync = (taskType: string, provider: string, canonicalSymbol: string,
                                  startDate?: string, endDate?: string, adjustType?: string) =>
  providerApi.createDailyBarSync(taskType, provider, canonicalSymbol, startDate, endDate, adjustType);
export const getSyncTasks = (status?: string, provider?: string, page?: number, size?: number) =>
  providerApi.getSyncTasks(status, provider, page, size);
export const getAlerts = (resolved?: boolean, severity?: string, canonicalSymbol?: string, page?: number, size?: number) =>
  providerApi.getAlerts(resolved, severity, canonicalSymbol, page, size);
export const resolveAlert = (id: EntityId) => providerApi.resolveAlert(id);
