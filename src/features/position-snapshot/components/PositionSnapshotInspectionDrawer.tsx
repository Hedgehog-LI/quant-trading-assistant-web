/**
 * 持仓快照对比与账本对账抽屉（v0.1.1 功能三 + 功能四）。
 *
 * - 对比：选两个已确认快照，展示变化类型、数量与金额 delta。
 * - 对账：选一个已确认快照，与截止时点 FIFO 账本数量对账。
 *
 * 盈亏颜色按 A 股习惯（盈利红、亏损绿）；结果仅用于复盘，不构成投资建议。
 * 对账只读，不会自动修改交易流水。
 */
import { useState } from 'react';
import { Alert, Button, Drawer, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { positionSnapshotApi } from '../api/positionSnapshotApi';
import type { PositionSnapshotSummary } from '../model/types';
import type {
  PositionSnapshotComparison,
  PositionSnapshotComparisonItem,
  PositionSnapshotReconciliation,
  PositionSnapshotReconciliationItem,
  ReconciliationStatus,
  SnapshotChangeType,
} from '../../../shared/types/domain';

const CHANGE_TYPE_LABEL: Record<SnapshotChangeType, { text: string; color: string }> = {
  NEW: { text: '新增', color: 'green' },
  INCREASED: { text: '加仓', color: 'red' },
  REDUCED: { text: '减仓', color: 'green' },
  CLOSED: { text: '清仓', color: 'default' },
  UNCHANGED: { text: '未变化', color: 'default' },
};

const RECONCILE_LABEL: Record<ReconciliationStatus, { text: string; color: string }> = {
  MATCHED: { text: '一致', color: 'green' },
  QUANTITY_MISMATCH: { text: '数量不一致', color: 'red' },
  SNAPSHOT_ONLY: { text: '仅快照有', color: 'orange' },
  LEDGER_ONLY: { text: '仅账本有', color: 'orange' },
};

function pnlColor(value: number): string {
  if (value > 0) return '#c0392b'; // 盈利红
  if (value < 0) return '#27ae60'; // 亏损绿
  return '#666';
}

interface Props {
  open: boolean;
  confirmedSnapshots: PositionSnapshotSummary[];
  onClose: () => void;
}

export function PositionSnapshotInspectionDrawer({ open, confirmedSnapshots, onClose }: Props) {
  const [baseId, setBaseId] = useState<string | undefined>();
  const [targetId, setTargetId] = useState<string | undefined>();
  const [reconcileId, setReconcileId] = useState<string | undefined>();
  const [comparison, setComparison] = useState<PositionSnapshotComparison | null>(null);
  const [reconciliation, setReconciliation] = useState<PositionSnapshotReconciliation | null>(null);
  const [loading, setLoading] = useState(false);

  const options = confirmedSnapshots.map((s) => ({
    value: String(s.id),
    label: `${s.snapshotDate}${s.snapshotName ? ' ' + s.snapshotName : ''} · ${s.snapshotStatus}`,
  }));

  const handleCompare = async () => {
    if (!baseId || !targetId) {
      message.warning('请选择基准与目标快照');
      return;
    }
    setLoading(true);
    try {
      setComparison(await positionSnapshotApi.compare(baseId, targetId));
    } catch (e) {
      message.error(e instanceof Error ? e.message : '对比失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!reconcileId) {
      message.warning('请选择要对账的快照');
      return;
    }
    setLoading(true);
    try {
      setReconciliation(await positionSnapshotApi.reconcile(reconcileId));
    } catch (e) {
      message.error(e instanceof Error ? e.message : '对账失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} size={760} title="快照对比与账本对账" destroyOnClose>
      <Alert
        type="warning"
        showIcon
        title="对比与对账结果仅用于复盘参考，不构成投资建议；对账只读，不会自动修改交易流水。"
        style={{ marginBottom: 12 }}
      />
      <Tabs
        items={[
          {
            key: 'compare',
            label: '快照对比',
            children: (
              <>
                <Space style={{ marginBottom: 12 }} wrap>
                  <Select
                    value={baseId}
                    onChange={setBaseId}
                    placeholder="基准快照（较早）"
                    options={options}
                    style={{ width: 240 }}
                    allowClear
                  />
                  <Select
                    value={targetId}
                    onChange={setTargetId}
                    placeholder="目标快照（较晚）"
                    options={options}
                    style={{ width: 240 }}
                    allowClear
                  />
                  <Button loading={loading} onClick={() => void handleCompare()}>
                    比较
                  </Button>
                </Space>
                {options.length < 2 && (
                  <Typography.Text type="secondary">至少需要 2 个已确认快照才能对比。</Typography.Text>
                )}
                {comparison && (
                  <>
                    <Typography.Paragraph>
                      总成本变化 <b>{comparison.totalCostDelta.toFixed(2)}</b> · {' '}
                      总市值变化 <b>{comparison.totalMarketValueDelta.toFixed(2)}</b> · {' '}
                      总浮盈亏变化{' '}
                      <b style={{ color: pnlColor(comparison.totalUnrealizedPnlDelta) }}>
                        {comparison.totalUnrealizedPnlDelta.toFixed(2)}
                      </b>{' '}
                      · 持仓数变化 <b>{comparison.positionCountDelta}</b>
                    </Typography.Paragraph>
                    <Table<PositionSnapshotComparisonItem>
                      size="small"
                      rowKey="symbol"
                      pagination={false}
                      dataSource={comparison.items}
                      columns={[
                        { title: '代码', dataIndex: 'symbol' },
                        { title: '名称', dataIndex: 'name' },
                        {
                          title: '变化',
                          dataIndex: 'changeType',
                          render: (t: SnapshotChangeType) => (
                            <Tag color={CHANGE_TYPE_LABEL[t].color}>{CHANGE_TYPE_LABEL[t].text}</Tag>
                          ),
                        },
                        { title: '基准数量', dataIndex: 'baseQuantity' },
                        { title: '目标数量', dataIndex: 'targetQuantity' },
                        { title: '数量变化', dataIndex: 'quantityDelta' },
                        {
                          title: '市值变化',
                          dataIndex: 'marketValueDelta',
                          render: (v: number) => (
                            <span style={{ color: pnlColor(v) }}>{v.toFixed(2)}</span>
                          ),
                        },
                      ]}
                    />
                  </>
                )}
              </>
            ),
          },
          {
            key: 'reconcile',
            label: '账本对账',
            children: (
              <>
                <Space style={{ marginBottom: 12 }} wrap>
                  <Select
                    value={reconcileId}
                    onChange={setReconcileId}
                    placeholder="选择已确认快照"
                    options={options}
                    style={{ width: 300 }}
                    allowClear
                  />
                  <Button loading={loading} onClick={() => void handleReconcile()}>
                    对账
                  </Button>
                </Space>
                {reconciliation && (
                  <>
                    {reconciliation.warnings.map((w, idx) => (
                      <Alert key={idx} type="warning" showIcon title={w} style={{ marginBottom: 8 }} />
                    ))}
                    <Alert
                      type={reconciliation.hasMismatch ? 'error' : 'success'}
                      showIcon
                      style={{ marginBottom: 12 }}
                      title={
                        reconciliation.hasMismatch
                          ? `发现 ${reconciliation.mismatchCount} 项不一致（共 ${reconciliation.items.length} 项）`
                          : `全部 ${reconciliation.matchedCount} 项数量一致`
                      }
                      description="以数量为核心一致性判断；成本差异只展示不判错。券商成本与 FIFO 理论成本可能因费用、分红送转等原因不同。"
                    />
                    <Table<PositionSnapshotReconciliationItem>
                      size="small"
                      rowKey="symbol"
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      dataSource={reconciliation.items}
                      columns={[
                        { title: '代码', dataIndex: 'symbol', width: 90, fixed: 'left' },
                        { title: '名称', dataIndex: 'name', width: 100 },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          width: 110,
                          render: (s: ReconciliationStatus) => (
                            <Tag color={RECONCILE_LABEL[s].color}>{RECONCILE_LABEL[s].text}</Tag>
                          ),
                        },
                        { title: '快照数量', dataIndex: 'snapshotQuantity', width: 90 },
                        { title: '账本数量', dataIndex: 'ledgerQuantity', width: 90 },
                        { title: '数量差异', dataIndex: 'quantityDifference', width: 90 },
                        {
                          title: '快照成本价',
                          dataIndex: 'snapshotCostPrice',
                          width: 110,
                          render: (v: number | undefined) =>
                            v === undefined || v === null ? '—' : v.toFixed(4),
                        },
                        {
                          title: '账本平均成本',
                          dataIndex: 'ledgerAverageCost',
                          width: 120,
                          render: (v: number | undefined) =>
                            v === undefined || v === null ? '—' : v.toFixed(4),
                        },
                        {
                          title: '成本差异',
                          key: 'costDiff',
                          width: 110,
                          render: (_: unknown, r: PositionSnapshotReconciliationItem) =>
                            r.snapshotCostPrice === undefined ||
                            r.snapshotCostPrice === null ||
                            r.ledgerAverageCost === undefined ||
                            r.ledgerAverageCost === null
                              ? '—'
                              : (r.snapshotCostPrice - r.ledgerAverageCost).toFixed(4),
                        },
                      ]}
                    />
                  </>
                )}
              </>
            ),
          },
        ]}
      />
    </Drawer>
  );
}
