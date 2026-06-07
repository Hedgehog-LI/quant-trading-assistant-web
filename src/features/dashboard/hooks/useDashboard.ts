import { useMemo } from 'react';
import { getWatchlist } from '../../watchlist/api/watchlistApi';
import { getTradePlans } from '../../tradeplan/api/tradePlanApi';
import { getTradeJournals } from '../../journal/api/tradeJournalApi';
import { getReviews } from '../../review/api/reviewApi';
import { today } from '../../../shared/utils/date';
import type { DashboardSummary } from '../../../shared/types/domain';

export function useDashboard(): DashboardSummary {
  return useMemo(() => {
    const date = today();
    const watchlist = getWatchlist();
    const plans = getTradePlans();
    const journals = getTradeJournals();
    const reviews = getReviews();

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
    const noStopLossPlans = todayPlans.filter(
      (p) => p.allowedToTrade && !p.stopLossPrice,
    );
    if (noStopLossPlans.length > 0) {
      riskWarnings.push(`有 ${noStopLossPlans.length} 条允许交易的计划未设止损`);
    }
    const oversizePlans = todayPlans.filter(
      (p) => p.plannedPositionRatio && p.plannedPositionRatio > 0.2,
    );
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
  }, []);
}
