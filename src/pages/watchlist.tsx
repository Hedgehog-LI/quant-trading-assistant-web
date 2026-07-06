import { useState } from 'react';
import { Typography, Button, Space, Input, Select, Switch, message, Spin, Alert, Empty, Tag } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useWatchlist, useWatchlistFiltered } from '../features/watchlist/hooks/useWatchlist';
import { WatchlistTable } from '../features/watchlist/components/WatchlistTable';
import { WatchlistForm } from '../features/watchlist/components/WatchlistForm';
import type { FormValues as WatchlistFormValues } from '../features/watchlist/components/WatchlistForm';
import { TRADE_STYLE_OPTIONS } from '../features/watchlist/model/options';
import type { EntityId, WatchlistItem } from '../shared/types/domain';

export function WatchlistPage() {
  const { items, loading, error, isEmpty, apiMode, refresh, add, update, toggleEnabled, remove } =
    useWatchlist();
  const {
    filtered,
    keyword,
    setKeyword,
    tradeStyleFilter,
    setTradeStyleFilter,
    showDisabled,
    setShowDisabled,
  } = useWatchlistFiltered(items);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleEdit = (item: WatchlistItem) => {
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

  const handleSubmit = async (values: WatchlistFormValues) => {
    try {
      if (editingItem) {
        await update(editingItem.id, values as Partial<Omit<WatchlistItem, 'id' | 'createdAt' | 'updatedAt'>>);
        message.success('更新成功');
      } else {
        await add(values as Omit<WatchlistItem, 'id' | 'enabled' | 'createdAt' | 'updatedAt'>);
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
          <Typography.Title level={4} style={{ margin: 0 }}>
            自选股
          </Typography.Title>
          <Tag color={apiMode === 'remote' ? 'blue' : 'default'}>
            {apiMode === 'remote' ? '后端模式' : '本地模式'}
          </Tag>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增自选股
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索代码或名称"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          placeholder="交易风格"
          allowClear
          style={{ width: 120 }}
          value={tradeStyleFilter}
          onChange={setTradeStyleFilter}
          options={TRADE_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <Space>
          <Switch checked={showDisabled} onChange={setShowDisabled} size="small" />
          <span style={{ fontSize: 13, color: '#666' }}>显示已停用</span>
        </Space>
        <Button onClick={() => void refresh()}>刷新</Button>
      </Space>

      {error ? (
        <Alert
          type="error"
          showIcon
          title="加载失败"
          description={error}
          action={<Button size="small" onClick={() => void refresh()}>重试</Button>}
          style={{ marginBottom: 16 }}
        />
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : isEmpty ? (
        <Empty description="暂无自选股" style={{ padding: 48 }} />
      ) : (
        <WatchlistTable
          items={filtered}
          onEdit={handleEdit}
          onToggleEnabled={toggleEnabled}
          onRemove={handleRemove}
        />
      )}

      <WatchlistForm
        open={formOpen}
        editingItem={editingItem}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
