/**
 * CSV 导入面板：kind 下拉 + 文件上传（multipart 字段名 file、kind 查询参数）
 * + 导入结果卡 + 最近批次表（ImportBatchTable）。
 *
 * - 结果计数 inserted/updated/skipped/rejected 全部展示（null 显示 '--'）；
 * - 有错误行时展示 errorReportJson（可读原文），绝不伪造成功；
 * - 上传失败展示后端 message（校验/内容错误）。
 */
import { useMemo, useState } from 'react';
import { Alert, Button, Card, Select, Space, Typography, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useImportBatches, useUploadImportSnapshot } from '../hooks/useDataFoundation';
import { errorReportHasErrors, formatCount } from '../model/format';
import type { ImportBatch, ImportKind } from '../model/types';
import { ImportBatchTable } from './ImportBatchTable';

const IMPORT_KIND_OPTIONS: { value: ImportKind; label: string }[] = [
  { value: 'UNIVERSE_SNAPSHOT', label: 'UNIVERSE_SNAPSHOT（证券池快照）' },
  { value: 'TRADING_CALENDAR', label: 'TRADING_CALENDAR（交易日历）' },
  { value: 'DAILY_BAR', label: 'DAILY_BAR（日 K）' },
  { value: 'INDUSTRY_TAXONOMY', label: 'INDUSTRY_TAXONOMY（行业分类）' },
  { value: 'INDUSTRY_MEMBERSHIP_PIT', label: 'INDUSTRY_MEMBERSHIP_PIT（PIT 行业成分）' },
];

const { Text } = Typography;

export function ImportPanel() {
  const [kind, setKind] = useState<ImportKind>('DAILY_BAR');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const upload = useUploadImportSnapshot();
  const batches = useImportBatches({ kind, page: 1, pageSize: 10 });

  const file = useMemo(() => fileList[0]?.originFileObj ?? null, [fileList]);
  const result = upload.data ?? null;

  const submit = () => {
    if (!file) return;
    upload.mutate({ kind, file });
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
              onChange={setKind}
              data-testid="import-kind-select"
            />
          </Space>
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
              disabled={!file}
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
    </div>
  );
}

function ImportResultCard({ batch }: { batch: ImportBatch }) {
  return (
    <Card
      size="small"
      type="inner"
      title={`导入结果（批次 #${batch.id} · ${batch.status}）`}
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
