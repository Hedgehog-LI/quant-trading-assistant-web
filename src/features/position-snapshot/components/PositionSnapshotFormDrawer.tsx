import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { calculatePositionSnapshot } from '../api/positionSnapshotCalculator';
import { MARKET_TYPE_OPTIONS, SNAPSHOT_SOURCE_META } from '../model/meta';
import type {
  PositionSnapshotDetail,
  PositionSnapshotItemInput,
} from '../model/types';
import { formatMoney, formatPercent } from '../../../shared/utils/number';
import { pnlColor, PNL_COLOR_HEX } from '../../portfolio/model/types';

export interface PositionSnapshotFormValues {
  snapshotDate: string;
  snapshotTime: string;
  snapshotName?: string;
  remark?: string;
  items: PositionSnapshotItemInput[];
}

interface Props {
  open: boolean;
  editingSnapshot: PositionSnapshotDetail | null;
  onClose: () => void;
  onSubmit: (
    values: PositionSnapshotFormValues,
    targetStatus: 'DRAFT' | 'CONFIRMED',
  ) => Promise<void>;
}

function emptyItem(): PositionSnapshotItemInput {
  return {
    symbol: '',
    marketType: 'UNKNOWN',
    holdingQuantity: 100,
    availableQuantity: 100,
    costPrice: 0,
    currentPrice: 0,
  };
}

