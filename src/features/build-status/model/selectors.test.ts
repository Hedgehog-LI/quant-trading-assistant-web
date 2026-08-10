import { describe, expect, it } from 'vitest';
import { buildStatusSnapshot } from '../data/buildStatusSnapshot';
import type { BuildStatusNode, BuildStatusSnapshot } from './types';
import {
  collectLeaves,
  computeOverviewStats,
  countByDeliveryStatus,
  filterBuildTree,
  RECENT_DELIVERIES_DEFAULT,
  RECENT_DELIVERIES_MAX,
  snapshotAtIsValid,
  sortRecentDeliveries,
} from './selectors';

function leaf(id: string, overrides: Partial<BuildStatusNode>): BuildStatusNode {
  return {
    id,
    title: id,
    category: '测试',
    priority: 'P1',
    deliveryStatus: 'DELIVERED',
    validationStage: 'AUTOMATION_VERIFIED',
    productValue: '',
    deliveredContent: [],
    completionCriteria: [],
    remainingWork: [],
    nextActions: [],
    backendState: '',
    frontendState: '',
    lastUpdatedAt: '2026-08-09',
    risks: [],
    limitations: [],
    docLinks: [],
    ...overrides,
  };
}

describe('collectLeaves', () => {
  it('只收集叶子节点，父节点即使有状态也不重复计数', () => {
    const tree: BuildStatusNode[] = [
      {
        ...leaf('parent', {
          deliveryStatus: 'DELIVERED',
          validationStage: 'DEPLOYED',
          children: [
            leaf('leaf-b', { validationStage: 'DEPLOYED' }),
            leaf('leaf-c', { deliveryStatus: 'IN_PROGRESS', validationStage: 'NOT_VERIFIED' }),
          ],
        }),
      },
      leaf('leaf-d', { validationStage: 'DEPLOYED' }),
    ];
    const leaves = collectLeaves(tree);
    const ids = leaves.map((n) => n.id);
    expect(ids).toEqual(['leaf-b', 'leaf-c', 'leaf-d']);
    // 父节点 parent 的 DEPLOYED 状态不参与计数
    expect(leaves.some((n) => n.id === 'parent')).toBe(false);
  });
});

describe('computeOverviewStats', () => {
  it('从叶子推导，父节点状态不污染统计', () => {
    const snapshot: BuildStatusSnapshot = {
      snapshotAt: '2026-08-09',
      releaseStage: 'test',
      backendCommit: 'a',
      frontendCommit: 'b',
      recentDeliveries: [],
      readyToUse: [],
      capabilities: [
        {
          ...leaf('parent', {
            deliveryStatus: 'DELIVERED',
            validationStage: 'DEPLOYED',
            children: [
              leaf('deployed-1', { validationStage: 'DEPLOYED' }),
              leaf('delivered-1', { validationStage: 'RUNTIME_VERIFIED' }),
              leaf('inprogress-1', { deliveryStatus: 'IN_PROGRESS', validationStage: 'NOT_VERIFIED' }),
              leaf('planned-1', { deliveryStatus: 'PLANNED', validationStage: 'NOT_VERIFIED' }),
            ],
          }),
        },
        leaf('deferred-1', { deliveryStatus: 'DEFERRED', validationStage: 'NOT_VERIFIED' }),
      ],
    };
    const stats = computeOverviewStats(snapshot);
    expect(stats.deployed).toBe(1);
    expect(stats.deliveredNotDeployed).toBe(1);
    expect(stats.inProgress).toBe(1);
    expect(stats.planned).toBe(1);
    expect(stats.blocked).toBe(0);
    expect(stats.deferred).toBe(1);
    expect(stats.totalLeaves).toBe(5);
    expect(stats.plannedTotal).toBe(4); // deferred 不计入
    expect(stats.accepted).toBe(2); // DEPLOYED + RUNTIME_VERIFIED
    expect(stats.acceptanceRate).toBe(50);
  });

  it('真实快照：五个桶 + 暂缓之和等于叶子总数', () => {
    const stats = computeOverviewStats(buildStatusSnapshot);
    const sum = stats.deployed + stats.deliveredNotDeployed + stats.inProgress + stats.planned + stats.blocked;
    expect(stats.deferred).toBeGreaterThanOrEqual(0);
    expect(sum + stats.deferred).toBe(stats.totalLeaves);
    // 完成率 = 已验收 / 已纳入计划叶子
    expect(stats.acceptanceRate).toBe(
      Math.round((stats.accepted / stats.plannedTotal) * 100),
    );
  });

  it('阻塞、暂缓、建设中状态统计正确（真实快照）', () => {
    const byStatus = countByDeliveryStatus(buildStatusSnapshot);
    const map = Object.fromEntries(byStatus.map((s) => [s.status, s.count]));
    expect(map.BLOCKED).toBe(0);
    expect(map.DEFERRED).toBeGreaterThan(0);
    // D2 收口后无 IN_PROGRESS 叶节点（父节点 security-directory 仍 IN_PROGRESS，但不计入叶统计）
    expect(map.IN_PROGRESS).toBe(0);
    expect(map.DELIVERED).toBeGreaterThan(0);
    expect(map.PLANNED + map.DESIGNED).toBeGreaterThan(0);
  });
});

describe('snapshotAt 与最近交付', () => {
  it('snapshotAt 不早于最新交付日期', () => {
    expect(snapshotAtIsValid(buildStatusSnapshot)).toBe(true);
    const latest = sortRecentDeliveries(buildStatusSnapshot.recentDeliveries)[0];
    expect(latest).toBeDefined();
    expect(buildStatusSnapshot.snapshotAt.localeCompare(latest.deliveredAt)).toBeGreaterThanOrEqual(0);
  });

  it('最近交付默认 6 条、上限 12 条、按日期倒序', () => {
    const sorted = sortRecentDeliveries(buildStatusSnapshot.recentDeliveries);
    expect(sorted.length).toBeGreaterThanOrEqual(RECENT_DELIVERIES_DEFAULT);
    expect(sorted.length).toBeLessThanOrEqual(RECENT_DELIVERIES_MAX);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i - 1].deliveredAt.localeCompare(sorted[i].deliveredAt)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('filterBuildTree', () => {
  it('按研发状态筛选时保留命中路径的父节点', () => {
    const filtered = filterBuildTree(buildStatusSnapshot.capabilities, {
      deliveryStatus: 'IN_PROGRESS',
    });
    const leaves = collectLeaves(filtered);
    expect(leaves.some((n) => n.deliveryStatus === 'IN_PROGRESS')).toBe(true);
    // 筛选后任一叶子必须是 IN_PROGRESS
    expect(leaves.every((n) => n.deliveryStatus === 'IN_PROGRESS')).toBe(true);
  });

  it('按模块筛选：证券目录只保留目录相关叶子', () => {
    const filtered = filterBuildTree(buildStatusSnapshot.capabilities, { module: '证券目录' });
    const leaves = collectLeaves(filtered);
    expect(leaves.length).toBeGreaterThan(0);
    expect(leaves.every((n) => n.category === '证券目录')).toBe(true);
  });
});
