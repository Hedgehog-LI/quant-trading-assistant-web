/**
 * 数据集与版本面板：数据集选择 + 版本列表（状态 Tag/发布标记）+ 当前发布版本卡
 * + 版本操作（质量检查 / 发布）。
 *
 * - 发布仅对 QUALIFIED 版本开放；质量 FAIL/空数据由后端
 *   DATA_FOUNDATION_QUALITY_GATE_FAILED 拒绝并展示 message，前端不绕过门禁。
 * - 选中版本后联动 CoverageQualityPanel（覆盖率 + 质量结果）。
 */
import { useMemo } from 'react';
import { Alert, Button, Card, Descriptions, Empty, Select, Skeleton, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  useDatasetVersions,
  useFoundationDatasets,
  usePublishVersion,
  useReleasedVersion,
  useRunQualityCheck,
} from '../hooks/useDataFoundation';
import { VERSION_STATUS_COLOR, formatCount, formatDateTime, tagColor } from '../model/format';
import type { DatasetVersion } from '../model/types';
import { CoverageQualityPanel } from './CoverageQualityPanel';

const { Text } = Typography;

export interface DatasetVersionPanelProps {
  datasetCode: string | null;
  onSelectDataset: (code: string | null) => void;
  selectedVersionId: number | null;
  onSelectVersion: (versionId: number | null) => void;
}

export function DatasetVersionPanel({
  datasetCode, onSelectDataset, selectedVersionId, onSelectVersion,
}: DatasetVersionPanelProps) {
  const datasets = useFoundationDatasets();
  const versions = useDatasetVersions(datasetCode);
  const released = useReleasedVersion(datasetCode);
  const qualityCheck = useRunQualityCheck();
  const publish = usePublishVersion();

  const datasetOptions = useMemo(
    () => (datasets.data ?? []).map((dataset) => ({
      value: dataset.datasetCode,
      label: `${dataset.datasetCode}（${dataset.datasetName}）`,
    })),
    [datasets.data],
  );

  const actionError = qualityCheck.error ?? publish.error;

  const columns: ColumnsType<DatasetVersion> = [
    { title: '版本', dataIndex: 'versionCode', width: 130 },
    { title: '状态', dataIndex: 'status', width: 120, render: (status: string) => (
      <Tag color={tagColor(VERSION_STATUS_COLOR, status)}>{status}</Tag>
    ) },
    { title: '窗口', key: 'window', width: 190, render: (_, version) => (
      <span>{version.startDate ?? '--'} ~ {version.endDate ?? '--'}</span>
    ) },
    { title: '行数', dataIndex: 'rowCount', width: 90, render: (value: number | null) => formatCount(value) },
    { title: '来源', dataIndex: 'sourceProvider', width: 130, render: (value: string | null) => value ?? '--' },
    { title: '创建时间', dataIndex: 'createdAt', width: 140, render: (value: string | null) => formatDateTime(value) },
    { title: '操作', key: 'action', width: 200, render: (_, version) => (
      <Space size={4}>
        <Button
          size="small"
          loading={qualityCheck.isPending && qualityCheck.variables === version.id}
          onClick={() => qualityCheck.mutate(version.id)}
          data-testid={`quality-check-btn-${version.id}`}
        >
          质量检查
        </Button>
        <Button
          size="small"
          type="primary"
          ghost
          disabled={version.status !== 'QUALIFIED'}
          loading={publish.isPending && publish.variables === version.id}
          onClick={() => publish.mutate(version.id)}
          data-testid={`publish-btn-${version.id}`}
        >
          发布
        </Button>
      </Space>
    ) },
  ];

  return (
    <div className="df-dataset-panel">
      <div className="df-panel-toolbar">
        <Space wrap>
          <Typography.Text strong>数据集</Typography.Text>
          <Select
            style={{ minWidth: 320 }}
            placeholder="选择数据集"
            value={datasetCode}
            options={datasetOptions}
            loading={datasets.isLoading}
            onChange={(value) => {
              onSelectDataset(value);
              onSelectVersion(null);
            }}
            showSearch
            data-testid="dataset-select"
          />
        </Space>
      </div>

      {datasets.isError && (
        <Alert
          type="error" showIcon title="数据集加载失败"
          description={datasets.error instanceof Error ? datasets.error.message : '请重试。'}
          style={{ marginBottom: 12 }}
          data-testid="datasets-error"
        />
      )}

      {!datasetCode && (
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先选择数据集查看版本与发布状态。" />
        </Card>
      )}

      {datasetCode && (
        <>
          <Card size="small" title="当前发布版本" style={{ marginBottom: 12 }} data-testid="released-card">
            {released.isLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : released.isError ? (
              <Alert
                type="error" showIcon title="发布版本加载失败"
                description={released.error instanceof Error ? released.error.message : '请重试。'}
                data-testid="released-error"
              />
            ) : released.data ? (
              <Descriptions
                size="small"
                column={3}
                items={[
                  { key: 'versionCode', label: '版本', children: released.data.versionCode },
                  { key: 'status', label: '状态', children: <Tag color="success">{released.data.status}</Tag> },
                  { key: 'rowCount', label: '行数', children: formatCount(released.data.rowCount) },
                  { key: 'window', label: '窗口', children: `${released.data.startDate ?? '--'} ~ ${released.data.endDate ?? '--'}` },
                  { key: 'releasedAt', label: '发布时间', children: formatDateTime(released.data.releasedAt) },
                  { key: 'provider', label: '来源', children: released.data.sourceProvider ?? '--' },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该数据集尚未发布任何版本（发布门禁：质量 FAIL 或空数据不可发布）。" />
            )}
          </Card>

          {actionError && (
            <Alert
              type="error" showIcon title="版本操作失败"
              description={actionError instanceof Error ? actionError.message : '请重试。'}
              style={{ marginBottom: 12 }}
              data-testid="version-action-error"
            />
          )}

          {versions.isError ? (
            <Alert
              type="error" showIcon title="版本列表加载失败"
              description={versions.error instanceof Error ? versions.error.message : '请重试。'}
              data-testid="versions-error"
            />
          ) : versions.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : (
            <Table<DatasetVersion>
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={versions.data ?? []}
              pagination={false}
              scroll={{ x: 900 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该数据集暂无版本" /> }}
              onRow={(record) => ({
                onClick: () => onSelectVersion(selectedVersionId === record.id ? null : record.id),
                style: { cursor: 'pointer', background: selectedVersionId === record.id ? '#f0f7ff' : undefined },
              })}
            />
          )}

          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            点击版本行查看覆盖率与质量结果（<Text code>点击当前选中行可取消</Text>）。
          </Typography.Paragraph>

          {selectedVersionId != null && (
            <CoverageQualityPanel versionId={selectedVersionId} />
          )}
        </>
      )}
    </div>
  );
}
