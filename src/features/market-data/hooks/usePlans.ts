/**
 * 采集计划列表加载与"立即执行"逻辑。
 * 纯结构拆分：从 src/pages/market-workspace.tsx 的 PlansTab 移出，行为不变。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { listSyncPlans, runSyncPlan } from '../api/workbenchApi';
import type { PageResult } from '../api/workbenchApi';
import type { MarketDataSyncPlan } from '../../../shared/types/domain';

export function usePlans() {
  const [data, setData] = useState<PageResult<MarketDataSyncPlan>>({ items: [], total: 0, page: 1, size: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [itemsDrawerPlan, setItemsDrawerPlan] = useState<MarketDataSyncPlan | null>(null);
  const runSeqRef = useRef(0);

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

  return { data, loading, error, page, setPage, runningIds, itemsDrawerPlan, setItemsDrawerPlan, load, handleRun };
}
