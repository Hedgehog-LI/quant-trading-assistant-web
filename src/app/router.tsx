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
const PositionSnapshotPage = lazy(() => import('../pages/position-snapshot').then((m) => ({ default: m.PositionSnapshotPage })));
const ReviewPage = lazy(() => import('../pages/review').then((m) => ({ default: m.ReviewPage })));
const MarketDataPage = lazy(() => import('../pages/market-data').then((m) => ({ default: m.MarketDataPage })));
const MarketWorkspacePage = lazy(() => import('../pages/market-workspace').then((m) => ({ default: m.MarketWorkspacePage })));
const MarketSegmentsPage = lazy(() => import('../pages/market-segments').then((m) => ({ default: m.MarketSegmentsPage })));
const MarketAssetsPage = lazy(() => import('../pages/market-assets').then((m) => ({ default: m.MarketAssetsPage })));
const MarketResearchPage = lazy(() => import('../pages/market-research').then((m) => ({ default: m.MarketResearchPage })));
const MarketResearchSectorPage = lazy(() => import('../pages/market-research-sector').then((m) => ({ default: m.MarketResearchSectorPage })));
const DataFoundationPage = lazy(() => import('../pages/data-foundation').then((m) => ({ default: m.DataFoundationPage })));
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
          <Route path="/position-snapshots" element={<PositionSnapshotPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/market-data" element={<MarketDataPage />} />
          <Route path="/market-workspace" element={<MarketWorkspacePage />} />
          <Route path="/market-segments" element={<MarketSegmentsPage />} />
          <Route path="/market-assets" element={<MarketAssetsPage />} />
          <Route path="/market-research" element={<MarketResearchPage />} />
          <Route path="/market-research/sectors/:sectorId" element={<MarketResearchSectorPage />} />
          <Route path="/data-foundation" element={<DataFoundationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/build-status" element={<BuildStatusPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
