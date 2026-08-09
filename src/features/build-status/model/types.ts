/**
 * 建设看板 V2 数据模型。
 * 状态口径与统计规则以 docs/features/BUILD_STATUS_BOARD_V2_DESIGN.md 为准，
 * 禁止手填总体百分比，统计一律由叶子节点通过 selector 推导。
 */

export type BuildPriority = 'P0' | 'P1' | 'P2' | 'P3';

/** 研发状态：代码完成不等于已部署，研发状态与验证层级分开表达。 */
export type DeliveryStatus =
  | 'PLANNED'
  | 'DESIGNED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'BLOCKED'
  | 'DEFERRED';

/** 验证层级：只能逐级提升，服务器部署事实不能由本地测试推断。 */
export type ValidationStage =
  | 'NOT_VERIFIED'
  | 'STATIC_VERIFIED'
  | 'AUTOMATION_VERIFIED'
  | 'RUNTIME_VERIFIED'
  | 'DEPLOYED';

/** 最近交付的阶段标签。 */
export type DeliveryStage = 'DESIGN' | 'AUTOMATION' | 'RUNTIME' | 'DEPLOYED';

export interface BuildDocLink {
  label: string;
  /** 仓库相对路径，禁止绝对本机路径。 */
  path: string;
}

export interface BuildDeliveryRecord {
  /** 验收或部署日期，格式 YYYY-MM-DD。 */
  deliveredAt: string;
  /** 用户能理解的功能名称。 */
  title: string;
  /** 本轮实际新增或修复了什么，最多两句。 */
  summary: string;
  /** 影响模块。 */
  modules: string[];
  /** 代码完成 / 自动化验收 / 运行验收 / 生产部署。 */
  stage: DeliveryStage;
  backendCommit?: string;
  frontendCommit?: string;
  /** 指向验收日志标题或任务验收文档。 */
  acceptanceRef: string;
  /** 仍未验证或明确不包含的边界。 */
  limitations: string[];
}

export interface BuildStatusNode {
  id: string;
  title: string;
  category: string;
  priority: BuildPriority;
  deliveryStatus: DeliveryStatus;
  validationStage: ValidationStage;
  /** 用户价值：这个能力解决什么。 */
  productValue: string;
  /** 已交付内容（证据）。 */
  deliveredContent: string[];
  /** 完成标准（验收口径）。 */
  completionCriteria: string[];
  /** 剩余工作（未完成缺口）。 */
  remainingWork: string[];
  /** 下一动作。 */
  nextActions: string[];
  backendState: string;
  frontendState: string;
  /** 事实最后更新时间。 */
  lastUpdatedAt: string;
  backendCommit?: string;
  frontendCommit?: string;
  /** 指向验收日志标题或任务验收文档。 */
  acceptanceRef?: string;
  risks: string[];
  /** 当前限制 / 未验证边界。 */
  limitations: string[];
  docLinks: BuildDocLink[];
  children?: BuildStatusNode[];
}

export interface BuildCurrentActionLink {
  label: string;
  path: string;
}

export interface BuildStatusSnapshot {
  snapshotAt: string;
  releaseStage: string;
  backendCommit: string;
  frontendCommit: string;
  recentDeliveries: BuildDeliveryRecord[];
  capabilities: BuildStatusNode[];
  /** 当前可直接使用的页面。 */
  readyToUse: BuildCurrentActionLink[];
}

export type BuildStatusFilterKey =
  | 'priority'
  | 'deliveryStatus'
  | 'validationStage'
  | 'module';

export interface BuildStatusFilter {
  priority?: BuildPriority | 'ALL';
  deliveryStatus?: DeliveryStatus | 'ALL';
  validationStage?: ValidationStage | 'ALL';
  module?: string | 'ALL';
}
