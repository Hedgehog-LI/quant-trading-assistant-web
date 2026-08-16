/**
 * 新建数据集版本 Modal（仅 IMPORT_* 导入类数据集；POST /datasets/{code}/versions）。
 *
 * - 版本窗口 startDate/endDate 严格校验（YYYY-MM-DD/真实日历日/先后顺序/不早于 2021-01-01）；
 * - 创建成功后由父级自动选中新版本；业务失败展示后端 message，不伪造版本。
 */
import { useEffect } from 'react';
import { Alert, Form, Input, Modal } from 'antd';
import { useCreateDatasetVersion } from '../hooks/useDataFoundation';
import { EARLIEST_START_DATE, compareDateString, isValidDateString } from '../model/format';

interface FormValues {
  startDate?: string;
  endDate?: string;
}

export interface VersionCreateModalProps {
  open: boolean;
  datasetCode: string | null;
  onClose: () => void;
  /** 创建成功回调（新版本 id 由父级自动选中用于 DAILY_BAR 导入关联）。 */
  onCreated: (versionId: number) => void;
}

export function VersionCreateModal({ open, datasetCode, onClose, onCreated }: VersionCreateModalProps) {
  const [form] = Form.useForm<FormValues>();
  const createVersion = useCreateDatasetVersion();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const onFinish = (values: FormValues) => {
    if (!datasetCode) return;
    createVersion.mutate(
      { datasetCode, body: { startDate: values.startDate as string, endDate: values.endDate as string } },
      {
        onSuccess: (version) => {
          onClose();
          onCreated(version.id);
        },
      },
    );
  };

  return (
    <Modal
      title={`新建版本（${datasetCode ?? '--'}）`}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="创建"
      cancelText="取消"
      confirmLoading={createVersion.isPending}
      destroyOnHidden
      data-testid="version-create-modal"
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={onFinish}>
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
                  return Promise.reject(new Error(`版本窗口最早 ${EARLIEST_START_DATE}`));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input placeholder="2021-01-01" data-testid="version-create-start" />
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
          ]}
        >
          <Input placeholder="2026-07-31" data-testid="version-create-end" />
        </Form.Item>

        {createVersion.isError && (
          <Alert
            type="error"
            showIcon
            title="创建版本失败"
            description={createVersion.error instanceof Error ? createVersion.error.message : '请重试。'}
            data-testid="version-create-error"
          />
        )}
      </Form>
    </Modal>
  );
}
