import { Card, Form, InputNumber, Button, Space } from 'antd';
import { CalculatorOutlined, ReloadOutlined } from '@ant-design/icons';
import type { RiskCalculationInput } from '../../../shared/types/domain';

interface Props {
  input: RiskCalculationInput;
  error: string | null;
  onUpdateInput: (patch: Partial<RiskCalculationInput>) => void;
  onCalculate: () => void;
  onReset: () => void;
}

export function RiskCalculatorForm({ input, error, onUpdateInput, onCalculate, onReset }: Props) {
  return (
    <Card title="风控计算器" style={{ maxWidth: 600 }}>
      <Form layout="vertical">
        <Form.Item label="总资金" required>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            precision={2}
            value={input.totalCapital || null}
            onChange={(v) => onUpdateInput({ totalCapital: v ?? 0 })}
            placeholder="如 100000"
          />
        </Form.Item>
        <Form.Item label="单笔风险比例" required extra="建议 0.005~0.02，即 0.5%~2%">
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={0.1}
            step={0.005}
            precision={4}
            value={input.riskPercent || null}
            onChange={(v) => onUpdateInput({ riskPercent: v ?? 0 })}
            placeholder="如 0.01"
          />
        </Form.Item>
        <Form.Item label="计划买入价" required>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            precision={4}
            value={input.buyPrice || null}
            onChange={(v) => onUpdateInput({ buyPrice: v ?? 0 })}
            placeholder="如 50.00"
          />
        </Form.Item>
        <Form.Item label="止损价" required>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            precision={4}
            value={input.stopLossPrice || null}
            onChange={(v) => onUpdateInput({ stopLossPrice: v ?? 0 })}
            placeholder="如 48.00"
          />
        </Form.Item>
        <Form.Item label="单票最大仓位比例" extra="范围 0~1，建议 0.15">
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={1}
            step={0.05}
            precision={4}
            value={input.maxPositionRatio}
            onChange={(v) => onUpdateInput({ maxPositionRatio: v ?? 0.15 })}
          />
        </Form.Item>
        <Form.Item label="最小交易单位" extra="A 股默认 100">
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            step={100}
            value={input.lotSize}
            onChange={(v) => onUpdateInput({ lotSize: v ?? 100 })}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" icon={<CalculatorOutlined />} onClick={onCalculate}>
              计算
            </Button>
            <Button icon={<ReloadOutlined />} onClick={onReset}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
      {error && (
        <div style={{ color: '#ff4d4f', marginTop: 8 }}>{error}</div>
      )}
    </Card>
  );
}