export function PositionSnapshotFormDrawer({ open, editingSnapshot, onClose, onSubmit }: Props) {
  const [form] = Form.useForm<PositionSnapshotFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const watchedItems = Form.useWatch('items', form);

  const preview = useMemo(
    () => calculatePositionSnapshot(
      (watchedItems ?? []).map((item) => ({
        symbol: item?.symbol ?? '',
        name: item?.name,
        marketType: item?.marketType ?? 'UNKNOWN',
        holdingQuantity: Number(item?.holdingQuantity ?? 0),
        availableQuantity: item?.availableQuantity,
        costPrice: Number(item?.costPrice ?? 0),
        currentPrice: Number(item?.currentPrice ?? 0),
        remark: item?.remark,
      })),
    ),
    [watchedItems],
  );

  useEffect(() => {
    if (!open) return;
    if (editingSnapshot) {
      form.setFieldsValue({
        snapshotDate: editingSnapshot.snapshotDate,
        snapshotTime: editingSnapshot.snapshotTime.slice(0, 16),
        snapshotName: editingSnapshot.snapshotName,
        remark: editingSnapshot.remark,
        items: editingSnapshot.items.map((item) => ({
          symbol: item.symbol,
          name: item.name,
          marketType: item.marketType,
          holdingQuantity: item.holdingQuantity,
          availableQuantity: item.availableQuantity,
          costPrice: item.costPrice,
          currentPrice: item.currentPrice,
          remark: item.remark,
        })),
      });
    } else {
      const current = dayjs();
      form.resetFields();
      form.setFieldsValue({
        snapshotDate: current.format('YYYY-MM-DD'),
        snapshotTime: current.format('YYYY-MM-DDTHH:mm'),
        snapshotName: `${current.format('YYYY-MM-DD')} 持仓快照`,
        items: [emptyItem()],
      });
    }
  }, [editingSnapshot, form, open]);

  const validateBusinessRules = (values: PositionSnapshotFormValues): boolean => {
    if (values.snapshotTime.slice(0, 10) !== values.snapshotDate) {
      form.setFields([{ name: 'snapshotTime', errors: ['快照日期必须与快照时间中的日期一致'] }]);
      return false;
    }
    const symbols = values.items.map((item) => item.symbol.trim().toUpperCase());
    if (new Set(symbols).size !== symbols.length) {
      message.error('同一持仓快照内股票代码不能重复');
      return false;
    }
    const invalidAvailable = values.items.find(
      (item) => (item.availableQuantity ?? item.holdingQuantity) > item.holdingQuantity,
    );
    if (invalidAvailable) {
      message.error(`股票 ${invalidAvailable.symbol} 的可用数量不能超过持仓数量`);
      return false;
    }
    return true;
  };

  const submit = async (targetStatus: 'DRAFT' | 'CONFIRMED') => {
    try {
      const values = await form.validateFields();
      if (!validateBusinessRules(values)) return;
      setSubmitting(true);
      await onSubmit(values, targetStatus);
      form.resetFields();
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();
      if (!validateBusinessRules(values)) return;
      Modal.confirm({
        title: '确认并锁定这份持仓快照？',
        content: '确认后不能普通编辑，只能查看或作废。',
        okText: '确认入库',
        cancelText: '继续编辑',
        onOk: () => submit('CONFIRMED'),
      });
    } catch {
      // Ant Design Form 已展示字段错误。
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Drawer
      title={editingSnapshot ? '编辑持仓快照草稿' : '新建持仓快照'}
      open={open}
      onClose={handleClose}
      size="min(1180px, 98vw)"
      destroyOnHidden
      footer={
        <div className="position-snapshot-form-footer">
          <Typography.Text type="secondary">
            预览：{preview.positionCount} 只 / 市值 {formatMoney(preview.totalMarketValue)} / 盈亏{' '}
            <span style={{ color: PNL_COLOR_HEX[pnlColor(preview.totalUnrealizedPnl)] }}>
              {formatMoney(preview.totalUnrealizedPnl)}
            </span>
          </Typography.Text>
          <Space>
            <Button onClick={handleClose} disabled={submitting}>取消</Button>
            <Button icon={<SaveOutlined />} loading={submitting} onClick={() => void submit('DRAFT')}>
              保存草稿
            </Button>
            <Button type="primary" icon={<CheckCircleOutlined />} loading={submitting} onClick={() => void handleConfirm()}>
              保存并确认
            </Button>
          </Space>
        </div>
      }
    >
      <Form<PositionSnapshotFormValues> form={form} layout="vertical" autoComplete="off">
        <div className="position-snapshot-header-fields">
          <Form.Item name="snapshotDate" label="快照日期" rules={[{ required: true, message: '请选择快照日期' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="snapshotTime" label="快照时间" rules={[{ required: true, message: '请选择快照时间' }]}>
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="snapshotName" label="快照名称" rules={[{ max: 128 }]}>
            <Input maxLength={128} placeholder="如 2026-06-27 收盘持仓" />
          </Form.Item>
          <Form.Item label="数据来源">
            <Tag color="blue">
              {editingSnapshot ? SNAPSHOT_SOURCE_META[editingSnapshot.sourceType] : '手工录入'}
            </Tag>
          </Form.Item>
        </div>
        <Form.Item name="remark" label="快照备注" rules={[{ max: 1024 }]}>
          <Input.TextArea rows={2} maxLength={1024} showCount />
        </Form.Item>

        <div className="position-snapshot-form-title">
          <Typography.Text strong>持仓明细</Typography.Text>
          <Typography.Text type="secondary">金额和比例由系统预览，保存后以后端计算结果为准</Typography.Text>
        </div>

        <div className="position-snapshot-editor-scroll">
          <div className="position-snapshot-editor">
            <div className="position-snapshot-editor-header">
              <span>股票代码</span><span>股票名称</span><span>市场</span><span>持仓数量</span>
              <span>可用数量</span><span>成本价</span><span>当前价</span><span>持仓成本</span>
              <span>当前市值</span><span>浮动盈亏</span><span>备注</span><span />
            </div>
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => {
                    const row = preview.items[field.name];
                    return (
                      <div className="position-snapshot-editor-row" key={field.key}>
                        <Form.Item name={[field.name, 'symbol']} rules={[{ required: true, message: '必填' }]}>
                          <Input maxLength={32} placeholder="300750" />
                        </Form.Item>
                        <Form.Item name={[field.name, 'name']}>
                          <Input maxLength={128} placeholder="股票名称" />
                        </Form.Item>
                        <Form.Item name={[field.name, 'marketType']}>
                          <Select options={MARKET_TYPE_OPTIONS} />
                        </Form.Item>
                        <Form.Item name={[field.name, 'holdingQuantity']} rules={[{ required: true, message: '必填' }]}>
                          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name={[field.name, 'availableQuantity']}>
                          <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name={[field.name, 'costPrice']} rules={[{ required: true, message: '必填' }]}>
                          <InputNumber min={0} precision={6} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name={[field.name, 'currentPrice']} rules={[{ required: true, message: '必填' }]}>
                          <InputNumber min={0} precision={6} style={{ width: '100%' }} />
                        </Form.Item>
                        <span className="position-snapshot-calculated">{formatMoney(row?.costAmount)}</span>
                        <span className="position-snapshot-calculated">{formatMoney(row?.marketValue)}</span>
                        <span
                          className="position-snapshot-calculated"
                          style={{ color: PNL_COLOR_HEX[pnlColor(row?.unrealizedPnl)] }}
                        >
                          {formatMoney(row?.unrealizedPnl)}
                          <small>{formatPercent(row?.pnlRate)}</small>
                        </span>
                        <Form.Item name={[field.name, 'remark']}>
                          <Input maxLength={512} placeholder="备注" />
                        </Form.Item>
                        <Tooltip title="删除此行">
                          <Button aria-label="删除此行" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                        </Tooltip>
                      </div>
                    );
                  })}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add(emptyItem())} block>
                    添加持仓
                  </Button>
                </>
              )}
            </Form.List>
          </div>
        </div>
      </Form>
    </Drawer>
  );
}
