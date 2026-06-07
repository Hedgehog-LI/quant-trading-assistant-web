/**
 * 风控计算器 —— 纯函数，使用 decimal.js 保证精度。
 * 公式与后端 BACKEND_TODAY_MVP_IMPLEMENTATION_MANUAL.md 对齐。
 */
import Decimal from 'decimal.js';
import type { RiskCalculationInput, RiskCalculationResult, RiskLevel } from '../../../shared/types/domain';

const DISCLAIMER = '本计算结果仅为辅助参考，不构成任何投资建议。投资有风险，入市需谨慎。请结合自身情况独立判断。';

/** 判断风险等级 */
function determineRiskLevel(
  positionRatio: Decimal,
  riskPercent: Decimal,
  finalQuantity: Decimal,
): RiskLevel {
  if (finalQuantity.lte(0)) return 'HIGH';
  if (positionRatio.gt(0.3) || riskPercent.gt(0.05)) return 'HIGH';
  if (positionRatio.gt(0.2) || riskPercent.gt(0.02)) return 'MEDIUM';
  return 'LOW';
}

/** 收集警告信息 */
function collectWarnings(
  input: RiskCalculationInput,
  positionRatio: Decimal,
  riskPercent: Decimal,
): string[] {
  const warnings: string[] = [];
  if (riskPercent.gt(0.05)) {
    warnings.push('单笔风险比例超过 5%，建议控制在 2% 以内');
  }
  if (positionRatio.gt(0.3)) {
    warnings.push('仓位占比超过 30%，建议控制在 20% 以内');
  }
  if (riskPercent.lte(0)) {
    warnings.push('风险比例必须大于 0');
  }
  if (input.maxPositionRatio > 1) {
    warnings.push('最大仓位比例不能超过 100%');
  }
  return warnings;
}

/**
 * 计算建议仓位大小。
 * 止损价 >= 买入价时直接抛业务错误。
 */
export function calculatePositionSize(input: RiskCalculationInput): RiskCalculationResult {
  const totalCapital = new Decimal(input.totalCapital);
  const riskPercent = new Decimal(input.riskPercent);
  const buyPrice = new Decimal(input.buyPrice);
  const stopLossPrice = new Decimal(input.stopLossPrice);
  const maxPositionRatio = new Decimal(input.maxPositionRatio);
  const lotSize = new Decimal(input.lotSize);

  // 核心公式
  const riskAmount = totalCapital.mul(riskPercent);
  const perShareRisk = buyPrice.minus(stopLossPrice);
  const riskBasedQuantity = perShareRisk.gt(0)
    ? riskAmount.div(perShareRisk).floor()
    : new Decimal(0);
  const positionCapQuantity = totalCapital.mul(maxPositionRatio).div(buyPrice).floor();
  const rawQuantity = Decimal.min(riskBasedQuantity, positionCapQuantity);
  // 按 lotSize 向下取整
  const finalQuantity = rawQuantity.div(lotSize).floor().mul(lotSize);
  const estimatedLoss = finalQuantity.mul(perShareRisk);
  const positionAmount = finalQuantity.mul(buyPrice);
  const positionRatio = totalCapital.gt(0) ? positionAmount.div(totalCapital) : new Decimal(0);

  const riskLevel = determineRiskLevel(positionRatio, riskPercent, finalQuantity);
  const warnings = collectWarnings(input, positionRatio, riskPercent);

  if (finalQuantity.lte(0)) {
    warnings.push('资金或止损距离不满足交易条件，建议调整参数');
  }

  return {
    riskAmount: riskAmount.toNumber(),
    perShareRisk: perShareRisk.toNumber(),
    riskBasedQuantity: riskBasedQuantity.toNumber(),
    positionCapQuantity: positionCapQuantity.toNumber(),
    finalQuantity: finalQuantity.toNumber(),
    estimatedLoss: estimatedLoss.toNumber(),
    positionAmount: positionAmount.toNumber(),
    positionRatio: positionRatio.toNumber(),
    riskLevel,
    warnings,
    disclaimer: DISCLAIMER,
  };
}
