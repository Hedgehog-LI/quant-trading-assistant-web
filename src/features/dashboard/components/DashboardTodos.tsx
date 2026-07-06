/**
 * 工作台待办中心。
 * 只展示记录、数据质量和纪律待办，不包含任何买卖建议。点击「去处理」跳转 targetPath。
 * 使用语义化 ul/li + Flex 布局，避免 Antd List 的 deprecated 警告。
 */
import type { ReactNode } from 'react';
import { Card, Empty, Tag, Typography } from 'antd';
import {
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router';
import type { DashboardTodo, DashboardTodoLevel } from '../../../shared/types/domain';

const LEVEL_TAG_META: Record<
  DashboardTodoLevel,
  { color: string; icon: ReactNode; label: string }
> = {
  RISK: { color: 'red', icon: <ExclamationCircleOutlined />, label: '风险' },
  WARNING: { color: 'orange', icon: <WarningOutlined />, label: '关注' },
  INFO: { color: 'blue', icon: <InfoCircleOutlined />, label: '提示' },
};

function getLevelTagMeta(level: DashboardTodoLevel) {
  return LEVEL_TAG_META[level] ?? LEVEL_TAG_META.INFO;
}

interface Props {
  todos: DashboardTodo[] | undefined;
  loading: boolean;
}

export function DashboardTodos({ todos, loading }: Props) {
  const navigate = useNavigate();

  return (
    <Card
      title="今日待办"
      extra={<Typography.Text type="secondary">仅记录与数据质量提醒，不含买卖建议</Typography.Text>}
      loading={loading && !todos}
    >
      {!todos || todos.length === 0 ? (
        <Empty description="暂无待办，保持纪律" />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {todos.map((todo) => {
            const meta = getLevelTagMeta(todo.level);
            return (
              <li
                key={todo.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <Tag color={meta.color} icon={meta.icon}>
                    {meta.label}
                  </Tag>
                  <div style={{ minWidth: 0 }}>
                    <div>
                      {todo.title} <Typography.Text type="secondary">（{todo.count}）</Typography.Text>
                    </div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {todo.description}
                    </Typography.Text>
                  </div>
                </div>
                <a onClick={() => navigate(todo.targetPath)}>去处理</a>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
