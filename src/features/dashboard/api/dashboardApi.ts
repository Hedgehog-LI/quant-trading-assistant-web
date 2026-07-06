/**
 * 今日工作台数据访问与待办聚合（v0.1.1）。
 *
 * - remote：直接使用后端 GET /dashboard/today 聚合结果（含 todos），前端不再四请求自聚合。
 * - mock：四请求聚合 + 纯函数 buildTodos，与后端口径完全一致。
 *
 * 待办只表达记录、数据质量和纪律事项，不包含买卖建议。
 */
import { client } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import { unwrap } from '../../../shared/api/unwrappers';
import { getSettings } from '../../settings/api/settingsApi';
import { getWatchlist } from '../../watchlist/api/watchlistApi';
import { getTradePlans } from '../../tradeplan/api/tradePlanApi';
import { getTradeJournals } from '../../journal/api/tradeJournalApi';
import { getReviews } from '../../review/api/reviewApi';
import { positionSnapshotApi } from '../../position-snapshot/api/positionSnapshotApi';
import { reconcileSnapshot } from '../../position-snapshot/api/positionSnapshotReconciliation';
import { today as todayStr } from '../../../shared/utils/date';
import type {
  DashboardSummary,
  DashboardTodo,
  DashboardTodoLevel,
  ReviewNote,
  TradeJournal,
  TradePlan,
  WatchlistItem,
} from '../../../shared/types/domain';
import type { PositionSnapshotDetail } from '../../position-snapshot/model/types';

/** 已确认快照过期阈值（自然日） */
export const STALE_SNAPSHOT_DAYS = 3;

const TODO_PATHS = {
  PENDING_REVIEW: '/journal?reviewStatus=PENDING',
  UNLINKED_TRADE_PLAN: '/journal',
  TRADE_AGAINST_PLAN: '/journal',
  MISSING_STOP_LOSS: '/journal',
  STALE_POSITION_SNAPSHOT: '/position-snapshots',
  POSITION_RECONCILIATION_MISMATCH: '/position-snapshots',
} as const;

