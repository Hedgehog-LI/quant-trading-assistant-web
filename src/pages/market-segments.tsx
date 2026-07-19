import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Drawer, Form, Input, message, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, TeamOutlined, ReloadOutlined, FundOutlined, StarOutlined, HistoryOutlined } from '@ant-design/icons';
import {
  createSegment, listSegments, deleteSegment,
  listSegmentMembers, addSegmentMember, removeSegmentMember,
  type SegmentInput, type SegmentFilter,
} from '../features/market-data/api/segmentApi';
import {
  getIndustryPeers, listIndustryRankings,
  createSectorWatch, deleteSectorWatch, listSectorSnapshotMembers, listSectorSnapshots,
  listSectorWatches, refreshSectorWatch, toggleSectorWatch,
  type SectorMarket, type SectorRankIndicator,
} from '../features/market-data/api/sectorCatalogApi';
import type { MarketSegment, MarketSegmentMember, EntityId, MarketSectorMemberSnapshot,
  MarketSectorPeer, MarketSectorRank, MarketSectorSnapshot, MarketSectorWatch } from '../shared/types/domain';

interface PageResult<T> { items: T[]; total: number; page: number; size: number; }

const { Title, Text } = Typography;

export function MarketSegmentsPage() {
  return (
    <div>
      <Title level={4}>板块管理</Title>
      <Text type="secondary">查看市场行业排行，并维护个人观察分组。板块热度只用于行情观察，不构成投资建议。</Text>
      <Tabs
        style={{ marginTop: 16 }}
        items={[
          { key: 'market', label: '市场板块', children: <MarketSectorTab /> },
          { key: 'watch', label: '我的关注', children: <MarketSectorWatchTab /> },
          { key: 'custom', label: '自定义分组', children: <SegmentListTab /> },
        ]}
      />
    </div>
  );
}

const indicatorOptions: { value: SectorRankIndicator; label: string }[] = [
  { value: 'leading-gainer', label: '领涨' },
  { value: 'today-trend', label: '今日趋势' },
  { value: 'popularity', label: '热度' },
  { value: 'market-cap', label: '市值' },
  { value: 'revenue-growth', label: '营收增长' },
  { value: 'net-profit-growth', label: '净利润增长' },
];

function MarketSectorTab() {
  const [market, setMarket] = useState<SectorMarket>('CN');
  const [indicator, setIndicator] = useState<SectorRankIndicator>('leading-gainer');
  const [data, setData] = useState<MarketSectorRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peer, setPeer] = useState<MarketSectorPeer | null>(null);
  const [peerLoading, setPeerLoading] = useState(false);
  const [followTarget, setFollowTarget] = useState<MarketSectorRank | null>(null);
  const [trackingSymbol, setTrackingSymbol] = useState('');
  const [following, setFollowing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await listIndustryRankings({ market, indicator, limit: 20 })); }
    catch (e) { setError((e as Error).message); setData([]); }
    finally { setLoading(false); }
  }, [market, indicator]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const result = await listIndustryRankings({ market, indicator, limit: 20 });
        if (!cancelled) { setData(result); setError(null); }
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setData([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [market, indicator]);

  const openPeer = async (row: MarketSectorRank) => {
    setPeerLoading(true); setError(null);
    try { setPeer(await getIndustryPeers(row.market, row.providerSectorId)); }
    catch (e) { setError((e as Error).message); }
    finally { setPeerLoading(false); }
  };

  const follow = async () => {
    if (!followTarget) return;
    setFollowing(true);
    try {
      await createSectorWatch({ market: followTarget.market, providerSectorId: followTarget.providerSectorId,
        trackingSymbol: trackingSymbol.trim() || undefined });
      message.success(`已关注 ${followTarget.name}`);
      setFollowTarget(null); setTrackingSymbol('');
    } catch (e) { message.error((e as Error).message); }
    finally { setFollowing(false); }
  };

  const percent = (value?: number) => value == null ? '-' : `${(value * 100).toFixed(2)}%`;
  const changeColor = (value?: number) => value == null ? undefined : value >= 0 ? '#cf1322' : '#389e0d';

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      {data[0]?.providerCode === 'LOCAL_DEMO' && (
        <Alert type="info" showIcon title="当前为本地模式，以下为界面演示数据；切换后端模式后读取 LongPort 行业排行。" />
      )}
      {error && <Alert type="error" title={error} action={<Button onClick={load}>重试</Button>} />}
      <Space wrap>
        <Select<SectorMarket> value={market} onChange={setMarket} style={{ width: 120 }} options={[
          { value: 'CN', label: 'A 股' }, { value: 'HK', label: '港股' }, { value: 'US', label: '美股' },
        ]} />
        <Select<SectorRankIndicator> value={indicator} onChange={setIndicator}
          style={{ width: 150 }} options={indicatorOptions} />
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>
      </Space>
      <Table<MarketSectorRank> size="small" rowKey="providerSectorId" loading={loading}
        dataSource={data} pagination={false} scroll={{ x: 760 }}
        columns={[
          { title: '板块', dataIndex: 'name', width: 180 },
          { title: '涨跌幅', dataIndex: 'changeRate', width: 100,
            render: (v?: number) => <Text style={{ color: changeColor(v) }}>{percent(v)}</Text> },
          { title: '领涨标的', width: 190,
            render: (_, r) => <Space><Text>{r.leadingName ?? '-'}</Text>{r.leadingSymbol && <Tag>{r.leadingSymbol}</Tag>}</Space> },
          { title: '领涨幅', dataIndex: 'leadingChangeRate', width: 100,
            render: (v?: number) => <Text style={{ color: changeColor(v) }}>{percent(v)}</Text> },
          { title: '数据源', dataIndex: 'providerCode', width: 110, render: (v: string) => <Tag>{v}</Tag> },
          { title: '操作', width: 170,
            render: (_, r) => <Space size={0}>
              <Button type="link" size="small" icon={<FundOutlined />}
                loading={peerLoading && peer?.providerSectorId !== r.providerSectorId}
                onClick={() => openPeer(r)}>层级</Button>
              <Button type="link" size="small" icon={<StarOutlined />} onClick={() => setFollowTarget(r)}>关注</Button>
            </Space> },
        ]} />
      <Alert type="warning" showIcon
        title="板块涨跌与热度不等于资金净流入；ETF 可按普通证券代码加入行情采集计划。" />
      <Drawer title="行业层级" open={!!peer} onClose={() => setPeer(null)} size={420} loading={peerLoading}>
        {peer && <Space orientation="vertical" size="middle">
          <Title level={5}>{peer.name}</Title>
          <Text type="secondary">{peer.topName ?? '行业'} / {peer.providerSectorId}</Text>
          <Space wrap>
            <Tag>成分数量 {peer.stockCount ?? '-'}</Tag>
            <Tag>当日 {percent(peer.changeRate)}</Tag>
            <Tag>年内 {percent(peer.yearToDateChangeRate)}</Tag>
          </Space>
          <Text>{peer.hasChildren ? '该节点包含下级行业，可在后续成分同步阶段继续展开。' : '当前节点没有可用的下级行业。'}</Text>
        </Space>}
      </Drawer>
      <Modal title={followTarget ? `关注：${followTarget.name}` : '关注行业'} open={!!followTarget}
        onCancel={() => { setFollowTarget(null); setTrackingSymbol(''); }} onOk={follow}
        okText="确认关注" confirmLoading={following}>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Text type="secondary">确认后会立即保存一份板块及成分行情快照。</Text>
          <Input value={trackingSymbol} onChange={(e) => setTrackingSymbol(e.target.value)}
            placeholder="可选：关联 ETF/指数，如 SH.512480" />
        </Space>
      </Modal>
    </Space>
  );
}

