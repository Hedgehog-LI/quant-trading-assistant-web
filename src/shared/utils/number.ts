/** 格式化金额，保留 2 位小数 */
export function formatMoney(value: number | undefined | null): string {
  if (value == null) return '-';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 格式化价格，最多 4 位小数 */
export function formatPrice(value: number | undefined | null): string {
  if (value == null) return '-';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/** 格式化百分比（入参为 0~1 的小数，如 0.2 -> 20.00%） */
export function formatPercent(value: number | undefined | null): string {
  if (value == null) return '-';
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * 格式化已是百分点的值（如 portfolio 的 returnPoint，20.0 表示 20%）。
 * 注意：不再 ×100，与 formatPercent 区分。
 */
export function formatPointPercent(value: number | undefined | null, digits = 2): string {
  if (value == null) return '-';
  return `${value.toFixed(digits)}%`;
}