function levelOrder(level: DashboardTodoLevel): number {
  return level === 'RISK' ? 0 : level === 'WARNING' ? 1 : 2;
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 按后端口径构建待办列表（mock 模式纯函数）。
 */
export function buildTodos(
  todayJournals: TradeJournal[],
  allJournals: TradeJournal[],
  plans: TradePlan[],
  latestSnapshot: PositionSnapshotDetail | null,
  today: string,
): DashboardTodo[] {
  const todos: DashboardTodo[] = [];

  const pendingCount = allJournals.filter(
    (j) => j.reviewStatus === 'PENDING' && j.tradeDate <= today,
  ).length;
  if (pendingCount > 0) {
    todos.push({
      code: 'PENDING_REVIEW', level: 'WARNING', title: '待复盘交易',
      description: '存在尚未复盘的交易记录，及时复盘可沉淀经验',
      count: pendingCount, targetPath: TODO_PATHS.PENDING_REVIEW,
    });
  }

  const unlinked = todayJournals.filter((j) => j.planId === undefined || j.planId === null).length;
  if (unlinked > 0) {
    todos.push({
      code: 'UNLINKED_TRADE_PLAN', level: 'INFO', title: '交易未关联计划',
      description: '今日存在未关联交易计划的交易记录',
      count: unlinked, targetPath: TODO_PATHS.UNLINKED_TRADE_PLAN,
    });
  }

  const planMap = new Map(plans.map((p) => [String(p.id), p]));
  const against = todayJournals.filter((j) => {
    const plan = j.planId == null ? undefined : planMap.get(String(j.planId));
    const againstAllowed = plan !== undefined && plan.allowedToTrade === false;
    const notFollowed = j.followedPlan === false;
    return againstAllowed || notFollowed;
  }).length;
  if (against > 0) {
    todos.push({
      code: 'TRADE_AGAINST_PLAN', level: 'WARNING', title: '交易偏离计划',
      description: '今日存在关联到「不允许交易」计划的交易记录，建议复盘原因',
      count: against, targetPath: TODO_PATHS.TRADE_AGAINST_PLAN,
    });
  }

  const missingStop = todayJournals.filter(
    (j) => j.side === 'BUY' && (j.planStopLoss === undefined || j.planStopLoss === null),
  ).length;
  if (missingStop > 0) {
    todos.push({
      code: 'MISSING_STOP_LOSS', level: 'RISK', title: '买入交易缺少止损',
      description: '今日买入交易未记录计划止损，纪律上需要明确止损位',
      count: missingStop, targetPath: TODO_PATHS.MISSING_STOP_LOSS,
    });
  }

  if (latestSnapshot && latestSnapshot.snapshotStatus === 'CONFIRMED') {
    const days = daysBetween(latestSnapshot.snapshotTime.slice(0, 10), today);
    if (days > STALE_SNAPSHOT_DAYS) {
      todos.push({
        code: 'STALE_POSITION_SNAPSHOT', level: 'INFO', title: '持仓快照过期',
        description: '最近一次已确认持仓快照已超过 3 个自然日，建议重新盘点（阈值：3 个自然日）',
        count: 1, targetPath: TODO_PATHS.STALE_POSITION_SNAPSHOT,
      });
    }
    const reconciliation = reconcileSnapshot(latestSnapshot, allJournals);
    if (reconciliation.hasMismatch) {
      todos.push({
        code: 'POSITION_RECONCILIATION_MISMATCH', level: 'WARNING', title: '快照与账本不一致',
        description: '最新已确认快照与截止时点 FIFO 账本数量不一致，请核对',
        count: reconciliation.mismatchCount, targetPath: TODO_PATHS.POSITION_RECONCILIATION_MISMATCH,
      });
    }
  }

  todos.sort((a, b) => levelOrder(a.level) - levelOrder(b.level));
  return todos;
}

/**
 * 由原始数据聚合今日看板（mock 模式使用）。
 */
export function buildDashboardSummary(
  watchlist: WatchlistItem[],
  plans: TradePlan[],
  journals: TradeJournal[],
  reviews: ReviewNote[],
  latestSnapshot: PositionSnapshotDetail | null,
  date: string,
): DashboardSummary {
  const enabledWatchlist = watchlist.filter((i) => i.enabled);
  const todayPlans = plans.filter((p) => p.planDate === date);
  const activePlans = todayPlans.filter((p) => p.planStatus === 'ACTIVE' || p.planStatus === 'DRAFT');
  const todayJournals = journals.filter((j) => j.tradeDate === date);
  const pendingReview = journals.filter((j) => j.reviewStatus === 'PENDING' && j.tradeDate <= date);
  const todayReviews = reviews.filter((r) => r.reviewDate === date);
  const highAttentionStocks = enabledWatchlist.filter((i) => i.attentionLevel === 'HIGH');
  const pendingReviewJournals = pendingReview.slice(0, 10);

  const riskWarnings: string[] = [];
  if (pendingReview.length > 0) riskWarnings.push(`有 ${pendingReview.length} 条交易记录待复盘`);
  const noStopLossPlans = todayPlans.filter((p) => p.allowedToTrade && !p.stopLossPrice);
  if (noStopLossPlans.length > 0) riskWarnings.push(`有 ${noStopLossPlans.length} 条允许交易的计划未设止损`);
  const oversizePlans = todayPlans.filter((p) => p.plannedPositionRatio && p.plannedPositionRatio > 0.2);
  if (oversizePlans.length > 0) riskWarnings.push(`有 ${oversizePlans.length} 条计划仓位超过 20%`);

  const todos = buildTodos(todayJournals, journals, plans, latestSnapshot, date);

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
    todos,
  };
}

async function fetchDashboardTodayMock(): Promise<DashboardSummary> {
  const [watchlist, plans, journals, reviews] = await Promise.all([
    getWatchlist(),
    getTradePlans(),
    getTradeJournals(),
    getReviews(),
  ]);
  const latest = await positionSnapshotApi.getLatest();
  return buildDashboardSummary(watchlist, plans, journals, reviews, latest, todayStr());
}

/**
 * 获取今日工作台聚合数据。
 * - remote 模式：使用后端聚合结果。
 * - mock 模式：前端按相同口径计算。
 */
export async function fetchDashboardToday(): Promise<DashboardSummary> {
  if (getSettings().apiMode === 'remote') {
    return unwrap(client.get<ApiResponse<DashboardSummary>>('/dashboard/today'));
  }
  return fetchDashboardTodayMock();
}