function MarketSectorWatchTab() {
  const [data, setData] = useState<MarketSectorWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MarketSectorWatch | null>(null);
  const [snapshots, setSnapshots] = useState<MarketSectorSnapshot[]>([]);
  const [members, setMembers] = useState<MarketSectorMemberSnapshot[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await listSectorWatches()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const result = await listSectorWatches();
        if (!cancelled) { setData(result); setError(null); }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  const refresh = async (row: MarketSectorWatch) => {
    setBusyId(String(row.id));
    try { await refreshSectorWatch(row.id); message.success('板块快照已刷新'); await load(); }
    catch (e) { message.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const toggle = async (row: MarketSectorWatch, enabled: boolean) => {
    setBusyId(String(row.id));
    try { await toggleSectorWatch(row.id, enabled); await load(); }
    catch (e) { message.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const remove = async (row: MarketSectorWatch) => {
    setBusyId(String(row.id));
    try { await deleteSectorWatch(row.id); message.success('已取消关注'); await load(); }
    catch (e) { message.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const openDetail = async (row: MarketSectorWatch) => {
    setDetail(row); setDetailLoading(true); setSnapshots([]); setMembers([]);
    try {
      const history = await listSectorSnapshots(row.id, 1, 30);
      setSnapshots(history.items);
      if (history.items[0]) setMembers(await listSectorSnapshotMembers(history.items[0].id));
    } catch (e) { message.error((e as Error).message); }
    finally { setDetailLoading(false); }
  };

  const percent = (value?: number) => value == null ? '-' : `${(value * 100).toFixed(2)}%`;
  const amount = (value?: number) => value == null ? '-' : Intl.NumberFormat('zh-CN', {
    notation: 'compact', maximumFractionDigits: 2,
  }).format(value);

  return <Space orientation="vertical" style={{ width: '100%' }} size="middle">
    {error && <Alert type="error" title={error} action={<Button onClick={load}>重试</Button>} />}
    <Space><Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新列表</Button>
      <Text type="secondary">每次手动刷新保存一份不可变快照，可用于后续板块强弱与资金趋势分析。</Text></Space>
    <Table<MarketSectorWatch> size="small" rowKey="id" loading={loading} dataSource={data}
      scroll={{ x: 1100 }} pagination={false} locale={{ emptyText: '尚未关注行业，请从“市场板块”添加' }}
      columns={[
        { title: '市场', dataIndex: 'marketCode', width: 70, render: (v: string) => <Tag>{v}</Tag> },
        { title: '行业', dataIndex: 'sectorName', width: 170 },
        { title: '上级', dataIndex: 'topName', width: 120, render: (v?: string) => v ?? '-' },
        { title: '关联 ETF/指数', dataIndex: 'trackingSymbol', width: 130, render: (v?: string) => v ? <Tag>{v}</Tag> : '-' },
        { title: '涨跌', width: 90, render: (_, r) => percent(r.latestSnapshot?.changeRate) },
        { title: '净流入', width: 100, render: (_, r) => amount(r.latestSnapshot?.totalNetInflow) },
        { title: '成交额', width: 100, render: (_, r) => amount(r.latestSnapshot?.totalTurnoverAmount) },
        { title: '成分', width: 70, render: (_, r) => r.latestSnapshot?.constituentCount ?? '-' },
        { title: '启用', width: 70, render: (_, r) => <Switch size="small" checked={r.enabled}
          loading={busyId === String(r.id)} onChange={(checked) => toggle(r, checked)} /> },
        { title: '操作', width: 220, fixed: 'right', render: (_, r) => <Space size={0}>
          <Button type="link" size="small" icon={<ReloadOutlined />} loading={busyId === String(r.id)} onClick={() => refresh(r)}>采集</Button>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => openDetail(r)}>历史</Button>
          <Popconfirm title="取消关注并删除历史快照？" onConfirm={() => remove(r)}>
            <Button danger type="link" size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space> },
      ]} />
    <Drawer title={detail ? `${detail.sectorName} · 数据资产` : '行业数据资产'} open={!!detail}
      onClose={() => setDetail(null)} size={760} loading={detailLoading}>
      <Title level={5}>历史快照</Title>
      <Table<MarketSectorSnapshot> size="small" rowKey="id" dataSource={snapshots} pagination={false}
        scroll={{ x: 780 }} columns={[
          { title: '时间', dataIndex: 'snapshotTime', width: 170, render: (v: string) => new Date(v).toLocaleString() },
          { title: '涨跌', dataIndex: 'changeRate', width: 90, render: percent },
          { title: '年内', dataIndex: 'yearToDateChangeRate', width: 90, render: percent },
          { title: '净流入', dataIndex: 'totalNetInflow', width: 100, render: amount },
          { title: '成交额', dataIndex: 'totalTurnoverAmount', width: 100, render: amount },
          { title: '上涨/下跌', width: 100, render: (_, r) => `${r.riseCount ?? '-'}/${r.fallCount ?? '-'}` },
          { title: '领涨', dataIndex: 'leadingName', width: 120, render: (v?: string) => v ?? '-' },
        ]} />
      <Title level={5} style={{ marginTop: 24 }}>最新成分</Title>
      <Table<MarketSectorMemberSnapshot> size="small" rowKey="id" dataSource={members} pagination={{ pageSize: 20 }}
        scroll={{ x: 820 }} columns={[
          { title: '证券', width: 170, render: (_, r) => <Space><Text>{r.securityName}</Text><Tag>{r.canonicalSymbol}</Tag></Space> },
          { title: '现价', dataIndex: 'currentPrice', width: 90, render: (v?: number) => v ?? '-' },
          { title: '涨跌', dataIndex: 'changeRate', width: 90, render: percent },
          { title: '净流入', dataIndex: 'netInflow', width: 100, render: amount },
          { title: '成交额', dataIndex: 'turnoverAmount', width: 100, render: amount },
          { title: '标签', dataIndex: 'tags', width: 180, render: (v?: string) => v ?? '-' },
          { title: '延迟', dataIndex: 'delayed', width: 70, render: (v: boolean) => v ? <Tag>延迟</Tag> : <Tag color="green">实时</Tag> },
        ]} />
    </Drawer>
  </Space>;
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

  if (error) return <Alert type="error" title={error} action={<Button onClick={() => load(page)}>重试</Button>} />;

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>新建分组</Button>
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
      <Drawer title="新建分组" open={drawerOpen} onClose={() => setDrawerOpen(false)} size={420}
        extra={<Space><Button onClick={() => setDrawerOpen(false)} disabled={creating}>取消</Button><Button type="primary" onClick={handleCreate} loading={creating}>创建</Button></Space>}>
        <Form form={form} layout="vertical" initialValues={{ segmentType: 'CUSTOM', enabled: true }}>
          <Form.Item name="segmentName" label="板块名称" rules={[{ required: true }]}><Input placeholder="白酒观察池" /></Form.Item>
          <Form.Item name="segmentType" label="分组类型"><Select disabled options={[{ value: 'CUSTOM', label: '自定义分组' }]} /></Form.Item>
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
    <Drawer title={segment ? `成员管理：${segment.segmentName}` : ''} open={!!segment} onClose={onClose} size={520}>
      {error && (
        <Alert type="error" title={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={loadMembers}>重试</Button>} />
      )}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Input placeholder="如 SH.600519 / HK.02498 / US.AAPL" value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={adding} />
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
