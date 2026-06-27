import { useState } from 'react';
import {
  Alert,
  Button,
  DatePicker,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { usePositionSnapshots } from '../features/position-snapshot/hooks/usePositionSnapshots';
import { PositionSnapshotLatest } from '../features/position-snapshot/components/PositionSnapshotLatest';
import { PositionSnapshotHistoryTable } from '../features/position-snapshot/components/PositionSnapshotHistoryTable';
import { PositionSnapshotDetailDrawer } from '../features/position-snapshot/components/PositionSnapshotDetailDrawer';
import {
  PositionSnapshotFormDrawer,
  type PositionSnapshotFormValues,
} from '../features/position-snapshot/components/PositionSnapshotFormDrawer';
import { SNAPSHOT_STATUS_OPTIONS } from '../features/position-snapshot/model/meta';
import type {
  PositionSnapshotDetail,
  SnapshotStatus,
} from '../features/position-snapshot/model/types';
import '../features/position-snapshot/components/positionSnapshot.css';

const { RangePicker } = DatePicker;

export function PositionSnapshotPage() {
  const {
    items,
    latest,
    filters,
    loading,
    error,
    apiMode,
    setFilters,
    refresh,
    create,
    update,
    confirm,
    cancel,
    getById,
  } = usePositionSnapshots();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<PositionSnapshotDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<PositionSnapshotDetail | null>(null);

  const openCreate = () => {
    setEditingSnapshot(null);
    setFormOpen(true);
  };

  const openDetail = async (id: string | number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      setDetail(await getById(id));
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载详情失败');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = async (id: string | number) => {
    try {
      const snapshot = await getById(id);
      setEditingSnapshot(snapshot);
      setDetailOpen(false);
      setFormOpen(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载草稿失败');
    }
  };

  const handleSubmit = async (
    values: PositionSnapshotFormValues,
    targetStatus: 'DRAFT' | 'CONFIRMED',
  ) => {
    if (editingSnapshot) {
      const updated = await update(editingSnapshot.id, values);
      if (targetStatus === 'CONFIRMED') {
        await confirm(updated.id);
        message.success('持仓快照已更新并确认');
      } else {
        message.success('持仓快照草稿已更新');
      }
    } else {
      await create({ ...values, sourceType: 'MANUAL', snapshotStatus: targetStatus });
      message.success(targetStatus === 'CONFIRMED' ? '持仓快照已确认入库' : '持仓快照草稿已保存');
    }
    setFormOpen(false);
    setEditingSnapshot(null);
  };

  const handleConfirm = async (id: string | number) => {
    try {
      const result = await confirm(id);
      if (detail?.id === id) setDetail(result);
      message.success('持仓快照已确认');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '确认失败');
    }
  };

  const handleCancel = async (id: string | number) => {
    try {
      const result = await cancel(id);
      if (detail?.id === id) setDetail(result);
      message.success('持仓快照已作废');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '作废失败');
    }
  };

  const rangeValue = filters.fromDate && filters.toDate
    ? [dayjs(filters.fromDate), dayjs(filters.toDate)] as [dayjs.Dayjs, dayjs.Dayjs]
    : null;

  return (
    <div>
      <div className="position-snapshot-page-header">
        <div>
          <Space align="center">
            <Typography.Title level={4} style={{ margin: 0 }}>持仓快照</Typography.Title>
            <Tag color={apiMode === 'remote' ? 'blue' : 'default'}>
              {apiMode === 'remote' ? '后端模式' : '本地模式'}
            </Tag>
          </Space>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建快照</Button>
      </div>

      <Alert
        type="warning"
        showIcon
        title="持仓快照由用户手工盘点，不连接券商；盈亏仅用于记录和复盘，不构成投资建议。"
        style={{ margin: '12px 0 16px' }}
      />

      <Alert
        type="info"
        showIcon
        title={apiMode === 'remote' ? '当前数据写入后端数据库' : '当前数据仅保存在本浏览器'}
        description={apiMode === 'remote'
          ? '新增、编辑、确认、作废和历史查询均通过 REST API 操作后端数据。'
          : '本地数据不会自动同步到后端；切换数据模式后将看到另一套独立数据。'}
        style={{ marginBottom: 16 }}
      />

      {error && (
        <Alert
          type="error"
          showIcon
          title="持仓快照加载失败"
          description={error}
          action={<Button size="small" onClick={() => void refresh()}>重试</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      <PositionSnapshotLatest
        snapshot={latest}
        onView={(id) => void openDetail(id)}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <Typography.Title level={5} style={{ margin: 0 }}>历史快照</Typography.Title>
      <div className="position-snapshot-filters">
        <RangePicker
          value={rangeValue}
          onChange={(dates) => setFilters({
            ...filters,
            fromDate: dates?.[0]?.format('YYYY-MM-DD'),
            toDate: dates?.[1]?.format('YYYY-MM-DD'),
          })}
        />
        <Select<SnapshotStatus>
          allowClear
          placeholder="全部状态"
          value={filters.status}
          options={SNAPSHOT_STATUS_OPTIONS}
          style={{ width: 120 }}
          onChange={(status) => setFilters({ ...filters, status })}
        />
        <Space size={6}>
          <Switch
            size="small"
            checked={filters.includeCanceled}
            onChange={(includeCanceled) => setFilters({ ...filters, includeCanceled })}
          />
          <Typography.Text>包含已作废</Typography.Text>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => void refresh()}>刷新</Button>
      </div>

      <PositionSnapshotHistoryTable
        items={items}
        loading={loading}
        onView={(id) => void openDetail(id)}
        onEdit={(id) => void openEdit(id)}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <PositionSnapshotFormDrawer
        open={formOpen}
        editingSnapshot={editingSnapshot}
        onClose={() => { setFormOpen(false); setEditingSnapshot(null); }}
        onSubmit={handleSubmit}
      />
      <PositionSnapshotDetailDrawer
        open={detailOpen}
        snapshot={detail}
        loading={detailLoading}
        onClose={() => { setDetailOpen(false); setDetail(null); }}
        onEdit={(snapshot) => { setEditingSnapshot(snapshot); setDetailOpen(false); setFormOpen(true); }}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
