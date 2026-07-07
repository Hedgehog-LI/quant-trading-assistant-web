import { useState, useCallback, useEffect } from 'react';
import {
  Typography, Tabs, Table, Button, Space, Input, Select, DatePicker, Drawer, Form,
  Upload, Alert, Empty, Tag, message, Popconfirm,
} from 'antd';
import { PlusOutlined, UploadOutlined, ReloadOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getStocks, addStock, updateStock, deleteStock, getDailyBars, importDailyBars,
} from '../features/market-data/api/marketDataApi';
import type { StockBasic, StockDailyBar, DailyBarImportResult, EntityId } from '../shared/types/domain';

const DISCLAIMER = '行情数据用于支撑指标与回测，不构成投资建议。';

export function MarketDataPage() {
  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 8 }}>行情数据</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
        证券主数据与日 K 行情管理 · 数据来源：手工录入 / CSV 导入 · {DISCLAIMER}
      </Typography.Text>
      <Alert type="info" showIcon title={DISCLAIMER} style={{ marginBottom: 16 }} />
      <Tabs items={[
        { key: 'stocks', label: '证券主数据', children: <StocksTab /> },
        { key: 'bars', label: '日 K 数据', children: <BarsTab /> },
      ]} />
    </div>
  );
}

// ===== 证券主数据 Tab =====
function StocksTab() {
  const [data, setData] = useState<StockBasic[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filter, setFilter] = useState<{ market?: string; keyword?: string }>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StockBasic | null>(null);

  const load = useCallback(async (p: number, ps: number, f: typeof filter) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStocks(f.market, f.keyword, p, ps);
      setData(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const result = await getStocks(filter.market, filter.keyword, page, pageSize);
        if (!cancelled) { setData(result.items); setTotal(result.total); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [filter, page, pageSize]);

  const handleDelete = async (canonical: string) => {
    try {
      await deleteStock(canonical);
      message.success('已删除');
      void load(page, pageSize, filter);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  if (error) {
    return <Alert type="error" showIcon title="加载失败" description={error}
      action={<Button size="small" onClick={() => void load(page, pageSize, filter)}>重试</Button>} />;
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select allowClear placeholder="市场" style={{ width: 120 }} value={filter.market}
          onChange={(v) => { setFilter({ ...filter, market: v }); setPage(1); }}
          options={[{ value: 'SH', label: 'SH' }, { value: 'SZ', label: 'SZ' }, { value: 'BJ', label: 'BJ' }]} />
        <Input allowClear placeholder="搜索代码/名称" style={{ width: 200 }} value={filter.keyword}
          onChange={(e) => { setFilter({ ...filter, keyword: e.target.value }); setPage(1); }} />
        <Button icon={<ReloadOutlined />} onClick={() => void load(page, pageSize, filter)}>刷新</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新增证券</Button>
      </Space>
      <Table<StockBasic> size="small" rowKey="id" loading={loading}
        dataSource={data}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); void load(p, ps, filter); } }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="暂无证券主数据" /> }}
        columns={[
          { title: '代码', dataIndex: 'canonicalSymbol', width: 140 },
          { title: '名称', dataIndex: 'name', width: 120 },
          { title: '市场', dataIndex: 'market', width: 80, render: (v) => <Tag>{v}</Tag> },
          { title: '上市日期', dataIndex: 'listDate', width: 120 },
          { title: '退市', dataIndex: 'delisted', width: 80, render: (v) => (v ? <Tag color="red">退市</Tag> : '—') },
          { title: '操作', key: 'action', width: 140, render: (_, r) => (
            <Space size="small">
              <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)}>编辑</Button>
              <Popconfirm title="确认删除？" onConfirm={() => void handleDelete(r.canonicalSymbol)}>
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            </Space>
          ) },
        ]}
      />
      <StockFormDrawer open={createOpen} onClose={() => setCreateOpen(false)}
        onSubmit={async (v) => {
          await addStock(v);
          message.success('证券已添加');
          setCreateOpen(false);
          void load(page, pageSize, filter);
        }} />
      {editing && <StockEditDrawer stock={editing} onClose={() => setEditing(null)}
        onSubmit={async (id, v) => {
          await updateStock(id, v);
          message.success('证券已更新');
          setEditing(null);
          void load(page, pageSize, filter);
        }} />}
    </>
  );
}

