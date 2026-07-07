import { useState, useCallback, useEffect } from 'react';
import {
  Typography, Tabs, Table, Button, Space, Input, Select, Drawer, Form,
  Upload, Alert, Empty, Spin, Tag, message, Popconfirm,
} from 'antd';
import { PlusOutlined, UploadOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import {
  getStocks, addStock, deleteStock, getDailyBars, importDailyBars,
} from '../features/market-data/api/marketDataApi';
import type { StockBasic, StockDailyBar, DailyBarImportResult } from '../shared/types/domain';

export function MarketDataPage() {
  const [stocks, setStocks] = useState<StockBasic[]>([]);
  const [bars, setBars] = useState<StockDailyBar[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [loadingBars, setLoadingBars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importResult, setImportResult] = useState<DailyBarImportResult | null>(null);
  const [stockFilter, setStockFilter] = useState<{ market?: string; keyword?: string }>({});
  const [barFilter, setBarFilter] = useState<{ canonicalSymbol?: string; adjustType?: string }>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await getStocks(stockFilter.market, stockFilter.keyword);
        if (!cancelled) setStocks(result.items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoadingStocks(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [stockFilter]);

  const refreshBars = useCallback(async () => {
    setLoadingBars(true);
    try {
      const result = await getDailyBars(barFilter);
      setBars(result.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoadingBars(false);
    }
  }, [barFilter]);

  const refreshStocks = useCallback(async () => {
    setLoadingStocks(true);
    try {
      const result = await getStocks(stockFilter.market, stockFilter.keyword);
      setStocks(result.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoadingStocks(false);
    }
  }, [stockFilter]);

  const handleAdd = async (values: { symbol: string; market: string; name?: string }) => {
    try {
      await addStock(values);
      message.success('证券已添加');
      setFormOpen(false);
      void refreshStocks();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '添加失败');
    }
  };

  const handleDelete = async (canonical: string) => {
    try {
      await deleteStock(canonical);
      message.success('已删除');
      void refreshStocks();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const result = await importDailyBars(file);
      setImportResult(result);
      if (result.failed > 0) {
        message.warning(`导入存在错误：失败 ${result.failed} 行`);
      } else {
        message.success(`导入完成：新增 ${result.inserted}，更新 ${result.updated}，跳过 ${result.skipped}`);
      }
      void refreshBars();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导入失败');
    }
    return false;
  };

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 8 }}>行情数据</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
        证券主数据与日 K 行情管理 · 数据来源：手工录入 / CSV 导入 · 不构成投资建议
      </Typography.Text>

      <Alert type="info" showIcon title="行情数据用于支撑指标与回测，不构成投资建议。" style={{ marginBottom: 16 }} />

      {error && <Alert type="error" showIcon title="加载失败" description={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => { setError(null); void refreshStocks(); }}>重试</Button>} />}

      <Tabs items={[
        {
          key: 'stocks', label: '证券主数据', children: (
            <>
              <Space style={{ marginBottom: 16 }} wrap>
                <Select allowClear placeholder="市场" style={{ width: 120 }} value={stockFilter.market}
                  onChange={(v) => setStockFilter({ ...stockFilter, market: v })}
                  options={[{ value: 'SH', label: 'SH' }, { value: 'SZ', label: 'SZ' }, { value: 'BJ', label: 'BJ' }]} />
                <Input allowClear placeholder="搜索代码/名称" style={{ width: 200 }} value={stockFilter.keyword}
                  onChange={(e) => setStockFilter({ ...stockFilter, keyword: e.target.value })} />
                <Button icon={<ReloadOutlined />} onClick={() => void refreshStocks()}>刷新</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>新增证券</Button>
              </Space>
              {loadingStocks ? <Spin /> : stocks.length === 0 ? <Empty description="暂无证券主数据" /> : (
                <Table<StockBasic> size="small" rowKey="id" pagination={{ pageSize: 20 }} dataSource={stocks} scroll={{ x: 'max-content' }}
                  columns={[
                    { title: '代码', dataIndex: 'canonicalSymbol', width: 140 },
                    { title: '名称', dataIndex: 'name', width: 120 },
                    { title: '市场', dataIndex: 'market', width: 80, render: (v) => <Tag>{v}</Tag> },
                    { title: '上市日期', dataIndex: 'listDate', width: 120 },
                    { title: '退市', dataIndex: 'delisted', width: 80, render: (v) => (v ? <Tag color="red">退市</Tag> : '—') },
                    { title: '操作', key: 'action', width: 80, render: (_, r) => (
                      <Popconfirm title="确认删除？" onConfirm={() => void handleDelete(r.canonicalSymbol)}>
                        <Button size="small" danger>删除</Button>
                      </Popconfirm>
                    ) },
                  ]}
                />
              )}
            </>
          ),
        },
        {
          key: 'bars', label: '日 K 数据', children: (
            <>
              <Space style={{ marginBottom: 16 }} wrap>
                <Input allowClear placeholder="canonical_symbol" style={{ width: 200 }} value={barFilter.canonicalSymbol ?? ''}
                  onChange={(e) => setBarFilter({ ...barFilter, canonicalSymbol: e.target.value || undefined })} />
                <Select allowClear placeholder="复权" style={{ width: 120 }} value={barFilter.adjustType}
                  onChange={(v) => setBarFilter({ ...barFilter, adjustType: v })}
                  options={[{ value: 'NONE', label: '不复权' }, { value: 'QF', label: '前复权' }, { value: 'HF', label: '后复权' }]} />
                <Button icon={<ReloadOutlined />} onClick={() => void refreshBars()}>查询</Button>
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
              {loadingBars ? <Spin /> : bars.length === 0 ? <Empty description="暂无日 K 数据，请导入 CSV 或查询" /> : (
                <Table<StockDailyBar> size="small" rowKey="id" pagination={{ pageSize: 50 }} scroll={{ x: 'max-content' }}
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
                  ]}
                />
              )}
            </>
          ),
        },
      ]} />

      <StockFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleAdd} />
    </div>
  );
}

function StockFormDrawer({ open, onClose, onSubmit }: {
  open: boolean; onClose: () => void; onSubmit: (v: { symbol: string; market: string; name?: string }) => Promise<void>;
}) {
  const [form] = Form.useForm<{ symbol: string; market: string; name?: string }>();
  return (
    <Drawer title="新增证券" open={open} onClose={() => { form.resetFields(); onClose(); }} size={420} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
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
