import { useEffect, useMemo, useState } from 'react';
import { Drawer, Form, Input, Checkbox, Spin, Empty } from 'antd';
import type { TradeJournal } from '../../../shared/types/domain';
import type { ReviewNote } from '../../../shared/types/domain';
import { getTradeJournals } from '../../journal/api/tradeJournalApi';
import { DrawerFooter } from '../../../shared/components/DrawerFooter';

export interface FormValues {
  reviewDate: string;
  symbol?: string;
  title: string;
  marketContext?: string;
  planSummary?: string;
  actionSummary?: string;
  rightThings?: string;
  wrongThings?: string;
  ruleChanges?: string;
  nextActions?: string;
  linkedJournalIds: string[];
}

interface Props {
  open: boolean;
  editingItem: ReviewNote | null;
  onClose: () => void;
  /** 异步提交：表单内部 await，捕获错误后通过 message.error 反馈。 */
  onSubmit: (values: FormValues) => Promise<void>;
  defaultDate: string;
}

export function ReviewForm({ open, editingItem, onClose, onSubmit, defaultDate }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [pendingJournals, setPendingJournals] = useState<TradeJournal[]>([]);
  const [journalsLoading, setJournalsLoading] = useState(false);

  // getTradeJournals 当前同步；改 async 后兼容。drawer 打开时异步加载待复盘交易。
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setJournalsLoading(true);
      try {
        const all = await getTradeJournals();
        if (cancelled) return;
        setPendingJournals(all.filter((j) => j.reviewStatus === 'PENDING'));
      } catch {
        if (!cancelled) setPendingJournals([]);
      } finally {
        if (!cancelled) setJournalsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.setFieldsValue({
          reviewDate: editingItem.reviewDate,
          symbol: editingItem.symbol,
          title: editingItem.title,
          marketContext: editingItem.marketContext,
          planSummary: editingItem.planSummary,
          actionSummary: editingItem.actionSummary,
          rightThings: editingItem.rightThings,
          wrongThings: editingItem.wrongThings,
          ruleChanges: editingItem.ruleChanges,
          nextActions: editingItem.nextActions,
          linkedJournalIds: editingItem.linkedJournalIds.map((id) => String(id)),
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ reviewDate: defaultDate, linkedJournalIds: [] });
      }
    }
  }, [open, editingItem, form, defaultDate]);

  const handleFinish = async (values: FormValues) => {
    await onSubmit(values);
    form.resetFields();
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const pendingJournalsContent = useMemo(() => {
    if (journalsLoading) {
      return <Spin size="small" />;
    }
    if (pendingJournals.length === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无待复盘交易" />;
    }
    return pendingJournals.map((j) => (
      <div key={j.id} style={{ marginBottom: 4 }}>
        <Checkbox value={String(j.id)}>
          {j.tradeDate} {j.symbol} {j.side === 'BUY' ? '买入' : '卖出'} {j.price} x {j.quantity}
        </Checkbox>
      </div>
    ));
  }, [journalsLoading, pendingJournals]);

  return (
    <Drawer
      title={editingItem ? '编辑复盘' : '新增复盘'}
      open={open}
      onClose={handleClose}
      width={520}
      destroyOnClose
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={handleFinish} autoComplete="off">
        <Form.Item name="reviewDate" label="复盘日期" rules={[{ required: true }]}>
          <Input type="date" />
        </Form.Item>
        <Form.Item name="symbol" label="股票代码" extra="留空表示每日总复盘">
          <Input placeholder="如 300750，留空为每日总复盘" maxLength={32} />
        </Form.Item>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="如 宁德时代 6月8日复盘" maxLength={128} />
        </Form.Item>
        <Form.Item name="marketContext" label="市场环境">
          <Input.TextArea rows={2} maxLength={2048} />
        </Form.Item>
        <Form.Item name="planSummary" label="原计划">
          <Input.TextArea rows={2} maxLength={2048} />
        </Form.Item>
        <Form.Item name="actionSummary" label="实际操作">
          <Input.TextArea rows={2} maxLength={2048} />
        </Form.Item>
        <Form.Item name="rightThings" label="做对了什么">
          <Input.TextArea rows={2} maxLength={2048} />
        </Form.Item>
        <Form.Item name="wrongThings" label="做错了什么">
          <Input.TextArea rows={2} maxLength={2048} />
        </Form.Item>
        <Form.Item name="ruleChanges" label="规则修正">
          <Input.TextArea rows={2} maxLength={2048} />
        </Form.Item>
        <Form.Item name="nextActions" label="下一步">
          <Input.TextArea rows={2} maxLength={2048} />
        </Form.Item>
        <Form.Item name="linkedJournalIds" label="关联交易记录">
          <Checkbox.Group style={{ width: '100%' }}>
            {pendingJournalsContent}
          </Checkbox.Group>
        </Form.Item>
      </Form>
      <DrawerFooter
        onCancel={handleClose}
        onSubmit={() => form.submit()}
        submitText={editingItem ? '保存' : '新增'}
      />
    </Drawer>
  );
}
