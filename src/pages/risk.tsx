import { Typography, Space } from 'antd';
import { useRiskCalculator } from '../features/risk/hooks/useRiskCalculator';
import { RiskCalculatorForm } from '../features/risk/components/RiskCalculatorForm';
import { RiskResultCard } from '../features/risk/components/RiskResultCard';

export function RiskPage() {
  const { input, result, error, calculate, updateInput, reset } = useRiskCalculator();

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>风控计算器</Typography.Title>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <RiskCalculatorForm
          input={input}
          error={error}
          onUpdateInput={updateInput}
          onCalculate={calculate}
          onReset={reset}
        />
        {result && <RiskResultCard result={result} />}
      </Space>
    </div>
  );
}
