import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBuildStatus } from './useBuildStatus';

describe('useBuildStatus', () => {
  it('初始未选中任何节点（selectedNode 为 null）', () => {
    const { result } = renderHook(() => useBuildStatus());
    expect(result.current.selectedNode).toBeNull();
  });

  it('selectNode 后选中对应节点', () => {
    const { result } = renderHook(() => useBuildStatus());
    act(() => result.current.selectNode('snapshot-comparison'));
    expect(result.current.selectedNode?.id).toBe('snapshot-comparison');
  });

  it('clearSelection 后恢复为 null（关闭抽屉回到总览）', () => {
    const { result } = renderHook(() => useBuildStatus());
    act(() => result.current.selectNode('market-data-foundation'));
    expect(result.current.selectedNode?.id).toBe('market-data-foundation');
    act(() => result.current.clearSelection());
    expect(result.current.selectedNode).toBeNull();
  });
});
