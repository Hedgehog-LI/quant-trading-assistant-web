/**
 * 数据中心（V2.1 历史数据底座操作闭环，/data-foundation）。
 *
 * 三个页签：回补任务（创建/列表/详情分片/启动暂停重试）、数据集与版本（版本/发布/质量/覆盖）、
 * CSV 导入（五类 kind 上传与批次结果）。
 *
 * 状态纪律：loading(Skeleton)/empty(Empty)/error(Alert+重试，展示后端 message)/
 * partial(PARTIAL_FAILED 等明确标色)；null 计数显示 '--' 不显示 0；
 * 仅消费真实后端数据——mock 模式提示切换后端模式且不发起任何请求，remote 失败不回退假数据。
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, Empty, Tabs, Typography } from 'antd';
import { BackfillTaskDrawer } from '../features/data-foundation/components/BackfillTaskDrawer';
import { BackfillTaskForm } from '../features/data-foundation/components/BackfillTaskForm';
import { BackfillTaskTable } from '../features/data-foundation/components/BackfillTaskTable';
import { DatasetVersionPanel } from '../features/data-foundation/components/DatasetVersionPanel';
import { ImportPanel } from '../features/data-foundation/components/ImportPanel';
import { useBackfillTaskList } from '../features/data-foundation/hooks/useDataFoundation';
import { getSettings } from '../features/settings/api/settingsApi';
import './data-foundation.css';

const { Title, Text } = Typography;

const PAGE_SIZE = 10;

export function DataFoundationPage() {
  const queryClient = useQueryClient();
  const mockMode = getSettings().apiMode === 'mock';

  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(PAGE_SIZE);
  const [drawerTaskId, setDrawerTaskId] = useState<number | null>(null);

  const [datasetCode, setDatasetCode] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

  const taskList = useBackfillTaskList({ status: undefined, page: taskPage, pageSize: taskPageSize });

  if (mockMode) {
    return (
      <div className="data-foundation-page">
        <div className="df-page-header">
          <Title level={3}>数据中心</Title>
        </div>
        <Card>
          <Empty
            data-testid="data-foundation-mock-unavailable"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="数据中心需要后端数据模式，请在设置中切换为后端模式。"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="data-foundation-page">
      <div className="df-page-header">
        <Title level={3}>数据中心</Title>
        <Text type="secondary">
          历史数据底座：回补任务、数据集版本与发布门禁、CSV 导入；公共源为实验性来源，失败不伪造数据。
        </Text>
      </div>

      <Tabs
        defaultActiveKey="backfill"
        items={[
          {
            key: 'backfill',
            label: '回补任务',
            children: (
              <div className="df-tab-backfill">
                <Card size="small" title="创建回补任务" style={{ marginBottom: 12 }}>
                  <BackfillTaskForm
                    onCreated={() => {
                      setTaskPage(1);
                      void queryClient.invalidateQueries({ queryKey: ['data-foundation', 'backfill-tasks'] });
                    }}
                  />
                </Card>
                <BackfillTaskTable
                  tasks={taskList.data?.items ?? []}
                  total={taskList.data?.total ?? 0}
                  page={taskPage}
                  pageSize={taskPageSize}
                  loading={taskList.isLoading}
                  error={taskList.isError ? (taskList.error as Error) : null}
                  refreshing={taskList.isFetching}
                  onRefresh={() => void taskList.refetch()}
                  onPageChange={(page, pageSize) => {
                    setTaskPage(page);
                    setTaskPageSize(pageSize);
                  }}
                  onOpenDetail={(task) => setDrawerTaskId(task.id)}
                />
              </div>
            ),
          },
          {
            key: 'datasets',
            label: '数据集与版本',
            children: (
              <DatasetVersionPanel
                datasetCode={datasetCode}
                onSelectDataset={setDatasetCode}
                selectedVersionId={selectedVersionId}
                onSelectVersion={setSelectedVersionId}
              />
            ),
          },
          {
            key: 'imports',
            label: '导入',
            children: <ImportPanel />,
          },
        ]}
      />

      <BackfillTaskDrawer taskId={drawerTaskId} onClose={() => setDrawerTaskId(null)} />
    </div>
  );
}
