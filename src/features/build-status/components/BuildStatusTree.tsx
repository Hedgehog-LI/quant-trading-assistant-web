import { Card, Progress, Select, Space, Tag, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { BuildMaturity, BuildPriority, BuildStatus, BuildStatusFilter, BuildStatusNode } from '../model/types';
import { MATURITY_COLOR, MATURITY_LABEL, PRIORITY_COLOR, STATUS_COLOR, STATUS_LABEL } from '../model/meta';

interface Props {
  tree: BuildStatusNode[];
  selectedId?: string;
  filter: BuildStatusFilter;
  onPriorityChange: (priority: BuildPriority | 'ALL') => void;
  onStatusChange: (status: BuildStatus | 'ALL') => void;
  onMaturityChange: (maturity: BuildMaturity | 'ALL') => void;
  onSelect: (id: string) => void;
}

function renderNodeTitle(node: BuildStatusNode) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '2px 0' }}>
      <Typography.Text strong>{node.title}</Typography.Text>
      <Tag color={PRIORITY_COLOR[node.priority]}>{node.priority}</Tag>
      <Tag color={STATUS_COLOR[node.status]}>{STATUS_LABEL[node.status]}</Tag>
      <Tag color={MATURITY_COLOR[node.maturity]}>
        {node.maturity} {MATURITY_LABEL[node.maturity]}
      </Tag>
      <Progress percent={node.progress} size="small" showInfo={false} style={{ width: 96 }} />
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
  onStatusChange,
  onMaturityChange,
  onSelect,
}: Props) {
  return (
    <Card title="建设树" size="small">
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          value={filter.priority ?? 'ALL'}
          onChange={(value) => onPriorityChange(value as BuildPriority | 'ALL')}
          style={{ width: 120 }}
          options={[
            { value: 'ALL', label: '全部优先级' },
            { value: 'P0', label: 'P0' },
            { value: 'P1', label: 'P1' },
            { value: 'P2', label: 'P2' },
            { value: 'P3', label: 'P3' },
          ]}
        />
        <Select
          value={filter.status ?? 'ALL'}
          onChange={(value) => onStatusChange(value as BuildStatus | 'ALL')}
          style={{ width: 140 }}
          options={[
            { value: 'ALL', label: '全部状态' },
            { value: 'DONE', label: '已完成' },
            { value: 'IN_PROGRESS', label: '进行中' },
            { value: 'TODO', label: '待开始' },
            { value: 'RISK', label: '有风险' },
            { value: 'BLOCKED', label: '阻塞' },
          ]}
        />
        <Select
          value={filter.maturity ?? 'ALL'}
          onChange={(value) => onMaturityChange(value as BuildMaturity | 'ALL')}
          style={{ width: 140 }}
          options={[
            { value: 'ALL', label: '全部成熟度' },
            { value: 'M0', label: 'M0 未开始' },
            { value: 'M1', label: 'M1 已设计' },
            { value: 'M2', label: 'M2 后端完成' },
            { value: 'M3', label: 'M3 前端完成' },
            { value: 'M4', label: 'M4 已验收' },
            { value: 'M5', label: 'M5 持续优化' },
          ]}
        />
      </Space>
      <Tree
        defaultExpandAll
        selectedKeys={selectedId ? [selectedId] : []}
        treeData={toTreeData(tree)}
        onSelect={(keys) => {
          const key = keys[0];
          if (typeof key === 'string') {
            onSelect(key);
          }
        }}
      />
    </Card>
  );
}
