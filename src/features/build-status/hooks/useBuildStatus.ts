import { useMemo, useState } from 'react';
import { buildCapabilities, buildStatusTree, buildSummaryCards } from '../api/buildStatusData';
import type { BuildMaturity, BuildPriority, BuildStatus, BuildStatusFilter, BuildStatusNode } from '../model/types';

export function flattenBuildNodes(nodes: BuildStatusNode[]): BuildStatusNode[] {
  return nodes.flatMap((node) => [node, ...flattenBuildNodes(node.children ?? [])]);
}

function matchesFilter(node: BuildStatusNode, filter: BuildStatusFilter): boolean {
  const priorityMatched = !filter.priority || filter.priority === 'ALL' || node.priority === filter.priority;
  const statusMatched = !filter.status || filter.status === 'ALL' || node.status === filter.status;
  const maturityMatched = !filter.maturity || filter.maturity === 'ALL' || node.maturity === filter.maturity;
  return priorityMatched && statusMatched && maturityMatched;
}

export function filterBuildTree(nodes: BuildStatusNode[], filter: BuildStatusFilter): BuildStatusNode[] {
  return nodes
    .map<BuildStatusNode | null>((node) => {
      const children = filterBuildTree(node.children ?? [], filter);
      if (matchesFilter(node, filter) || children.length > 0) {
        const nextNode: BuildStatusNode = { ...node, children };
        if (children.length === 0) {
          delete nextNode.children;
        }
        return nextNode;
      }
      return null;
    })
    .filter((node): node is BuildStatusNode => node !== null);
}

export interface UseBuildStatusResult {
  summaryCards: typeof buildSummaryCards;
  capabilities: typeof buildCapabilities;
  tree: BuildStatusNode[];
  flatNodes: BuildStatusNode[];
  selectedNode: BuildStatusNode | null;
  filter: BuildStatusFilter;
  setPriority: (priority: BuildPriority | 'ALL') => void;
  setStatus: (status: BuildStatus | 'ALL') => void;
  setMaturity: (maturity: BuildMaturity | 'ALL') => void;
  selectNode: (id: string) => void;
  clearSelection: () => void;
}

export function useBuildStatus(): UseBuildStatusResult {
  const [filter, setFilter] = useState<BuildStatusFilter>({ priority: 'ALL', status: 'ALL', maturity: 'ALL' });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tree = useMemo(() => filterBuildTree(buildStatusTree, filter), [filter]);
  const flatNodes = useMemo(() => flattenBuildNodes(buildStatusTree), []);
  const selectedNode = useMemo(
    () => flatNodes.find((node) => node.id === selectedId) ?? null,
    [flatNodes, selectedId],
  );

  return {
    summaryCards: buildSummaryCards,
    capabilities: buildCapabilities,
    tree,
    flatNodes,
    selectedNode,
    filter,
    setPriority: (priority) => setFilter((prev) => ({ ...prev, priority })),
    setStatus: (status) => setFilter((prev) => ({ ...prev, status })),
    setMaturity: (maturity) => setFilter((prev) => ({ ...prev, maturity })),
    selectNode: setSelectedId,
    clearSelection: () => setSelectedId(null),
  };
}
