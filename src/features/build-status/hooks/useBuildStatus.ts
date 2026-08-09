import { useMemo, useState } from 'react';
import { buildStatusSnapshot } from '../data/buildStatusSnapshot';
import type {
  BuildPriority,
  BuildStatusFilter,
  BuildStatusNode,
  DeliveryStatus,
  ValidationStage,
} from '../model/types';
import {
  collectLeaves,
  computeOverviewStats,
  filterBuildTree,
  RECENT_DELIVERIES_DEFAULT,
  RECENT_DELIVERIES_MAX,
  sortRecentDeliveries,
} from '../model/selectors';

export interface UseBuildStatusResult {
  snapshot: typeof buildStatusSnapshot;
  overview: ReturnType<typeof computeOverviewStats>;
  recentDeliveries: ReturnType<typeof sortRecentDeliveries>;
  tree: BuildStatusNode[];
  flatLeaves: BuildStatusNode[];
  selectedNode: BuildStatusNode | null;
  filter: BuildStatusFilter;
  showAllDeliveries: boolean;
  setPriority: (priority: BuildPriority | 'ALL') => void;
  setDeliveryStatus: (status: DeliveryStatus | 'ALL') => void;
  setValidationStage: (stage: ValidationStage | 'ALL') => void;
  setModule: (module: string | 'ALL') => void;
  resetFilter: () => void;
  selectNode: (id: string) => void;
  clearSelection: () => void;
  toggleShowAllDeliveries: () => void;
}

export function useBuildStatus(): UseBuildStatusResult {
  const [filter, setFilter] = useState<BuildStatusFilter>({
    priority: 'ALL',
    deliveryStatus: 'ALL',
    validationStage: 'ALL',
    module: 'ALL',
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAllDeliveries, setShowAllDeliveries] = useState(false);

  const tree = useMemo(() => filterBuildTree(buildStatusSnapshot.capabilities, filter), [filter]);
  const flatLeaves = useMemo(() => collectLeaves(buildStatusSnapshot.capabilities), []);
  const selectedNode = useMemo(
    () => flatLeaves.find((node) => node.id === selectedId) ?? null,
    [flatLeaves, selectedId],
  );
  const overview = useMemo(() => computeOverviewStats(buildStatusSnapshot), []);
  const recentDeliveries = useMemo(() => sortRecentDeliveries(buildStatusSnapshot.recentDeliveries), []);

  return {
    snapshot: buildStatusSnapshot,
    overview,
    recentDeliveries,
    tree,
    flatLeaves,
    selectedNode,
    filter,
    showAllDeliveries,
    setPriority: (priority) => setFilter((prev) => ({ ...prev, priority })),
    setDeliveryStatus: (deliveryStatus) => setFilter((prev) => ({ ...prev, deliveryStatus })),
    setValidationStage: (validationStage) => setFilter((prev) => ({ ...prev, validationStage })),
    setModule: (module) => setFilter((prev) => ({ ...prev, module })),
    resetFilter: () =>
      setFilter({ priority: 'ALL', deliveryStatus: 'ALL', validationStage: 'ALL', module: 'ALL' }),
    selectNode: setSelectedId,
    clearSelection: () => setSelectedId(null),
    toggleShowAllDeliveries: () => setShowAllDeliveries((prev) => !prev),
  };
}

export { RECENT_DELIVERIES_DEFAULT, RECENT_DELIVERIES_MAX };
