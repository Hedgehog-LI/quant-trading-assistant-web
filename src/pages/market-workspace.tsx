import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Drawer, Form, Input, message, Popconfirm, Row, Select, Space, Statistic, Switch, Table, Tabs, Tag, Typography } from 'antd';
import { EditOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { getSettings } from '../features/settings/api/settingsApi';
import {
  getWorkbenchOverview, listSyncPlans, createSyncPlan, updateSyncPlan, toggleSyncPlan, runSyncPlan,
  listTaskItems, reconcileTask, getSyncTask,
  listMinuteBars, listWatermarks, getTradingSessions,
  type MinuteBarFilter, type WatermarkFilter,
} from '../features/market-data/api/workbenchApi';
import { buildPlanInput, fallbackConfigurationErrors, planToDraft, type SyncPlanDraft } from '../features/market-data/utils/syncPlanForm';
import { SecurityVerificationField } from '../features/market-data/components/SecurityVerificationField';
import type {
  WorkbenchOverview, MarketDataSyncPlan, MarketDataSyncTask, MarketDataSyncTaskItem,
  StockMinuteBar,
  MarketDataWatermark, MarketTradingSession, EntityId,
} from '../shared/types/domain';
import { formatDateTime } from '../shared/utils/date';

interface PageResult<T> { items: T[]; total: number; page: number; size: number; }

const { Title, Text } = Typography;
const DISCLAIMER = '行情数据仅用于辅助观察和复盘，不构成投资建议。';

export function MarketWorkspacePage() {
  return (
    <div>
      <Title level={4}>行情工作台</Title>
      <Text type="secondary">{DISCLAIMER}</Text>
      <Tabs
        style={{ marginTop: 16 }}
        items={[
          { key: 'overview', label: '概览', children: <OverviewTab /> },
          { key: 'plans', label: '采集计划', children: <PlansTab /> },
          { key: 'minute', label: '分钟 K', children: <MinuteBarTab /> },
          { key: 'watermark', label: '数据水位', children: <WatermarkTab /> },
        ]}
      />
    </div>
  );
}

// ==================== 概览 Tab ====================

function OverviewTab() {
  const [data, setData] = useState<WorkbenchOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<MarketTradingSession[]>([]);
  const apiMode = getSettings().apiMode;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, sess] = await Promise.all([getWorkbenchOverview(), getTradingSessions()]);
      setData(overview);
      setSessions(sess);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true); setError(null);
      try {
        const [overview, sess] = await Promise.all([getWorkbenchOverview(), getTradingSessions()]);
        if (!cancelled) { setData(overview); setSessions(sess); }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <Alert type="error" message={error} action={<Button onClick={load}>重试</Button>} />;
  }

  const ps = data?.providerStatus;
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Tag color={apiMode === 'remote' ? 'green' : 'default'}>
        {apiMode === 'remote' ? '后端模式' : '本地模式（mock）'}
      </Tag>
      <Row gutter={16}>
        <Col span={4}><Card><Statistic title="Provider" value={ps?.configured ? '已配置' : '未配置'} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={4}><Card><Statistic title="可达" value={ps?.reachable ? '✓' : '✗'} valueStyle={{ fontSize: 16, color: ps?.reachable ? '#3f8600' : '#cf1322' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="HIGH 提醒" value={data?.unresolvedHighAlerts ?? 0} valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="WARN 提醒" value={data?.unresolvedWarnAlerts ?? 0} valueStyle={{ color: '#d4b106' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="今日失败任务" value={data?.failedTasksToday ?? 0} valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="证券数" value={data?.totalSymbols ?? 0} /></Card></Col>
      </Row>

      {ps?.lastError && <Alert type="warning" message={`Provider 错误：${ps.lastError}`} />}

      <Card title="A 股交易时段" size="small" loading={loading}>
        <Table<MarketTradingSession>
          size="small" rowKey="id" pagination={false}
          dataSource={sessions}
          columns={[
            { title: '时段', dataIndex: 'sessionName', width: 160 },
            { title: '类型', dataIndex: 'sessionType', width: 120 },
            { title: '开始', dataIndex: 'startTime', width: 100 },
            { title: '结束', dataIndex: 'endTime', width: 100 },
            {
              title: '集合竞价', dataIndex: 'isAuction', width: 100,
              render: (v: boolean) => v ? <Tag color="orange">是</Tag> : <Tag>否</Tag>,
            },
            { title: '排序', dataIndex: 'sortOrder', width: 80 },
          ]}
        />
      </Card>

      {data?.recentAlerts && data.recentAlerts.length > 0 && (
        <Card title="最近提醒" size="small">
          {data.recentAlerts.slice(0, 5).map((a) => (
            <div key={a.id}>
              <Tag color={a.severity === 'HIGH' ? 'red' : 'orange'}>{a.severity}</Tag>
              <Text>{a.message}</Text>
            </div>
          ))}
        </Card>
      )}
    </Space>
  );
}

// ==================== 采集计划 Tab ====================

function PlansTab() {
  const [data, setData] = useState<PageResult<MarketDataSyncPlan>>({ items: [], total: 0, page: 1, size: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MarketDataSyncPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [itemsDrawerPlan, setItemsDrawerPlan] = useState<MarketDataSyncPlan | null>(null);
  const [form] = Form.useForm<SyncPlanDraft>();
  const taskType = Form.useWatch('taskType', form);
  const runSeqRef = useRef(0);
  const remoteMode = getSettings().apiMode === 'remote';

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSyncPlans({ page: p, size: 20 });
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true); setError(null);
      try {
        const result = await listSyncPlans({ page, size: 20 });
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [page]);

  const openCreate = () => {
    setEditingPlan(null);
    form.resetFields();
    form.setFieldsValue({ taskType: 'MINUTE_BAR_BACKFILL', provider: 'LONGPORT', adjustType: 'NONE', includeAuction: false });
    setDrawerOpen(true);
  };

  const openEdit = (plan: MarketDataSyncPlan) => {
    setEditingPlan(plan);
    form.setFieldsValue(planToDraft(plan));
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      const input = buildPlanInput(values);
      if (editingPlan) await updateSyncPlan(editingPlan.id, input);
      else await createSyncPlan(input);
      message.success(editingPlan ? '采集计划已修正' : '采集计划已创建');
      setDrawerOpen(false);
      setEditingPlan(null);
      form.resetFields();
      await load(page);
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: EntityId, enabled: boolean) => {
    await toggleSyncPlan(id, enabled);
    message.success(enabled ? '已启用' : '已停用');
    load(page);
  };

  const handleRun = async (plan: MarketDataSyncPlan) => {
    const key = String(plan.id);
    if (runningIds.has(key)) return;
    const seq = ++runSeqRef.current;
    setRunningIds(previous => new Set(previous).add(key));
    message.loading({ content: '执行中...', key: `run-${key}`, duration: 0 });
    try {
      const result = await runSyncPlan(plan.id);
      if (seq !== runSeqRef.current) return;
      message.success({ content: `任务 ${result.lastTaskId ?? '-'} 已进入终态`, key: `run-${key}` });
      setItemsDrawerPlan(result);
      await load(page);
    } catch (e) {
      if (seq === runSeqRef.current) message.error({ content: `执行失败: ${(e as Error).message}`, key: `run-${key}` });
    } finally {
      setRunningIds(previous => { const next = new Set(previous); next.delete(key); return next; });
    }
  };

  if (error) {
    return <Alert type="error" message={error} action={<Button onClick={() => load(page)}>重试</Button>} />;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {!remoteMode && <Alert type="info" title="Mock 模式只保存演示配置，不会伪造 provider 执行成功；切换后端模式才能立即执行。" />}
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建采集计划</Button>
      <Table<MarketDataSyncPlan>
        size="small" rowKey="id" loading={loading}
        dataSource={data.items}
        pagination={{ current: data.page, pageSize: data.size, total: data.total, onChange: setPage }}
        columns={[
          { title: '名称', dataIndex: 'planName', width: 160 },
          { title: '任务类型', dataIndex: 'taskType', width: 160 },
          { title: 'Provider', dataIndex: 'provider', width: 100 },
          { title: '粒度', dataIndex: 'intervalType', width: 80 },
          { title: '触发', dataIndex: 'triggerType', width: 100 },
          { title: '复权', dataIndex: 'adjustType', width: 80 },
          {
            title: '配置 / 启用', width: 150,
            render: (_, r) => {
              const errors = fallbackConfigurationErrors(r);
              return <Space size={4} wrap>
                <Tag color={errors.length ? 'red' : 'green'} title={errors.join('；')}>{errors.length ? '需要修正' : '配置完整'}</Tag>
                <Tag color={r.enabled ? 'blue' : 'default'}>{r.enabled ? '已启用' : '已停用'}</Tag>
              </Space>;
            },
          },
          { title: '最后运行', dataIndex: 'lastRunAt', width: 160 },
          {
            title: '操作', width: 300,
            render: (_, r) => {
              const errors = fallbackConfigurationErrors(r);
              const pending = runningIds.has(String(r.id));
              return (
              <Space>
                <Button size="small" type="link" loading={pending} disabled={!remoteMode || pending || errors.length > 0 || !r.manuallyRunnable}
                  onClick={() => handleRun(r)}>立即执行</Button>
                {r.lastTaskId != null && (
                  <Button size="small" type="link" onClick={() => setItemsDrawerPlan(r)}>任务明细</Button>
                )}
                <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>修正</Button>
                <Popconfirm title={r.enabled ? '确定停用？' : '确定启用？'} onConfirm={() => handleToggle(r.id, !r.enabled)}>
                  <Button size="small" type="link" disabled={!r.enabled && errors.length > 0}>{r.enabled ? '停用' : '启用'}</Button>
                </Popconfirm>
              </Space>
              );
            },
          },
        ]}
      />
      <Drawer title={editingPlan ? '修正采集计划' : '新建采集计划'} open={drawerOpen} onClose={() => setDrawerOpen(false)} size="large"
        extra={<Space><Button onClick={() => setDrawerOpen(false)}>取消</Button><Button type="primary" loading={saving} onClick={handleSave}>{editingPlan ? '保存修正' : '创建'}</Button></Space>}>
        <Form form={form} layout="vertical">
          <Form.Item name="planName" label="计划名称" rules={[{ required: true }]}><Input placeholder="茅台30M补档" /></Form.Item>
          <Form.Item name="taskType" label="任务类型" rules={[{ required: true }]}>
            <Select options={[
              { value: 'MINUTE_BAR_BACKFILL', label: '历史分钟K补档' },
              { value: 'DAILY_BAR_BACKFILL', label: '历史日K补档' },
              { value: 'INTRADAY_MINUTE_REFRESH', label: '盘中分钟线刷新' },
            ]} />
          </Form.Item>
          <Form.Item name="provider" label="Provider" rules={[{ required: true }]}><Select options={[{ value: 'LONGPORT', label: 'LongPort（只读行情）' }]} /></Form.Item>
          <Form.Item name="symbols" label="标的" rules={[{ required: true, message: '至少验证并加入一个标的' }]}>
            <SecurityVerificationField remoteMode={remoteMode} taskType={taskType} />
          </Form.Item>
          {taskType !== 'INTRADAY_MINUTE_REFRESH' && <Row gutter={16}>
            <Col span={12}><Form.Item name="startDate" label="开始日期" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
            <Col span={12}><Form.Item name="endDate" label="结束日期" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
          </Row>}
          {taskType !== 'DAILY_BAR_BACKFILL' && <Form.Item name="intervalType" label="K线粒度" rules={[{ required: true }]}>
            <Select allowClear options={[
              { value: '1M', label: '1分钟' }, { value: '5M', label: '5分钟' },
              { value: '15M', label: '15分钟' }, { value: '30M', label: '30分钟' }, { value: '60M', label: '60分钟' },
            ]} />
          </Form.Item>}
          <Form.Item name="adjustType" label="复权类型">
            <Select options={[{ value: 'NONE', label: '不复权' }, { value: 'QF', label: '前复权' }, { value: 'HF', label: '后复权（SDK 不支持）', disabled: true }]} />
          </Form.Item>
          <Alert type="info" title={taskType === 'INTRADAY_MINUTE_REFRESH'
            ? '触发方式固定为 INTRADAY；仅 A 股交易日和允许时段运行，同一计划不重叠。'
            : '历史补档触发方式固定为 MANUAL；点击“立即执行”才会创建任务并拉取数据。'} style={{ marginBottom: 16 }} />
          {taskType === 'INTRADAY_MINUTE_REFRESH' && <>
            <Form.Item name="collectFrequency" label="采集频率" rules={[{ required: true }]}>
              <Select options={[{ value: '30S', label: '每 30 秒' }, { value: '60S', label: '每 60 秒' }, { value: '5M', label: '每 5 分钟' }]} />
            </Form.Item>
            <Form.Item name="includeAuction" label="包含 09:15-09:25 集合竞价" valuePropName="checked"><Switch /></Form.Item>
          </>}
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Drawer>
      <TaskItemsDrawer plan={itemsDrawerPlan} onClose={() => setItemsDrawerPlan(null)} />
    </Space>
  );
}

// ==================== 任务明细 Drawer ====================

export function TaskItemsDrawer({ plan, onClose }: { plan: MarketDataSyncPlan | null; onClose: () => void }) {
  const taskKey = plan?.lastTaskId == null ? 'closed' : String(plan.lastTaskId);
  return <TaskItemsDrawerContent key={taskKey} plan={plan} onClose={onClose} />;
}

function TaskItemsDrawerContent({ plan, onClose }: { plan: MarketDataSyncPlan | null; onClose: () => void }) {
  const [task, setTask] = useState<MarketDataSyncTask | null>(null);
  const [items, setItems] = useState<MarketDataSyncTaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [itemPage, setItemPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const reqIdRef = useRef(0);
  const activeRef = useRef(true);

  useEffect(() => () => {
    activeRef.current = false;
    reqIdRef.current += 1;
  }, []);

  const loadItems = useCallback(async (taskId: EntityId, p: number) => {
    if (!activeRef.current) return;
    const myReqId = ++reqIdRef.current;
    setLoading(true); setError(null);
    try {
      const result = await listTaskItems(taskId, undefined, p, 20);
      if (!activeRef.current || myReqId !== reqIdRef.current) return;
      setItems(result.items);
      setTotal(result.total);
    } catch (e) {
      if (!activeRef.current || myReqId !== reqIdRef.current) return;
      setError((e as Error).message);
    } finally {
      if (activeRef.current && myReqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const taskId = plan?.lastTaskId;
    if (taskId == null) return;
    const scheduledReqId = ++reqIdRef.current;
    void Promise.resolve().then(() => {
      if (activeRef.current && scheduledReqId === reqIdRef.current) {
        void loadItems(taskId, itemPage);
      }
    });
    return () => {
      reqIdRef.current += 1;
    };
  }, [itemPage, plan?.lastTaskId, loadItems]);

  useEffect(() => {
    const taskId = plan?.lastTaskId;
    if (taskId == null) return;
    let active = true;
    void getSyncTask(taskId).then(result => { if (active) setTask(result); }).catch(() => { if (active) setTask(null); });
    return () => { active = false; };
  }, [plan?.lastTaskId]);

  const handleReconcile = async () => {
    if (!plan?.lastTaskId || reconciling) return;
    setReconciling(true); setError(null);
    try {
      await reconcileTask(plan.lastTaskId);
      if (!activeRef.current) return;
      message.success('收敛完成');
      await loadItems(plan.lastTaskId, itemPage);
    } catch (e) {
      if (activeRef.current) setError(`收敛失败: ${(e as Error).message}`);
    } finally {
      if (activeRef.current) setReconciling(false);
    }
  };

  return (
    <Drawer title={plan ? `任务明细：${plan.planName}` : ''} open={!!plan} onClose={onClose} size="large"
      extra={plan?.lastTaskId != null ? (
        <Button size="small" onClick={handleReconcile} loading={reconciling} disabled={reconciling}>
          刷新/收敛
        </Button>
      ) : undefined}>
      {error && (
        <Alert type="error" title={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => plan?.lastTaskId && loadItems(plan.lastTaskId, itemPage)}>重试</Button>} />
      )}
      {task && <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col span={4}><Statistic title="Task ID" value={String(task.id)} /></Col>
          <Col span={4}><Statistic title="状态" value={task.status} /></Col>
          <Col span={4}><Statistic title="总行数" value={task.totalCount ?? 0} /></Col>
          <Col span={4}><Statistic title="新增" value={task.insertedCount ?? 0} /></Col>
          <Col span={4}><Statistic title="跳过" value={task.skippedCount ?? 0} /></Col>
          <Col span={4}><Statistic title="失败" value={task.failCount ?? 0} /></Col>
        </Row>
        {(task.lastErrorCode || task.errorSummaryJson) && <Alert type="warning" style={{ marginTop: 12 }}
          title={`${task.lastErrorCode ?? '任务错误'}：${task.errorSummaryJson ?? ''}`} />}
      </Card>}
      {plan?.lastTaskId != null ? (
        <Table<MarketDataSyncTaskItem>
          size="small" rowKey="id" loading={loading}
          dataSource={items}
          pagination={{ current: itemPage, pageSize: 20, total, onChange: setItemPage }}
          scroll={{ x: 1200 }}
          columns={[
            { title: '标的', dataIndex: 'canonicalSymbol', width: 120 },
            { title: '状态', dataIndex: 'status', width: 100, render: (s: string) => <Tag color={s === 'SUCCEEDED' ? 'green' : s === 'FAILED' ? 'red' : s === 'PARTIAL_FAILED' ? 'orange' : 'blue'}>{s}</Tag> },
            { title: '行数', dataIndex: 'rowCount', width: 70 },
            { title: '新增', dataIndex: 'insertedCount', width: 60 },
            { title: '更新', dataIndex: 'updatedCount', width: 60 },
            { title: '跳过', dataIndex: 'skippedCount', width: 60 },
            { title: '子任务ID', dataIndex: 'subTaskId', width: 90 },
            { title: '开始', dataIndex: 'startedAt', width: 150, render: (v?: string) => v ? formatDateTime(v) : '-' },
            { title: '结束', dataIndex: 'finishedAt', width: 150, render: (v?: string) => v ? formatDateTime(v) : '-' },
            { title: '错误', dataIndex: 'errorMessage', ellipsis: true },
          ]}
        />
      ) : (
        <Text type="secondary">该计划尚未执行</Text>
      )}
    </Drawer>
  );
}

// ==================== 分钟 K Tab ====================

function MinuteBarTab() {
  const [data, setData] = useState<PageResult<StockMinuteBar>>({ items: [], total: 0, page: 1, size: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MinuteBarFilter>({ page: 1, size: 20 });

  const load = useCallback(async (f: MinuteBarFilter) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listMinuteBars(f);
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true); setError(null);
      try {
        const result = await listMinuteBars(filter);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [filter]);

  if (error) {
    return <Alert type="error" message={error} action={<Button onClick={() => load(filter)}>重试</Button>} />;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space>
        <Input placeholder="证券代码" allowClear onPressEnter={(e) => setFilter({ ...filter, canonicalSymbol: (e.target as HTMLInputElement).value || undefined, page: 1 })} style={{ width: 200 }} />
        <Select placeholder="粒度" allowClear style={{ width: 120 }} onChange={(v) => setFilter({ ...filter, intervalType: v, page: 1 })}
          options={[{ value: '1M', label: '1分钟' }, { value: '5M', label: '5分钟' }, { value: '15M', label: '15分钟' }, { value: '30M', label: '30分钟' }, { value: '60M', label: '60分钟' }]} />
        <Select placeholder="数据源" allowClear style={{ width: 120 }} onChange={(v) => setFilter({ ...filter, dataSource: v, page: 1 })}
          options={[{ value: 'LONGPORT', label: 'LongPort' }, { value: 'CSV', label: 'CSV' }]} />
        <Button icon={<ReloadOutlined />} onClick={() => load(filter)}>刷新</Button>
      </Space>
      <Table<StockMinuteBar>
        size="small" rowKey="id" loading={loading}
        dataSource={data.items}
        pagination={{ current: data.page, pageSize: data.size, total: data.total, onChange: (p) => setFilter({ ...filter, page: p }) }}
        columns={[
          { title: '代码', dataIndex: 'canonicalSymbol', width: 110 },
          { title: '交易日', dataIndex: 'tradeDate', width: 110 },
          { title: 'Bar开始', dataIndex: 'barStartTime', width: 160 },
          { title: '粒度', dataIndex: 'intervalType', width: 70 },
          { title: '开', dataIndex: 'openPrice', width: 90 },
          { title: '高', dataIndex: 'highPrice', width: 90 },
          { title: '低', dataIndex: 'lowPrice', width: 90 },
          { title: '收', dataIndex: 'closePrice', width: 90 },
          { title: '量', dataIndex: 'volume', width: 90 },
          { title: '额', dataIndex: 'amount', width: 120 },
          { title: '数据源', dataIndex: 'dataSource', width: 90 },
          { title: '质量', dataIndex: 'qualityStatus', width: 90, render: (q: string) => <Tag color={q === 'VALID' ? 'green' : q === 'SUSPECT' ? 'orange' : 'red'}>{q}</Tag> },
        ]}
      />
    </Space>
  );
}

// ==================== 水位 Tab ====================

function WatermarkTab() {
  const [data, setData] = useState<PageResult<MarketDataWatermark>>({ items: [], total: 0, page: 1, size: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<WatermarkFilter>({ page: 1, size: 20 });

  const load = useCallback(async (f: WatermarkFilter) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listWatermarks(f);
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true); setError(null);
      try {
        const result = await listWatermarks(filter);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [filter]);

  if (error) {
    return <Alert type="error" message={error} action={<Button onClick={() => load(filter)}>重试</Button>} />;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space>
        <Input placeholder="证券代码" allowClear onPressEnter={(e) => setFilter({ ...filter, canonicalSymbol: (e.target as HTMLInputElement).value || undefined, page: 1 })} style={{ width: 200 }} />
        <Button icon={<ReloadOutlined />} onClick={() => load(filter)}>刷新</Button>
      </Space>
      <Table<MarketDataWatermark>
        size="small" rowKey="id" loading={loading}
        dataSource={data.items}
        pagination={{ current: data.page, pageSize: data.size, total: data.total, onChange: (p) => setFilter({ ...filter, page: p }) }}
        columns={[
          { title: '代码', dataIndex: 'canonicalSymbol', width: 110 },
          { title: '数据源', dataIndex: 'dataSource', width: 90 },
          { title: '粒度', dataIndex: 'intervalType', width: 80 },
          { title: '复权', dataIndex: 'adjustType', width: 80 },
          { title: '最后成功', dataIndex: 'lastSuccessTime', width: 160 },
          { title: '最后交易日', dataIndex: 'lastTradeDate', width: 110 },
          { title: '最后Bar', dataIndex: 'lastBarTime', width: 160 },
          { title: '总行数', dataIndex: 'totalRows', width: 100 },
        ]}
      />
    </Space>
  );
}
