/**
 * 回补任务创建表单。
 *
 * - dataset 下拉只展示在线回补数据集（Provider=TENCENT_PUBLIC，用途隔离：导入类数据集
 *   只用于 CSV 导入通道，不进入回补下拉，不依赖用户理解 Provider 差异）；
 *   market/provider/frequency/adjust 随所选数据集自动带出并以只读方式展示。
 * - 数据集为空或无在线回补数据集时给出"新建数据集"入口（Provider 锁定 TENCENT_PUBLIC），
 *   创建成功后自动选中。
 * - 起止日期为 YYYY-MM-DD 文本输入并严格校验（格式/真实日历日/先后顺序/不早于 2021-01-01）；
 *   结束日期晚于今天仅前端提示（warningOnly 不阻断），最终校验以后端为准。
 * - symbols 可选：逗号或空白分隔；chunkSize 可选 1-500（后端 MAX_CHUNK_SIZE）。
 * - 创建成功回调携带新任务（页面自动定位任务详情）。
 * - 业务失败（如 DATA_FOUNDATION_*）展示后端 message，绝不伪造成功。
 */
import { useMemo, useState } from 'react';
import { Alert, Button, Form, Input, InputNumber, Select, Space, Typography } from 'antd';
import { useCreateBackfillTask, useFoundationDatasets } from '../hooks/useDataFoundation';
import {
  EARLIEST_START_DATE,
  MAX_CHUNK_SIZE,
  ONLINE_BACKFILL_PROVIDER,
  compareDateString,
  isValidDateString,
  parseSymbolsInput,
  todayDateString,
} from '../model/format';
import type { BackfillTask, Dataset } from '../model/types';
import { DatasetCreateModal } from './DatasetCreateModal';

const { Text } = Typography;

interface FormValues {
  datasetCode?: string;
  startDate?: string;
  endDate?: string;
  symbols?: string;
  chunkSize?: number;
}

export interface BackfillTaskFormHandle {
  /** 提交成功后回调（携带新任务，页面用于刷新列表并自动定位任务详情）。 */
  onCreated?: (task: BackfillTask) => void;
}

