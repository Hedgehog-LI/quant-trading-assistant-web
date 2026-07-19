import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SecurityVerificationField } from './SecurityVerificationField';

const verifySecurity = vi.fn();
vi.mock('../api/workbenchApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/workbenchApi')>();
  return { ...original, verifySecurity: (...args: unknown[]) => verifySecurity(...args) };
});

describe('SecurityVerificationField', () => {
  it('验证后显式加入计划，并支持移除', async () => {
    verifySecurity.mockResolvedValue({ canonicalSymbol: 'SH.603308', providerSymbol: '603308.SH',
      displayName: '应流股份', market: 'CN', exchange: 'SSE', currency: 'CNY', lotSize: 100,
      verificationStatus: 'VERIFIED_QUOTE_AVAILABLE', quoteAvailable: true, lastPrice: 31.2,
      quoteTime: '2026-07-17T15:00:00', provider: 'LONGPORT' });
    const onChange = vi.fn();
    const { rerender } = render(<SecurityVerificationField value="" onChange={onChange} remoteMode taskType="DAILY_BAR_BACKFILL" />);

    fireEvent.change(screen.getByPlaceholderText('603308'), { target: { value: '603308' } });
    fireEvent.click(screen.getByRole('button', { name: /查询并验证/ }));
    await screen.findByText(/应流股份/);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /加入计划/ }));
    expect(onChange).toHaveBeenCalledWith('SH.603308');

    rerender(<SecurityVerificationField value="SH.603308" onChange={onChange} remoteMode taskType="DAILY_BAR_BACKFILL" />);
    fireEvent.click(screen.getByRole('img', { name: 'Close' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('输入变化使旧结果失效', async () => {
    let resolveFirst!: (value: unknown) => void;
    verifySecurity.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    render(<SecurityVerificationField value="" onChange={vi.fn()} remoteMode />);

    const input = screen.getByPlaceholderText('603308');
    fireEvent.change(input, { target: { value: '603308' } });
    fireEvent.click(screen.getByRole('button', { name: /查询并验证/ }));
    fireEvent.change(input, { target: { value: '603309' } });
    resolveFirst({ canonicalSymbol: 'SH.603308', displayName: '旧结果', market: 'CN',
      verificationStatus: 'VERIFIED_NO_QUOTE', quoteAvailable: false, provider: 'LONGPORT' });
    await waitFor(() => expect(screen.queryByText(/旧结果/)).not.toBeInTheDocument());
  });

  it('本地模式明确禁用真实验证', () => {
    render(<SecurityVerificationField value="" onChange={vi.fn()} remoteMode={false} />);
    expect(screen.getByText(/本地模式不连接 LongPort/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查询并验证/ })).toBeDisabled();
  });
});
