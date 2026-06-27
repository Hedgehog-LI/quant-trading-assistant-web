import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PositionSnapshotHistoryTable } from './PositionSnapshotHistoryTable';
import type { PositionSnapshotSummary } from '../model/types';

describe('PositionSnapshotHistoryTable', () => {
  it('展示快照名称、状态和关键金额', () => {
    const item: PositionSnapshotSummary = {
      id: 1,
      snapshotDate: '2026-06-27',
      snapshotTime: '2026-06-27T15:05:00',
      snapshotName: '收盘持仓',
      sourceType: 'MANUAL',
      snapshotStatus: 'CONFIRMED',
      totalCostAmount: 1000,
      totalMarketValue: 1200,
      totalUnrealizedPnl: 200,
      totalPnlRate: 0.2,
      positionCount: 1,
      createdAt: '',
      updatedAt: '',
    };
    render(
      <PositionSnapshotHistoryTable
        items={[item]}
        loading={false}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('收盘持仓')).toBeInTheDocument();
    expect(screen.getByText('已确认')).toBeInTheDocument();
    expect(screen.getByText('20.00%')).toBeInTheDocument();
  });
});
