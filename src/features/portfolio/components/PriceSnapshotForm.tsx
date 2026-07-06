import { useEffect } from 'react';
import { Drawer, Form, Input, InputNumber, Alert, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DrawerFooter } from '../../../shared/components/DrawerFooter';
import type { PriceSnapshot } from '../model/types';
import { today } from '../../../shared/utils/date';
import { formatPrice } from '../../../shared/utils/number';

export interface PriceFormValues {
  symbol: string;
  name?: string;
  currentPrice: number;
  priceDate: string;
  note?: string;
}

interface FormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PriceFormValues) => void;
  defaultDate: string;
}

/** 当前价维护 Drawer 表单（upsert：相同 symbol + priceDate 覆盖）。 */
export function PriceSnapshotForm({ open, onClose, onSubmit, defaultDate }: FormProps) {
  const [form] = Form.useForm<PriceFormValues>();

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({ priceDate: defaultDate || today() });
    }
  }, [open, form, defaultDate]);

  const handleFinish = (values: PriceFormValues) => {
    onSubmit(values);
    form.resetFields();
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Drawer title="维护当前价" open={open} onClose={handleClose} size={520} destroyOnClose>
      <Alert
        type="info"
        title="当前价为手工录入，仅用于本地估算浮盈，不代表实时行情。"
        style={{ marginBottom: 16 }}
        showIcon
      />
      <Form<PriceFormValues> form={form} layout="vertical" onFinish={handleFinish} autoComplete="off">
        <Form.Item name="symbol" label="股票代码" rules={[{ required: true, message: '请输入股票代码' }]}>
          <Input placeholder="如 300750" maxLength={32} />
        </Form.Item>
        <Form.Item name="name" label="股票名称">
          <Input placeholder="如 宁德时代" maxLength={128} />
        </Form.Item>
        <Form.Item
          name="currentPrice"
          label="当前价"
          rules={[
            { required: true, message: '请输入当前价' },
            {
              validator: (_, value: number) =>
                value > 0 ? Promise.resolve() : Promise.reject(new Error('当前价需大于 0')),
            },
          ]}
        >
          <InputNumber style={{ width: '100%' }} min={0} precision={4} />
        </Form.Item>
        <Form.Item name="priceDate" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
          <Input type="date" />
        </Form.Item>
        <Form.Item name="note" label="备注">
          <Input.TextArea rows={2} maxLength={512} />
        </Form.Item>
      </Form>
      <DrawerFooter onCancel={handleClose} onSubmit={() => form.submit()} submitText="保存" />
    </Drawer>
  );
}

const listColumns: ColumnsType<PriceSnapshot> = [
  { title: '代码', dataIndex: 'symbol', width: 100 },
  { title: '名称', dataIndex: 'name', width: 110, render: (v?: string) => v ?? '-' },
  {
    title: '当前价',
    dataIndex: 'currentPrice',
    width: 90,
    align: 'right',
    render: (v: number) => formatPrice(v),
  },
  { title: '日期', dataIndex: 'priceDate', width: 110 },
  { title: '备注', dataIndex: 'note', ellipsis: true, render: (v?: string) => v ?? '-' },
];

interface ListProps {
  prices: PriceSnapshot[];
  title?: string;
}

/** 已维护当前价列表（当前价维护 Tab 与 Drawer 复用）。 */
export function PriceSnapshotTable({ prices, title }: ListProps) {
  return (
    <div>
      {title && (
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
          {title}
        </Typography.Title>
      )}
      <Table<PriceSnapshot>
        rowKey={(r) => `${r.symbol}-${r.priceDate}`}
        dataSource={prices}
        columns={listColumns}
        size="small"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 500 }}
      />
    </div>
  );
}
