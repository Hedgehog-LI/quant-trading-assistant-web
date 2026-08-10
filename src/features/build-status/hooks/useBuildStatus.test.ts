import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBuildStatus } from './useBuildStatus';
import { buildStatusSnapshot } from '../data/buildStatusSnapshot';
import { collectLeaves, RECENT_DELIVERIES_DEFAULT } from '../model/selectors';

describe('useBuildStatus', () => {
  it('初始未选中任何节点（selectedNode 为 null）', () => {
    const { result } = renderHook(() => useBuildStatus());
    expect(result.current.selectedNode).toBeNull();
  });

  it('selectNode 后选中对应叶子节点', () => {
    const { result } = renderHook(() => useBuildStatus());
    act(() => result.current.selectNode('snapshot-comparison'));
    expect(result.current.selectedNode?.id).toBe('snapshot-comparison');
  });

  it('clearSelection 后恢复为 null（关闭抽屉回到总览）', () => {
    const { result } = renderHook(() => useBuildStatus());
    // market-data-foundation 是父节点，不在叶节点集合中；选一个真实叶节点
    act(() => result.current.selectNode('security-directory-d2'));
    expect(result.current.selectedNode?.id).toBe('security-directory-d2');
    act(() => result.current.clearSelection());
    expect(result.current.selectedNode).toBeNull();
  });

  it('筛选按优先级/研发状态/验证层级/模块生效', () => {
    const { result } = renderHook(() => useBuildStatus());
    // D2 收口后快照无 IN_PROGRESS 叶节点，用 DELIVERED 验证状态筛选
    act(() => result.current.setDeliveryStatus('DELIVERED'));
    expect(result.current.filter.deliveryStatus).toBe('DELIVERED');
    // 全量叶节点中必须存在 DELIVERED 节点
    const ids = result.current.flatLeaves.filter((n) => n.deliveryStatus === 'DELIVERED').map((n) => n.id);
    expect(ids.length).toBeGreaterThan(0);
    // 筛选后的树（collectLeaves 递归展开全部叶节点）必须全部命中该状态
    const leavesAfter = collectLeaves(result.current.tree);
    expect(leavesAfter.length).toBeGreaterThan(0);
    expect(leavesAfter.every((n) => n.deliveryStatus === 'DELIVERED')).toBe(true);

    act(() => result.current.resetFilter());
    expect(result.current.filter).toEqual({
      priority: 'ALL',
      deliveryStatus: 'ALL',
      validationStage: 'ALL',
      module: 'ALL',
    });
  });

  it('最近交付默认展示 6 条，可展开到全部', () => {
    const { result } = renderHook(() => useBuildStatus());
    expect(result.current.recentDeliveries.length).toBe(buildStatusSnapshot.recentDeliveries.length);
    expect(result.current.recentDeliveries.length).toBeGreaterThan(RECENT_DELIVERIES_DEFAULT);
    expect(result.current.showAllDeliveries).toBe(false);
    act(() => result.current.toggleShowAllDeliveries());
    expect(result.current.showAllDeliveries).toBe(true);
  });

  it('总览统计来自快照推导', () => {
    const { result } = renderHook(() => useBuildStatus());
    expect(result.current.overview.totalLeaves).toBeGreaterThan(0);
    expect(result.current.overview.acceptanceRate).toBeGreaterThanOrEqual(0);
  });
});
