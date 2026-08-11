/**
 * 采集计划表格与列定义。
 * 纯结构拆分：从 src/pages/market-workspace.tsx 的 PlansTab 移出，行为不变。
 */
import { Button, Popconfirm, Space, Table, Tag } from 'antd';
import type { TableProps } from 'antd';
import { EditOutlined, LineChartOutlined } from '@ant-design/icons';
import { planToAssetViewerParams } from '../../market-assets/utils/assetViewerLink';
import type { AssetViewerParams } from '../../market-assets/utils/assetViewerLink';
import { fallbackConfigurationErrors } from '../utils/syncPlanForm';
import type { EntityId, MarketDataSyncPlan } from '../../../shared/types/domain';

export function PlanTable({ data, page, pageSize, total, loading, remoteMode, runningIds, onPageChange, onRun, onEdit, onToggle, onShowItems, onView }: {
  data: MarketDataSyncPlan[];
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  remoteMode: boolean;
  runningIds: Set<string>;
  onPageChange: (page: number) => void;
  onRun: (plan: MarketDataSyncPlan) => void;
  onEdit: (plan: MarketDataSyncPlan) => void;
  onToggle: (id: EntityId, enabled: boolean) => void;
  onShowItems: (plan: MarketDataSyncPlan) => void;
  onView: (params: AssetViewerParams) => void;
}) {
  return (
    <Table<MarketDataSyncPlan>
      size="small" rowKey="id" loading={loading}
      dataSource={data}
      pagination={{ current: page, pageSize, total, onChange: onPageChange }}
      columns={planTableColumns({ remoteMode, runningIds, onRun, onEdit, onToggle, onShowItems, onView })}
    />
  );
}

function planTableColumns(params: {
  remoteMode: boolean;
  runningIds: Set<string>;
  onRun: (plan: MarketDataSyncPlan) => void;
  onEdit: (plan: MarketDataSyncPlan) => void;
  onToggle: (id: EntityId, enabled: boolean) => void;
  onShowItems: (plan: MarketDataSyncPlan) => void;
  onView: (params: AssetViewerParams) => void;
}): NonNullable<TableProps<MarketDataSyncPlan>['columns']> {
  const { remoteMode, runningIds, onRun, onEdit, onToggle, onShowItems, onView } = params;
  return [
    { title: '名称', dataIndex: 'planName', width: 160 },
    { title: '任务类型', dataIndex: 'taskType', width: 160 },
    { title: 'Provider', dataIndex: 'provider', width: 100 },
    { title: '粒度', dataIndex: 'intervalType', width: 80 },
    { title: '触发', dataIndex: 'triggerType', width: 100 },
    { title: '复权', dataIndex: 'adjustType', width: 80 },
    {
      title: '配置 / 启用', width: 150,
      render: (_, r) => {
        const errors = fallbackConfigurationErrors(r);
        return <Space size={4} wrap>
          <Tag color={errors.length ? 'red' : 'green'} title={errors.join('；')}>{errors.length ? '需要修正' : '配置完整'}</Tag>
          <Tag color={r.enabled ? 'blue' : 'default'}>{r.enabled ? '已启用' : '已停用'}</Tag>
        </Space>;
      },
    },
    { title: '最后运行', dataIndex: 'lastRunAt', width: 160 },
    {
      title: '操作', width: 360,
      render: (_, r) => {
        const errors = fallbackConfigurationErrors(r);
        const pending = runningIds.has(String(r.id));
        const viewerParams = planToAssetViewerParams(r);
        return (
        <Space size={4} wrap>
          <Button size="small" type="link" icon={<LineChartOutlined />} data-testid={`plan-view-${r.id}`}
            disabled={viewerParams == null}
            onClick={() => { if (viewerParams) onView(viewerParams); }}>查看数据</Button>
          <Button size="small" type="link" loading={pending} disabled={!remoteMode || pending || errors.length > 0 || !r.manuallyRunnable}
            onClick={() => onRun(r)}>立即执行</Button>
          {r.lastTaskId != null && (
            <Button size="small" type="link" onClick={() => onShowItems(r)}>任务明细</Button>
          )}
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => onEdit(r)}>修正</Button>
          <Popconfirm title={r.enabled ? '确定停用？' : '确定启用？'} onConfirm={() => onToggle(r.id, !r.enabled)}>
            <Button size="small" type="link" disabled={!r.enabled && errors.length > 0}>{r.enabled ? '停用' : '启用'}</Button>
          </Popconfirm>
        </Space>
        );
      },
    },
  ];
}
