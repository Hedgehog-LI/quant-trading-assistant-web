/**
 * 交易费用归一化。
 *
 * 口径与后端一致：totalFee 字段填写后优先使用（包括 0）；
 * 未填写（undefined / null）时按 佣金 + 印花税 + 过户费 + 其他费用 合计。
 *
 * 该函数是交易费用合计的唯一计算点，calculator、交易记录表格、交易记录 api 共用，
 * 避免散落多份"合计逻辑"导致口径不一致。
 */

export interface FeeFields {
  totalFee?: number | null;
  commissionFee?: number | null;
  stampTax?: number | null;
  transferFee?: number | null;
  otherFee?: number | null;
}

function num(value: number | null | undefined): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * 返回归一化后的总费用。
 * - totalFee 显式填写（含 0）→ 直接返回；
 * - 否则 → commissionFee + stampTax + transferFee + otherFee（缺项按 0）。
 */
export function normalizeTotalFee(fees: FeeFields): number {
  if (typeof fees.totalFee === 'number') {
    return fees.totalFee;
  }
  return num(fees.commissionFee) + num(fees.stampTax) + num(fees.transferFee) + num(fees.otherFee);
}
