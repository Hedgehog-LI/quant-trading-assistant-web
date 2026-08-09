import type {
  BuildDeliveryRecord,
  BuildStatusFilter,
  BuildStatusNode,
  BuildStatusSnapshot,
  DeliveryStatus,
  ValidationStage,
} from './types';

export const STAGE_RANK: Record<ValidationStage, number> = {
  NOT_VERIFIED: 0,
  STATIC_VERIFIED: 1,
  AUTOMATION_VERIFIED: 2,
  RUNTIME_VERIFIED: 3,
  DEPLOYED: 4,
};

/** 是否达到"已验收"口径：至少自动化验证通过。 */
export function isAccepted(stage: ValidationStage): boolean {
  return STAGE_RANK[stage] >= STAGE_RANK.AUTOMATION_VERIFIED;
}

/**
 * 只统计叶子节点（无 children）。
 * 父节点即使标记了状态也不参与计数，避免父子重复计数。
 */
export function collectLeaves(nodes: BuildStatusNode[]): BuildStatusNode[] {
  return nodes.flatMap((node) => {
    if (node.children && node.children.length > 0) {
      return collectLeaves(node.children);
    }
    return [node];
  });
}

export interface BuildOverviewStats {
  /** 已部署可用：叶子 validationStage=DEPLOYED */
  deployed: number;
  /** 已验收待部署：叶子 DELIVERED 且验证层级在 AUTOMATION/RUNTIME，尚未部署 */
  deliveredNotDeployed: number;
  /** 建设中：叶子 deliveryStatus=IN_PROGRESS */
  inProgress: number;
  /** 待开始：叶子 deliveryStatus=PLANNED 或 DESIGNED */
  planned: number;
  /** 阻塞/风险：叶子 deliveryStatus=BLOCKED */
  blocked: number;
  /** 暂缓：叶子 deliveryStatus=DEFERRED（不计入在建） */
  deferred: number;
  /** 叶子总数 */
  totalLeaves: number;
  /** 已纳入计划（非 DEFERRED）的叶子数 */
  plannedTotal: number;
  /** 已验收能力数（validationStage >= AUTOMATION_VERIFIED） */
  accepted: number;
  /** 能力完成率 = accepted / plannedTotal，分子分母必须来自同一批叶子 */
  acceptanceRate: number;
}

/**
 * 从快照推导建设总览统计。
 * 所有数字只来自叶子节点，禁止手填。
 */
export function computeOverviewStats(snapshot: BuildStatusSnapshot): BuildOverviewStats {
  const leaves = collectLeaves(snapshot.capabilities);
  const deployed = leaves.filter((n) => n.validationStage === 'DEPLOYED').length;
  const deliveredNotDeployed = leaves.filter(
    (n) => n.deliveryStatus === 'DELIVERED' && !isDeployed(n),
  ).length;
  const inProgress = leaves.filter((n) => n.deliveryStatus === 'IN_PROGRESS').length;
  const planned = leaves.filter(
    (n) => n.deliveryStatus === 'PLANNED' || n.deliveryStatus === 'DESIGNED',
  ).length;
  const blocked = leaves.filter((n) => n.deliveryStatus === 'BLOCKED').length;
  const deferred = leaves.filter((n) => n.deliveryStatus === 'DEFERRED').length;
  const plannedTotal = leaves.filter((n) => n.deliveryStatus !== 'DEFERRED').length;
  const accepted = leaves.filter((n) => isAccepted(n.validationStage)).length;
  const acceptanceRate = plannedTotal > 0 ? Math.round((accepted / plannedTotal) * 100) : 0;

  return {
    deployed,
    deliveredNotDeployed,
    inProgress,
    planned,
    blocked,
    deferred,
    totalLeaves: leaves.length,
    plannedTotal,
    accepted,
    acceptanceRate,
  };
}

function isDeployed(node: BuildStatusNode): boolean {
  return node.validationStage === 'DEPLOYED';
}

/** 叶子交付记录按日期倒序（最新在前）。 */
export function sortRecentDeliveries(
  deliveries: BuildDeliveryRecord[],
): BuildDeliveryRecord[] {
  return [...deliveries].sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));
}

/** 最近交付默认展示条数与最大条数。 */
export const RECENT_DELIVERIES_DEFAULT = 6;
export const RECENT_DELIVERIES_MAX = 12;

/** 校验快照时间不得早于最近交付日期；否则测试失败。 */
export function snapshotAtIsValid(snapshot: BuildStatusSnapshot): boolean {
  const latest = sortRecentDeliveries(snapshot.recentDeliveries)[0];
  if (!latest) {
    return true;
  }
  return snapshot.snapshotAt.localeCompare(latest.deliveredAt) >= 0;
}

export interface DeliveryStatusCount {
  status: DeliveryStatus;
  count: number;
}

/** 各研发状态叶子计数，供测试与图例使用。 */
export function countByDeliveryStatus(snapshot: BuildStatusSnapshot): DeliveryStatusCount[] {
  const leaves = collectLeaves(snapshot.capabilities);
  const order: DeliveryStatus[] = [
    'DELIVERED',
    'IN_PROGRESS',
    'PLANNED',
    'DESIGNED',
    'BLOCKED',
    'DEFERRED',
  ];
  return order.map((status) => ({
    status,
    count: leaves.filter((n) => n.deliveryStatus === status).length,
  }));
}

/** 模块筛选：节点或其后代命中该 category 则保留路径。 */
function nodeMatchesFilter(node: BuildStatusNode, filter: BuildStatusFilter): boolean {
  const priorityMatched = !filter.priority || filter.priority === 'ALL' || node.priority === filter.priority;
  const statusMatched =
    !filter.deliveryStatus || filter.deliveryStatus === 'ALL' || node.deliveryStatus === filter.deliveryStatus;
  const stageMatched =
    !filter.validationStage ||
    filter.validationStage === 'ALL' ||
    node.validationStage === filter.validationStage;
  const moduleMatched = !filter.module || filter.module === 'ALL' || node.category === filter.module;
  return priorityMatched && statusMatched && stageMatched && moduleMatched;
}

/** 过滤能力树：命中或存在命中后代时保留节点路径。 */
export function filterBuildTree(
  nodes: BuildStatusNode[],
  filter: BuildStatusFilter,
): BuildStatusNode[] {
  return nodes
    .map<BuildStatusNode | null>((node) => {
      const children = filterBuildTree(node.children ?? [], filter);
      if (nodeMatchesFilter(node, filter) || children.length > 0) {
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
