/**
 * 今日工作台聚合 hook（v0.1.1）。
 *
 * remote 模式直接使用后端 GET /dashboard/today 聚合结果（含 todos），
 * mock 模式由 dashboardApi 的纯函数按相同口径计算。
 * 不再在前端分别请求四份数据形成另一套口径。
 */
import { useState, useCallback, useEffect } from 'react';
import { fetchDashboardToday } from '../api/dashboardApi';
import { getSettings } from '../../settings/api/settingsApi';
import type { DashboardSummary } from '../../../shared/types/domain';

export interface UseDashboardResult {
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  /** 当前数据模式（供页面展示数据源提示） */
  apiMode: 'mock' | 'remote';
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboardResult {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiMode = getSettings().apiMode;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchDashboardToday());
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
        const result = await fetchDashboardToday();
        if (!cancelled) setSummary(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return { summary, loading, error, apiMode, refresh };
}
