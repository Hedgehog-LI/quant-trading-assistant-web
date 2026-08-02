import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchSecurities } from '../features/market-data/api/securityDirectoryApi';
import { saveSettings } from '../features/settings/api/settingsApi';
import { clearAll } from '../shared/api/localStorageClient';
import type { MarketSegment } from '../shared/types/domain';

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

// Mock the security directory API so SecuritySelector never touches the network/seed catalog.
vi.mock('../features/market-data/api/securityDirectoryApi', async () => {
  const actual = await vi.importActual<typeof import('../features/market-data/api/securityDirectoryApi')>(
    '../features/market-data/api/securityDirectoryApi',
  );
  return {
    ...actual,
    searchSecurities: vi.fn(),
  };
});

import { message as antdMessage } from 'antd';
import { MarketSegmentsPage, MembersDrawer } from './market-segments';

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

function renderCustomPage() {
  const result = render(<MarketSegmentsPage />);
  fireEvent.click(screen.getByRole('tab', { name: '自定义分组' }));
  return result;
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
    renderCustomPage();
    await waitFor(() => expect(screen.getByText('白酒池')).toBeInTheDocument());
    expect(mockApi.listSegments).toHaveBeenCalledWith({ page: 1, size: 20 });
  });

  it('2. 翻页用新 page 参数重新请求 listSegments', async () => {
    mockApi.listSegments.mockResolvedValue({ items: [], total: 25, page: 1, size: 20 });
    renderCustomPage();
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
    renderCustomPage();
    await waitFor(() => expect(screen.getByText('白酒池')).toBeInTheDocument());
    fireEvent.click(screen.getByText('成员'));
    await waitFor(() => expect(mockApi.listSegmentMembers).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(screen.getByText('SH.600519')).toBeInTheDocument());
  });

  it('4. 创建失败调用 createSegment 且 message.error 被触发', async () => {
    // mock createSegment 返回 reject
    mockApi.createSegment.mockRejectedValue(new Error('创建失败_网络错误'));
    renderCustomPage();
    // 点击新建分组打开 Drawer
    fireEvent.click(screen.getByText('新建分组'));
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
    renderCustomPage();
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
    const { container } = renderCustomPage();
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
    const { unmount } = renderCustomPage();
    await waitFor(() => expect(screen.getByText('成员测试')).toBeInTheDocument());
    fireEvent.click(screen.getByText('成员'));
    const symbolInput = await screen.findByPlaceholderText('如 SH.600519 / HK.02498 / US.AAPL');
    fireEvent.change(symbolInput, { target: { value: 'SH.600519' } });
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
    const { unmount } = renderCustomPage();
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

// ==================== 板块成员 SecuritySelector 集成 (RS-05) ====================

/**
 * Advance fake timers past the SecuritySelector 250ms debounce and flush the
 * microtask queue that resolves the mocked searchSecurities promise + React
 * state updates. Under fake timers waitFor cannot self-advance, so we settle
 * microtasks via repeated `await Promise.resolve()`.
 */
async function flushSelectorDebounce(ms = 250) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
}

describe('板块成员 SecuritySelector 集成', () => {
  const stubSegment: MarketSegment = {
    id: 'seg-selector',
    segmentName: '选择器测试板块',
    segmentType: 'CUSTOM',
    enabled: true,
    memberCount: 0,
    segmentCode: 'SEG_SEL',
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    clearAll();
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
    mockApi.listSegmentMembers.mockResolvedValue([]);
    mockApi.addSegmentMember.mockResolvedValue({ id: 'm-sel', segmentId: stubSegment.id, canonicalSymbol: 'SH.603308', sortOrder: 0, createdAt: '' });
    vi.mocked(searchSecurities).mockReset();
    vi.mocked(searchSecurities).mockResolvedValue({
      items: [
        {
          canonicalSymbol: 'SH.603308',
          symbol: '603308',
          displayName: '应流股份',
          name: '应流股份',
          market: 'SH',
          exchange: 'SSE',
          currency: 'CNY',
          securityType: 'STOCK',
          listStatus: 'LISTED',
          matchedBy: 'FORMAL_NAME_EXACT',
        },
      ],
      catalogStatus: 'READY',
      catalogUpdatedAt: '2026-07-29T10:00:00',
      stale: false,
      degraded: false,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('板块成员：SecuritySelector 选中后 addSegmentMember 提交的 canonical symbol 与所选一致', async () => {
    await act(async () => {
      render(<MembersDrawer segment={stubSegment} onClose={vi.fn()} />);
      // 让 useEffect(listSegmentMembers) 的 microtask 在 fake timers 下落地。
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });
    const selectorInput = screen.getByPlaceholderText(/检索证券/) as HTMLInputElement;

    // 驱动 SecuritySelector：输入 → debounce → 点击 data-canonical-symbol="SH.603308"
    fireEvent.change(selectorInput, { target: { value: '应流' } });
    await flushSelectorDebounce();
    const listItem = screen.getByTestId('security-selector-results')
      .querySelector('[data-canonical-symbol="SH.603308"]') as HTMLElement;
    expect(listItem).toBeTruthy();
    fireEvent.click(listItem);
    await flushSelectorDebounce(0);

    // 点击添加成员
    const addBtn = Array.from(document.querySelectorAll('.ant-drawer button'))
      .find((b) => b.textContent?.replace(/\s/g, '') === '添加成员') as HTMLButtonElement;
    expect(addBtn).toBeTruthy();
    await act(async () => { fireEvent.click(addBtn); });
    // 让 addSegmentMember promise 的 microtask 落地。
    await flushSelectorDebounce(0);

    // 断言 addSegmentMember 被调用，canonicalSymbol 与所选一致
    expect(mockApi.addSegmentMember).toHaveBeenCalledTimes(1);
    expect(mockApi.addSegmentMember).toHaveBeenCalledWith(stubSegment.id, expect.objectContaining({ canonicalSymbol: 'SH.603308' }));
  });

  it('板块成员：仅选择不提交时 addSegmentMember 不被调用', async () => {
    await act(async () => {
      render(<MembersDrawer segment={stubSegment} onClose={vi.fn()} />);
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });
    const selectorInput = screen.getByPlaceholderText(/检索证券/) as HTMLInputElement;

    fireEvent.change(selectorInput, { target: { value: '应流' } });
    await flushSelectorDebounce();
    const listItem = screen.getByTestId('security-selector-results')
      .querySelector('[data-canonical-symbol="SH.603308"]') as HTMLElement;
    fireEvent.click(listItem);
    await flushSelectorDebounce(0);

    // 未点添加：addSegmentMember 不应被调用
    expect(mockApi.addSegmentMember).not.toHaveBeenCalled();
  });
});