// ===== 日 K 数据 Tab =====
function BarsTab() {
  const [data, setData] = useState<StockDailyBar[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [importResult, setImportResult] = useState<DailyBarImportResult | null>(null);
  const [filter, setFilter] = useState<{
    canonicalSymbol?: string; adjustType?: string; dataSource?: string;
    fromDate?: string; toDate?: string;
  }>({});

  const load = useCallback(async (p: number, ps: number, f: typeof filter) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDailyBars(f, p, ps);
      setData(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = async (file: File) => {
    try {
      const result = await importDailyBars(file);
      setImportResult(result);
      if (result.failed > 0) {
        message.warning(`导入存在错误：失败 ${result.failed} 行`);
      } else {
        message.success(`导入完成：新增 ${result.inserted}，更新 ${result.updated}，跳过 ${result.skipped}`);
      }
      void load(page, pageSize, filter);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导入失败');
    }
    return false;
  };

  if (error) {
    return <Alert type="error" showIcon title="加载失败" description={error}
      action={<Button size="small" onClick={() => void load(page, pageSize, filter)}>重试</Button>} />;
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input allowClear placeholder="canonical_symbol" style={{ width: 180 }}
          value={filter.canonicalSymbol ?? ''}
          onChange={(e) => setFilter({ ...filter, canonicalSymbol: e.target.value || undefined })} />
        <Select allowClear placeholder="复权" style={{ width: 120 }}
          value={filter.adjustType}
          onChange={(v) => setFilter({ ...filter, adjustType: v })}
          options={[{ value: 'NONE', label: '不复权' }, { value: 'QF', label: '前复权' }, { value: 'HF', label: '后复权' }]} />
        <Select allowClear placeholder="来源" style={{ width: 120 }}
          value={filter.dataSource}
          onChange={(v) => setFilter({ ...filter, dataSource: v })}
          options={[{ value: 'CSV', label: 'CSV' }, { value: 'MANUAL', label: '手工' }]} />
        <DatePicker placeholder="起始" value={filter.fromDate ? dayjs(filter.fromDate) : null}
          onChange={(d) => setFilter({ ...filter, fromDate: d?.format('YYYY-MM-DD') })} />
        <DatePicker placeholder="截止" value={filter.toDate ? dayjs(filter.toDate) : null}
          onChange={(d) => setFilter({ ...filter, toDate: d?.format('YYYY-MM-DD') })} />
        <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); void load(1, pageSize, filter); }}>查询</Button>
        <Upload accept=".csv" showUploadList={false} beforeUpload={handleImport}>
          <Button icon={<UploadOutlined />}>导入 CSV</Button>
        </Upload>
        <Button icon={<DownloadOutlined />} onClick={() => {
          const csvData = 'canonical_symbol,trade_date,open,high,low,close,volume,amount,adjust_type\nSH.600519,2026-07-01,1680.00,1695.00,1678.00,1690.00,25000,42250000.00,NONE\n';
          const blob = new Blob([csvData], { type: 'text/csv' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'daily-bar-template.csv';
          a.click();
        }}>下载模板</Button>
      </Space>
      {importResult && (
        <Alert
          type={importResult.failed > 0 ? 'warning' : 'success'}
          showIcon
          style={{ marginBottom: 16 }}
          title={`新增 ${importResult.inserted} / 更新 ${importResult.updated} / 跳过 ${importResult.skipped} / 失败 ${importResult.failed}`}
          description={importResult.errors.length > 0
            ? importResult.errors.slice(0, 5).map((e) => `第 ${e.row} 行: ${e.message}`).join('；')
            : '导入成功'}
        />
      )}
      <Table<StockDailyBar> size="small" rowKey="id" loading={loading}
        dataSource={data}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); void load(p, ps, filter); } }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="暂无日 K 数据，请导入 CSV 或查询" /> }}
        columns={[
          { title: '代码', dataIndex: 'canonicalSymbol', width: 140 },
          { title: '日期', dataIndex: 'tradeDate', width: 120 },
          { title: '开盘', dataIndex: 'openPrice', width: 100, render: (v: number) => v?.toFixed(2) },
          { title: '最高', dataIndex: 'highPrice', width: 100, render: (v: number) => v?.toFixed(2) },
          { title: '最低', dataIndex: 'lowPrice', width: 100, render: (v: number) => v?.toFixed(2) },
          { title: '收盘', dataIndex: 'closePrice', width: 100, render: (v: number) => v?.toFixed(2) },
          { title: '成交量', dataIndex: 'volume', width: 100 },
          { title: '复权', dataIndex: 'adjustType', width: 80, render: (v) => <Tag>{v}</Tag> },
          { title: '来源', dataIndex: 'dataSource', width: 80, render: (v) => <Tag color="blue">{v}</Tag> },
          ...(data.some((d) => d.fetchedAt) ? [{
            title: '抓取时间', dataIndex: 'fetchedAt', width: 160,
            render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '—',
          }] : []),
        ]}
      />
    </>
  );
}

