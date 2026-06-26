import { describe, expect, it } from 'vitest';
import { buildCapabilities, buildStatusTree, buildSummaryCards } from './buildStatusData';
import { filterBuildTree, flattenBuildNodes } from '../hooks/useBuildStatus';

describe('buildStatusData', () => {
  it('keeps position snapshot as current P0 todo focus', () => {
    const nodes = flattenBuildNodes(buildStatusTree);
    const positionSnapshot = nodes.find((node) => node.id === 'position-snapshot');

    expect(positionSnapshot).toBeDefined();
    expect(positionSnapshot?.priority).toBe('P0');
    expect(positionSnapshot?.status).toBe('TODO');
    expect(positionSnapshot?.maturity).toBe('M1');
    expect(positionSnapshot?.nextActions).toContain('新增 DB 表');
  });

  it('covers all planned construction categories', () => {
    const categories = buildStatusTree.map((node) => node.title);

    expect(categories).toEqual(['数据与基础设施', '交易记录闭环', '持仓与盈亏', '智能录入', '量化分析']);
  });

  it('has summary and finance capability sections for the board top area', () => {
    expect(buildSummaryCards).toHaveLength(4);
    expect(buildCapabilities.map((item) => item.title)).toEqual([
      '数据沉淀',
      '盈亏解释',
      '风险控制',
      '复盘闭环',
      '自动化录入',
    ]);
  });

  it('filters tree by status while keeping matching parent paths', () => {
    const filtered = filterBuildTree(buildStatusTree, { status: 'RISK' });
    const nodes = flattenBuildNodes(filtered);

    expect(nodes.some((node) => node.id === 'production-data-mode')).toBe(true);
    expect(nodes.every((node) => node.status === 'RISK' || (node.children?.length ?? 0) > 0)).toBe(true);
  });
});
