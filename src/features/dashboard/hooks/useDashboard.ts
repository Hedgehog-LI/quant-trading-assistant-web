/**
 * 今日工作台聚合 hook。
 *
 * 依赖 watchlist / tradeplan / journal / review 四个 feature 的列表接口。
 * 这四个接口已统一为 async（mock/remote 双模），本 hook 改为：
 * - mount 时 Promise.all 并发拉取四份数据，聚合成 DashboardSummary；
 * - 维护 loading / error 三态；
 * - 聚合逻辑抽成纯函数 buildSummary，便于阅读与测试。
 *
 * 跟随项目现有风格（useState + useCallback + refresh），不引入 react-query。
 */
import { useState, useCallback, useEffect } from 'react';
import { getWatchlist } from '../../watchlist/api/watchlistApi';
import { getTradePlans } from '../../tradeplan/api/tradePlanApi';
import { getTradeJournals } from '../../journal/api/tradeJournalApi';
import { getReviews } from '../../review/api/reviewApi';
import { getSettings } from '../../settings/api/settingsApi';
import { today } from '../../../shared/utils/date';
import type {
  DashboardSummary,
  WatchlistItem,
  TradePlan,
  TradeJournal,
  ReviewNote,
} from '../../../shared/types/domain';

export interface UseDashboardResult {
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  /** 当前数据模式（供页面展示数据源提示） */
  apiMode: 'mock' | 'remote';
  refresh: () => Promise<void>;
}

/** 将四份原始数据聚合成今日看板汇总（纯函数）。 */
function buildSummary(
  watchlist: WatchlistItem[],
  plans: TradePlan[],
  journals: TradeJournal[],
  reviews: ReviewNote[],
): DashboardSummary {
  const date = today();

  const enabledWatchlist = watchlist.filter((i) => i.enabled);
  const todayPlans = plans.filter((p) => p.planDate === date);
  const activePlans = todayPlans.filter((p) => p.planStatus === 'ACTIVE' || p.planStatus === 'DRAFT');
  const todayJournals = journals.filter((j) => j.tradeDate === date);
  const pendingReview = journals.filter((j) => j.reviewStatus === 'PENDING');
  const todayReviews = reviews.filter((r) => r.reviewDate === date);
  const highAttentionStocks = enabledWatchlist.filter((i) => i.attentionLevel === 'HIGH');
  const pendingReviewJournals = pendingReview.slice(0, 10);

  // 风险提醒
  const riskWarnings: string[] = [];
  if (pendingReview.length > 0) {
    riskWarnings.push(`有 ${pendingReview.length} 条交易记录待复盘`);
  }
  const noStopLossPlans = todayPlans.filter((p) => p.allowedToTrade && !p.stopLossPrice);
  if (noStopLossPlans.length > 0) {
    riskWarnings.push(`有 ${noStopLossPlans.length} 条允许交易的计划未设止损`);
  }
  const oversizePlans = todayPlans.filter((p) => p.plannedPositionRatio && p.plannedPositionRatio > 0.2);
  if (oversizePlans.length > 0) {
    riskWarnings.push(`有 ${oversizePlans.length} 条计划仓位超过 20%`);
  }

  return {
    date,
    enabledWatchlistCount: enabledWatchlist.length,
    activePlanCount: activePlans.length,
    todayJournalCount: todayJournals.length,
    pendingReviewCount: pendingReview.length,
    todayReviewCount: todayReviews.length,
    riskWarnings,
    highAttentionStocks,
    todayPlans,
    pendingReviewJournals,
  };
}

export function useDashboard(): UseDashboardResult {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiMode = getSettings().apiMode;

  // 并发拉取四份数据并聚合。
  const load = useCallback(async () => {
    const [watchlist, plans, journals, reviews] = await Promise.all([
      getWatchlist(),
      getTradePlans(),
      getTradeJournals(),
      getReviews(),
    ]);
    return buildSummary(watchlist, plans, journals, reviews);
  }, []);

  // 手动刷新（事件触发，含 loading 态切换）。
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [load]);

  // 挂载时拉取：fetch 逻辑内联为局部 async 函数，所有 setState 都在 await 之后，
  // effect 同步路径不触发 setState（loading 初值已为 true）。
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const result = await load();
        if (cancelled) return;
        setSummary(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { summary, loading, error, apiMode, refresh };
}
