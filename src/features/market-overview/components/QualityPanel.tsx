/**
 * 数据质量面板：结构化 findings（WARN/INFO）、覆盖缺口、不可用指标（官方资金流 UNAVAILABLE，
 * 禁止以 0 代替）；limitations/assumptions/Provider attribution 折叠进紧凑详情，不铺满首屏。
 */
import { Alert, Collapse, Space, Tag, Typography } from 'antd';
import { dash, formatMoney } from '../model/formatters';
import type { MarketOverviewQuality, OverviewQualityStatus } from '../model/types';

const { Text } = Typography;

interface Props {
  quality: MarketOverviewQuality;
  qualityStatus: OverviewQualityStatus;
}

const FINDING_TITLE: Record<string, string> = {
  BENCHMARK_DATA_MISSING: '窗口内没有基准指数日 K',
  EMPTY_SAMPLE: '证券池快照未派生出样本',
  LOW_BAR_COVERAGE: '样本日 K 覆盖不足',
  LOW_MEMBERSHIP_COVERAGE: '行业映射覆盖不足',
  INDUSTRY_MIGRATION_BLOCKED: '行业成交占比迁移已阻断',
  INDUSTRY_MAPPING_MISSING: '样本证券全部缺少行业映射',
  INSUFFICIENT_WARMUP: '合格交易日不足 120，中期结论不可用',
  EMPTY_VALID_TRADING_DAY: '存在有效证券数为 0 的交易日',
  PARTIAL_INDUSTRY_MAPPING: '部分样本缺少行业映射',
};

export function QualityPanel({ quality, qualityStatus }: Props) {
  const warnings = quality.qualityFindings.filter((finding) => finding.severity === 'WARN');
  const infos = quality.qualityFindings.filter((finding) => finding.severity === 'INFO');
  const moneyFlowUnavailable = quality.unavailableMetrics.includes('OFFICIAL_MONEY_FLOW');

  return (
    <div data-testid="overview-quality-panel" className="overview-quality">
      {qualityStatus === 'NO_DATA' ? (
        <Alert type="warning" showIcon title="窗口内没有可用数据（NO_DATA）"
          description="该窗口没有基准指数日 K，无法推导交易日；请调整日期范围或先在本地完成数据导入。" />
      ) : (
        <>
          {warnings.length > 0 && (
            <Alert
              type="warning" showIcon
              title={`数据质量 DEGRADED：${warnings.length} 项告警（短期序列保留，中期结论按门禁判定）`}
              description={
                <ul className="overview-quality__list">
                  {warnings.map((finding) => (
                    <li key={finding.code}>
                      <Text strong>{FINDING_TITLE[finding.code] ?? finding.code}</Text>
                      <Text type="secondary">（{finding.code}{finding.affectedCount > 0 ? ` · ${finding.affectedCount}` : ''}）：{finding.message}</Text>
                    </li>
                  ))}
                </ul>
              }
            />
          )}
          <Space wrap size={[8, 8]} style={{ marginTop: 10 }}>
            {moneyFlowUnavailable && (
              <Tag data-testid="overview-money-flow-unavailable">官方资金流不可用（OFFICIAL_MONEY_FLOW=UNAVAILABLE）</Tag>
            )}
            {infos.map((finding) => (
              <Tag key={finding.code} color="blue">{FINDING_TITLE[finding.code] ?? finding.code}</Tag>
            ))}
            {quality.coverageGap.uncoveredSampleStocks > 0 && (
              <Tag>
                行业映射缺口 {quality.coverageGap.uncoveredSampleStocks} 只 · 未入占比分母成交额 {dash(formatMoney(quality.coverageGap.uncoveredTurnoverAmount))}
              </Tag>
            )}
          </Space>
          <Collapse
            size="small"
            style={{ marginTop: 10 }}
            items={[{
              key: 'details',
              label: '数据边界、口径假设与 Provider 归属',
              children: (
                <div className="overview-quality__details">
                  <Text strong>口径假设（assumptions）</Text>
                  <ul className="overview-quality__list">
                    {quality.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
                  </ul>
                  <Text strong>Provider 归属</Text>
                  <ul className="overview-quality__list">
                    {quality.providerAttribution.map((attribution) => (
                      <li key={attribution.dataset}>{attribution.dataset}：{attribution.providers.join(' + ')}</li>
                    ))}
                  </ul>
                </div>
              ),
            }]}
          />
        </>
      )}
    </div>
  );
}
