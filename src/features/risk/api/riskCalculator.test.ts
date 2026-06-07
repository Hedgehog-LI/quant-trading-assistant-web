import { describe, it, expect } from 'vitest';
import { calculatePositionSize } from '../api/riskCalculator';

describe('riskCalculator', () => {
  it('正常计算仓位', () => {
    const result = calculatePositionSize({
      totalCapital: 100000,
      riskPercent: 0.01,
      buyPrice: 50,
      stopLossPrice: 48,
      maxPositionRatio: 0.2,
      lotSize: 100,
    });
    expect(result.riskAmount).toBeCloseTo(1000, 2);
    expect(result.perShareRisk).toBeCloseTo(2, 2);
    expect(result.riskBasedQuantity).toBe(500);
    expect(result.positionCapQuantity).toBe(400);
    expect(result.finalQuantity).toBe(400);
    expect(result.estimatedLoss).toBeCloseTo(800, 2);
    expect(result.positionAmount).toBeCloseTo(20000, 2);
    expect(result.positionRatio).toBeCloseTo(0.2, 4);
    expect(result.riskLevel).toBe('LOW');
    expect(result.warnings).toEqual([]);
  });

  it('止损价接近买入价时每股风险很小，数量很大', () => {
    const result = calculatePositionSize({
      totalCapital: 100000,
      riskPercent: 0.01,
      buyPrice: 50,
      stopLossPrice: 49.9,
      maxPositionRatio: 0.15,
      lotSize: 100,
    });
    expect(result.perShareRisk).toBeCloseTo(0.1, 2);
    expect(result.riskBasedQuantity).toBe(10000);
    expect(result.finalQuantity).toBeGreaterThan(0);
  });

  it('按 lotSize 向下取整', () => {
    const result = calculatePositionSize({
      totalCapital: 100000,
      riskPercent: 0.01,
      buyPrice: 33.33,
      stopLossPrice: 30,
      maxPositionRatio: 0.15,
      lotSize: 100,
    });
    expect(result.finalQuantity % 100).toBe(0);
  });

  it('风险等级 HIGH：仓位超过 30%', () => {
    const result = calculatePositionSize({
      totalCapital: 100000,
      riskPercent: 0.05,
      buyPrice: 10,
      stopLossPrice: 9,
      maxPositionRatio: 0.5,
      lotSize: 100,
    });
    expect(result.riskLevel).toBe('HIGH');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('风险等级 MEDIUM：仓位超过 20%', () => {
    const result = calculatePositionSize({
      totalCapital: 100000,
      riskPercent: 0.03,
      buyPrice: 10,
      stopLossPrice: 9,
      maxPositionRatio: 0.25,
      lotSize: 100,
    });
    expect(result.riskLevel).toBe('MEDIUM');
  });

  it('finalQuantity 为 0 时风险等级 HIGH', () => {
    const result = calculatePositionSize({
      totalCapital: 100,
      riskPercent: 0.01,
      buyPrice: 1000,
      stopLossPrice: 999,
      maxPositionRatio: 0.1,
      lotSize: 100,
    });
    expect(result.finalQuantity).toBe(0);
    expect(result.riskLevel).toBe('HIGH');
  });

  it('包含免责声明', () => {
    const result = calculatePositionSize({
      totalCapital: 100000,
      riskPercent: 0.01,
      buyPrice: 50,
      stopLossPrice: 48,
      maxPositionRatio: 0.15,
      lotSize: 100,
    });
    expect(result.disclaimer).toContain('辅助参考');
    expect(result.disclaimer).toContain('不构成');
  });

  it('风险比例超过 5% 时有警告', () => {
    const result = calculatePositionSize({
      totalCapital: 100000,
      riskPercent: 0.08,
      buyPrice: 50,
      stopLossPrice: 48,
      maxPositionRatio: 0.1,
      lotSize: 100,
    });
    expect(result.warnings).toContain('单笔风险比例超过 5%，建议控制在 2% 以内');
  });
});
