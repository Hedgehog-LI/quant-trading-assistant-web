import { Button, Card, Select, Space, Tag, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type {
  BuildPriority,
  BuildStatusFilter,
  BuildStatusNode,
  DeliveryStatus,
  ValidationStage,
} from '../model/types';
import {
  DELIVERY_STATUS_COLOR,
  DELIVERY_STATUS_LABEL,
  MODULE_OPTIONS,
  PRIORITY_COLOR,
  VALIDATION_STAGE_COLOR,
  VALIDATION_STAGE_LABEL,
} from '../model/meta';

interface Props {
  tree: BuildStatusNode[];
  selectedId?: string;
  filter: BuildStatusFilter;
  onPriorityChange: (priority: BuildPriority | 'ALL') => void;
  onDeliveryStatusChange: (status: DeliveryStatus | 'ALL') => void;
  onValidationStageChange: (stage: ValidationStage | 'ALL') => void;
  onModuleChange: (module: string | 'ALL') => void;
  onReset: () => void;
  onSelect: (id: string) => void;
}

function renderNodeTitle(node: BuildStatusNode) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '2px 0' }}>
      <Typography.Text strong>{node.title}</Typography.Text>
      <Tag color={PRIORITY_COLOR[node.priority]}>{node.priority}</Tag>
      <Tag color={DELIVERY_STATUS_COLOR[node.deliveryStatus]}>
        {DELIVERY_STATUS_LABEL[node.deliveryStatus]}
      </Tag>
      <Tag color={VALIDATION_STAGE_COLOR[node.validationStage]}>
        {VALIDATION_STAGE_LABEL[node.validationStage]}
      </Tag>
    </div>
  );
}

function toTreeData(nodes: BuildStatusNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: renderNodeTitle(node),
    children: node.children ? toTreeData(node.children) : undefined,
  }));
}

export function BuildStatusTree({
  tree,
  selectedId,
  filter,
  onPriorityChange,
  onDeliveryStatusChange,
  onValidationStageChange,
  onModuleChange,
  onReset,
  onSelect,
}: Props) {
  return (
    <Card title="能力目录（第二屏 · 默认折叠）" size="small">
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          value={filter.priority ?? 'ALL'}
          onChange={(value) => onPriorityChange(value as BuildPriority | 'ALL')}
          style={{ width: 110 }}
          options={[
            { value: 'ALL', label: '全部优先级' },
            { value: 'P0', label: 'P0' },
            { value: 'P1', label: 'P1' },
            { value: 'P2', label: 'P2' },
            { value: 'P3', label: 'P3' },
          ]}
        />
        <Select
          value={filter.deliveryStatus ?? 'ALL'}
          onChange={(value) => onDeliveryStatusChange(value as DeliveryStatus | 'ALL')}
          style={{ width: 120 }}
          options={[
            { value: 'ALL', label: '全部状态' },
            { value: 'DELIVERED', label: '已交付' },
            { value: 'IN_PROGRESS', label: '建设中' },
            { value: 'PLANNED', label: '待开始' },
            { value: 'DESIGNED', label: '已设计' },
            { value: 'BLOCKED', label: '阻塞' },
            { value: 'DEFERRED', label: '暂缓' },
          ]}
        />
        <Select
          value={filter.validationStage ?? 'ALL'}
          onChange={(value) => onValidationStageChange(value as ValidationStage | 'ALL')}
          style={{ width: 130 }}
          options={[
            { value: 'ALL', label: '全部验证层级' },
            { value: 'NOT_VERIFIED', label: '未验证' },
            { value: 'STATIC_VERIFIED', label: '静态验证' },
            { value: 'AUTOMATION_VERIFIED', label: '自动化验证' },
            { value: 'RUNTIME_VERIFIED', label: '运行验证' },
            { value: 'DEPLOYED', label: '已部署' },
          ]}
        />
        <Select
          value={filter.module ?? 'ALL'}
          onChange={(value) => onModuleChange(value as string | 'ALL')}
          style={{ width: 120 }}
          options={[
            { value: 'ALL', label: '全部模块' },
            ...MODULE_OPTIONS.map((m) => ({ value: m, label: m })),
          ]}
        />
        <Button size="small" onClick={onReset}>
          重置筛选
        </Button>
      </Space>
      <Tree
        defaultExpandedKeys={['foundation', 'trade-loop', 'portfolio-pnl', 'market-data-foundation']}
        selectedKeys={selectedId ? [selectedId] : []}
        treeData={toTreeData(tree)}
        onSelect={(keys) => {
          const key = keys[0];
          if (typeof key === 'string') {
            onSelect(key);
          }
        }}
      />
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        点击节点查看用户价值、已交付内容、完成标准、剩余工作、提交与验收证据。父节点仅作为目录，统计一律按叶子计算。
      </Typography.Text>
    </Card>
  );
}
