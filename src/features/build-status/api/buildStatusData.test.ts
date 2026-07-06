import { describe, expect, it } from 'vitest';
import { buildCapabilities, buildStatusTree, buildSummaryCards } from './buildStatusData';
import { filterBuildTree, flattenBuildNodes } from '../hooks/useBuildStatus';

describe('buildStatusData', () => {
  it('v0.1.1 核心闭环节点均为 DONE / M4', () => {
    const nodes = flattenBuildNodes(buildStatusTree);
    for (const id of ['trade-loop', 'portfolio-pnl', 'snapshot-comparison', 'production-data-mode']) {
      const node = nodes.find((n) => n.id === id);
      expect(node, `${id} 应存在`).toBeDefined();
      expect(node?.status).toBe('DONE');
      expect(node?.maturity).toBe('M4');
    }
  });

  it('production-data-mode 含生产实测证据（地址 + 接口 + success）', () => {
    const node = flattenBuildNodes(buildStatusTree).find((n) => n.id === 'production-data-mode');
    const evidence = (node?.currentEvidence ?? []).join(' ');
    expect(evidence).toContain('129.204.169.155');
    expect(evidence).toContain('success=true');
    expect(evidence).not.toMatch(/待部署|未实测/);
  });

  it('snapshot-comparison 为 DONE / 100%', () => {
    const node = flattenBuildNodes(buildStatusTree).find((n) => n.id === 'snapshot-comparison');
    expect(node?.status).toBe('DONE');
    expect(node?.progress).toBe(100);
  });

  it('position-snapshot 为 P0 / DONE / M4 / 100%', () => {
    const node = flattenBuildNodes(buildStatusTree).find((n) => n.id === 'position-snapshot');
    expect(node?.priority).toBe('P0');
    expect(node?.status).toBe('DONE');
    expect(node?.maturity).toBe('M4');
    expect(node?.progress).toBe(100);
  });

  it('存在 P1 market-data-foundation 一级节点（TODO/M1）', () => {
    const top = buildStatusTree.find((n) => n.id === 'market-data-foundation');
    expect(top).toBeDefined();
    expect(top?.priority).toBe('P1');
    expect(top?.status).toBe('TODO');
    expect(top?.maturity).toBe('M1');
  });

  it('market-data-foundation 含 stock-basic / daily-bar-import / market-data-provider', () => {
    const top = buildStatusTree.find((n) => n.id === 'market-data-foundation');
    const childIds = (top?.children ?? []).map((c) => c.id);
    expect(childIds).toEqual(['stock-basic', 'daily-bar-import', 'market-data-provider']);
  });

  it('daily-bar-import 不重复出现在 quant-analysis', () => {
    const qa = buildStatusTree.find((n) => n.id === 'quant-analysis');
    const childIds = (qa?.children ?? []).map((c) => c.id);
    expect(childIds).not.toContain('daily-bar-import');
  });

  it('AI 图片识别（ai-input）不是 P1 当前任务', () => {
    const ai = buildStatusTree.find((n) => n.id === 'ai-input');
    expect(ai?.priority).not.toBe('P1');
    expect(ai?.priority).toBe('P2');
  });

  it('不含过期下一步字符串', () => {
    const all = flattenBuildNodes(buildStatusTree);
    const outdated = [
      '增加快照对比',
      '增强计划',
      '尚未自动对比理论持仓',
      '和持仓快照做差异核对',
      '设计快照差异对比',
      '和交易记录建立更强关联',
    ];
    for (const node of all) {
      for (const action of node.nextActions) {
        for (const bad of outdated) {
          expect(action, `节点 ${node.id} 含过期下一步 "${bad}"`).not.toContain(bad);
        }
      }
    }
  });

  it('一级分类与产品设计一致（含证券主数据与行情基础）', () => {
    const titles = buildStatusTree.map((n) => n.title);
    expect(titles).toEqual([
      '数据与基础设施',
      '交易记录闭环',
      '持仓与盈亏',
      '证券主数据与行情基础',
      '智能录入',
      '量化分析',
    ]);
  });

  it('summary cards 当前最优先含"行情"字样', () => {
    const top = buildSummaryCards.find((c) => c.title === '当前最优先');
    expect(top?.value).toContain('行情');
  });

  it('filters tree by status while keeping matching parent paths', () => {
    const filtered = filterBuildTree(buildStatusTree, { status: 'TODO' });
    const nodes = flattenBuildNodes(filtered);
    expect(nodes.some((n) => n.id === 'market-data-foundation')).toBe(true);
    expect(nodes.every((n) => n.status === 'TODO' || (n.children?.length ?? 0) > 0)).toBe(true);
  });

  it('has summary and capability sections', () => {
    expect(buildSummaryCards).toHaveLength(4);
    expect(buildCapabilities.map((i) => i.title)).toEqual([
      '数据沉淀',
      '盈亏解释',
      '风险控制',
      '复盘闭环',
      '自动化录入',
    ]);
  });
});
