import { useEffect } from 'react';
import { Drawer, Form, Input, Select, InputNumber, Alert, Tag, Row, Col, Typography } from 'antd';
import type { TradeJournal } from '../../../shared/types/domain';
import { TRADE_SIDE_OPTIONS, EMOTION_TAG_OPTIONS, MISTAKE_TAG_OPTIONS } from '../model/options';
import { DrawerFooter } from '../../../shared/components/DrawerFooter';

export interface FormValues {
  tradeDate: string;
  tradeTime?: string;
  symbol: string;
  name?: string;
  side: string;
  price: number;
  quantity: number;
  commissionFee?: number;
  stampTax?: number;
  transferFee?: number;
  otherFee?: number;
  totalFee?: number;
  positionRatio?: number;
  planId?: string;
  reason?: string;
  planStopLoss?: number;
  planTakeProfit?: number;
  followedPlan?: boolean;
  emotionTags: string[];
  mistakeTags: string[];
  actualResult?: string;
}

interface Props {
  open: boolean;
  editingItem: TradeJournal | null;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
  defaultDate: string;
}

export function TradeJournalForm({ open, editingItem, onClose, onSubmit, defaultDate }: Props) {
  const [form] = Form.useForm<FormValues>();
  const side = Form.useWatch('side', form);

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.setFieldsValue({
          tradeDate: editingItem.tradeDate,
          tradeTime: editingItem.tradeTime,
          symbol: editingItem.symbol,
          name: editingItem.name,
          side: editingItem.side,
          price: editingItem.price,
          quantity: editingItem.quantity,
          commissionFee: editingItem.commissionFee,
          stampTax: editingItem.stampTax,
          transferFee: editingItem.transferFee,
          otherFee: editingItem.otherFee,
          totalFee: editingItem.totalFee,
          positionRatio: editingItem.positionRatio,
          planId: editingItem.planId,
          reason: editingItem.reason,
          planStopLoss: editingItem.planStopLoss,
          planTakeProfit: editingItem.planTakeProfit,
          followedPlan: editingItem.followedPlan,
          emotionTags: editingItem.emotionTags,
          mistakeTags: editingItem.mistakeTags,
          actualResult: editingItem.actualResult,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ tradeDate: defaultDate, side: 'BUY', emotionTags: [], mistakeTags: [] });
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
      title={editingItem ? '编辑交易记录' : '新增交易记录'}
      open={open}
      onClose={handleClose}
      width={500}
      destroyOnClose
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={handleFinish} autoComplete="off">
        <Form.Item name="tradeDate" label="交易日期" rules={[{ required: true }]}>
          <Input type="date" />
        </Form.Item>
        <Form.Item name="symbol" label="股票代码" rules={[{ required: true, message: '请输入股票代码' }]}>
          <Input placeholder="如 300750" maxLength={32} />
        </Form.Item>
        <Form.Item name="name" label="股票名称">
          <Input placeholder="如 宁德时代" maxLength={128} />
        </Form.Item>
        <Form.Item name="side" label="交易方向" rules={[{ required: true }]}>
          <Select options={TRADE_SIDE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </Form.Item>
        <Form.Item name="price" label="成交价" rules={[{ required: true, message: '请输入成交价' }]}>
          <InputNumber style={{ width: '100%' }} min={0} precision={4} />
        </Form.Item>
        <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
          <InputNumber style={{ width: '100%' }} min={1} step={100} />
        </Form.Item>
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 4, marginBottom: 8 }}>
          <Typography.Text type="secondary">费用（可选，填写总费用后优先使用）</Typography.Text>
        </div>
        <Row gutter={8}>
          <Col span={12}>
            <Form.Item name="commissionFee" label="佣金">
              <InputNumber style={{ width: '100%' }} min={0} precision={6} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="stampTax" label="印花税">
              <InputNumber style={{ width: '100%' }} min={0} precision={6} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="transferFee" label="过户费">
              <InputNumber style={{ width: '100%' }} min={0} precision={6} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="otherFee" label="其他费用">
              <InputNumber style={{ width: '100%' }} min={0} precision={6} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="totalFee" label="总费用" extra="填写后优先">
              <InputNumber style={{ width: '100%' }} min={0} precision={6} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="planStopLoss" label="计划止损">
          <InputNumber style={{ width: '100%' }} min={0} precision={4} />
        </Form.Item>
        {side === 'BUY' && !form.getFieldValue('planStopLoss') && (
          <Alert type="warning" message="建议为买入操作设置止损价" style={{ marginBottom: 16 }} />
        )}
        <Form.Item name="planTakeProfit" label="计划止盈">
          <InputNumber style={{ width: '100%' }} min={0} precision={4} />
        </Form.Item>
        <Form.Item name="positionRatio" label="仓位比例" extra="0~1">
          <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.01} precision={4} />
        </Form.Item>
        <Form.Item name="followedPlan" label="是否按计划执行">
          <Select
            allowClear
            placeholder="请选择"
            options={[
              { value: true, label: '是' },
              { value: false, label: '否' },
            ]}
          />
        </Form.Item>
        <Form.Item name="emotionTags" label="情绪标签">
          <Select
            mode="multiple"
            placeholder="选择情绪标签"
            options={EMOTION_TAG_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            tagRender={({ value, closable, onClose }) => {
              const opt = EMOTION_TAG_OPTIONS.find((o) => o.value === value);
              return (
                <Tag color={opt?.color ?? 'default'} closable={closable} onClose={onClose} style={{ marginRight: 3 }}>
                  {opt?.label ?? value}
                </Tag>
              );
            }}
          />
        </Form.Item>
        <Form.Item name="mistakeTags" label="错误标签">
          <Select
            mode="multiple"
            placeholder="选择错误标签"
            options={MISTAKE_TAG_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            tagRender={({ value, closable, onClose }) => {
              const opt = MISTAKE_TAG_OPTIONS.find((o) => o.value === value);
              return (
                <Tag color={opt?.color ?? 'default'} closable={closable} onClose={onClose} style={{ marginRight: 3 }}>
                  {opt?.label ?? value}
                </Tag>
              );
            }}
          />
        </Form.Item>
        <Form.Item name="reason" label="交易理由">
          <Input.TextArea rows={2} maxLength={2048} />
        </Form.Item>
        <Form.Item name="actualResult" label="实际结果">
          <Input.TextArea rows={2} maxLength={1024} />
        </Form.Item>
      </Form>
      <DrawerFooter onCancel={handleClose} onSubmit={() => form.submit()} submitText={editingItem ? '保存' : '新增'} />
    </Drawer>
  );
}
