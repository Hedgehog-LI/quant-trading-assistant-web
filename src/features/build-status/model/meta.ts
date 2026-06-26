import type { BuildMaturity, BuildPriority, BuildStatus, DataOwnership } from './types';

export const STATUS_LABEL: Record<BuildStatus, string> = {
  DONE: '已完成',
  IN_PROGRESS: '进行中',
  TODO: '待开始',
  RISK: '有风险',
  BLOCKED: '阻塞',
};

export const STATUS_COLOR: Record<BuildStatus, string> = {
  DONE: 'green',
  IN_PROGRESS: 'blue',
  TODO: 'default',
  RISK: 'orange',
  BLOCKED: 'red',
};

export const MATURITY_LABEL: Record<BuildMaturity, string> = {
  M0: '未开始',
  M1: '已设计',
  M2: '后端完成',
  M3: '前端完成',
  M4: '已验收可用',
  M5: '持续优化',
};

export const MATURITY_COLOR: Record<BuildMaturity, string> = {
  M0: 'default',
  M1: 'purple',
  M2: 'blue',
  M3: 'cyan',
  M4: 'green',
  M5: 'gold',
};

export const PRIORITY_COLOR: Record<BuildPriority, string> = {
  P0: 'red',
  P1: 'orange',
  P2: 'blue',
  P3: 'default',
};

export const DATA_OWNERSHIP_LABEL: Record<DataOwnership, string> = {
  DB: '后端 DB',
  LOCAL_STORAGE: '本地 localStorage',
  DERIVED: '计算派生',
  EXTERNAL: '外部模型/数据源',
  NONE: '不存数据',
};

export const DATA_OWNERSHIP_COLOR: Record<DataOwnership, string> = {
  DB: 'green',
  LOCAL_STORAGE: 'orange',
  DERIVED: 'blue',
  EXTERNAL: 'purple',
  NONE: 'default',
};
