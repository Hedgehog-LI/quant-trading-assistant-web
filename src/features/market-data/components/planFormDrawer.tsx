/**
 * 采集计划新建/修正表单 Drawer。
 * 纯结构拆分：从 src/pages/market-workspace.tsx 的 PlansTab 移出，行为不变。
 */
import { Alert, Button, Col, Drawer, Form, Input, Row, Select, Space, Switch } from 'antd';
import type { FormInstance } from 'antd';
import { SecurityVerificationField } from './SecurityVerificationField';
import { SecuritySelector } from '../../../shared/components/SecuritySelector';
import type { SyncPlanDraft } from '../utils/syncPlanForm';
import type { MarketDataSyncPlan } from '../../../shared/types/domain';

export function PlanFormDrawer({ open, editingPlan, saving, form, taskType, remoteMode, onClose, onSave }: {
  open: boolean;
  editingPlan: MarketDataSyncPlan | null;
  saving: boolean;
  form: FormInstance<SyncPlanDraft>;
  taskType: string | undefined;
  remoteMode: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Drawer title={editingPlan ? '修正采集计划' : '新建采集计划'} open={open} onClose={onClose} size="large"
      extra={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={saving} onClick={onSave}>{editingPlan ? '保存修正' : '创建'}</Button></Space>}>
      <Form form={form} layout="vertical">
        <Form.Item name="planName" label="计划名称" rules={[{ required: true }]}><Input placeholder="茅台30M补档" /></Form.Item>
        <Form.Item name="taskType" label="任务类型" rules={[{ required: true }]}>
          <Select options={[
            { value: 'MINUTE_BAR_BACKFILL', label: '历史分钟K补档' },
            { value: 'DAILY_BAR_BACKFILL', label: '历史日K补档' },
            { value: 'INTRADAY_MINUTE_REFRESH', label: '盘中分钟线刷新' },
          ]} />
        </Form.Item>
        <Form.Item name="provider" label="Provider" rules={[{ required: true }]}><Select options={[{ value: 'LONGPORT', label: 'LongPort（只读行情）' }]} /></Form.Item>
        <Form.Item label="从目录选择标的">
          <SecuritySelector
            onChange={(symbol) => {
              if (!symbol) return;
              const current = (form.getFieldValue('symbols') ?? '').trim();
              const existing = current.split(/[\s,，;；]+/).filter(Boolean);
              if (existing.includes(symbol)) return;
              form.setFieldValue('symbols', current ? `${current}, ${symbol}` : symbol);
            }}
          />
        </Form.Item>
        <Form.Item name="symbols" label="标的" rules={[{ required: true, message: '至少验证并加入一个标的' }]}>
          <SecurityVerificationField remoteMode={remoteMode} taskType={taskType} />
        </Form.Item>
        {taskType !== 'INTRADAY_MINUTE_REFRESH' && <Row gutter={16}>
          <Col span={12}><Form.Item name="startDate" label="开始日期" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
          <Col span={12}><Form.Item name="endDate" label="结束日期" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
        </Row>}
        {taskType !== 'DAILY_BAR_BACKFILL' && <Form.Item name="intervalType" label="K线粒度" rules={[{ required: true }]}>
          <Select allowClear options={[
            { value: '1M', label: '1分钟' }, { value: '5M', label: '5分钟' },
            { value: '15M', label: '15分钟' }, { value: '30M', label: '30分钟' }, { value: '60M', label: '60分钟' },
          ]} />
        </Form.Item>}
        <Form.Item name="adjustType" label="复权类型">
          <Select options={[{ value: 'NONE', label: '不复权' }, { value: 'QF', label: '前复权' }, { value: 'HF', label: '后复权（SDK 不支持）', disabled: true }]} />
        </Form.Item>
        <Alert type="info" title={taskType === 'INTRADAY_MINUTE_REFRESH'
          ? '触发方式固定为 INTRADAY；仅 A 股交易日和允许时段运行，同一计划不重叠。'
          : '历史补档触发方式固定为 MANUAL；点击“立即执行”才会创建任务并拉取数据。'} style={{ marginBottom: 16 }} />
        {taskType === 'INTRADAY_MINUTE_REFRESH' && <>
          <Form.Item name="collectFrequency" label="采集频率" rules={[{ required: true }]}>
            <Select options={[{ value: '30S', label: '每 30 秒' }, { value: '60S', label: '每 60 秒' }, { value: '5M', label: '每 5 分钟' }]} />
          </Form.Item>
          <Form.Item name="includeAuction" label="包含 09:15-09:25 集合竞价" valuePropName="checked"><Switch /></Form.Item>
        </>}
        <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Drawer>
  );
}
