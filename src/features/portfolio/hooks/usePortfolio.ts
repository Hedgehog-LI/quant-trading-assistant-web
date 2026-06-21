/**
 * 交易账本状态管理 hook。
 *
 * 跟随项目现有风格（useState + useCallback + refresh），不引入 react-query。
 * - mount 时并发拉取 summary / positions / closedTrades / prices；
 * - closed-trades 筛选统一在前端 useMemo（mock / remote 都拉全量）；
 * - 维护 loading / error / empty 三态；
 * - upsertPrice 写入后自动 refresh 重算浮盈。
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { applyClosedTradeFilter, portfolioApi } from '../api/portfolioApi';
import type { ClosedTradeFilter } from '../api/portfolioApi';
import { getSettings } from '../../settings/api/settingsApi';
import type {
  ClosedTrade,
  PortfolioPosition,
  PortfolioSummary,
  PriceSnapshot,
  PriceSnapshotInput,
} from '../model/types';

export type PortfolioFilters = ClosedTradeFilter;

export interface UsePortfolioResult {
  summary: PortfolioSummary | null;
  positions: PortfolioPosition[];
  /** 已应用 filters 的已结算交易 */
  closedTrades: ClosedTrade[];
  prices: PriceSnapshot[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  /** 当前数据模式（供页面展示数据源提示） */
  apiMode: 'mock' | 'remote';
  filters: PortfolioFilters;
  setFilters: (f: Partial<PortfolioFilters>) => void;
  refresh: () => Promise<void>;
  upsertPrice: (input: PriceSnapshotInput) => Promise<void>;
}

export function usePortfolio(): UsePortfolioResult {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [allClosedTrades, setAllClosedTrades] = useState<ClosedTrade[]>([]);
  const [prices, setPrices] = useState<PriceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<PortfolioFilters>({});
  const apiMode = getSettings().apiMode;

  // 手动刷新（事件触发，含 loading 态切换）。
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, ct, pr] = await Promise.all([
        portfolioApi.getSummary(),
        portfolioApi.getPositions(),
        portfolioApi.getClosedTrades(),
        portfolioApi.getPrices(),
      ]);
      setSummary(s);
      setPositions(p);
      setAllClosedTrades(ct);
      setPrices(pr);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 挂载时拉取：fetch 逻辑内联为局部 async 函数，所有 setState 都在 await 之后，
  // effect 同步路径不触发 setState（loading 初值已为 true）。
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [s, p, ct, pr] = await Promise.all([
          portfolioApi.getSummary(),
          portfolioApi.getPositions(),
          portfolioApi.getClosedTrades(),
          portfolioApi.getPrices(),
        ]);
        if (cancelled) return;
        setSummary(s);
        setPositions(p);
        setAllClosedTrades(ct);
        setPrices(pr);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const closedTrades = useMemo(
    () => applyClosedTradeFilter(allClosedTrades, filters),
    [allClosedTrades, filters],
  );

  const setFilters = useCallback((f: Partial<PortfolioFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
  }, []);

  const upsertPrice = useCallback(
    async (input: PriceSnapshotInput) => {
      await portfolioApi.upsertPrice(input);
      await refresh(); // 价格变化后重算浮盈
    },
    [refresh],
  );

  const isEmpty = !loading && !error && positions.length === 0 && allClosedTrades.length === 0;

  return {
    summary,
    positions,
    closedTrades,
    prices,
    loading,
    error,
    isEmpty,
    apiMode,
    filters,
    setFilters,
    refresh,
    upsertPrice,
  };
}
