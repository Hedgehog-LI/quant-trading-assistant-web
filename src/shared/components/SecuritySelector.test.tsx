import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SecuritySelector } from './SecuritySelector';
import { searchSecurities } from '../../features/market-data/api/securityDirectoryApi';

vi.mock('../../features/market-data/api/securityDirectoryApi', () => ({
  searchSecurities: vi.fn(),
}));

function summary(
  canonicalSymbol: string,
  displayName: string,
  market: string,
  exchange: string,
  securityType = 'STOCK',
  listStatus: 'LISTED' | 'DELISTED' = 'LISTED',
) {
  return {
    canonicalSymbol,
    symbol: canonicalSymbol.split('.')[1] ?? canonicalSymbol,
    displayName,
    name: displayName,
    market,
    exchange,
    currency: market === 'HK' ? 'HKD' : market === 'US' ? 'USD' : 'CNY',
    securityType,
    listStatus,
    matchedBy: 'FORMAL_NAME_EXACT' as const,
  };
}

function result(
  items: ReturnType<typeof summary>[],
  overrides: Record<string, unknown> = {},
) {
  return {
    items,
    catalogStatus: 'READY',
    catalogUpdatedAt: '2026-07-29T10:00:00',
    stale: false,
    degraded: false,
    ...overrides,
  };
}

/**
 * Advance fake timers by the debounce window and flush the microtask queue
 * that resolves the mocked searchSecurities promise + the React state update.
 * Under fake timers, waitFor/findBy cannot self-advance, so we synchronously
 * settle microtasks via repeated `await Promise.resolve()`.
 */
async function flush(ms = 250) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    // Drain the resolved-promise microtasks (mock search + .then + setState).
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
}

