/**
 * 版本覆盖率与质量结果面板。
 *
 * - 质量表：checkCode + status Tag（OK 绿 / WARN 橙 / FAIL 红）+ affectedCount + detail 摘要；
 * - 覆盖率表：symbol + 覆盖百分比（coverageRatio 为 0..1 小数；null 显示 '--'）。
 * - 发布阻断原因：存在 FAIL 检查项或版本 REJECTED 时给出明确阻断说明（来源为真实
 *   质量结果，不展示没有来源的百分比）；FAIL 与 WARN 分开列示。
 * - FAIL/WARN 明确标色；空结果渲染 Empty，不把无数据当错误。
 */
import { Alert, Card, Empty, Skeleton, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCoverage, useQualityResults } from '../hooks/useDataFoundation';
import { QUALITY_STATUS_COLOR, formatCount, formatDateTime, formatRatioPercent, summarizeJson, tagColor } from '../model/format';
import type { CoverageWatermark, QualityResult } from '../model/types';

export interface CoverageQualityPanelProps {
  versionId: number;
  /** 选中版本状态（用于 REJECTED 阻断说明；可空）。 */
  versionStatus?: string | null;
}

export function CoverageQualityPanel({ versionId, versionStatus }: CoverageQualityPanelProps) {
  const quality = useQualityResults(versionId);
  const coverage = useCoverage(versionId);

  const results = quality.data ?? [];
  const failItems = results.filter((item) => item.status === 'FAIL');
  const warnItems = results.filter((item) => item.status === 'WARN');

  const qualityColumns: ColumnsType<QualityResult> = [
    { title: '检查项', dataIndex: 'checkCode', width: 240 },
    { title: '结果', dataIndex: 'status', width: 90, render: (status: string) => (
      <Tag color={tagColor(QUALITY_STATUS_COLOR, status)} data-testid={`quality-status-${status}`}>
        {status}
      </Tag>
    ) },
    { title: '影响行数', dataIndex: 'affectedCount', width: 100, render: (value: number | null) => formatCount(value) },
    { title: '明细摘要', dataIndex: 'detailJson', render: (value: string | null) => (
      <Typography.Text style={{ fontSize: 12 }}>{summarizeJson(value)}</Typography.Text>
    ) },
    { title: '检查时间', dataIndex: 'checkedAt', width: 140, render: (value: string | null) => formatDateTime(value) },
  ];

  const coverageColumns: ColumnsType<CoverageWatermark> = [
    { title: '证券', dataIndex: 'canonicalSymbol', width: 130 },
    { title: '首日', dataIndex: 'firstDate', width: 110, render: (value: string | null) => value ?? '--' },
    { title: '末日', dataIndex: 'lastDate', width: 110, render: (value: string | null) => value ?? '--' },
    { title: '行数', dataIndex: 'rowCount', width: 90, render: (value: number | null) => formatCount(value) },
    { title: '应有天数', dataIndex: 'expectedDays', width: 100, render: (value: number | null) => formatCount(value) },
    { title: '已覆盖天数', dataIndex: 'coveredDays', width: 110, render: (value: number | null) => formatCount(value) },
    { title: '覆盖率', dataIndex: 'coverageRatio', width: 110, render: (value: number | null) => (
      <span data-testid="coverage-ratio">{formatRatioPercent(value)}</span>
    ) },
  ];

  // 平均覆盖率只统计非 null 的行（null 不可计算，不能当 0 参与平均）。
  const ratioValues = (coverage.data ?? [])
    .map((row) => row.coverageRatio)
    .filter((ratio): ratio is number => ratio != null);
  const avgRatio = ratioValues.length > 0
    ? ratioValues.reduce((sum, ratio) => sum + ratio, 0) / ratioValues.length
    : null;

  return (
    <div className="df-coverage-quality" data-testid={`coverage-quality-${versionId}`}>
      {failItems.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title="发布门禁阻断：存在 FAIL 质量检查项，该版本不可发布"
          description={(
            <Space direction="vertical" size={2}>
              {failItems.map((item) => (
                <Typography.Text type="danger" key={item.checkCode}>
                  [FAIL] {item.checkCode}（影响 {formatCount(item.affectedCount)} 行）
                </Typography.Text>
              ))}
              {warnItems.length > 0 && (
                <Typography.Text type="warning">
                  另有 WARN 项：{warnItems.map((item) => item.checkCode).join('、')}（不单独阻断，但会在门禁结果中留痕）
                </Typography.Text>
              )}
              {versionStatus === 'REJECTED' && (
                <Typography.Text type="secondary">版本状态 REJECTED：失败版本保留可查，但不会成为研究默认版本。</Typography.Text>
              )}
            </Space>
          )}
          data-testid="publish-gate-blocked"
        />
      )}

      <Card size="small" title={`版本 #${versionId} 质量结果（13 检查族）`} style={{ marginBottom: 12 }}>
        {quality.isError ? (
          <Alert
            type="error" showIcon title="质量结果加载失败"
            description={quality.error instanceof Error ? quality.error.message : '请重试。'}
            data-testid="quality-error"
          />
        ) : quality.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <Table<QualityResult>
            rowKey={(record) => `${record.checkCode}-${record.checkedAt ?? ''}`}
            size="small"
            columns={qualityColumns}
            dataSource={quality.data ?? []}
            pagination={(quality.data?.length ?? 0) > 10 ? { pageSize: 10, size: 'small' } : false}
            scroll={{ x: 760 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该版本尚无质量检查结果（点击版本行的“质量检查”触发）" /> }}
          />
        )}
      </Card>

      <Card size="small" title={`版本 #${versionId} 覆盖水位`} extra={
        avgRatio != null ? <Typography.Text type="secondary">平均覆盖率 {formatRatioPercent(avgRatio)}</Typography.Text> : null
      }>
        {coverage.isError ? (
          <Alert
            type="error" showIcon title="覆盖水位加载失败"
            description={coverage.error instanceof Error ? coverage.error.message : '请重试。'}
            data-testid="coverage-error"
          />
        ) : coverage.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <Table<CoverageWatermark>
            rowKey="canonicalSymbol"
            size="small"
            columns={coverageColumns}
            dataSource={coverage.data ?? []}
            pagination={(coverage.data?.length ?? 0) > 10 ? { pageSize: 10, size: 'small' } : false}
            scroll={{ x: 760 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该版本暂无覆盖水位数据" /> }}
          />
        )}
      </Card>
    </div>
  );
}
