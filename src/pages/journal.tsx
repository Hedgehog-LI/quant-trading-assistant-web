import { useState } from 'react';
import { Typography, Button, Space, Input, DatePicker, Select, message, Spin, Alert, Empty, Tag } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTradeJournal, useTradeJournalFiltered } from '../features/journal/hooks/useTradeJournal';
import { TradeJournalTable } from '../features/journal/components/TradeJournalTable';
import { TradeJournalForm } from '../features/journal/components/TradeJournalForm';
import type { FormValues as JournalFormValues } from '../features/journal/components/TradeJournalForm';
import { REVIEW_STATUS_OPTIONS } from '../features/journal/model/options';
import type { EntityId, TradeJournal } from '../shared/types/domain';

export function JournalPage() {
  const { items, loading, error, isEmpty, apiMode, refresh, add, update, remove } = useTradeJournal();
  const { filtered, dateFilter, setDateFilter, symbolFilter, setSymbolFilter, reviewStatusFilter, setReviewStatusFilter } = useTradeJournalFiltered(items);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TradeJournal | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleEdit = (item: TradeJournal) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleRemove = async (id: EntityId) => {
    try {
      await remove(id);
      message.success('已删除');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  // 表单提交：失败抛回 TradeJournalForm 由其 message.error 提示；成功后关闭 Drawer。
  const handleSubmit = async (values: JournalFormValues) => {
    if (editingItem) {
      await update(editingItem.id, values as Partial<Omit<TradeJournal, 'id' | 'createdAt' | 'updatedAt'>>);
      message.success('更新成功');
    } else {
      await add(values as Omit<TradeJournal, 'id' | 'amount' | 'reviewStatus' | 'createdAt' | 'updatedAt'>);
      message.success('新增成功');
    }
    setFormOpen(false);
    setEditingItem(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>交易记录</Typography.Title>
          <Tag color={apiMode === 'remote' ? 'blue' : 'default'}>
            {apiMode === 'remote' ? '后端模式' : '本地模式'}
          </Tag>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void refresh()}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            记录交易
          </Button>
        </Space>
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
        <Select
          placeholder="复盘状态"
          allowClear
          style={{ width: 120 }}
          value={reviewStatusFilter}
          onChange={setReviewStatusFilter}
          options={REVIEW_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={error}
          action={<Button size="small" onClick={() => void refresh()}>重试</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin tip="加载中..." />
        </div>
      ) : isEmpty ? (
        <Empty description="暂无交易记录" style={{ padding: 48 }} />
      ) : (
        <TradeJournalTable items={filtered} onEdit={handleEdit} onRemove={handleRemove} />
      )}

      <TradeJournalForm
        open={formOpen}
        editingItem={editingItem}
        onClose={() => { setFormOpen(false); setEditingItem(null); }}
        onSubmit={handleSubmit}
        defaultDate={dateFilter}
      />
    </div>
  );
}
