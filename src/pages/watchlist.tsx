import { useState } from 'react';
import { Typography, Button, Space, Input, Select, Switch, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useWatchlist, useWatchlistFiltered } from '../features/watchlist/hooks/useWatchlist';
import { WatchlistTable } from '../features/watchlist/components/WatchlistTable';
import { WatchlistForm } from '../features/watchlist/components/WatchlistForm';
import type { FormValues as WatchlistFormValues } from '../features/watchlist/components/WatchlistForm';
import { TRADE_STYLE_OPTIONS } from '../features/watchlist/model/options';
import type { WatchlistItem } from '../shared/types/domain';

export function WatchlistPage() {
  const { items, add, update, toggleEnabled } = useWatchlist();
  const { filtered, keyword, setKeyword, tradeStyleFilter, setTradeStyleFilter, showDisabled, setShowDisabled } = useWatchlistFiltered(items);

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

  const handleSubmit = (values: WatchlistFormValues) => {
    try {
      if (editingItem) {
        update(editingItem.id, values as Partial<Omit<WatchlistItem, 'id' | 'createdAt' | 'updatedAt'>>);
        message.success('更新成功');
      } else {
        add(values as Omit<WatchlistItem, 'id' | 'enabled' | 'createdAt' | 'updatedAt'>);
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
        <Typography.Title level={4} style={{ margin: 0 }}>自选股</Typography.Title>
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
      </Space>

      <WatchlistTable items={filtered} onEdit={handleEdit} onToggleEnabled={toggleEnabled} />

      <WatchlistForm
        open={formOpen}
        editingItem={editingItem}
        onClose={() => { setFormOpen(false); setEditingItem(null); }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
