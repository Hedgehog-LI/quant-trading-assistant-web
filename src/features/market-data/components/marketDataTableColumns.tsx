/**
 * 行情数据页各 Tab 的表格列定义。
 *
 * 纯结构拆分：仅把 src/pages/market-data.tsx 各 Tab 内联的 columns 数组移到独立模块，
 * 不改变任何渲染逻辑、列顺序或交互行为（操作列的跳转仍走 openAssetViewer helper）。
 */
import { Button, Popconfirm, Space, Tag } from 'antd';
import type { TableProps } from 'antd';
import { EditOutlined, LineChartOutlined } from '@ant-design/icons';
import type { NavigateFunction } from 'react-router';
import type {
  MarketDataSyncTask,
  StockBasic,
  StockDailyBar,
  StockQuoteSnapshot,
} from '../../../shared/types/domain';
import { dailyBarToAssetViewerParams } from '../../market-assets/utils/assetViewerLink';
import { openAssetViewer } from '../../market-assets/utils/assetViewerNavigation';

type Columns<T> = NonNullable<TableProps<T>['columns']>;

const SYNC_STATUS_COLOR: Record<string, string> = {
  SUCCEEDED: 'green',
  FAILED: 'red',
  PARTIAL_FAILED: 'orange',
  RUNNING: 'blue',
  PENDING: 'default',
};

/** 最新价快照列：纯展示，无外部依赖。 */
export function quoteSnapshotColumns(): Columns<StockQuoteSnapshot> {
  return [
    { title: '代码', dataIndex: 'canonicalSymbol', width: 140 },
    { title: '行情时间', dataIndex: 'quoteTime', width: 160, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
    { title: '最新价', dataIndex: 'currentPrice', width: 100, render: (v: number) => v?.toFixed(2) },
    { title: '开', dataIndex: 'openPrice', width: 80, render: (v?: number) => v?.toFixed(2) ?? '—' },
    { title: '高', dataIndex: 'highPrice', width: 80, render: (v?: number) => v?.toFixed(2) ?? '—' },
    { title: '低', dataIndex: 'lowPrice', width: 80, render: (v?: number) => v?.toFixed(2) ?? '—' },
    { title: '昨收', dataIndex: 'preClosePrice', width: 80, render: (v?: number) => v?.toFixed(2) ?? '—' },
    { title: '成交量', dataIndex: 'volume', width: 100 },
    { title: '来源', dataIndex: 'dataSource', width: 100, render: (v) => <Tag color="blue">{v}</Tag> },
    { title: '抓取时间', dataIndex: 'fetchedAt', width: 160, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
  ];
}

/** 证券主数据列：编辑/删除走参数化的回调，保持组件与表格解耦。 */
export function stockColumns(params: {
  onDelete: (canonical: string) => void;
  onEdit: (stock: StockBasic) => void;
}): Columns<StockBasic> {
  const { onDelete, onEdit } = params;
  return [
    { title: '代码', dataIndex: 'canonicalSymbol', width: 140 },
    { title: '名称', dataIndex: 'name', width: 120 },
    { title: '市场', dataIndex: 'market', width: 80, render: (v) => <Tag>{v}</Tag> },
    { title: '上市日期', dataIndex: 'listDate', width: 120 },
    { title: '退市', dataIndex: 'delisted', width: 80, render: (v) => (v ? <Tag color="red">退市</Tag> : '—') },
    { title: '操作', key: 'action', width: 140, render: (_, r) => (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(r)}>编辑</Button>
        <Popconfirm title="确认删除？" onConfirm={() => onDelete(r.canonicalSymbol)}>
          <Button size="small" danger>删除</Button>
        </Popconfirm>
      </Space>
    ) },
  ];
}

/** 日 K 列：操作列跳转行情查看器，使用统一 helper。 */
export function dailyBarColumns(params: {
  data: StockDailyBar[];
  navigate: NavigateFunction;
}): Columns<StockDailyBar> {
  const { data, navigate } = params;
  return [
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
    {
      title: '操作', width: 90, fixed: 'right',
      render: (_, r) => {
        const p = dailyBarToAssetViewerParams(r);
        return (
          <Button size="small" type="link" icon={<LineChartOutlined />} data-testid={`daily-view-${r.id}`}
            onClick={() => openAssetViewer(navigate, p)}>图表查看</Button>
        );
      },
    },
  ];
}

/** 历史数据同步列：状态配色集中在模块内。 */
export function syncTaskColumns(): Columns<MarketDataSyncTask> {
  return [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '类型', dataIndex: 'taskType', width: 140 },
    { title: 'Provider', dataIndex: 'provider', width: 100 },
    { title: '状态', dataIndex: 'status', width: 120, render: (v) => <Tag color={SYNC_STATUS_COLOR[v] ?? 'default'}>{v}</Tag> },
    { title: '新增', dataIndex: 'insertedCount', width: 60 },
    { title: '更新', dataIndex: 'updatedCount', width: 60 },
    { title: '跳过', dataIndex: 'skippedCount', width: 60 },
    { title: '失败', dataIndex: 'failCount', width: 60 },
    { title: '开始', dataIndex: 'startedAt', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
    { title: '完成', dataIndex: 'finishedAt', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
  ];
}
