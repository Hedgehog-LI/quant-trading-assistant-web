import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Drawer, Form, Input, message, Popconfirm, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons';
import {
  createSegment, listSegments, deleteSegment,
  listSegmentMembers, addSegmentMember, removeSegmentMember,
  type SegmentInput, type SegmentFilter,
} from '../features/market-data/api/segmentApi';
import type { MarketSegment, MarketSegmentMember, EntityId } from '../shared/types/domain';

interface PageResult<T> { items: T[]; total: number; page: number; size: number; }

const { Title, Text } = Typography;

export function MarketSegmentsPage() {
  return (
    <div>
      <Title level={4}>板块管理</Title>
      <Text type="secondary">管理自定义板块和成分股，用于行情工作台按板块聚合展示。不构成投资建议。</Text>
      <Tabs
        style={{ marginTop: 16 }}
        items={[
          { key: 'segments', label: '板块列表', children: <SegmentListTab /> },
        ]}
      />
    </div>
  );
}

function SegmentListTab() {
  const [data, setData] = useState<PageResult<MarketSegment>>({ items: [], total: 0, page: 1, size: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [membersDrawer, setMembersDrawer] = useState<MarketSegment | null>(null);
  const [form] = Form.useForm<SegmentInput>();

  const load = useCallback(async (p: number) => {
    setLoading(true); setError(null);
    try {
      const filter: SegmentFilter = { page: p, size: 20 };
      setData(await listSegments(filter));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true); setError(null);
      try {
        const filter: SegmentFilter = { page, size: 20 };
        const r = await listSegments(filter);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [page]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      await createSegment(values);
      message.success('板块已创建');
      setDrawerOpen(false); form.resetFields(); load(page);
    } catch (e) {
      // form.validateFields 的错误由 Ant Design 内部处理；API 错误显示 message
      if (e instanceof Error && e.message) {
        message.error(`创建失败: ${e.message}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: EntityId) => {
    try {
      setDeletingId(String(id));
      await deleteSegment(id);
      message.success('已删除');
      // 删除当前页最后一条后，如页码超出总页数，回到有效页
      const newTotal = data.total - 1;
      const maxPage = Math.max(1, Math.ceil(newTotal / data.size));
      if (page > maxPage) {
        setPage(maxPage); // useEffect[page] 会自动加载
      } else {
        load(page);
      }
    } catch (e) {
      message.error(`删除失败: ${(e as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (error) return <Alert type="error" message={error} action={<Button onClick={() => load(page)}>重试</Button>} />;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>新建板块</Button>
      <Table<MarketSegment>
        size="small" rowKey="id" loading={loading}
        dataSource={data.items}
        pagination={{ current: data.page, pageSize: data.size, total: data.total, onChange: setPage }}
        columns={[
          { title: '名称', dataIndex: 'segmentName', width: 160 },
          { title: '代码', dataIndex: 'segmentCode', width: 140 },
          { title: '类型', dataIndex: 'segmentType', width: 100, render: (t: string) => <Tag>{t}</Tag> },
          { title: '成分股数', dataIndex: 'memberCount', width: 100 },
          { title: '描述', dataIndex: 'description', ellipsis: true },
          { title: '状态', dataIndex: 'enabled', width: 80, render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
          {
            title: '操作', width: 160,
            render: (_, r) => (
              <Space>
                <Button size="small" type="link" icon={<TeamOutlined />} onClick={() => setMembersDrawer(r)}>成员</Button>
                <Popconfirm title="确定删除该板块？" onConfirm={() => handleDelete(r.id)} disabled={deletingId === String(r.id)}>
                  <Button size="small" type="link" danger icon={<DeleteOutlined />}
                    loading={deletingId === String(r.id)}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Drawer title="新建板块" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={420}
        extra={<Space><Button onClick={() => setDrawerOpen(false)} disabled={creating}>取消</Button><Button type="primary" onClick={handleCreate} loading={creating}>创建</Button></Space>}>
        <Form form={form} layout="vertical" initialValues={{ segmentType: 'CUSTOM', enabled: true }}>
          <Form.Item name="segmentName" label="板块名称" rules={[{ required: true }]}><Input placeholder="白酒观察池" /></Form.Item>
          <Form.Item name="segmentType" label="板块类型">
            <Select options={[
              { value: 'CUSTOM', label: '自定义' }, { value: 'INDUSTRY', label: '行业' },
              { value: 'CONCEPT', label: '概念' }, { value: 'INDEX', label: '指数' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Drawer>
      <MembersDrawer segment={membersDrawer} onClose={() => setMembersDrawer(null)} />
    </Space>
  );
}

function MembersDrawer({ segment, onClose }: { segment: MarketSegment | null; onClose: () => void }) {
  const [members, setMembers] = useState<MarketSegmentMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('');
  const [remark, setRemark] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!segment) return;
    setLoading(true); setError(null);
    try { setMembers(await listSegmentMembers(segment.id)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [segment]);

  // 打开或切换板块时：先清理旧数据（含操作状态），再加载新数据
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) { setMembers([]); setError(null); setAdding(false); setRemovingSymbol(null); }
      if (!segment) return;
      if (!cancelled) { setLoading(true); setError(null); }
      try {
        const r = await listSegmentMembers(segment.id);
        if (!cancelled) setMembers(r);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [segment]);

  const handleAdd = async () => {
    if (!segment || !symbol.trim() || adding) return;
    setAdding(true); setError(null);
    try {
      await addSegmentMember(segment.id, { canonicalSymbol: symbol.trim(), remark: remark.trim() || undefined });
      setSymbol(''); setRemark('');
      message.success('已添加');
      await loadMembers();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (s: string) => {
    if (!segment || removingSymbol) return;
    setRemovingSymbol(s); setError(null);
    try {
      await removeSegmentMember(segment.id, s);
      await loadMembers();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemovingSymbol(null);
    }
  };

  return (
    <Drawer title={segment ? `成员管理：${segment.segmentName}` : ''} open={!!segment} onClose={onClose} width={520}>
      {error && (
        <Alert type="error" message={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={loadMembers}>重试</Button>} />
      )}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="代码 SH.600519" value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={adding} />
          <Input placeholder="备注（可选）" value={remark} onChange={(e) => setRemark(e.target.value)} disabled={adding} />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} loading={adding} disabled={adding}>添加成员</Button>
        </Space>
      </Card>
      <Table<MarketSegmentMember>
        size="small" rowKey="id" loading={loading}
        dataSource={members} pagination={false}
        columns={[
          { title: '代码', dataIndex: 'canonicalSymbol', width: 140 },
          { title: '排序', dataIndex: 'sortOrder', width: 80 },
          { title: '备注', dataIndex: 'remark', ellipsis: true },
          {
            title: '操作', width: 80,
            render: (_, r) => (
              <Popconfirm title="确定移除？" onConfirm={() => handleRemove(r.canonicalSymbol)}
                disabled={removingSymbol === r.canonicalSymbol}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}
                  loading={removingSymbol === r.canonicalSymbol}
                  disabled={removingSymbol !== null && removingSymbol !== r.canonicalSymbol}>移除</Button>
              </Popconfirm>
            ),
          },
        ]}
      />
    </Drawer>
  );
}
