import { client } from '../../../shared/api/client';
import { unwrap } from '../../../shared/api/unwrappers';
import { getSettings } from '../../settings/api/settingsApi';
import { normalizeCanonicalSymbol } from '../utils/canonicalSymbol';
import type { Security, SecuritySummary, ListStatus, MatchedBy } from '../../../shared/types/domain';

export interface SecuritySearchInput {
  q: string;
  markets?: string[];
  types?: string[];
  includeDelisted?: boolean;
  limit?: number;
}

export interface SecuritySearchResult {
  items: SecuritySummary[];
  catalogStatus: string;
  catalogUpdatedAt: string | null;
  stale: boolean;
  degraded: boolean;
}

const CATALOG_UPDATED_AT = '2026-07-29T10:00:00';

const SEED_CATALOG: Security[] = [
  { canonicalSymbol: 'SH.603308', symbol: '603308', displayName: '应流股份', name: '应流股份', market: 'SH', exchange: 'SSE', currency: 'CNY', securityType: 'STOCK', listStatus: 'LISTED', pinyinFull: 'yingliugufen', pinyinAbbr: 'ylgf', matchedBy: 'FORMAL_NAME_EXACT' },
  { canonicalSymbol: 'HK.02498', symbol: '02498', displayName: '速腾聚创', name: '速腾聚创', market: 'HK', exchange: 'HKEX', currency: 'HKD', securityType: 'STOCK', listStatus: 'LISTED', aliases: ['RoboSense', '速腾'], pinyinFull: 'sutengjuchuang', pinyinAbbr: 'stjch', matchedBy: 'FORMAL_NAME_EXACT' },
  { canonicalSymbol: 'US.AAPL', symbol: 'AAPL', displayName: 'Apple Inc.', name: 'Apple Inc.', market: 'US', exchange: 'NASDAQ', currency: 'USD', securityType: 'STOCK', listStatus: 'LISTED', aliases: ['Apple', '苹果'], pinyinFull: null, pinyinAbbr: null, matchedBy: 'FORMAL_NAME_EXACT' },
  { canonicalSymbol: 'SH.600600', symbol: '600600', displayName: '同名X', market: 'SH', exchange: 'SSE', currency: 'CNY', securityType: 'STOCK', listStatus: 'LISTED', matchedBy: 'FORMAL_NAME_EXACT' },
  { canonicalSymbol: 'HK.06000', symbol: '06000', displayName: '同名X', market: 'HK', exchange: 'HKEX', currency: 'HKD', securityType: 'STOCK', listStatus: 'LISTED', matchedBy: 'FORMAL_NAME_EXACT' },
  { canonicalSymbol: 'SH.600000', symbol: '600000', displayName: '当前名', market: 'SH', exchange: 'SSE', currency: 'CNY', securityType: 'STOCK', listStatus: 'LISTED', aliases: ['旧名称'], pinyinFull: 'dangqianming', matchedBy: 'FORMAL_NAME_EXACT' },
  { canonicalSymbol: 'SH.600001', symbol: '600001', displayName: '退市样本', market: 'SH', exchange: 'SSE', currency: 'CNY', securityType: 'STOCK', listStatus: 'DELISTED', delisted: true, matchedBy: 'FORMAL_NAME_EXACT' },
  { canonicalSymbol: 'SZ.000001', symbol: '000001', displayName: '平安银行', market: 'SZ', exchange: 'SZSE', currency: 'CNY', securityType: 'STOCK', listStatus: 'LISTED', matchedBy: 'FORMAL_NAME_EXACT' },
  { canonicalSymbol: 'BJ.430047', symbol: '430047', displayName: '北交所样本', market: 'BJ', exchange: 'BSE', currency: 'CNY', securityType: 'STOCK', listStatus: 'LISTED', matchedBy: 'FORMAL_NAME_EXACT' },
  { canonicalSymbol: 'SH.510300', symbol: '510300', displayName: '沪深300ETF', market: 'SH', exchange: 'SSE', currency: 'CNY', securityType: 'ETF', listStatus: 'LISTED', matchedBy: 'FORMAL_NAME_EXACT' },
  { canonicalSymbol: 'SH.000300', symbol: '000300', displayName: '沪深300指数', market: 'SH', exchange: 'SSE', currency: 'CNY', securityType: 'INDEX', listStatus: 'LISTED', matchedBy: 'FORMAL_NAME_EXACT' },
  ...Array.from({ length: 25 }, (_, i) => {
    const n = String(i + 2).padStart(3, '0');
    return {
      canonicalSymbol: `SH.600${n}`, symbol: `600${n}`, displayName: `样本${i + 2}`, market: 'SH', exchange: 'SSE', currency: 'CNY', securityType: 'STOCK', listStatus: 'LISTED' as ListStatus, matchedBy: 'FORMAL_NAME_EXACT' as MatchedBy,
    } as Security;
  }),
];

const CJK_REGEX = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const LATIN_OR_DIGIT_REGEX = /^[A-Za-z0-9]+$/;

function meetsThreshold(q: string): boolean {
  if (!q) return false;
  if (CJK_REGEX.test(q)) return true;
  if (LATIN_OR_DIGIT_REGEX.test(q)) return q.length >= 2;
  return false;
}

interface RankedItem { item: Security; score: number; matchedBy: MatchedBy; marketOrder: number; }

