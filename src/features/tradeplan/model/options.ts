import type { PlanStatus } from '../../../shared/types/domain';
import type { EnumOption } from '../../watchlist/model/options';

export const PLAN_STATUS_OPTIONS: EnumOption<PlanStatus>[] = [
  { value: 'DRAFT', label: '草稿', color: 'default' },
  { value: 'ACTIVE', label: '生效中', color: 'blue' },
  { value: 'DONE', label: '已完成', color: 'green' },
  { value: 'CANCELLED', label: '已取消', color: 'red' },
];

export const PLAN_STATUS_MAP = new Map(PLAN_STATUS_OPTIONS.map((o) => [o.value, o]));
