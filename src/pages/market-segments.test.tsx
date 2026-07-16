import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  listSegments: vi.fn(),
  createSegment: vi.fn(),
  deleteSegment: vi.fn(),
  updateSegment: vi.fn(),
  getSegment: vi.fn(),
  listSegmentMembers: vi.fn(),
  addSegmentMember: vi.fn(),
  removeSegmentMember: vi.fn(),
}));

vi.mock('../features/market-data/api/segmentApi', () => mockApi);

import { message as antdMessage } from 'antd';
import { MarketSegmentsPage } from './market-segments';

vi.spyOn(antdMessage, 'success').mockImplementation(() => ({} as never));
vi.spyOn(antdMessage, 'error').mockImplementation(() => ({} as never));
vi.spyOn(antdMessage, 'loading').mockImplementation(() => ({} as never));

const emptyPage = { items: [], total: 0, page: 1, size: 20 };

// Helper: find a button by text inside Drawer (handles Antd character spacing)
function findBtnInDrawer(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('.ant-drawer button'))
    .find(b => b.textContent?.replace(/\s/g, '').includes(text)) as HTMLButtonElement | undefined;
}

// Helper: find Popconfirm confirm button (Antd renders "OK" in English locale)
function findPopconfirmOkBtn(): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('[class*="pop"] button'))
    .find(b => {
      const t = b.textContent?.replace(/\s/g, '').toLowerCase();
      return t === 'ok' || t === '确定';
    }) as HTMLButtonElement | undefined;
}

