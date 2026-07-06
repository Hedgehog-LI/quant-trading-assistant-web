import { Card, Descriptions, Tag, Alert, Divider } from 'antd';
import type { RiskCalculationResult } from '../../../shared/types/domain';
import { RISK_LEVEL_MAP } from '../model/types';
import { formatMoney, formatPrice, formatPercent } from '../../../shared/utils/number';

interface Props {
  result: RiskCalculationResult;
}

export function RiskResultCard({ result }: Props) {
  const levelOpt = RISK_LEVEL_MAP.get(result.riskLevel);

  return (
    <Card title="计算结果" style={{ maxWidth: 600 }}>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="可承受风险金额">{formatMoney(result.riskAmount)}</Descriptions.Item>
        <Descriptions.Item label="每股风险">{formatPrice(result.perShareRisk)}</Descriptions.Item>
        <Descriptions.Item label="风险仓位">{result.riskBasedQuantity} 股</Descriptions.Item>
        <Descriptions.Item label="仓位上限">{result.positionCapQuantity} 股</Descriptions.Item>
        <Descriptions.Item label="最终建议数量">
          <strong>{result.finalQuantity} 股</strong>
        </Descriptions.Item>
        <Descriptions.Item label="预计亏损">{formatMoney(result.estimatedLoss)}</Descriptions.Item>
        <Descriptions.Item label="仓位金额">{formatMoney(result.positionAmount)}</Descriptions.Item>
        <Descriptions.Item label="仓位占比">{formatPercent(result.positionRatio)}</Descriptions.Item>
      </Descriptions>

      <Divider />
      <div style={{ marginBottom: 8 }}>
        风险等级：{levelOpt ? <Tag color={levelOpt.color}>{levelOpt.label}</Tag> : result.riskLevel}
      </div>

      {result.warnings.length > 0 && (
        <Alert
          type={result.riskLevel === 'HIGH' ? 'error' : 'warning'}
          title="风险提示"
          description={
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      <Alert
        type="info"
        title="免责声明"
        description={result.disclaimer}
        showIcon
      />
    </Card>
  );
}
