import { useState, useCallback } from 'react';
import { calculatePositionSize } from '../api/riskCalculator';
import type { RiskCalculationInput, RiskCalculationResult } from '../../../shared/types/domain';

const DEFAULT_INPUT: RiskCalculationInput = {
  totalCapital: 100000,
  riskPercent: 0.01,
  buyPrice: 0,
  stopLossPrice: 0,
  maxPositionRatio: 0.15,
  lotSize: 100,
};

export function useRiskCalculator() {
  const [input, setInput] = useState<RiskCalculationInput>({ ...DEFAULT_INPUT });
  const [result, setResult] = useState<RiskCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    setError(null);
    if (input.buyPrice <= 0) {
      setError('买入价必须大于 0');
      setResult(null);
      return;
    }
    if (input.stopLossPrice <= 0) {
      setError('止损价必须大于 0');
      setResult(null);
      return;
    }
    if (input.stopLossPrice >= input.buyPrice) {
      setError('止损价必须低于买入价');
      setResult(null);
      return;
    }
    if (input.riskPercent <= 0 || input.riskPercent > 0.1) {
      setError('单笔风险比例应在 (0, 10%] 范围内');
      setResult(null);
      return;
    }
    try {
      const r = calculatePositionSize(input);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : '计算出错');
      setResult(null);
    }
  }, [input]);

  const updateInput = useCallback(
    (patch: Partial<RiskCalculationInput>) => {
      setInput((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const reset = useCallback(() => {
    setInput({ ...DEFAULT_INPUT });
    setResult(null);
    setError(null);
  }, []);

  return { input, result, error, calculate, updateInput, reset };
}
