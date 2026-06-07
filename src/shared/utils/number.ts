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

/** 格式化百分比 */
export function formatPercent(value: number | undefined | null): string {
  if (value == null) return '-';
  return `${(value * 100).toFixed(2)}%`;
}
