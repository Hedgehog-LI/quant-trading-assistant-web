import { useState } from 'react';
import { Typography, Button, Space, Input, DatePicker, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTradePlan, useTradePlanFiltered } from '../features/tradeplan/hooks/useTradePlan';
import { TradePlanTable } from '../features/tradeplan/components/TradePlanTable';
import { TradePlanForm } from '../features/tradeplan/components/TradePlanForm';
import type { FormValues as TradePlanFormValues } from '../features/tradeplan/components/TradePlanForm';
import type { EntityId, PlanStatus, TradePlan } from '../shared/types/domain';

export function TradePlanPage() {
  const { items, loading, error, isEmpty, add, update, updateStatus, remove } = useTradePlan();
  const { filtered, dateFilter, setDateFilter, symbolFilter, setSymbolFilter } = useTradePlanFiltered(items);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TradePlan | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleEdit = (item: TradePlan) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleSubmit = async (values: TradePlanFormValues) => {
    // 校验：allowedToTrade=true 时必须填 buyCondition、stopLossPrice、plannedPositionRatio
    if (values.allowedToTrade) {
      if (!values.buyCondition) {
        message.error('允许交易时必须填写买入条件');
        return;
      }
      if (!values.stopLossPrice) {
        message.error('允许交易时必须填写止损价');
        return;
      }
      if (!values.plannedPositionRatio && values.plannedPositionRatio !== 0) {
        message.error('允许交易时必须填写计划仓位比例');
        return;
      }
    }
    // 校验：takeProfitPrice > stopLossPrice
    if (values.takeProfitPrice && values.stopLossPrice && Number(values.takeProfitPrice) <= Number(values.stopLossPrice)) {
      message.error('止盈价必须大于止损价');
      return;
    }
    setSubmitting(true);
    try {
      if (editingItem) {
        await update(editingItem.id, values as Partial<Omit<TradePlan, 'id' | 'createdAt' | 'updatedAt'>>);
        message.success('更新成功');
      } else {
        await add(values as Omit<TradePlan, 'id' | 'createdAt' | 'updatedAt'>);
        message.success('新增成功');
      }
      setFormOpen(false);
      setEditingItem(null);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: EntityId, planStatus: PlanStatus) => {
    try {
      await updateStatus(id, planStatus);
      message.success('状态已更新');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleRemove = async (id: EntityId) => {
    try {
      await remove(id);
      message.success('已删除');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>盘前计划</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增计划
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <DatePicker
          placeholder="按日期筛选"
          value={dateFilter ? dayjs(dateFilter) : null}
          onChange={(d) => setDateFilter(d ? d.format('YYYY-MM-DD') : '')}
        />
        <Input
          placeholder="搜索代码或名称"
          prefix={<SearchOutlined />}
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
      </Space>

      <TradePlanTable
        items={filtered}
        loading={loading}
        error={error}
        isEmpty={isEmpty}
        onEdit={handleEdit}
        onUpdateStatus={handleUpdateStatus}
        onRemove={handleRemove}
      />

      <TradePlanForm
        open={formOpen}
        editingItem={editingItem}
        onClose={() => { setFormOpen(false); setEditingItem(null); }}
        onSubmit={handleSubmit}
        submitting={submitting}
        defaultDate={dateFilter}
      />
    </div>
  );
}
