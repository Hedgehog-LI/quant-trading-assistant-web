/**
 * P1.9-A 数据健康栏：覆盖率、截断、疑似数据、水位与抓取时间。
 * 区分“无数据 / 范围为空 / 数据陈旧 / 疑似 / 截断”，不把空数据写成加载失败。
 */
import { Alert, Descriptions, Skeleton, Tag } from 'antd';
import type { MarketAssetSeriesAvailability, MarketAssetSeriesQuality } from '../model/types';

interface Props {
  availability: MarketAssetSeriesAvailability | null;
  quality: MarketAssetSeriesQuality | null;
  loading: boolean;
}

const COVERAGE_TEXT: Record<string, string> = {
  VERIFIED: '覆盖率已验证',
  PARTIAL: '覆盖率部分缺失',
  UNKNOWN: '覆盖率未知',
};

function coverageColor(status: string | null): string {
  if (status === 'VERIFIED') return 'green';
  if (status === 'PARTIAL') return 'orange';
  return 'default';
}

export function MarketAssetHealth({ availability, quality, loading }: Props) {
  if (loading && !quality) {
    return <Skeleton active paragraph={{ rows: 1 }} />;
  }
  if (!quality) return null;

  const reasonText = (reasonCodes: string[]): string => {
    const map: Record<string, string> = {
      TRUNCATED: '返回条数受 2000 上限约束',
      MISSING_BARS: '存在缺失 bar',
      SUSPECT_BARS: '存在疑似异常 bar',
    };
    return reasonCodes.map((r) => map[r] ?? r).join('；') || '无';
  };

  return (
    <div data-testid="asset-health">
      <Descriptions size="small" column={2} style={{ marginBottom: 8 }}>
        <Descriptions.Item label="覆盖率">
          <Tag color={coverageColor(quality.coverageStatus)}>
            {COVERAGE_TEXT[quality.coverageStatus] ?? quality.coverageStatus}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="实际 / 期望 bar">
          {quality.actualBarCount}
          {quality.expectedBarCount != null ? ` / ${quality.expectedBarCount}` : ' / --'}
        </Descriptions.Item>
        {quality.missingBarCount != null && (
          <Descriptions.Item label="缺失 bar"> {quality.missingBarCount}</Descriptions.Item>
        )}
        {quality.suspectBarCount > 0 && (
          <Descriptions.Item label="疑似 bar">
            <Tag color="orange">{quality.suspectBarCount}</Tag>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="数据范围">
          {availability?.firstBarTime ?? '--'} ～ {availability?.lastBarTime ?? '--'}
        </Descriptions.Item>
        <Descriptions.Item label="水位">
          {availability?.watermarkTime ?? '无水位（分钟链路外）'}
        </Descriptions.Item>
        <Descriptions.Item label="最近抓取">
          {availability?.latestFetchedAt ?? '--'}
        </Descriptions.Item>
      </Descriptions>

      {quality.truncated && (
        <Alert
          type="warning"
          showIcon
          message="数据已受上限约束"
          description="返回条数达到 2000 条上限，未静默截断；建议改用更粗粒度或缩短范围以查看完整数据。"
        />
      )}
      {quality.suspectBarCount > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`含 ${quality.suspectBarCount} 条疑似异常数据`}
          description="疑似数据保留可见并提示，不从图表中静默删除。"
        />
      )}
      {quality.reasonCodes.length > 0 && (
        <Alert type="info" showIcon message="数据健康提示" description={reasonText(quality.reasonCodes)} />
      )}
      {availability?.watermarkTime && (
        <Alert
          type="info"
          showIcon
          message="数据截至说明"
          description={`数据截至 ${availability.watermarkTime}，不宣称实时。`}
        />
      )}
    </div>
  );
}