// ===== 新增 Drawer =====
function StockFormDrawer({ open, onClose, onSubmit }: {
  open: boolean; onClose: () => void;
  onSubmit: (v: { symbol: string; market: string; name?: string }) => Promise<void>;
}) {
  const [form] = Form.useForm<{ symbol: string; market: string; name?: string }>();
  return (
    <Drawer title="新增证券" open={open} onClose={() => { form.resetFields(); onClose(); }} size={420} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={async (v) => { await onSubmit(v); form.resetFields(); }}>
        <Form.Item name="market" label="市场" rules={[{ required: true }]}>
          <Select options={[{ value: 'SH', label: 'SH 上海' }, { value: 'SZ', label: 'SZ 深圳' }, { value: 'BJ', label: 'BJ 北京' }]} />
        </Form.Item>
        <Form.Item name="symbol" label="证券代码" rules={[{ required: true, message: '请输入 4-6 位数字代码' }]}>
          <Input placeholder="如 600519" maxLength={6} />
        </Form.Item>
        <Form.Item name="name" label="证券名称"><Input placeholder="如 贵州茅台" /></Form.Item>
        <Button type="primary" htmlType="submit">保存</Button>
      </Form>
    </Drawer>
  );
}

// ===== 编辑 Drawer =====
function StockEditDrawer({ stock, onClose, onSubmit }: {
  stock: StockBasic;
  onClose: () => void;
  onSubmit: (id: EntityId, v: { name?: string; listDate?: string; delisted?: boolean }) => Promise<void>;
}) {
  const [form] = Form.useForm();
  useEffect(() => {
    form.setFieldsValue({
      name: stock.name,
      listDate: stock.listDate,
      delisted: stock.delisted,
    });
  }, [stock, form]);

  return (
    <Drawer title={`编辑证券 ${stock.canonicalSymbol}`} open onClose={onClose} size={420} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={async (v) => { await onSubmit(stock.id, v); }}>
        <Form.Item name="name" label="证券名称"><Input placeholder="如 贵州茅台" /></Form.Item>
        <Form.Item name="listDate" label="上市日期"><Input type="date" /></Form.Item>
        <Form.Item name="delisted" label="是否退市">
          <Select options={[{ value: false, label: '否' }, { value: true, label: '是' }]} />
        </Form.Item>
        <Button type="primary" htmlType="submit">保存</Button>
      </Form>
    </Drawer>
  );
}
