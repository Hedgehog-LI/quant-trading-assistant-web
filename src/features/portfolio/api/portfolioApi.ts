/**
 * 交易账本数据访问层（mock / remote 双模式）。
 *
 * - mock：读取本地交易流水 + 手工当前价，用 portfolioCalculator 实时 FIFO 计算。
 * - remote：调用后端 /api/v1/portfolio/*（baseURL 已配置，vite proxy /api → 后端）。
 *
 * 按 settings.apiMode 分流，每次调用现读 settings，切换模式无需刷新页面。
 * 这是项目内第一个 remote 分流的 feature，建立后续 remote feature 的范式。
 *
 * closed-trades 筛选统一在前端：mock 与 remote 都拉全量，由 hook 层 applyClosedTradeFilter 筛选，
 * 避免 mock / remote 口径不一致或同层重复筛选。
 */
import { client } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import { today } from '../../../shared/utils/date';
import { getSettings } from '../../settings/api/settingsApi';
import { getTradeJournals } from '../../journal/api/tradeJournalApi';
import { calculateAll, toFlowItems } from './portfolioCalculator';
import { getAllSnapshots, getLatestPriceBySymbol, upsertSnapshot } from './portfolioLocalStorage';
import type {
  ClosedTrade,
  PortfolioPosition,
  PortfolioSummary,
  PriceSnapshot,
  PriceSnapshotInput,
} from '../model/types';

// ============ 筛选 ============

export interface ClosedTradeFilter {
  symbol?: string;
  /** 卖出日期起始（按 sellDate 过滤） */
  fromDate?: string;
  /** 卖出日期截止 */
  toDate?: string;
}

/** 按股票代码 + 卖出日期区间筛选已结算交易（mock 与 remote 共用）。 */
export function applyClosedTradeFilter(trades: ClosedTrade[], filter?: ClosedTradeFilter): ClosedTrade[] {
  if (!filter) return trades;
  const symbol = filter.symbol?.trim().toUpperCase();
  return trades.filter(
    (t) =>
      (!symbol || t.symbol === symbol) &&
      (!filter.fromDate || t.sellDate >= filter.fromDate) &&
      (!filter.toDate || t.sellDate <= filter.toDate),
  );
}

// ============ 接口 ============

export interface PortfolioApi {
  getSummary(): Promise<PortfolioSummary>;
  getPositions(): Promise<PortfolioPosition[]>;
  /** 返回全量已结算交易（筛选交由 hook 层 applyClosedTradeFilter） */
  getClosedTrades(): Promise<ClosedTrade[]>;
  getPrices(): Promise<PriceSnapshot[]>;
  upsertPrice(input: PriceSnapshotInput): Promise<PriceSnapshot>;
}

// ============ mock 实现 ============

/** 读本地流水 + 当前价，实时 FIFO 计算。每次调用都重读，保证数据新鲜。 */
function computeAll() {
  const journals = getTradeJournals();
  const prices = getLatestPriceBySymbol();
  return calculateAll(toFlowItems(journals), prices, today());
}

const mockApi: PortfolioApi = {
  async getSummary() {
    return computeAll().summary;
  },
  async getPositions() {
    return computeAll().positions;
  },
  async getClosedTrades() {
    return computeAll().closedTrades;
  },
  async getPrices() {
    return getAllSnapshots();
  },
  async upsertPrice(input) {
    return upsertSnapshot(input);
  },
};

// ============ remote 实现 ============

async function unwrap<T>(p: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await p;
  const body = res.data;
  if (!body.success || body.data == null) {
    throw new Error(body.message ?? '接口返回失败');
  }
  return body.data;
}

const remoteApi: PortfolioApi = {
  async getSummary() {
    return unwrap(client.get<ApiResponse<PortfolioSummary>>('/portfolio/summary'));
  },
  async getPositions() {
    return unwrap(client.get<ApiResponse<PortfolioPosition[]>>('/portfolio/positions'));
  },
  async getClosedTrades() {
    return unwrap(client.get<ApiResponse<ClosedTrade[]>>('/portfolio/closed-trades'));
  },
  async getPrices() {
    return unwrap(client.get<ApiResponse<PriceSnapshot[]>>('/portfolio/prices'));
  },
  async upsertPrice(input) {
    return unwrap(client.post<ApiResponse<PriceSnapshot>>('/portfolio/prices', input));
  },
};

// ============ 分流 ============

function pick(): PortfolioApi {
  return getSettings().apiMode === 'remote' ? remoteApi : mockApi;
}

export const portfolioApi: PortfolioApi = {
  getSummary() {
    return pick().getSummary();
  },
  getPositions() {
    return pick().getPositions();
  },
  getClosedTrades() {
    return pick().getClosedTrades();
  },
  getPrices() {
    return pick().getPrices();
  },
  upsertPrice(input) {
    return pick().upsertPrice(input);
  },
};
