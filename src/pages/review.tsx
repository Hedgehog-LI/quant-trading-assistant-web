import { useState } from 'react';
import { Typography, Button, Space, Input, DatePicker, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useReview, useReviewFiltered } from '../features/review/hooks/useReview';
import { ReviewTable } from '../features/review/components/ReviewTable';
import { ReviewForm } from '../features/review/components/ReviewForm';
import type { FormValues as ReviewFormValues } from '../features/review/components/ReviewForm';
import type { ReviewNote } from '../shared/types/domain';

export function ReviewPage() {
  const { items, add, update } = useReview();
  const { filtered, dateFilter, setDateFilter, symbolFilter, setSymbolFilter } = useReviewFiltered(items);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReviewNote | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleEdit = (item: ReviewNote) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleSubmit = (values: ReviewFormValues) => {
    try {
      if (editingItem) {
        update(editingItem.id, values as Partial<Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>>);
        message.success('更新成功');
      } else {
        add(values as Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>);
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
        <Typography.Title level={4} style={{ margin: 0 }}>盘后复盘</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          写复盘
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <DatePicker
          placeholder="按日期筛选"
          value={dateFilter ? dayjs(dateFilter) : null}
          onChange={(d) => setDateFilter(d ? d.format('YYYY-MM-DD') : '')}
        />
        <Input
          placeholder="搜索代码或标题"
          prefix={<SearchOutlined />}
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
      </Space>

      <ReviewTable items={filtered} onEdit={handleEdit} />

      <ReviewForm
        open={formOpen}
        editingItem={editingItem}
        onClose={() => { setFormOpen(false); setEditingItem(null); }}
        onSubmit={handleSubmit}
        defaultDate={dateFilter}
      />
    </div>
  );
}
