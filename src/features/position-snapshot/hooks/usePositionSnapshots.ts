import { useCallback, useEffect, useState } from 'react';
import { getSettings } from '../../settings/api/settingsApi';
import { positionSnapshotApi } from '../api/positionSnapshotApi';
import type {
  PositionSnapshotFilter,
  PositionSnapshotSaveInput,
  PositionSnapshotSummary,
  PositionSnapshotDetail,
  PositionSnapshotUpdateInput,
} from '../model/types';

export function usePositionSnapshots() {
  const [items, setItems] = useState<PositionSnapshotSummary[]>([]);
  const [latest, setLatest] = useState<PositionSnapshotDetail | null>(null);
  const [filters, setFilters] = useState<PositionSnapshotFilter>({ includeCanceled: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiMode = getSettings().apiMode;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, latestSnapshot] = await Promise.all([
        positionSnapshotApi.list(filters),
        positionSnapshotApi.getLatest(),
      ]);
      setItems(list);
      setLatest(latestSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载持仓快照失败');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [list, latestSnapshot] = await Promise.all([
          positionSnapshotApi.list(filters),
          positionSnapshotApi.getLatest(),
        ]);
        if (cancelled) return;
        setItems(list);
        setLatest(latestSnapshot);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载持仓快照失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [filters]);

  const create = useCallback(async (input: PositionSnapshotSaveInput) => {
    const result = await positionSnapshotApi.create(input);
    await refresh();
    return result;
  }, [refresh]);

  const update = useCallback(async (id: string | number, input: PositionSnapshotUpdateInput) => {
    const result = await positionSnapshotApi.update(id, input);
    await refresh();
    return result;
  }, [refresh]);

  const confirm = useCallback(async (id: string | number) => {
    const result = await positionSnapshotApi.confirm(id);
    await refresh();
    return result;
  }, [refresh]);

  const cancel = useCallback(async (id: string | number) => {
    const result = await positionSnapshotApi.cancel(id);
    await refresh();
    return result;
  }, [refresh]);

  return {
    items,
    latest,
    filters,
    loading,
    error,
    apiMode,
    setFilters,
    refresh,
    create,
    update,
    confirm,
    cancel,
    getById: positionSnapshotApi.getById,
  };
}
