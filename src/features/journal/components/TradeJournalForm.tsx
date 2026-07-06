import { useEffect, useMemo, useState } from 'react';
import { Drawer, Form, Input, Select, InputNumber, Alert, Tag, Row, Col, Typography, message } from 'antd';
import type { TradeJournal, TradePlan } from '../../../shared/types/domain';
import { TRADE_SIDE_OPTIONS, EMOTION_TAG_OPTIONS, MISTAKE_TAG_OPTIONS } from '../model/options';
import { DrawerFooter } from '../../../shared/components/DrawerFooter';
import { getTradePlans } from '../../tradeplan/api/tradePlanApi';

const PLAN_STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  ACTIVE: '生效中',
  DONE: '已完成',
  CANCELLED: '已取消',
};

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
  onSubmit: (values: FormValues) => Promise<void>;
  defaultDate: string;
}

export function TradeJournalForm({ open, editingItem, onClose, onSubmit, defaultDate }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [plans, setPlans] = useState<TradePlan[]>([]);
  const side = Form.useWatch('side', form);
  const tradeDate = Form.useWatch('tradeDate', form);

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
          // planId 后端可能是数字主键，表单 Select 统一按字符串处理。
          planId: editingItem.planId === undefined ? undefined : String(editingItem.planId),
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

  // 加载交易计划候选，用于关联选择器。
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getTradePlans()
      .then((all) => {
        if (!cancelled) setPlans(all);
      })
      .catch(() => {
        if (!cancelled) setPlans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 候选过滤 CANCELLED，同日计划优先排序。
  const candidatePlans = useMemo(() => {
    return plans
      .filter((p) => p.planStatus !== 'CANCELLED')
      .sort((a, b) => {
        const aSame = a.planDate === tradeDate ? 0 : 1;
        const bSame = b.planDate === tradeDate ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
        return b.planDate.localeCompare(a.planDate);
      });
  }, [plans, tradeDate]);

  const handlePlanSelect = (planId?: string) => {
    if (!planId) return;
    const plan = plans.find((p) => String(p.id) === String(planId));
    if (!plan) return;
    // 选择计划后自动带入可复用字段（用户仍可修改）。
    form.setFieldsValue({
      symbol: plan.symbol,
      name: plan.name ?? form.getFieldValue('name'),
      planStopLoss: plan.stopLossPrice ?? form.getFieldValue('planStopLoss'),
      planTakeProfit: plan.takeProfitPrice ?? form.getFieldValue('planTakeProfit'),
      positionRatio: plan.plannedPositionRatio ?? form.getFieldValue('positionRatio'),
    });
  };

  const handleFinish = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await onSubmit(values);
      form.resetFields();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
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
      size={500}
      destroyOnClose
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={handleFinish} autoComplete="off">
        <Form.Item name="tradeDate" label="交易日期" rules={[{ required: true }]}>
          <Input type="date" />
        </Form.Item>
        <Form.Item
          name="planId"
          label="关联交易计划"
          extra="选择后自动带入股票、止损、止盈和计划仓位；可继续修改。已取消计划不出现在候选。"
        >
          <Select
            allowClear
            placeholder="不关联计划可直接保存"
            onChange={handlePlanSelect}
            options={candidatePlans.map((p) => ({
              value: String(p.id),
              label: `[${p.planDate}] ${p.symbol}${p.name ? ' ' + p.name : ''} · ${PLAN_STATUS_LABEL[p.planStatus] ?? p.planStatus}`,
            }))}
          />
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
          <Alert type="warning" title="建议为买入操作设置止损价" style={{ marginBottom: 16 }} />
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
      <DrawerFooter
        onCancel={handleClose}
        onSubmit={() => form.submit()}
        submitText={editingItem ? '保存' : '新增'}
        loading={submitting}
      />
    </Drawer>
  );
}