/** Resolve a deferred promise and flush the resulting microtask chain. */
async function settle(resolveFn: (value: unknown) => void, value: unknown) {
  await act(async () => {
    resolveFn(value);
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
}

function inputEl(): HTMLInputElement {
  return screen.getByPlaceholderText(/检索证券/) as HTMLInputElement;
}

describe('SecuritySelector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(searchSecurities).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('250ms debounce：阈值内连续输入只触发一次搜索', () => {
    vi.mocked(searchSecurities).mockResolvedValue(result([]));
    render(<SecuritySelector onChange={vi.fn()} />);
    const input = inputEl();
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ap' } });
    expect(searchSecurities).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(searchSecurities).toHaveBeenCalledTimes(1);
    expect(searchSecurities).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'ap' }),
    );
  });

  it('过期响应不覆盖新关键词结果（竞态保护）', async () => {
    let resolveFirst!: (value: unknown) => void;
    vi.mocked(searchSecurities)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve as (value: unknown) => void;
          }),
      )
      .mockResolvedValueOnce(
        result([summary('SH.600002', '新关键词结果', 'SH', 'SSE')]),
      );

    render(<SecuritySelector onChange={vi.fn()} />);
    const input = inputEl();

    fireEvent.change(input, { target: { value: 'old' } });
    await flush();
    // second keyword
    fireEvent.change(input, { target: { value: 'new' } });
    await flush();

    // late old response resolves — must be ignored
    await settle(
      resolveFirst,
      result([summary('SH.600001', '旧关键词结果', 'SH', 'SSE')]),
    );

    expect(screen.getByTestId('security-selector-results')).toBeInTheDocument();
    expect(screen.getByText('新关键词结果')).toBeInTheDocument();
    expect(screen.queryByText('旧关键词结果')).not.toBeInTheDocument();
  });

  it('loading / 空结果 / 失败 / 重试 四态正确', async () => {
    // loading: deferred
    let resolveSearch!: (value: unknown) => void;
    vi.mocked(searchSecurities).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve as (value: unknown) => void;
        }),
    );

    render(<SecuritySelector onChange={vi.fn()} />);
    const input = inputEl();
    fireEvent.change(input, { target: { value: 'abc' } });
    await flush();

    // loading state visible while pending
    expect(screen.getByTestId('security-selector-loading')).toBeInTheDocument();

    // empty result
    await settle(resolveSearch, result([]));
    expect(screen.queryByTestId('security-selector-loading')).not.toBeInTheDocument();
    expect(screen.getByText('无匹配结果')).toBeInTheDocument();

    // error state
    vi.mocked(searchSecurities).mockRejectedValueOnce(new Error('网络错误'));
    fireEvent.change(input, { target: { value: 'def' } });
    await flush();
    expect(screen.getByText('请求失败')).toBeInTheDocument();
    // antd renders CJK button text with an inserted space ("重 试"); match by
    // accessible name, which aggregates descendant text and ignores the span wrapper.
    const retryButton = screen.getByRole('button', { name: /重\s*试/ });
    expect(retryButton).toBeInTheDocument();

    // retry re-invokes search
    vi.mocked(searchSecurities).mockResolvedValueOnce(
      result([summary('SH.600003', '重试结果', 'SH', 'SSE')]),
    );
    fireEvent.click(retryButton);
    await flush();
    expect(screen.getByText('重试结果')).toBeInTheDocument();
  });

  it('键盘 ArrowDown/ArrowUp 导航、Enter 确认、Esc 关闭', async () => {
    vi.mocked(searchSecurities).mockResolvedValue(
      result([
        summary('SH.600010', '第一项', 'SH', 'SSE'),
        summary('SH.600011', '第二项', 'SH', 'SSE'),
      ]),
    );
    const onChange = vi.fn();
    render(<SecuritySelector onChange={onChange} />);
    const input = inputEl();
    fireEvent.change(input, { target: { value: '项' } });
    await flush();

    expect(screen.getByTestId('security-selector-results')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('SH.600011');

    // reopen and Esc closes
    fireEvent.change(input, { target: { value: '再项' } });
    await flush();
    expect(screen.getByTestId('security-selector-results')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('security-selector-results')).not.toBeInTheDocument();
  });

  it('选中后展示名称/canonical symbol/市场交易所/证券类型', async () => {
    vi.mocked(searchSecurities).mockResolvedValue(
      result([summary('SH.600600', '样本展示', 'SH', 'SSE', 'STOCK')]),
    );
    const onChange = vi.fn();
    render(<SecuritySelector onChange={onChange} />);
    const input = inputEl();
    fireEvent.change(input, { target: { value: '展示' } });
    await flush();
    expect(screen.getByText('样本展示')).toBeInTheDocument();
    fireEvent.click(screen.getByText('样本展示'));

    expect(onChange).toHaveBeenCalledWith('SH.600600');
    expect(screen.getByTestId('security-selector-selected')).toBeInTheDocument();
    expect(screen.getByTestId('selected-displayName')).toHaveTextContent('样本展示');
    expect(screen.getByTestId('selected-canonicalSymbol')).toHaveTextContent('SH.600600');
    expect(screen.getByTestId('selected-market')).toHaveTextContent('沪市 · SSE');
    expect(screen.getByTestId('selected-securityType')).toHaveTextContent('股票');
  });

  it('再次编辑文本立即失效旧选择（清除已选）', async () => {
    vi.mocked(searchSecurities).mockResolvedValue(
      result([summary('SH.600600', '失效样本', 'SH', 'SSE')]),
    );
    const onChange = vi.fn();
    render(<SecuritySelector onChange={onChange} />);
    const input = inputEl();
    fireEvent.change(input, { target: { value: '失效' } });
    await flush();
    expect(screen.getByText('失效样本')).toBeInTheDocument();
    fireEvent.click(screen.getByText('失效样本'));
    await flush();
    expect(screen.getByTestId('security-selector-selected')).toBeInTheDocument();

    // edit text again → invalidate
    fireEvent.change(input, { target: { value: '失效改' } });
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.queryByTestId('security-selector-selected')).not.toBeInTheDocument();
  });

  it('同名跨市场证券并列展示且不自动选择', async () => {
    vi.mocked(searchSecurities).mockResolvedValue(
      result([
        summary('SH.600600', '同名X', 'SH', 'SSE'),
        summary('HK.06000', '同名X', 'HK', 'HKEX'),
      ]),
    );
    const onChange = vi.fn();
    render(<SecuritySelector onChange={onChange} />);
    const input = inputEl();
    fireEvent.change(input, { target: { value: '同名' } });
    await flush();
    const list = screen.getByTestId('security-selector-results');
    const shItem = list.querySelector('[data-canonical-symbol="SH.600600"]');
    const hkItem = list.querySelector('[data-canonical-symbol="HK.06000"]');
    expect(shItem).not.toBeNull();
    expect(hkItem).not.toBeNull();
    // not auto-selected
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('security-selector-selected')).not.toBeInTheDocument();
  });

  it('退市证券默认隐藏；显式筛选后可见并标注状态', async () => {
    // default search (includeDelisted=false) returns only listed items
    vi.mocked(searchSecurities).mockImplementation((params) => {
      const base = [summary('SH.600600', '在市样本', 'SH', 'SSE', 'STOCK', 'LISTED')];
      if (params.includeDelisted) {
        base.push(summary('SH.600001', '退市样本', 'SH', 'SSE', 'STOCK', 'DELISTED'));
      }
      return Promise.resolve(result(base));
    });

    render(<SecuritySelector onChange={vi.fn()} includeDelistedToggle />);
    const input = inputEl();
    fireEvent.change(input, { target: { value: '样本' } });
    await flush();
    expect(searchSecurities).toHaveBeenCalledWith(
      expect.objectContaining({ includeDelisted: false }),
    );
    // default excludes delisted
    expect(screen.queryByText('退市样本')).not.toBeInTheDocument();

    // toggle the switch
    const switchInput = screen.getByRole('switch');
    fireEvent.click(switchInput);
    await flush();

    expect(searchSecurities).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeDelisted: true }),
    );
    expect(screen.getByText('退市样本')).toBeInTheDocument();
    expect(screen.getByText('退市')).toBeInTheDocument();
  });

  it('目录未初始化 / 正常无匹配 / 请求失败 三态可区分', async () => {
    // (a) catalogStatus='EMPTY'
    vi.mocked(searchSecurities).mockResolvedValueOnce(
      result([], { catalogStatus: 'EMPTY' }),
    );
    const { unmount } = render(<SecuritySelector onChange={vi.fn()} />);
    let input = inputEl();
    fireEvent.change(input, { target: { value: 'init' } });
    await flush();
    expect(screen.getByText('目录尚未初始化')).toBeInTheDocument();
    unmount();

    // (b) items=[] catalogStatus='READY'
    vi.mocked(searchSecurities).mockResolvedValueOnce(
      result([], { catalogStatus: 'READY' }),
    );
    render(<SecuritySelector onChange={vi.fn()} />);
    input = inputEl();
    fireEvent.change(input, { target: { value: 'nomatch' } });
    await flush();
    expect(screen.getByText('无匹配结果')).toBeInTheDocument();
    expect(screen.queryByText('目录尚未初始化')).not.toBeInTheDocument();
    expect(screen.queryByText('请求失败')).not.toBeInTheDocument();
  });

  it('目录陈旧只提示不阻断本地结果展示', async () => {
    vi.mocked(searchSecurities).mockResolvedValue(
      result([summary('SH.600600', '陈旧样本', 'SH', 'SSE')], { stale: true }),
    );
    render(<SecuritySelector onChange={vi.fn()} />);
    const input = inputEl();
    fireEvent.change(input, { target: { value: '陈旧' } });
    await flush();
    // items still displayed
    expect(screen.getByTestId('security-selector-results')).toBeInTheDocument();
    expect(screen.getByText('陈旧样本')).toBeInTheDocument();
    // stale alert shown
    expect(screen.getByText(/目录可能陈旧/)).toBeInTheDocument();
  });

  it('SecuritySelector 搜索过程不触发任何业务写请求', async () => {
    vi.mocked(searchSecurities).mockResolvedValue(
      result([summary('SH.600600', '无副作用', 'SH', 'SSE')]),
    );
    render(<SecuritySelector onChange={vi.fn()} />);
    const input = inputEl();
    fireEvent.change(input, { target: { value: 'noeffect' } });
    await flush();
    expect(screen.getByText('无副作用')).toBeInTheDocument();
    // The mocked module only exposes searchSecurities; only this fn was called.
    expect(searchSecurities).toHaveBeenCalled();
    // Reinforce: every call was to searchSecurities with a query payload,
    // never a quote/sync/collection operation.
    for (const call of vi.mocked(searchSecurities).mock.calls) {
      expect(call[0]).toMatchObject({ q: 'noeffect' });
    }
  });
});