function rankItem(item: Security, qUpper: string): { score: number; matchedBy: MatchedBy } {
  if (item.canonicalSymbol === qUpper) return { score: 100, matchedBy: 'CANONICAL_SYMBOL_EXACT' };
  if (item.symbol === qUpper) return { score: 95, matchedBy: 'RAW_SYMBOL_EXACT' };
  if (item.displayName === qUpper) return { score: 90, matchedBy: 'FORMAL_NAME_EXACT' };
  if (item.displayName.startsWith(qUpper)) return { score: 80, matchedBy: 'FORMAL_NAME_PREFIX' };
  const aliasesUpper = (item.aliases ?? []).map((a) => a.toUpperCase());
  if (aliasesUpper.some((a) => a === qUpper)) return { score: 75, matchedBy: 'ALIAS_EXACT' };
  if (aliasesUpper.some((a) => a.startsWith(qUpper))) return { score: 75, matchedBy: 'ALIAS_PREFIX' };
  const qLower = qUpper.toLowerCase();
  if (item.pinyinAbbr && item.pinyinAbbr.startsWith(qLower)) return { score: 70, matchedBy: 'PINYIN_ABBR_PREFIX' };
  if (item.pinyinFull && item.pinyinFull.startsWith(qLower)) return { score: 70, matchedBy: 'PINYIN_FULL_PREFIX' };
  if (item.displayName.includes(qUpper)) return { score: 50, matchedBy: 'NAME_CONTAINS' };
  if (aliasesUpper.some((a) => a.includes(qUpper))) return { score: 50, matchedBy: 'ALIAS_CONTAINS' };
  return { score: 0, matchedBy: 'FORMAL_NAME_EXACT' };
}

function marketIndex(market: string, markets?: string[]): number {
  if (!markets || markets.length === 0) return 0;
  const idx = markets.indexOf(market);
  return idx < 0 ? markets.length : idx;
}

function toSummary(sec: Security, matchedBy: MatchedBy): SecuritySummary {
  return {
    canonicalSymbol: sec.canonicalSymbol, symbol: sec.symbol, displayName: sec.displayName,
    name: sec.name, nameCn: sec.nameCn, nameHk: sec.nameHk, nameEn: sec.nameEn, shortName: sec.shortName,
    market: sec.market, exchange: sec.exchange, currency: sec.currency,
    securityType: sec.securityType, listStatus: sec.listStatus as ListStatus, matchedBy,
  };
}

const mockApi = {
  search: async (params: SecuritySearchInput): Promise<SecuritySearchResult> => {
    const q = (params.q ?? '').trim();
    if (!meetsThreshold(q)) {
      return { items: [], catalogStatus: 'READY', catalogUpdatedAt: CATALOG_UPDATED_AT, stale: false, degraded: false };
    }
    const qUpper = q.toUpperCase();
    const { markets, types, includeDelisted } = params;
    const ranked: RankedItem[] = [];
    for (const item of SEED_CATALOG) {
      if (markets && markets.length > 0 && !markets.includes(item.market)) continue;
      if (types && types.length > 0 && !types.includes(item.securityType)) continue;
      if (!includeDelisted && item.listStatus === 'DELISTED') continue;
      const { score, matchedBy } = rankItem(item, qUpper);
      if (score < 50) continue;
      ranked.push({ item, score, matchedBy, marketOrder: marketIndex(item.market, markets) });
    }
    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aListed = a.item.listStatus === 'LISTED' ? 0 : 1;
      const bListed = b.item.listStatus === 'LISTED' ? 0 : 1;
      if (aListed !== bListed) return aListed - bListed;
      if (a.marketOrder !== b.marketOrder) return a.marketOrder - b.marketOrder;
      if (a.item.displayName !== b.item.displayName) return a.item.displayName.localeCompare(b.item.displayName);
      return a.item.canonicalSymbol.localeCompare(b.item.canonicalSymbol);
    });
    const requestedLimit = params.limit;
    const limit = requestedLimit === undefined ? 20 : Math.min(Math.max(0, requestedLimit), 100);
    const items = ranked.slice(0, limit).map((r) => toSummary(r.item, r.matchedBy));
    return { items, catalogStatus: 'READY', catalogUpdatedAt: CATALOG_UPDATED_AT, stale: false, degraded: false };
  },
  get: async (canonicalSymbol: string): Promise<Security> => {
    const normalized = normalizeCanonicalSymbol(canonicalSymbol);
    const found = SEED_CATALOG.find((s) => s.canonicalSymbol === normalized);
    if (!found) throw new Error('证券不存在');
    return { ...found };
  },
};

const remoteApi = {
  search: (params: SecuritySearchInput) =>
    unwrap<SecuritySearchResult>(
      client.get('/market-data/securities/search', {
        params: {
          q: params.q,
          ...(params.markets?.length ? { markets: params.markets.join(',') } : {}),
          ...(params.types?.length ? { types: params.types.join(',') } : {}),
          ...(params.includeDelisted !== undefined ? { includeDelisted: params.includeDelisted } : {}),
          ...(params.limit !== undefined ? { limit: params.limit } : {}),
        },
      }),
    ),
  get: (canonicalSymbol: string) =>
    unwrap<Security>(
      client.get(`/market-data/securities/${encodeURIComponent(normalizeCanonicalSymbol(canonicalSymbol))}`),
    ),
};

function pick<T>(mock: T, remote: T): T {
  return getSettings().apiMode === 'remote' ? remote : mock;
}

export function searchSecurities(params: SecuritySearchInput) {
  return pick(mockApi.search, remoteApi.search)(params);
}

export function getSecurity(canonicalSymbol: string) {
  return pick(mockApi.get, remoteApi.get)(canonicalSymbol);
}