export function BackfillTaskForm({ onCreated }: BackfillTaskFormHandle) {
  const [form] = Form.useForm<FormValues>();
  const datasets = useFoundationDatasets();
  const createTask = useCreateBackfillTask();
  const [createOpen, setCreateOpen] = useState(false);

  const onlineDatasets = useMemo(
    () => (datasets.data ?? []).filter((dataset: Dataset) => dataset.providerCode === ONLINE_BACKFILL_PROVIDER),
    [datasets.data],
  );
  const datasetOptions = useMemo(
    () =>
      onlineDatasets.map((dataset: Dataset) => ({
        value: dataset.datasetCode,
        label: `${dataset.datasetCode}（${dataset.datasetName}）`,
        dataset,
      })),
    [onlineDatasets],
  );

  const selectedDatasetCode = Form.useWatch('datasetCode', form);
  const selectedDataset = datasetOptions.find((option) => option.value === selectedDatasetCode)?.dataset ?? null;

  const noOnlineDataset =
    datasets.isSuccess && (datasets.data ?? []).length > 0 && onlineDatasets.length === 0;

  const onFinish = (values: FormValues) => {
    if (!selectedDataset) return;
    createTask.mutate(
      {
        datasetCode: selectedDataset.datasetCode,
        marketCode: selectedDataset.marketCode,
        providerCode: selectedDataset.providerCode,
        frequency: selectedDataset.frequency,
        adjustType: selectedDataset.adjustType,
        startDate: values.startDate as string,
        endDate: values.endDate as string,
        symbols: parseSymbolsInput(values.symbols),
        chunkSize: values.chunkSize,
      },
      {
        onSuccess: (created) => {
          form.resetFields();
          onCreated?.(created);
        },
      },
    );
  };

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      onFinish={onFinish}
      data-testid="backfill-task-form"
      className="df-task-form"
    >
      <Form.Item
        name="datasetCode"
        label="数据集"
        rules={[{ required: true, message: '请选择数据集' }]}
      >
        <Select
          placeholder="选择要回补的数据集"
          options={datasetOptions.map(({ value, label }) => ({ value, label }))}
          loading={datasets.isLoading}
          data-testid="backfill-dataset-select"
        />
      </Form.Item>

      {datasets.isSuccess && (datasets.data ?? []).length === 0 && (
        <Alert
          type="info"
          showIcon
          title="尚无数据集"
          description={
            <Space direction="vertical" size={4}>
              <Text type="secondary">全新部署请先创建在线回补数据集（Provider 固定 TENCENT_PUBLIC，腾讯公共源·实验性）。</Text>
              <Button size="small" onClick={() => setCreateOpen(true)} data-testid="backfill-create-dataset-entry">
                新建数据集
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {noOnlineDataset && (
        <Alert
          type="info"
          showIcon
          title="暂无支持在线回补的数据集"
          description={
            <Space direction="vertical" size={4}>
              <Text type="secondary">
                现有数据集均为导入类（IMPORT_*），只用于 CSV 导入页签，不能创建回补任务；如需在线回补请新建 TENCENT_PUBLIC 数据集。
              </Text>
              <Button size="small" onClick={() => setCreateOpen(true)} data-testid="backfill-create-dataset-entry">
                新建数据集
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <DatasetCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        providerLocked={ONLINE_BACKFILL_PROVIDER}
        onCreated={(code) => form.setFieldValue('datasetCode', code)}
      />

      {selectedDataset && (
        <div className="df-task-form__derived">
          <Space size={[8, 8]} wrap>
            <Text type="secondary">market={selectedDataset.marketCode}</Text>
            <Text type="secondary">provider={selectedDataset.providerCode}</Text>
            <Text type="secondary">frequency={selectedDataset.frequency}</Text>
            <Text type="secondary">adjust={selectedDataset.adjustType}</Text>
          </Space>
        </div>
      )}

      <Form.Item
        name="startDate"
        label="起始日期（YYYY-MM-DD）"
        rules={[
          { required: true, message: '请输入起始日期' },
          {
            validator: (_rule, value: string | undefined) => {
              if (!value) return Promise.resolve();
              if (!isValidDateString(value)) return Promise.reject(new Error('日期格式必须为 YYYY-MM-DD 且是真实日历日'));
              if (compareDateString(value, EARLIEST_START_DATE) < 0) {
                return Promise.reject(new Error(`回补窗口最早 ${EARLIEST_START_DATE}（MR-1 输入边界）`));
              }
              return Promise.resolve();
            },
          },
        ]}
      >
        <Input placeholder="2026-07-01" data-testid="backfill-start-date" />
      </Form.Item>

        <Form.Item
          name="endDate"
          label="截止日期（YYYY-MM-DD）"
          dependencies={['startDate']}
          rules={[
            { required: true, message: '请输入截止日期' },
            {
              validator: (_rule, value: string | undefined) => {
                if (!value) return Promise.resolve();
                if (!isValidDateString(value)) return Promise.reject(new Error('日期格式必须为 YYYY-MM-DD 且是真实日历日'));
                const start = form.getFieldValue('startDate') as string | undefined;
                if (start && isValidDateString(start) && compareDateString(value, start) < 0) {
                  return Promise.reject(new Error('截止日期不能早于起始日期'));
                }
                return Promise.resolve();
              },
            },
            {
              // 结束日期晚于今天：仅前端提示（warningOnly 不阻断提交），最终校验以后端为准。
              warningOnly: true,
              validator: (_rule, value: string | undefined) => {
                if (!value || !isValidDateString(value)) return Promise.resolve();
                if (compareDateString(value, todayDateString()) > 0) {
                  return Promise.reject(new Error('截止日期晚于今天，提交后以后端校验为准'));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input placeholder="2026-07-31" data-testid="backfill-end-date" />
        </Form.Item>

      <Form.Item
        name="symbols"
        label="证券代码（可选，逗号分隔；留空为数据集全证券池）"
        rules={[
          {
            validator: (_rule, value: string | undefined) => {
              if (!value?.trim()) return Promise.resolve();
              const symbols = parseSymbolsInput(value);
              if (!symbols) return Promise.reject(new Error('证券代码输入无法解析'));
              return Promise.resolve();
            },
          },
        ]}
      >
        <Input placeholder="SH.600519, SZ.000001" data-testid="backfill-symbols" />
      </Form.Item>

      <Form.Item
        name="chunkSize"
        label="每分片证券数（可选，1-500，默认后端取值）"
        rules={[
          {
            validator: (_rule, value: number | undefined) => {
              if (value == null) return Promise.resolve();
              if (!Number.isInteger(value) || value < 1 || value > MAX_CHUNK_SIZE) {
                return Promise.reject(new Error(`chunkSize 必须为 1-${MAX_CHUNK_SIZE} 的整数`));
              }
              return Promise.resolve();
            },
          },
        ]}
      >
        <InputNumber style={{ width: 160 }} data-testid="backfill-chunk-size" />
      </Form.Item>

      {createTask.isError && (
        <Alert
          type="error"
          showIcon
          title="创建回补任务失败"
          description={createTask.error instanceof Error ? createTask.error.message : '请检查后端连接后重试。'}
          style={{ marginBottom: 12 }}
          data-testid="backfill-create-error"
        />
      )}

      <Button
        type="primary"
        htmlType="submit"
        loading={createTask.isPending}
        data-testid="backfill-submit"
      >
        创建回补任务
      </Button>
    </Form>
  );
}
