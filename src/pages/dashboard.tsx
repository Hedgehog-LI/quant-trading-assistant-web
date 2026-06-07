import { Typography } from 'antd';
import { useDashboard } from '../features/dashboard/hooks/useDashboard';
import { DashboardStats } from '../features/dashboard/components/DashboardStats';
import { QuickActions } from '../features/dashboard/components/QuickActions';

export function DashboardPage() {
  const summary = useDashboard();

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        今日工作台 — {summary.date}
      </Typography.Title>
      <QuickActions />
      <div style={{ marginTop: 16 }}>
        <DashboardStats summary={summary} />
      </div>
    </div>
  );
}
