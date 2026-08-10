import { describe, expect, it } from 'vitest';
import { buildStatusSnapshot } from './buildStatusSnapshot';
import { collectLeaves, snapshotAtIsValid, sortRecentDeliveries } from '../model/selectors';
import type { BuildStatusNode } from '../model/types';

const serialized = JSON.stringify(buildStatusSnapshot);

function allNodes(nodes: BuildStatusNode[]): BuildStatusNode[] {
  return nodes.flatMap((n) => [n, ...allNodes(n.children ?? [])]);
}

describe('buildStatusSnapshot 数据完整性', () => {
  it('不出现旧字符串「最近同步 2026-07-06」', () => {
    expect(serialized).not.toContain('最近同步 2026-07-06');
    expect(serialized).not.toContain('2026-07-06 · 数据来源');
  });

  it('不出现 /Users/joker 绝对本机路径，文档引用为仓库相对路径', () => {
    expect(serialized).not.toContain('/Users/joker');
    const nodes = allNodes(buildStatusSnapshot.capabilities);
    for (const node of nodes) {
      for (const link of node.docLinks) {
        expect(link.path.startsWith('/'), `${node.id} 的文档路径必须是仓库相对路径`).toBe(false);
        expect(link.path).not.toContain('/Users/');
      }
    }
  });

  it('snapshotAt 不早于最新交付日期', () => {
    expect(snapshotAtIsValid(buildStatusSnapshot)).toBe(true);
    const latest = sortRecentDeliveries(buildStatusSnapshot.recentDeliveries)[0];
    expect(latest).toBeDefined();
    expect(buildStatusSnapshot.snapshotAt.localeCompare(latest.deliveredAt)).toBeGreaterThanOrEqual(0);
  });

  it('最近交付记录字段完整（日期/标题/摘要/模块/阶段/验收依据/限制）', () => {
    expect(buildStatusSnapshot.recentDeliveries.length).toBeGreaterThanOrEqual(6);
    expect(buildStatusSnapshot.recentDeliveries.length).toBeLessThanOrEqual(12);
    for (const record of buildStatusSnapshot.recentDeliveries) {
      expect(record.deliveredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(record.title.length).toBeGreaterThan(0);
      expect(record.summary.length).toBeGreaterThan(0);
      expect(record.modules.length).toBeGreaterThan(0);
      expect(['DESIGN', 'AUTOMATION', 'RUNTIME', 'DEPLOYED']).toContain(record.stage);
      expect(record.acceptanceRef.length).toBeGreaterThan(0);
    }
  });

  it('DELIVERED 叶子必须有验收依据、最后更新时间和修订证据', () => {
    const leaves = collectLeaves(buildStatusSnapshot.capabilities);
    for (const node of leaves) {
      if (node.deliveryStatus !== 'DELIVERED') {
        continue;
      }
      expect(node.acceptanceRef, `${node.id} 必须提供验收依据`).toBeTruthy();
      expect(node.lastUpdatedAt, `${node.id} 必须提供最后更新时间`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(
        node.backendCommit || node.frontendCommit,
        `${node.id} 必须有代码提交或明确的纯文档交付标识`,
      ).toBeTruthy();
    }
  });

  it('DEPLOYED 叶子必须有线上/部署冒烟证据', () => {
    const leaves = collectLeaves(buildStatusSnapshot.capabilities);
    const deployed = leaves.filter((n) => n.validationStage === 'DEPLOYED');
    expect(deployed.length).toBeGreaterThan(0);
    for (const node of deployed) {
      const evidence = node.deliveredContent.join(' ');
      expect(evidence, `${node.id} 的已交付内容缺少部署证据`).toMatch(/生产|部署|线上|冒烟/);
      expect(node.deliveryStatus, `${node.id} DEPLOYED 但未标记已交付`).toBe('DELIVERED');
    }
  });

  it('验证层级只增不减：DEPLOYED/RUNTIME 节点不落后于 DELIVERED 语义', () => {
    const leaves = collectLeaves(buildStatusSnapshot.capabilities);
    for (const node of leaves) {
      if (node.validationStage === 'DEPLOYED') {
        expect(node.deliveryStatus).toBe('DELIVERED');
      }
    }
  });

  it('能力节点至少展示名称、优先级、研发状态与验证层级', () => {
    const nodes = allNodes(buildStatusSnapshot.capabilities);
    for (const node of nodes) {
      expect(node.title.length).toBeGreaterThan(0);
      expect(['P0', 'P1', 'P2', 'P3']).toContain(node.priority);
      expect([
        'PLANNED',
        'DESIGNED',
        'IN_PROGRESS',
        'DELIVERED',
        'BLOCKED',
        'DEFERRED',
      ]).toContain(node.deliveryStatus);
      expect([
        'NOT_VERIFIED',
        'STATIC_VERIFIED',
        'AUTOMATION_VERIFIED',
        'RUNTIME_VERIFIED',
        'DEPLOYED',
      ]).toContain(node.validationStage);
    }
  });

  it('「现在可直接使用」链接指向存在的路由', () => {
    const validPaths = [
      '/dashboard',
      '/watchlist',
      '/trade-plan',
      '/risk',
      '/journal',
      '/portfolio',
      '/position-snapshots',
      '/review',
      '/market-data',
      '/market-workspace',
      '/market-segments',
      '/settings',
    ];
    expect(buildStatusSnapshot.readyToUse.length).toBeGreaterThan(0);
    expect(buildStatusSnapshot.readyToUse.length).toBeLessThanOrEqual(6);
    for (const item of buildStatusSnapshot.readyToUse) {
      expect(validPaths).toContain(item.path);
    }
  });

  describe('交付证据归属修正（V2 收口）', () => {
    it('P1.7 最近交付只指向后端 3181dc0，无 frontendCommit', () => {
      const p17 = buildStatusSnapshot.recentDeliveries.find((r) => r.title.includes('P1.7'));
      expect(p17).toBeDefined();
      expect(p17?.backendCommit).toBe('3181dc0');
      expect(p17?.frontendCommit).toBeUndefined();
    });

    it('D2 最近交付只指向前端 0cf382f，无 backendCommit', () => {
      const d2 = buildStatusSnapshot.recentDeliveries.find((r) => r.title.includes('P1.4b-D2'));
      expect(d2).toBeDefined();
      expect(d2?.frontendCommit).toBe('0cf382f');
      expect(d2?.backendCommit).toBeUndefined();
    });

    it('D2 节点已收口为 DELIVERED + AUTOMATION_VERIFIED，且 D4 仍未完成', () => {
      const nodes = allNodes(buildStatusSnapshot.capabilities);
      const d2 = nodes.find((n) => n.id === 'security-directory-d2');
      expect(d2).toBeDefined();
      expect(d2?.deliveryStatus).toBe('DELIVERED');
      expect(d2?.validationStage).toBe('AUTOMATION_VERIFIED');
      // 真实限制保留：不得宣称 Docker/MySQL 或跨模块 D4 已验证
      expect(d2?.limitations.join(' ')).toContain('D4');
      expect(d2?.remainingWork.join(' ')).toContain('D4');
      // D4 未完成：父节点仍 IN_PROGRESS 且 remainingWork 含 D4
      const parent = nodes.find((n) => n.id === 'security-directory');
      expect(parent).toBeDefined();
      expect(parent?.deliveryStatus).toBe('IN_PROGRESS');
      expect(parent?.remainingWork.join(' ')).toContain('D4');
    });

    it('修正后的证据指向新基线：P1.7 不再用 715932c', () => {
      const p17 = buildStatusSnapshot.recentDeliveries.find((r) => r.title.includes('P1.7'));
      expect(p17?.backendCommit).not.toBe('715932c');
    });
  });
});
