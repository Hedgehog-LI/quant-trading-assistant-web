import { useEffect } from 'react';
import { Drawer, Form, Input, Select, InputNumber, Switch, Alert } from 'antd';
import type { TradePlan } from '../../../shared/types/domain';
import { PLAN_STATUS_OPTIONS } from '../model/options';
import { DrawerFooter } from '../../../shared/components/DrawerFooter';

export interface FormValues {
  planDate: string;
  symbol: string;
  name?: string;
  planStatus: string;
  buyCondition?: string;
  sellCondition?: string;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  plannedPositionRatio?: number;
  maxLossAmount?: number;
  allowedToTrade: boolean;
  riskNote?: string;
  notes?: string;
}

interface Props {
  open: boolean;
  editingItem: TradePlan | null;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
  /** 提交中：禁用按钮并显示 loading（async 提交防重复点击）。 */
  submitting?: boolean;
  defaultDate: string;
}

export function TradePlanForm({ open, editingItem, onClose, onSubmit, submitting = false, defaultDate }: Props) {
  const [form] = Form.useForm<FormValues>();
  const allowedToTrade = Form.useWatch('allowedToTrade', form);

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.setFieldsValue({
          planDate: editingItem.planDate,
          symbol: editingItem.symbol,
          name: editingItem.name,
          planStatus: editingItem.planStatus,
          buyCondition: editingItem.buyCondition,
          sellCondition: editingItem.sellCondition,
          stopLossPrice: editingItem.stopLossPrice,
          takeProfitPrice: editingItem.takeProfitPrice,
          plannedPositionRatio: editingItem.plannedPositionRatio,
          maxLossAmount: editingItem.maxLossAmount,
          allowedToTrade: editingItem.allowedToTrade,
          riskNote: editingItem.riskNote,
          notes: editingItem.notes,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ planDate: defaultDate, allowedToTrade: false, planStatus: 'DRAFT' });
      }
    }
  }, [open, editingItem, form, defaultDate]);

  const handleFinish = (values: FormValues) => {
    onSubmit(values);
    form.resetFields();
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Drawer
      title={editingItem ? '编辑交易计划' : '新增交易计划'}
      open={open}
      onClose={handleClose}
      size={500}
      destroyOnClose
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={handleFinish} autoComplete="off">
        <Form.Item name="planDate" label="计划日期" rules={[{ required: true, message: '请选择日期' }]}>
          <Input type="date" />
        </Form.Item>
        <Form.Item name="symbol" label="股票代码" rules={[{ required: true, message: '请输入股票代码' }]}>
          <Input placeholder="如 300750" disabled={!!editingItem} maxLength={32} />
        </Form.Item>
        <Form.Item name="name" label="股票名称">
          <Input placeholder="如 宁德时代" maxLength={128} />
        </Form.Item>
        <Form.Item name="planStatus" label="计划状态">
          <Select options={PLAN_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </Form.Item>
        <Form.Item name="allowedToTrade" label="今日允许交易" valuePropName="checked">
          <Switch />
        </Form.Item>
        {allowedToTrade && (
          <Alert
            type="warning"
            title="允许交易时必须填写买入条件、止损价和计划仓位"
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item name="buyCondition" label="买入条件" rules={allowedToTrade ? [{ required: true, message: '允许交易时必填' }] : []}>
          <Input.TextArea rows={2} maxLength={1024} placeholder="如 突破220且放量" />
        </Form.Item>
        <Form.Item name="sellCondition" label="卖出条件">
          <Input.TextArea rows={2} maxLength={1024} placeholder="如 跌破210止损" />
        </Form.Item>
        <Form.Item name="stopLossPrice" label="止损价" rules={allowedToTrade ? [{ required: true, message: '允许交易时必填' }] : []}>
          <InputNumber style={{ width: '100%' }} min={0} precision={4} />
        </Form.Item>
        <Form.Item name="takeProfitPrice" label="止盈价">
          <InputNumber style={{ width: '100%' }} min={0} precision={4} />
        </Form.Item>
        <Form.Item
          name="plannedPositionRatio"
          label="计划仓位比例"
          rules={allowedToTrade ? [{ required: true, message: '允许交易时必填' }] : []}
          extra="范围 0~1，如 0.10 表示 10%"
        >
          <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.01} precision={4} />
        </Form.Item>
        <Form.Item name="maxLossAmount" label="最大可承受亏损">
          <InputNumber style={{ width: '100%' }} min={0} precision={2} />
        </Form.Item>
        <Form.Item name="riskNote" label="风险备注">
          <Input.TextArea rows={2} maxLength={1024} />
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={2} maxLength={2048} />
        </Form.Item>
      </Form>
      <DrawerFooter onCancel={handleClose} onSubmit={() => form.submit()} submitText={editingItem ? '保存' : '新增'} loading={submitting} />
    </Drawer>
  );
}
