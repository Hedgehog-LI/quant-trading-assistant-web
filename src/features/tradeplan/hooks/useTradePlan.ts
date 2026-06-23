/**
 * 交易计划状态管理 hook。
 *
 * 跟随项目现有风格（useState + useCallback + refresh），不引入 react-query。
 * - mount 时拉取全量计划；
 * - 维护 loading / error / empty 三态；
 * - add / update / updateStatus 均为 async，写入后 refresh；
 * - apiMode 供页面展示数据源提示。
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  getTradePlans,
  addTradePlan,
  updateTradePlan,
  updateTradePlanStatus,
  deleteTradePlan,
} from '../api/tradePlanApi';
import type { TradePlanInput, TradePlanUpdateInput } from '../api/tradePlanApi';
import { getSettings } from '../../settings/api/settingsApi';
import { today } from '../../../shared/utils/date';
import type { EntityId, PlanStatus, TradePlan } from '../../../shared/types/domain';

export interface UseTradePlanResult {
  items: TradePlan[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  apiMode: 'mock' | 'remote';
  refresh: () => Promise<void>;
  add: (input: TradePlanInput) => Promise<void>;
  update: (id: EntityId, input: TradePlanUpdateInput) => Promise<void>;
  updateStatus: (id: EntityId, planStatus: PlanStatus) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
}

export function useTradePlan(): UseTradePlanResult {
  const [items, setItems] = useState<TradePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiMode = getSettings().apiMode;

  // 手动刷新（事件触发，含 loading 态切换）。
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTradePlans();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 挂载时拉取：fetch 逻辑内联为局部 async 函数，所有 setState 都在 await 之后，
  // effect 同步路径不触发 setState（loading 初值已为 true）。
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getTradePlans();
        if (cancelled) return;
        setItems(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const add = useCallback(
    async (input: TradePlanInput) => {
      const upper = input.symbol.trim().toUpperCase();
      const planDate = input.planDate;
      if (items.some((i) => i.symbol === upper && i.planDate === planDate)) {
        throw new Error(`该股票在 ${planDate} 已有交易计划`);
      }
      await addTradePlan(input);
      await refresh();
    },
    [items, refresh],
  );

  const update = useCallback(
    async (id: EntityId, input: TradePlanUpdateInput) => {
      await updateTradePlan(id, input);
      await refresh();
    },
    [refresh],
  );

  const updateStatus = useCallback(
    async (id: EntityId, planStatus: PlanStatus) => {
      await updateTradePlanStatus(id, planStatus);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: EntityId) => {
      await deleteTradePlan(id);
      await refresh();
    },
    [refresh],
  );

  const isEmpty = !loading && !error && items.length === 0;

  return { items, loading, error, isEmpty, apiMode, refresh, add, update, updateStatus, remove };
}

export function useTradePlanFiltered(items: TradePlan[]) {
  const [dateFilter, setDateFilter] = useState<string>(today());
  const [symbolFilter, setSymbolFilter] = useState('');

  const filtered = useMemo(() => {
    let result = items;
    if (dateFilter) {
      result = result.filter((i) => i.planDate === dateFilter);
    }
    if (symbolFilter.trim()) {
      const kw = symbolFilter.trim().toUpperCase();
      result = result.filter(
        (i) => i.symbol.toUpperCase().includes(kw) || (i.name ?? '').includes(symbolFilter.trim()),
      );
    }
    return result;
  }, [items, dateFilter, symbolFilter]);

  return { filtered, dateFilter, setDateFilter, symbolFilter, setSymbolFilter };
}
