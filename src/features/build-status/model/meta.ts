import type {
  BuildPriority,
  DeliveryStage,
  DeliveryStatus,
  ValidationStage,
} from './types';

export const PRIORITY_COLOR: Record<BuildPriority, string> = {
  P0: 'red',
  P1: 'orange',
  P2: 'blue',
  P3: 'default',
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  PLANNED: '待开始',
  DESIGNED: '已设计',
  IN_PROGRESS: '建设中',
  DELIVERED: '已交付',
  BLOCKED: '阻塞',
  DEFERRED: '暂缓',
};

export const DELIVERY_STATUS_COLOR: Record<DeliveryStatus, string> = {
  PLANNED: 'default',
  DESIGNED: 'purple',
  IN_PROGRESS: 'blue',
  DELIVERED: 'green',
  BLOCKED: 'red',
  DEFERRED: 'gold',
};

export const VALIDATION_STAGE_LABEL: Record<ValidationStage, string> = {
  NOT_VERIFIED: '未验证',
  STATIC_VERIFIED: '静态验证',
  AUTOMATION_VERIFIED: '自动化验证',
  RUNTIME_VERIFIED: '运行验证',
  DEPLOYED: '已部署',
};

export const VALIDATION_STAGE_COLOR: Record<ValidationStage, string> = {
  NOT_VERIFIED: 'default',
  STATIC_VERIFIED: 'purple',
  AUTOMATION_VERIFIED: 'cyan',
  RUNTIME_VERIFIED: 'blue',
  DEPLOYED: 'green',
};

export const DELIVERY_STAGE_LABEL: Record<DeliveryStage, string> = {
  DESIGN: '设计冻结',
  AUTOMATION: '自动化验收',
  RUNTIME: '运行验收',
  DEPLOYED: '生产部署',
};

/** 模块筛选选项：与能力节点 category 取值保持一致。 */
export const MODULE_OPTIONS = [
  '基础设施',
  '交易闭环',
  '持仓盈亏',
  '行情基础',
  '证券目录',
  '智能录入',
  '集成',
  '量化分析',
];
