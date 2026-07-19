import { normalizeCanonicalSymbol } from './canonicalSymbol';
import type { PlanInput } from '../api/workbenchApi';
import type { MarketDataSyncPlan } from '../../../shared/types/domain';

export type SupportedPlanTaskType = 'DAILY_BAR_BACKFILL' | 'MINUTE_BAR_BACKFILL' | 'INTRADAY_MINUTE_REFRESH';

export interface SyncPlanDraft {
  planName: string;
  taskType: SupportedPlanTaskType;
  provider: 'LONGPORT';
  symbols: string;
  startDate?: string;
  endDate?: string;
  intervalType?: string;
  adjustType?: string;
  collectFrequency?: string;
  includeAuction?: boolean;
  description?: string;
}

export function buildPlanInput(draft: SyncPlanDraft): PlanInput {
  const symbols = draft.symbols.split(/[\s,，;；]+/).filter(Boolean).map(normalizeCanonicalSymbol);
  const uniqueSymbols = [...new Set(symbols)];
  if (uniqueSymbols.length === 0) throw new Error('至少填写一个 canonical symbol');
  if (uniqueSymbols.length > 50) throw new Error('单个计划最多 50 个标的，不允许全市场扫描');
  const isMinute = draft.taskType !== 'DAILY_BAR_BACKFILL';
  if (isMinute && uniqueSymbols.some(symbol => !/^(SH|SZ|BJ)\./.test(symbol))) {
    throw new Error('港美股分钟 K 的交易时段与质量规则尚未闭环，当前只支持 SH/SZ/BJ');
  }
  if (draft.adjustType === 'HF') throw new Error('LongPort Java SDK 4.3.3 不支持 HF 后复权');
  if (draft.taskType !== 'INTRADAY_MINUTE_REFRESH') {
    if (!draft.startDate || !draft.endDate) throw new Error('历史补档必须填写开始日期和结束日期');
    if (draft.startDate > draft.endDate) throw new Error('开始日期不能晚于结束日期');
  }
  if (isMinute && !['1M', '5M', '15M', '30M', '60M'].includes(draft.intervalType ?? '')) {
    throw new Error('分钟任务必须选择 K 线粒度');
  }
  if (draft.taskType === 'INTRADAY_MINUTE_REFRESH'
      && !['30S', '60S', '5M'].includes(draft.collectFrequency ?? '')) {
    throw new Error('盘中分钟刷新必须选择采集频率');
  }
  const scope: Record<string, unknown> = { symbols: uniqueSymbols };
  if (draft.taskType !== 'INTRADAY_MINUTE_REFRESH') {
    scope.startDate = draft.startDate;
    scope.endDate = draft.endDate;
  }
  return {
    planName: draft.planName.trim(),
    taskType: draft.taskType,
    provider: draft.provider,
    scopeJson: JSON.stringify(scope),
    intervalType: isMinute ? draft.intervalType : undefined,
    adjustType: draft.adjustType ?? 'NONE',
    triggerType: draft.taskType === 'INTRADAY_MINUTE_REFRESH' ? 'INTRADAY' : 'MANUAL',
    includeAuction: draft.taskType === 'INTRADAY_MINUTE_REFRESH' && Boolean(draft.includeAuction),
    collectFrequency: draft.taskType === 'INTRADAY_MINUTE_REFRESH' ? draft.collectFrequency : undefined,
    description: draft.description,
  };
}

export function planToDraft(plan: MarketDataSyncPlan): SyncPlanDraft {
  let symbols: string[];
  let startDate: string | undefined;
  let endDate: string | undefined;
  try {
    const scope = JSON.parse(plan.scopeJson) as { symbols?: string[]; canonicalSymbol?: string; startDate?: string; endDate?: string };
    symbols = scope.symbols ?? (scope.canonicalSymbol ? [scope.canonicalSymbol] : []);
    startDate = scope.startDate;
    endDate = scope.endDate;
  } catch {
    // 历史非法 scope 保留原文，用户可以在结构化表单中直接修正。
    symbols = [];
  }
  return {
    planName: plan.planName,
    taskType: (['DAILY_BAR_BACKFILL', 'MINUTE_BAR_BACKFILL', 'INTRADAY_MINUTE_REFRESH'].includes(plan.taskType)
      ? plan.taskType : 'MINUTE_BAR_BACKFILL') as SupportedPlanTaskType,
    provider: 'LONGPORT',
    symbols: symbols.join(', '),
    startDate,
    endDate,
    intervalType: plan.intervalType,
    adjustType: plan.adjustType,
    collectFrequency: plan.collectFrequency,
    includeAuction: plan.includeAuction,
    description: plan.description,
  };
}

export function fallbackConfigurationErrors(plan: MarketDataSyncPlan): string[] {
  if (plan.validationErrors) return plan.validationErrors;
  try {
    buildPlanInput(planToDraft(plan));
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : '配置不完整'];
  }
}
