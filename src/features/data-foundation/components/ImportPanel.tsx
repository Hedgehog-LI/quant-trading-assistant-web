/**
 * CSV 导入面板：kind 下拉 + 文件上传（multipart 字段名 file、kind 查询参数）
 * + 导入结果卡 + 最近批次表（ImportBatchTable）。
 *
 * DAILY_BAR 版本闭环（契约）：导入日 K 前必须选择导入类数据集（provider=IMPORT_*）
 * 并关联 DRAFT 版本（选择已有或新建，POST /datasets/{code}/versions）；上传携带
 * datasetVersionId。universe/calendar/taxonomy/membership 不要求版本关联。
 * 导入成功后刷新批次、版本、覆盖与质量；批次列表展示关联版本。
 * 结果计数 inserted/updated/skipped/rejected 全部展示（null 显示 '--'）；
 * 有错误行时展示 errorReportJson；上传失败展示后端 message，绝不伪造成功。
 */
import { useMemo, useState } from 'react';
import { Alert, Button, Card, Select, Space, Typography, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import {
  useDatasetVersions,
  useFoundationDatasets,
  useImportBatches,
  useUploadImportSnapshot,
} from '../hooks/useDataFoundation';
import { errorReportHasErrors, formatCount } from '../model/format';
import type { Dataset, ImportBatch, ImportKind } from '../model/types';
import { DatasetCreateModal } from './DatasetCreateModal';
import { ImportBatchTable } from './ImportBatchTable';
import { VersionCreateModal } from './VersionCreateModal';

const IMPORT_KIND_OPTIONS: { value: ImportKind; label: string }[] = [
  { value: 'UNIVERSE_SNAPSHOT', label: 'UNIVERSE_SNAPSHOT（证券池快照）' },
  { value: 'TRADING_CALENDAR', label: 'TRADING_CALENDAR（交易日历）' },
  { value: 'DAILY_BAR', label: 'DAILY_BAR（日 K）' },
  { value: 'INDUSTRY_TAXONOMY', label: 'INDUSTRY_TAXONOMY（行业分类）' },
  { value: 'INDUSTRY_MEMBERSHIP_PIT', label: 'INDUSTRY_MEMBERSHIP_PIT（PIT 行业成分）' },
];

const IMPORT_PROVIDER_PREFIX = 'IMPORT_';

const { Text } = Typography;

export function ImportPanel() {
  const [kind, setKind] = useState<ImportKind>('DAILY_BAR');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importDatasetCode, setImportDatasetCode] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [datasetModalOpen, setDatasetModalOpen] = useState(false);
  const upload = useUploadImportSnapshot();
  const batches = useImportBatches({ kind, page: 1, pageSize: 10 });
  const datasets = useFoundationDatasets();
  const versions = useDatasetVersions(importDatasetCode);

  const file = useMemo(() => fileList[0]?.originFileObj ?? null, [fileList]);
  const result = upload.data ?? null;

  // 导入类数据集（provider 以 IMPORT_ 开头）才有手动建版本与日 K 关联语义。
  const importDatasets = useMemo(
    () => (datasets.data ?? []).filter((dataset: Dataset) => dataset.providerCode.startsWith(IMPORT_PROVIDER_PREFIX)),
    [datasets.data],
  );
  const importDatasetOptions = useMemo(
    () =>
      importDatasets.map((dataset) => ({
        value: dataset.datasetCode,
        label: `${dataset.datasetCode}（${dataset.datasetName}）`,
      })),
    [importDatasets],
  );

  // DAILY_BAR 只能关联 DRAFT 版本（导入完成后再走质量检查/发布）。
  const draftVersions = useMemo(
    () => (versions.data ?? []).filter((version) => version.status === 'DRAFT'),
    [versions.data],
  );
  const versionOptions = useMemo(
    () =>
      draftVersions.map((version) => ({
        value: version.id,
        label: `${version.versionCode}（${version.startDate ?? '--'} ~ ${version.endDate ?? '--'}）`,
      })),
    [draftVersions],
  );

  const requiresVersion = kind === 'DAILY_BAR';
  const submitBlocked = !file || (requiresVersion && versionId == null);

  const submit = () => {
    if (!file || submitBlocked) return;
    upload.mutate({ kind, file, datasetVersionId: requiresVersion ? (versionId as number) : undefined });
  };

  return (
    <div className="df-import-panel">
      <Card size="small" title="上传导入文件（CSV，幂等：相同内容重复导入不产生重复行）" style={{ marginBottom: 12 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Text>导入类型</Text>
            <Select
              style={{ minWidth: 300 }}
              value={kind}
              options={IMPORT_KIND_OPTIONS}
              onChange={(next) => {
                setKind(next);
                setVersionId(null);
              }}
              data-testid="import-kind-select"
            />
          </Space>

          {requiresVersion && (
            <Space direction="vertical" size={4} style={{ width: '100%' }} data-testid="import-version-flow">
              <Space wrap>
                <Text>导入数据集</Text>
                <Select
                  style={{ minWidth: 300 }}
                  placeholder="选择导入类数据集（IMPORT_*）"
                  value={importDatasetCode}
                  options={importDatasetOptions}
                  loading={datasets.isLoading}
                  onChange={(code) => {
                    // 版本属于数据集：切换数据集时清空已选版本。
                    setImportDatasetCode(code);
                    setVersionId(null);
                  }}
                  showSearch
                  data-testid="import-dataset-select"
                />
                <Button
                  size="small"
                  onClick={() => setDatasetModalOpen(true)}
                  data-testid="import-create-dataset-entry"
                >
                  新建导入数据集
                </Button>
              </Space>
              <Space wrap>
                <Text>DRAFT 版本</Text>
                <Select
                  style={{ minWidth: 300 }}
                  placeholder={importDatasetCode ? '选择 DRAFT 版本或新建' : '请先选择导入数据集'}
                  value={versionId}
                  options={versionOptions}
                  loading={versions.isLoading}
                  disabled={!importDatasetCode}
                  onChange={setVersionId}
                  data-testid="import-version-select"
                />
                <Button
                  size="small"
                  disabled={!importDatasetCode}
                  onClick={() => setVersionModalOpen(true)}
                  data-testid="import-create-version-btn"
                >
                  新建版本
                </Button>
              </Space>
              <Text type="secondary">
                日 K 导入必须关联导入类数据集的 DRAFT 版本（上传携带 datasetVersionId）；其他导入类型无需版本关联。
              </Text>
              {importDatasetCode != null && draftVersions.length === 0 && !versions.isLoading && (
                <Text type="warning" data-testid="import-no-draft-hint">
                  该数据集暂无 DRAFT 版本，请新建版本后再上传。
                </Text>
              )}
            </Space>
          )}

          <Space wrap>
            <Upload
              maxCount={1}
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: next }) => setFileList(next)}
              accept=".csv,text/csv"
              data-testid="import-upload"
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
            <Button
              type="primary"
              disabled={submitBlocked}
              loading={upload.isPending}
              onClick={submit}
              data-testid="import-submit"
            >
              提交导入
            </Button>
          </Space>

          {upload.isError && (
            <Alert
              type="error" showIcon title="导入失败"
              description={upload.error instanceof Error ? upload.error.message : '请重试。'}
              data-testid="import-upload-error"
            />
          )}

          {result && <ImportResultCard batch={result} />}
        </Space>
      </Card>

      <Card size="small" title="最近导入批次">
        <ImportBatchTable
          batches={batches.data ?? []}
          loading={batches.isLoading}
          error={batches.isError ? (batches.error as Error) : null}
        />
      </Card>

      <DatasetCreateModal
        open={datasetModalOpen}
        onClose={() => setDatasetModalOpen(false)}
        defaultProviderCode="IMPORT_CSV_DAILY"
        onCreated={(code) => setImportDatasetCode(code)}
      />
      <VersionCreateModal
        open={versionModalOpen}
        datasetCode={importDatasetCode}
        onClose={() => setVersionModalOpen(false)}
        onCreated={(id) => setVersionId(id)}
      />
    </div>
  );
}

function ImportResultCard({ batch }: { batch: ImportBatch }) {
  return (
    <Card
      size="small"
      type="inner"
      title={`导入结果（批次 #${batch.id} · ${batch.status}${batch.datasetVersionId != null ? ` · 版本 #${batch.datasetVersionId}` : ''}）`}
      data-testid="import-result"
    >
      <Space size={16} wrap>
        <Text>新增 {formatCount(batch.insertedCount)}</Text>
        <Text>更新 {formatCount(batch.updatedCount)}</Text>
        <Text>跳过 {formatCount(batch.skippedCount)}</Text>
        <Text type={((batch.rejectedCount ?? 0) > 0) ? 'danger' : undefined}>
          拒绝 {formatCount(batch.rejectedCount)}
        </Text>
      </Space>
      {errorReportHasErrors(batch.errorReportJson) && (
        <Typography.Paragraph
          type="danger"
          style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}
          data-testid="import-result-error-report"
        >
          {batch.errorReportJson}
        </Typography.Paragraph>
      )}
    </Card>
  );
}
