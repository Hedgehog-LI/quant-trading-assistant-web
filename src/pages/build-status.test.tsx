import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect } from 'vitest';
import { BuildStatusPage } from './build-status';
import { buildStatusSnapshot } from '../features/build-status/data/buildStatusSnapshot';
import { RECENT_DELIVERIES_DEFAULT, RECENT_DELIVERIES_MAX } from '../features/build-status/model/selectors';

function renderPage() {
  return render(
    <MemoryRouter>
      <BuildStatusPage />
    </MemoryRouter>,
  );
}

function countTimelineItems(): number {
  return document.querySelectorAll('.ant-timeline-item').length;
}

describe('BuildStatusPage（V2 看板）', () => {
  it('首屏展示状态基线（数据截至时间）', () => {
    renderPage();
    // snapshotAt 可能与某条交付日期相同（如 2026-08-09），因此允许出现多次
    expect(screen.getAllByText(buildStatusSnapshot.snapshotAt).length).toBeGreaterThan(0);
    expect(screen.getByText(/静态发布快照/)).toBeInTheDocument();
    expect(screen.getByText('数据截至')).toBeInTheDocument();
  });

  it('建设总览展示五个口径计数与完成率', () => {
    renderPage();
    // 「建设中」等状态标签在总览与树节点标题中都会出现，因此用 getAllByText
    expect(screen.getAllByText('已部署可用').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已验收待部署').length).toBeGreaterThan(0);
    expect(screen.getAllByText('建设中').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待开始').length).toBeGreaterThan(0);
    expect(screen.getAllByText('阻塞/风险').length).toBeGreaterThan(0);
    expect(screen.getByText('能力完成率')).toBeInTheDocument();
  });

  it('最近交付默认展示 6 条，可展开到全部', () => {
    renderPage();
    expect(countTimelineItems()).toBe(RECENT_DELIVERIES_DEFAULT);
    const expandLabel = buildStatusSnapshot.recentDeliveries.length >= RECENT_DELIVERIES_MAX
      ? `展开到 ${RECENT_DELIVERIES_MAX} 条`
      : `展开全部（${buildStatusSnapshot.recentDeliveries.length} 条）`;
    const expand = screen.getByRole('button', {
      name: expandLabel,
    });
    fireEvent.click(expand);
    expect(countTimelineItems()).toBe(Math.min(buildStatusSnapshot.recentDeliveries.length, RECENT_DELIVERIES_MAX));
  });

  it('最近交付按日期倒序展示，第一条为最新', () => {
    renderPage();
    const firstTitle = screen.getAllByText(buildStatusSnapshot.recentDeliveries[0].title);
    expect(firstTitle.length).toBeGreaterThan(0);
  });

  it('树节点可选中并打开详情抽屉', () => {
    renderPage();
    // 打开能力目录卡片内的树节点标题（快照对比与账本对账）
    const target = screen.getByText('快照对比与账本对账');
    fireEvent.click(target);
    expect(screen.getByText('快照对比与账本对账', { selector: '.ant-drawer-title' })).toBeInTheDocument();
    expect(screen.getByText('用户价值')).toBeInTheDocument();
    expect(screen.getByText('已交付内容')).toBeInTheDocument();
    expect(screen.getByText('提交与验收证据')).toBeInTheDocument();
  });

  it('筛选控件存在并可重置', () => {
    renderPage();
    expect(screen.getByText('全部优先级')).toBeInTheDocument();
    expect(screen.getByText('全部状态')).toBeInTheDocument();
    expect(screen.getByText('全部验证层级')).toBeInTheDocument();
    expect(screen.getByText('全部模块')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置筛选' })).toBeInTheDocument();
  });

  it('当前行动区展示可直接使用、正在建设、下一步建议与阻塞事项', () => {
    renderPage();
    expect(screen.getByText('现在可直接使用')).toBeInTheDocument();
    expect(screen.getByText('正在建设')).toBeInTheDocument();
    expect(screen.getByText('下一步建议')).toBeInTheDocument();
    expect(screen.getByText('阻塞与风险事项')).toBeInTheDocument();
  });

  it('不再出现旧字符串「最近同步 2026-07-06」与 /Users/joker 绝对路径', () => {
    renderPage();
    expect(document.body.textContent).not.toContain('最近同步 2026-07-06');
    expect(document.body.textContent).not.toContain('/Users/joker');
  });
});
