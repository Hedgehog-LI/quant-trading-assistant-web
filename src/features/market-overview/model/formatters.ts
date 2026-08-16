/**
 * 市场全景展示格式化（纯函数，可单测）。
 *
 * 约定：输入 null/非有限数一律返回 null，由调用方渲染 '--'，禁止把 null 格式化成 0；
 * 比率内部保持原始小数，仅展示层转百分比；金额自动使用 万/亿 单位。
 */

/** 金额：≥1 亿用"亿"，≥1 万用"万"，否则"元"；保留 2 位小数。null → null。 */
export function formatMoney(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${(value / 1e4).toFixed(2)}万`;
  return `${value.toFixed(0)}元`;
}

/** 比率 → 百分比（默认 1 位小数）；null → null。 */
export function formatPercent(value: number | null | undefined, digits = 1): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${(value * 100).toFixed(digits)}%`;
}

/** 带符号百分比（正数加 '+'）；null → null。 */
export function formatSignedPercent(value: number | null | undefined, digits = 1): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const percent = (value * 100).toFixed(digits);
  return `${value > 0 ? '+' : ''}${percent}%`;
}

/** 日频价格冲击代理（1/元，量级约 1e-9..1e-5）：科学计数 2 位小数；null → null。 */
export function formatIlliquidity(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toExponential(2);
}

/** 比率数值本身（0..1）→ 0..100 数值，用于表格/tooltip 百分比口径；null → null。 */
export function toPercentValue(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value * 100;
}

/** 统一占位：格式化结果为 null 时显示 '--'（禁止 0 冒充）。 */
export function dash(value: string | null): string {
  return value ?? '--';
}
