import { useState } from 'react';
import { Typography, Button, Space, Input, DatePicker, message, Spin, Alert, Tag } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useReview, useReviewFiltered } from '../features/review/hooks/useReview';
import { ReviewTable } from '../features/review/components/ReviewTable';
import { ReviewForm } from '../features/review/components/ReviewForm';
import type { FormValues as ReviewFormValues } from '../features/review/components/ReviewForm';
import type { EntityId, ReviewNote } from '../shared/types/domain';

export function ReviewPage() {
  const { items, add, update, remove, loading, error, isEmpty, apiMode } = useReview();
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

  const handleRemove = async (id: EntityId) => {
    try {
      await remove(id);
      message.success('已删除');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleSubmit = async (values: ReviewFormValues) => {
    try {
      if (editingItem) {
        await update(editingItem.id, values as Partial<Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>>);
        message.success('更新成功');
      } else {
        await add(values as Omit<ReviewNote, 'id' | 'createdAt' | 'updatedAt'>);
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
        <Space align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>盘后复盘</Typography.Title>
          <Tag color={apiMode === 'remote' ? 'blue' : 'default'}>
            {apiMode === 'remote' ? '后端模式' : '本地模式'}
          </Tag>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={loading}>
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

      {error && (
        <Alert
          type="error"
          showIcon
          title="加载失败"
          description={error}
          action={<Button size="small" onClick={() => location.reload()}>重试</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading}>
        <ReviewTable items={filtered} onEdit={handleEdit} onRemove={handleRemove} />
        {isEmpty && !error && (
          <div style={{ textAlign: 'center', color: '#999', marginTop: 16 }}>
            暂无复盘记录，点击右上角「写复盘」开始记录
          </div>
        )}
      </Spin>

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
