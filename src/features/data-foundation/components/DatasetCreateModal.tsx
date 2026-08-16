/**
 * 新建数据集 Modal（全新部署初始化闭环）。
 *
 * - 使用现有 POST /datasets；首期冻结组合固定展示：market=CN、barType=DAILY、frequency=1D、
 *   adjust=NONE（单选项禁用防随意输入），provider 仅 TENCENT_PUBLIC / IMPORT_CSV_DAILY。
 * - 创建成功后由父级刷新数据集并自动选中新 datasetCode；业务失败展示后端 message。
 */
import { Alert, Form, Input, Modal, Select } from 'antd';
import { useCreateDataset } from '../hooks/useDataFoundation';
import { DATASET_PROVIDER_OPTIONS, isValidDatasetCode } from '../model/format';

interface FormValues {
  datasetCode?: string;
  datasetName?: string;
  providerCode?: string;
  description?: string;
}

export interface DatasetCreateModalProps {
  open: boolean;
  onClose: () => void;
  /** 创建成功回调（datasetCode 由父级用于刷新并自动选中）。 */
  onCreated: (datasetCode: string) => void;
  /**
   * Provider 锁定（数据集用途隔离，不依赖用户理解 Provider 差异）：
   * 回补入口传 ONLINE_BACKFILL_PROVIDER（TENCENT_PUBLIC），导入入口传 IMPORT_CSV_DAILY；
   * 不传时（数据集与版本面板的通用入口）允许在首期冻结组合中选择。
   */
  providerLocked?: string;
}

export function DatasetCreateModal({ open, onClose, onCreated, providerLocked }: DatasetCreateModalProps) {
  const [form] = Form.useForm<FormValues>();
  const createDataset = useCreateDataset();

  const providerOptions = providerLocked
    ? DATASET_PROVIDER_OPTIONS.filter((option) => option.value === providerLocked)
    : DATASET_PROVIDER_OPTIONS;

  // Modal destroyOnHidden：重开时表单自动重建并按 initialValues 预置；
  // 关闭（任意途径）与创建成功时清理上一次 mutation 错误态，下次打开不带残留。
  const resetAndClose = () => {
    createDataset.reset();
    onClose();
  };

  const onFinish = (values: FormValues) => {
    createDataset.mutate(
      {
        datasetCode: values.datasetCode as string,
        datasetName: values.datasetName as string,
        marketCode: 'CN',
        barType: 'DAILY',
        frequency: '1D',
        providerCode: values.providerCode as string,
        adjustType: 'NONE',
        description: values.description?.trim() || undefined,
      },
      {
        onSuccess: (dataset) => {
          createDataset.reset();
          onClose();
          onCreated(dataset.datasetCode);
        },
      },
    );
  };

  return (
    <Modal
      title="新建数据集"
      open={open}
      onCancel={resetAndClose}
      onOk={() => form.submit()}
      okText="创建"
      cancelText="取消"
      confirmLoading={createDataset.isPending}
      destroyOnHidden
      data-testid="dataset-create-modal"
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          marketCode: 'CN',
          barType: 'DAILY',
          frequency: '1D',
          adjustType: 'NONE',
          providerCode: providerLocked,
        }}
      >
        <Form.Item
          name="datasetCode"
          label="datasetCode"
          rules={[
            { required: true, message: '请输入 datasetCode' },
            {
              validator: (_rule, value: string | undefined) =>
                !value || isValidDatasetCode(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error('大写字母开头，仅大写字母/数字/下划线，3-64 位')),
            },
          ]}
        >
          <Input placeholder="CN_DAILY_BAR" data-testid="dataset-create-code" />
        </Form.Item>

        <Form.Item
          name="datasetName"
          label="数据集名称"
          rules={[{ required: true, message: '请输入数据集名称' }]}
        >
          <Input placeholder="A股日K数据集" data-testid="dataset-create-name" />
        </Form.Item>

        <Form.Item name="marketCode" label="市场（首期固定 CN）">
          <Select disabled options={[{ value: 'CN', label: 'CN' }]} data-testid="dataset-create-market" />
        </Form.Item>

        <Form.Item name="barType" label="K 线类型（首期固定 DAILY）">
          <Select disabled options={[{ value: 'DAILY', label: 'DAILY' }]} data-testid="dataset-create-bartype" />
        </Form.Item>

        <Form.Item name="frequency" label="频率（首期固定 1D）">
          <Select disabled options={[{ value: '1D', label: '1D' }]} data-testid="dataset-create-frequency" />
        </Form.Item>

        <Form.Item
          name="providerCode"
          label={
            providerLocked
              ? `Provider（已按入口锁定：${providerLocked}）`
              : 'Provider（首期仅以下组合，导入类数据集选 IMPORT_CSV_DAILY）'
          }
          rules={[{ required: true, message: '请选择 Provider' }]}
        >
          <Select
            options={providerOptions}
            placeholder="选择 Provider"
            disabled={providerLocked != null}
            data-testid="dataset-create-provider"
          />
        </Form.Item>

        <Form.Item
          name="adjustType"
          label="复权（首期仅 NONE，无 HFQ/QFQ Provider 支撑）"
        >
          <Select disabled options={[{ value: 'NONE', label: 'NONE' }]} data-testid="dataset-create-adjust" />
        </Form.Item>

        <Form.Item name="description" label="描述（可选）">
          <Input.TextArea rows={2} placeholder="口径与用途说明" data-testid="dataset-create-description" />
        </Form.Item>

        {createDataset.isError && (
          <Alert
            type="error"
            showIcon
            title="创建数据集失败"
            description={createDataset.error instanceof Error ? createDataset.error.message : '请重试。'}
            data-testid="dataset-create-error"
          />
        )}
      </Form>
    </Modal>
  );
}
