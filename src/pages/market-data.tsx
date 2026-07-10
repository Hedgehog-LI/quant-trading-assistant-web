import { useState, useCallback, useEffect } from 'react';
import {
  Typography, Tabs, Table, Button, Space, Input, Select, DatePicker, Drawer, Form,
  Upload, Alert, Empty, Tag, message, Popconfirm, Spin,
} from 'antd';
import { PlusOutlined, UploadOutlined, ReloadOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getStocks, addStock, updateStock, deleteStock, getDailyBars, importDailyBars,
  getProviderStatus, healthCheck, getSyncTasks,
  getAlerts, resolveAlert, createDailyBarSync,
} from '../features/market-data/api/marketDataApi';
import type { StockBasic, StockDailyBar, DailyBarImportResult, EntityId,
  ProviderStatus, MarketDataSyncTask, MarketDataAlert } from '../shared/types/domain';

const DISCLAIMER = '行情数据用于支撑指标与回测，不构成投资建议。LongPort 仅作为只读行情源，不发起下单/撤单/账户/真实持仓查询。';

export function MarketDataPage() {
  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 8 }}>行情数据</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
        证券主数据 · 日 K · 外部行情 · 同步任务 · 异常提醒 · {DISCLAIMER}
      </Typography.Text>
      <Alert type="info" showIcon title={DISCLAIMER} style={{ marginBottom: 16 }} />
      <Tabs items={[
        { key: 'status', label: '行情状态', children: <ProviderStatusTab /> },
        { key: 'stocks', label: '证券主数据', children: <StocksTab /> },
        { key: 'bars', label: '日 K 数据', children: <BarsTab /> },
        { key: 'sync', label: '历史数据同步', children: <SyncTasksTab /> },
        { key: 'alerts', label: '异常提醒', children: <AlertsTab /> },
      ]} />
    </div>
  );
}

// ===== 行情状态 Tab =====
function ProviderStatusTab() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try { const s = await getProviderStatus(); if (!cancelled) setStatus(s); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败'); }
      finally { if (!cancelled) setLoading(false); }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  const handleHealthCheck = async () => {
    setLoading(true);
    try { setStatus(await healthCheck()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : '健康检查失败'); }
    finally { setLoading(false); }
  };

  if (loading) return <Spin />;
  if (error) return <Alert type="error" showIcon title="加载失败" description={error} action={<Button size="small" onClick={() => void handleHealthCheck()}>重试</Button>} />;
  if (!status) return <Empty description="无状态数据" />;
  return (
    <div>
      <Space direction="vertical" size="middle">
        <Tag.CheckableTag checked={status.configured} style={{ padding: '4px 12px', borderRadius: 4, background: status.configured ? '#52c41a' : '#d9d9d9', color: '#fff' }}>
          {status.configured ? '已配置' : '未配置'}
        </Tag.CheckableTag>
        <Typography.Text>Provider: {status.providerCode}</Typography.Text>
        <Typography.Text>可达: {status.reachable ? '是' : '否'}</Typography.Text>
        {status.lastError && <Alert type="warning" showIcon message={status.lastError} />}
        {status.lastSuccessAt && <Typography.Text type="secondary">最近成功: {new Date(status.lastSuccessAt).toLocaleString('zh-CN')}</Typography.Text>}
        <Button onClick={() => void handleHealthCheck()} icon={<ReloadOutlined />}>健康检查</Button>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          外部行情只写入行情快照，不会覆盖手工当前价。Mock 模式下此页面显示模拟状态。
        </Typography.Text>
      </Space>
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

// ===== 历史数据同步 Tab =====
function SyncTasksTab() {
  const [data, setData] = useState<MarketDataSyncTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await getSyncTasks(undefined, undefined, p, 20);
      setData(result.items); setTotal(result.total);
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try { const r = await getSyncTasks(undefined, undefined, 1, 20); if (!cancelled) { setData(r.items); setTotal(r.total); } }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败'); }
      finally { if (!cancelled) setLoading(false); }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async () => {
    const scopeJson = JSON.stringify({ canonicalSymbol: 'SH.600519', startDate: '2026-06-01', endDate: '2026-07-01', adjustType: 'NONE' });
    try {
      await createDailyBarSync('DAILY_BAR_SYNC', 'LONGPORT', scopeJson);
      message.success('同步任务已创建并执行');
      void load(page);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建同步任务失败');
    }
  };

  if (error) return <Alert type="error" showIcon title="加载失败" description={error} action={<Button size="small" onClick={() => void load(page)}>重试</Button>} />;

  const statusColor: Record<string, string> = { SUCCEEDED: 'green', FAILED: 'red', PARTIAL_FAILED: 'orange', RUNNING: 'blue', PENDING: 'default' };
  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => void handleCreate()}>创建日 K 同步任务</Button>
        <Button icon={<ReloadOutlined />} onClick={() => void load(page)}>刷新</Button>
      </Space>
      <Table<MarketDataSyncTask> size="small" rowKey="id" loading={loading}
        dataSource={data}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); void load(p); } }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="暂无同步任务" /> }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '类型', dataIndex: 'taskType', width: 140 },
          { title: 'Provider', dataIndex: 'provider', width: 100 },
          { title: '状态', dataIndex: 'status', width: 120, render: (v) => <Tag color={statusColor[v] ?? 'default'}>{v}</Tag> },
          { title: '新增', dataIndex: 'insertedCount', width: 60 },
          { title: '更新', dataIndex: 'updatedCount', width: 60 },
          { title: '跳过', dataIndex: 'skippedCount', width: 60 },
          { title: '失败', dataIndex: 'failCount', width: 60 },
          { title: '开始', dataIndex: 'startedAt', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
          { title: '完成', dataIndex: 'finishedAt', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
        ]}
      />
    </>
  );
}

// ===== 异常提醒 Tab =====
function AlertsTab() {
  const [data, setData] = useState<MarketDataAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await getAlerts(undefined, undefined, undefined, p, 20);
      setData(result.items); setTotal(result.total);
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try { const r = await getAlerts(undefined, undefined, undefined, 1, 20); if (!cancelled) { setData(r.items); setTotal(r.total); } }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败'); }
      finally { if (!cancelled) setLoading(false); }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  const handleResolve = async (id: EntityId) => {
    try {
      await resolveAlert(id);
      message.success('已标记为已处理');
      void load(page);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  if (error) return <Alert type="error" showIcon title="加载失败" description={error} action={<Button size="small" onClick={() => void load(page)}>重试</Button>} />;

  const severityColor: Record<string, string> = { HIGH: 'red', WARN: 'orange', INFO: 'blue' };
  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={() => void load(page)}>刷新</Button>
      </Space>
      <Table<MarketDataAlert> size="small" rowKey="id" loading={loading}
        dataSource={data}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); void load(p); } }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="暂无异常提醒" /> }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '级别', dataIndex: 'severity', width: 80, render: (v) => <Tag color={severityColor[v] ?? 'default'}>{v}</Tag> },
          { title: '类型', dataIndex: 'alertType', width: 200 },
          { title: '证券', dataIndex: 'canonicalSymbol', width: 140, render: (v?: string) => v ?? '—' },
          { title: '说明', dataIndex: 'message' },
          { title: '时间', dataIndex: 'createdAt', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
          { title: '已处理', dataIndex: 'resolved', width: 80, render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag>否</Tag> },
          { title: '操作', key: 'action', width: 80, render: (_, r) => !r.resolved ? (
            <Popconfirm title="确认标记为已处理？" onConfirm={() => void handleResolve(r.id)}>
              <Button size="small">处理</Button>
            </Popconfirm>
          ) : null },
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
