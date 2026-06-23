import { Typography, Spin, Alert, Tag } from 'antd';
import { useDashboard } from '../features/dashboard/hooks/useDashboard';
import { DashboardStats } from '../features/dashboard/components/DashboardStats';
import { QuickActions } from '../features/dashboard/components/QuickActions';

export function DashboardPage() {
  const { summary, loading, error, apiMode, refresh } = useDashboard();

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        今日工作台{summary ? ` — ${summary.date}` : ''}
        <Tag color={apiMode === 'remote' ? 'blue' : 'default'} style={{ marginLeft: 12 }}>
          {apiMode === 'remote' ? '后端模式' : '本地模式'}
        </Tag>
      </Typography.Title>
      <QuickActions />
      <div style={{ marginTop: 16 }}>
        {error ? (
          <Alert
            type="error"
            message="看板加载失败"
            description={error}
            action={<a onClick={() => void refresh()}>重试</a>}
          />
        ) : loading || !summary ? (
          <Spin />
        ) : (
          <DashboardStats summary={summary} />
        )}
      </div>
    </div>
  );
}
