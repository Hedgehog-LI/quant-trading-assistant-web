import { useEffect } from 'react';
import { Drawer, Form, Input, Select, InputNumber } from 'antd';
import type { WatchlistItem } from '../../../shared/types/domain';
import { MARKET_TYPE_OPTIONS, TRADE_STYLE_OPTIONS, ATTENTION_LEVEL_OPTIONS } from '../model/options';
import { DrawerFooter } from '../../../shared/components/DrawerFooter';

export interface FormValues {
  symbol: string;
  name: string;
  market?: string;
  groupName?: string;
  watchReason?: string;
  tradeStyle?: string;
  attentionLevel?: string;
  supportPrice?: number;
  resistancePrice?: number;
  stopLossPrice?: number;
  riskNote?: string;
}

interface Props {
  open: boolean;
  editingItem: WatchlistItem | null;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}

export function WatchlistForm({ open, editingItem, onClose, onSubmit }: Props) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.setFieldsValue({
          symbol: editingItem.symbol,
          name: editingItem.name,
          market: editingItem.market,
          groupName: editingItem.groupName,
          watchReason: editingItem.watchReason,
          tradeStyle: editingItem.tradeStyle,
          attentionLevel: editingItem.attentionLevel,
          supportPrice: editingItem.supportPrice,
          resistancePrice: editingItem.resistancePrice,
          stopLossPrice: editingItem.stopLossPrice,
          riskNote: editingItem.riskNote,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editingItem, form]);

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
      title={editingItem ? '编辑自选股' : '新增自选股'}
      open={open}
      onClose={handleClose}
      width={480}
      destroyOnClose
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        autoComplete="off"
      >
        <Form.Item name="symbol" label="股票代码" rules={[{ required: true, message: '请输入股票代码' }]}>
          <Input placeholder="如 300750" disabled={!!editingItem} maxLength={32} />
        </Form.Item>
        <Form.Item name="name" label="股票名称" rules={[{ required: true, message: '请输入股票名称' }]}>
          <Input placeholder="如 宁德时代" maxLength={128} />
        </Form.Item>
        <Form.Item name="market" label="市场">
          <Select placeholder="请选择" allowClear options={MARKET_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </Form.Item>
        <Form.Item name="groupName" label="分组">
          <Input placeholder="如 新能源" maxLength={64} />
        </Form.Item>
        <Form.Item name="tradeStyle" label="交易风格">
          <Select placeholder="请选择" allowClear options={TRADE_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </Form.Item>
        <Form.Item name="attentionLevel" label="关注级别">
          <Select placeholder="请选择" allowClear options={ATTENTION_LEVEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </Form.Item>
        <Form.Item name="supportPrice" label="支撑位">
          <InputNumber style={{ width: '100%' }} min={0} precision={4} placeholder="0.00" />
        </Form.Item>
        <Form.Item name="resistancePrice" label="压力位">
          <InputNumber style={{ width: '100%' }} min={0} precision={4} placeholder="0.00" />
        </Form.Item>
        <Form.Item name="stopLossPrice" label="默认止损位">
          <InputNumber style={{ width: '100%' }} min={0} precision={4} placeholder="0.00" />
        </Form.Item>
        <Form.Item name="watchReason" label="关注理由">
          <Input.TextArea rows={2} maxLength={1024} placeholder="简述关注理由" />
        </Form.Item>
        <Form.Item name="riskNote" label="风险备注">
          <Input.TextArea rows={2} maxLength={1024} placeholder="风险提示" />
        </Form.Item>
      </Form>
      <DrawerFooter onCancel={handleClose} onSubmit={() => form.submit()} submitText={editingItem ? '保存' : '新增'} />
    </Drawer>
  );
}
