import { describe, it, expect } from 'vitest';
import { buildTodos, buildDashboardSummary } from './dashboardApi';
import type { TradeJournal } from '../../../shared/types/domain';
import type { PositionSnapshotDetail } from '../../position-snapshot/model/types';

function journal(id: string, date: string, reviewStatus: 'PENDING' | 'REVIEWED' = 'PENDING'): TradeJournal {
  return {
    id,
    tradeDate: date,
    symbol: 'A',
    name: 'A',
    side: 'BUY',
    price: 10,
    quantity: 100,
    reviewStatus,
    emotionTags: [],
    mistakeTags: [],
    createdAt: '',
    updatedAt: '',
  };
}

function oldSnapshot(): PositionSnapshotDetail {
  return {
    id: 's1',
    snapshotDate: '2026-06-01',
    snapshotTime: '2026-06-01T15:00:00',
    snapshotName: 'old',
    sourceType: 'MANUAL',
    snapshotStatus: 'CONFIRMED',
    totalCostAmount: 0,
    totalMarketValue: 0,
    totalUnrealizedPnl: 0,
    totalPnlRate: 0,
    positionCount: 0,
    remark: undefined,
    createdAt: '',
    updatedAt: '',
    items: [],
  };
}

describe('buildTodos', () => {
  it('历史日期口径：pendingCount 只算 tradeDate <= today，不含未来交易', () => {
    const hist = journal('1', '2026-07-01');
    const future = journal('2', '2026-07-05');
    const todos = buildTodos([hist], [hist, future], [], null, '2026-07-01');
    const pending = todos.find((t) => t.code === 'PENDING_REVIEW');
    expect(pending).toBeDefined();
    expect(pending!.count).toBe(1);
  });

  it('历史日期口径：UNLINKED 只算 tradeDate <= today 的当日交易', () => {
    const hist = journal('1', '2026-07-01');
    const future = journal('2', '2026-07-05');
    const todos = buildTodos([hist], [hist, future], [], null, '2026-07-01');
    const unlinked = todos.find((t) => t.code === 'UNLINKED_TRADE_PLAN');
    expect(unlinked).toBeDefined();
    expect(unlinked!.count).toBe(1);
  });

  it('targetPath 必须是 /position-snapshots，不得出现单数 /position-snapshot', () => {
    const todos = buildTodos([], [], [], oldSnapshot(), '2026-07-05');
    // STALE 应被触发（6-01 到 7-05 > 3 天）
    const stale = todos.find((t) => t.code === 'STALE_POSITION_SNAPSHOT');
    expect(stale).toBeDefined();
    expect(stale!.targetPath).toBe('/position-snapshots');
    for (const t of todos) {
      expect(t.targetPath).not.toBe('/position-snapshot');
    }
  });

  it('buildDashboardSummary 历史日期：pendingReviewCount/pendingReviewJournals/riskWarnings/todos 均不含未来交易', () => {
    const hist = journal('1', '2026-07-01');
    const future = journal('2', '2026-07-05');
    const summary = buildDashboardSummary([], [], [hist, future], [], null, '2026-07-01');
    // pendingReviewCount 只算 hist
    expect(summary.pendingReviewCount).toBe(1);
    // pendingReviewJournals 不含 future
    expect(summary.pendingReviewJournals.map((j) => j.id)).not.toContain('2');
    // riskWarnings 待复盘告警只反映 hist
    expect(summary.riskWarnings.some((w) => w.includes('1 条'))).toBe(true);
    expect(summary.riskWarnings.some((w) => w.includes('2 条'))).toBe(false);
    // todos PENDING_REVIEW count 只 hist
    const pending = summary.todos?.find((t) => t.code === 'PENDING_REVIEW');
    expect(pending?.count).toBe(1);
  });
});
