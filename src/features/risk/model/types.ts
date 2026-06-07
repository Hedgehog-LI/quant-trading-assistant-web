import type { RiskLevel } from '../../../shared/types/domain';
import type { EnumOption } from '../../watchlist/model/options';

export const RISK_LEVEL_OPTIONS: EnumOption<RiskLevel>[] = [
  { value: 'LOW', label: '低风险', color: 'green' },
  { value: 'MEDIUM', label: '中风险', color: 'orange' },
  { value: 'HIGH', label: '高风险', color: 'red' },
];

export const RISK_LEVEL_MAP = new Map(RISK_LEVEL_OPTIONS.map((o) => [o.value, o]));
