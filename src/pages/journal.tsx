import { useState } from 'react';
import { Typography, Button, Space, Input, DatePicker, Select, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTradeJournal, useTradeJournalFiltered } from '../features/journal/hooks/useTradeJournal';
import { TradeJournalTable } from '../features/journal/components/TradeJournalTable';
import { TradeJournalForm } from '../features/journal/components/TradeJournalForm';
import type { FormValues as JournalFormValues } from '../features/journal/components/TradeJournalForm';
import { REVIEW_STATUS_OPTIONS } from '../features/journal/model/options';
import type { TradeJournal } from '../shared/types/domain';

export function JournalPage() {
  const { items, add, update } = useTradeJournal();
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

  const handleSubmit = (values: JournalFormValues) => {
    try {
      if (editingItem) {
        update(editingItem.id, values as Partial<Omit<TradeJournal, 'id' | 'createdAt' | 'updatedAt'>>);
        message.success('更新成功');
      } else {
        add(values as Omit<TradeJournal, 'id' | 'amount' | 'reviewStatus' | 'createdAt' | 'updatedAt'>);
        message.success('新增成功');
      }
      setFormOpen(false);
      setEditingItem(null);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>交易记录</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          记录交易
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
        <Select
          placeholder="复盘状态"
          allowClear
          style={{ width: 120 }}
          value={reviewStatusFilter}
          onChange={setReviewStatusFilter}
          options={REVIEW_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </Space>

      <TradeJournalTable items={filtered} onEdit={handleEdit} />

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