describe('MarketSegmentsPage 行为测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listSegments.mockResolvedValue(emptyPage);
    mockApi.createSegment.mockResolvedValue({ id: 'seg1', segmentName: '新板块', segmentType: 'CUSTOM', enabled: true, memberCount: 0, segmentCode: 'SEG_1', createdAt: '', updatedAt: '' });
    mockApi.deleteSegment.mockResolvedValue(undefined);
    mockApi.listSegmentMembers.mockResolvedValue([]);
    mockApi.addSegmentMember.mockResolvedValue({ id: 'm1', segmentId: 'seg1', canonicalSymbol: 'SH.600519', sortOrder: 0, createdAt: '' });
    mockApi.removeSegmentMember.mockResolvedValue(undefined);
  });

  it('1. 首次加载调用 listSegments 并渲染结果', async () => {
    mockApi.listSegments.mockResolvedValue({
      items: [{ id: 's1', segmentName: '白酒池', segmentType: 'CUSTOM', enabled: true, memberCount: 2, segmentCode: 'SEG_1', createdAt: '', updatedAt: '' }],
      total: 1, page: 1, size: 20,
    });
    render(<MarketSegmentsPage />);
    await waitFor(() => expect(screen.getByText('白酒池')).toBeInTheDocument());
    expect(mockApi.listSegments).toHaveBeenCalledWith({ page: 1, size: 20 });
  });

  it('2. 翻页用新 page 参数重新请求 listSegments', async () => {
    mockApi.listSegments.mockResolvedValue({ items: [], total: 25, page: 1, size: 20 });
    render(<MarketSegmentsPage />);
    await waitFor(() => expect(mockApi.listSegments).toHaveBeenCalledWith({ page: 1, size: 20 }));
    fireEvent.click(screen.getByTitle('2'));
    await waitFor(() => expect(mockApi.listSegments).toHaveBeenCalledWith({ page: 2, size: 20 }));
  });

  it('3. 打开成员 Drawer 调用 listSegmentMembers 并渲染成员', async () => {
    mockApi.listSegments.mockResolvedValue({
      items: [{ id: 's1', segmentName: '白酒池', segmentType: 'CUSTOM', enabled: true, memberCount: 1, segmentCode: 'SEG_1', createdAt: '', updatedAt: '' }],
      total: 1, page: 1, size: 20,
    });
    mockApi.listSegmentMembers.mockResolvedValue([
      { id: 'm1', segmentId: 's1', canonicalSymbol: 'SH.600519', sortOrder: 0, createdAt: '' },
    ]);
    render(<MarketSegmentsPage />);
    await waitFor(() => expect(screen.getByText('白酒池')).toBeInTheDocument());
    fireEvent.click(screen.getByText('成员'));
    await waitFor(() => expect(mockApi.listSegmentMembers).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(screen.getByText('SH.600519')).toBeInTheDocument());
  });

  it('4. 创建失败调用 createSegment 且 message.error 被触发', async () => {
    // mock createSegment 返回 reject
    mockApi.createSegment.mockRejectedValue(new Error('创建失败_网络错误'));
    render(<MarketSegmentsPage />);
    // 点击新建板块打开 Drawer
    fireEvent.click(screen.getByText('新建板块'));
    // 等待 Drawer 打开
    await waitFor(() => expect(screen.getByPlaceholderText('白酒观察池')).toBeInTheDocument());
    // 填写板块名称
    fireEvent.change(screen.getByPlaceholderText('白酒观察池'), { target: { value: '测试板块_创建失败' } });
    // 找到 Drawer 内的创建按钮并点击
    const createBtn = findBtnInDrawer('创建');
    expect(createBtn).toBeTruthy();
    await act(async () => { fireEvent.click(createBtn!); });
    // createSegment 被调用
    await waitFor(() => {
      expect(mockApi.createSegment).toHaveBeenCalledTimes(1);
    });
    // message.error 被调用（删除 handleCreate catch 逻辑后此断言会失败）
    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith(expect.stringContaining('创建失败'));
    });
    expect(createBtn).not.toBeDisabled();
  });

  it('5. 删除失败调用 deleteSegment 且数据不误删', async () => {
    mockApi.listSegments.mockResolvedValue({
      items: [{ id: 's1', segmentName: '不可删板块', segmentType: 'CUSTOM', enabled: true, memberCount: 0, segmentCode: 'SEG_1', createdAt: '', updatedAt: '' }],
      total: 1, page: 1, size: 20,
    });
    mockApi.deleteSegment.mockRejectedValue(new Error('删除失败_权限不足'));
    render(<MarketSegmentsPage />);
    await waitFor(() => expect(screen.getByText('不可删板块')).toBeInTheDocument());
    // 点击删除触发 Popconfirm
    fireEvent.click(screen.getByText('删除'));
    // 找到 Popconfirm 的 OK 按钮
    await waitFor(() => {
      const confirmBtn = findPopconfirmOkBtn();
      expect(confirmBtn).toBeTruthy();
      fireEvent.click(confirmBtn!);
    });
    // deleteSegment 被调用
    await waitFor(() => {
      expect(mockApi.deleteSegment).toHaveBeenCalledTimes(1);
    });
    // message.error 被调用（删除 handleDelete catch 逻辑后此断言会失败）
    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith(expect.stringContaining('删除失败'));
    });
    // 板块数据仍在（未被误删）
    expect(screen.getByText('不可删板块')).toBeInTheDocument();
  });

  it('6. 加载失败后重试重新请求 listSegments', async () => {
    mockApi.listSegments.mockRejectedValueOnce(new Error('网络错误'));
    const { container } = render(<MarketSegmentsPage />);
    await waitFor(() => {
      const alert = container.querySelector('.ant-alert-error');
      expect(alert).toBeTruthy();
      expect(alert?.textContent).toContain('网络错误');
    }, { timeout: 3000 });
    mockApi.listSegments.mockResolvedValue(emptyPage);
    const retryBtn = container.querySelector('.ant-alert-error button');
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn!);
    await waitFor(() => expect(mockApi.listSegments).toHaveBeenCalledTimes(2));
  });

  it('7. 添加 pending 时重复点击只调用一次 addSegmentMember', async () => {
    mockApi.listSegments.mockResolvedValue({
      items: [{ id: 's1', segmentName: '成员测试', segmentType: 'CUSTOM', enabled: true, memberCount: 0, segmentCode: 'SEG_1', createdAt: '', updatedAt: '' }],
      total: 1, page: 1, size: 20,
    });
    let resolveAdd: () => void = () => {};
    mockApi.addSegmentMember.mockImplementation(() => new Promise((resolve) => { resolveAdd = resolve as () => void; }));
    const { unmount } = render(<MarketSegmentsPage />);
    await waitFor(() => expect(screen.getByText('成员测试')).toBeInTheDocument());
    fireEvent.click(screen.getByText('成员'));
    await waitFor(() => expect(screen.getByPlaceholderText('代码 SH.600519')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('代码 SH.600519'), { target: { value: 'SH.600519' } });
    const addBtn = screen.getByText('添加成员');
    fireEvent.click(addBtn);
    fireEvent.click(addBtn);
    expect(mockApi.addSegmentMember).toHaveBeenCalledTimes(1);
    // 清理: resolve pending + unmount 避免悬空更新
    await act(async () => { resolveAdd(); });
    unmount();
  });

  it('8. 移除 pending 时重复确认只调用一次 removeSegmentMember', async () => {
    mockApi.listSegments.mockResolvedValue({
      items: [{ id: 's1', segmentName: '移除测试', segmentType: 'CUSTOM', enabled: true, memberCount: 1, segmentCode: 'SEG_1', createdAt: '', updatedAt: '' }],
      total: 1, page: 1, size: 20,
    });
    mockApi.listSegmentMembers.mockResolvedValue([
      { id: 'm1', segmentId: 's1', canonicalSymbol: 'SH.600519', sortOrder: 0, createdAt: '' },
    ]);
    let resolveRemove: () => void = () => {};
    mockApi.removeSegmentMember.mockImplementation(() => new Promise((resolve) => { resolveRemove = resolve as () => void; }));
    const { unmount } = render(<MarketSegmentsPage />);
    await waitFor(() => expect(screen.getByText('移除测试')).toBeInTheDocument());
    fireEvent.click(screen.getByText('成员'));
    await waitFor(() => expect(screen.getByText('SH.600519')).toBeInTheDocument());
    // 点击移除
    fireEvent.click(screen.getByText('移除'));
    // 等待 Popconfirm 出现并点击 OK
    await waitFor(() => {
      const confirmBtn = findPopconfirmOkBtn();
      if (confirmBtn) fireEvent.click(confirmBtn);
    });
    await waitFor(() => expect(mockApi.removeSegmentMember).toHaveBeenCalledTimes(1));
    const removeButton = screen.getByText('移除').closest('button');
    expect(removeButton).toHaveClass('ant-btn-loading');
    fireEvent.click(removeButton!);
    expect(mockApi.removeSegmentMember).toHaveBeenCalledTimes(1);
    // 清理: resolve pending + unmount 避免悬空更新
    await act(async () => { resolveRemove(); });
    unmount();
  });
});
