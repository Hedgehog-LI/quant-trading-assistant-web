import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Spin } from 'antd';
import { AppLayout } from './layout';

const DashboardPage = lazy(() => import('../pages/dashboard').then((m) => ({ default: m.DashboardPage })));
const WatchlistPage = lazy(() => import('../pages/watchlist').then((m) => ({ default: m.WatchlistPage })));
const TradePlanPage = lazy(() => import('../pages/trade-plan').then((m) => ({ default: m.TradePlanPage })));
const RiskPage = lazy(() => import('../pages/risk').then((m) => ({ default: m.RiskPage })));
const JournalPage = lazy(() => import('../pages/journal').then((m) => ({ default: m.JournalPage })));
const PortfolioPage = lazy(() => import('../pages/portfolio').then((m) => ({ default: m.PortfolioPage })));
const ReviewPage = lazy(() => import('../pages/review').then((m) => ({ default: m.ReviewPage })));
const SettingsPage = lazy(() => import('../pages/settings').then((m) => ({ default: m.SettingsPage })));
const BuildStatusPage = lazy(() => import('../pages/build-status').then((m) => ({ default: m.BuildStatusPage })));
const NotFoundPage = lazy(() => import('../pages/not-found').then((m) => ({ default: m.NotFoundPage })));

function PageLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
      <Spin />
    </div>
  );
}

/**
 * 应用路由定义。页面组件使用 React.lazy 实现路由级懒加载。
 */
export function AppRouter() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/trade-plan" element={<TradePlanPage />} />
          <Route path="/risk" element={<RiskPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/build-status" element={<BuildStatusPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
