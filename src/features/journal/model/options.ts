import type { TradeSide, ReviewStatus, EmotionTag, MistakeTag } from '../../../shared/types/domain';
import type { EnumOption } from '../../watchlist/model/options';

export const TRADE_SIDE_OPTIONS: EnumOption<TradeSide>[] = [
  { value: 'BUY', label: '买入', color: 'red' },
  { value: 'SELL', label: '卖出', color: 'green' },
];

export const REVIEW_STATUS_OPTIONS: EnumOption<ReviewStatus>[] = [
  { value: 'PENDING', label: '待复盘', color: 'orange' },
  { value: 'REVIEWED', label: '已复盘', color: 'green' },
];

export const EMOTION_TAG_OPTIONS: EnumOption<EmotionTag>[] = [
  { value: 'CALM', label: '冷静', color: 'green' },
  { value: 'FOMO', label: 'FOMO', color: 'red' },
  { value: 'FEAR', label: '恐惧', color: 'volcano' },
  { value: 'REVENGE', label: '报复性', color: 'magenta' },
  { value: 'HESITATION', label: '犹豫', color: 'orange' },
];

export const MISTAKE_TAG_OPTIONS: EnumOption<MistakeTag>[] = [
  { value: 'CHASE_HIGH', label: '追高', color: 'red' },
  { value: 'PANIC_SELL', label: '恐慌卖出', color: 'volcano' },
  { value: 'NO_STOP_LOSS', label: '未止损', color: 'magenta' },
  { value: 'OVERSIZED_POSITION', label: '仓位过重', color: 'orange' },
  { value: 'NO_PLAN', label: '无计划交易', color: 'default' },
  { value: 'BROKE_RULE', label: '违反纪律', color: 'red' },
];

export const TRADE_SIDE_MAP = new Map(TRADE_SIDE_OPTIONS.map((o) => [o.value, o]));
export const REVIEW_STATUS_MAP = new Map(REVIEW_STATUS_OPTIONS.map((o) => [o.value, o]));
export const EMOTION_TAG_MAP = new Map(EMOTION_TAG_OPTIONS.map((o) => [o.value, o]));
export const MISTAKE_TAG_MAP = new Map(MISTAKE_TAG_OPTIONS.map((o) => [o.value, o]));
