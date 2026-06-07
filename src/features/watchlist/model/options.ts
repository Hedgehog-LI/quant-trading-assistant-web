import type { MarketType, TradeStyle, AttentionLevel } from '../../../shared/types/domain';

export interface EnumOption<T extends string> {
  value: T;
  label: string;
  color: string;
}

export const MARKET_TYPE_OPTIONS: EnumOption<MarketType>[] = [
  { value: 'A_SHARE', label: 'A股', color: 'red' },
  { value: 'HK', label: '港股', color: 'orange' },
  { value: 'US', label: '美股', color: 'blue' },
  { value: 'ETF', label: 'ETF', color: 'green' },
  { value: 'OTHER', label: '其他', color: 'default' },
];

export const TRADE_STYLE_OPTIONS: EnumOption<TradeStyle>[] = [
  { value: 'SHORT_TERM', label: '短线', color: 'volcano' },
  { value: 'DO_T', label: '做T', color: 'blue' },
  { value: 'SWING', label: '波段', color: 'green' },
  { value: 'OBSERVE', label: '观察', color: 'default' },
];

export const ATTENTION_LEVEL_OPTIONS: EnumOption<AttentionLevel>[] = [
  { value: 'HIGH', label: '高关注', color: 'red' },
  { value: 'MEDIUM', label: '中关注', color: 'orange' },
  { value: 'LOW', label: '低关注', color: 'blue' },
];

export const MARKET_TYPE_MAP = new Map(MARKET_TYPE_OPTIONS.map((o) => [o.value, o]));
export const TRADE_STYLE_MAP = new Map(TRADE_STYLE_OPTIONS.map((o) => [o.value, o]));
export const ATTENTION_LEVEL_MAP = new Map(ATTENTION_LEVEL_OPTIONS.map((o) => [o.value, o]));
