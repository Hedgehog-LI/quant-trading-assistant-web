import { Alert, Card, Typography } from 'antd';
import { BuildStatusHeader } from '../features/build-status/components/BuildStatusHeader';
import { BuildStatusOverview } from '../features/build-status/components/BuildStatusOverview';
import { RecentDeliveries } from '../features/build-status/components/RecentDeliveries';
import { CurrentActions } from '../features/build-status/components/CurrentActions';
import { BuildStatusTree } from '../features/build-status/components/BuildStatusTree';
import { BuildStatusDetailDrawer } from '../features/build-status/components/BuildStatusDetailDrawer';
import { useBuildStatus } from '../features/build-status/hooks/useBuildStatus';

export function BuildStatusPage() {
  const {
    snapshot,
    overview,
    recentDeliveries,
    tree,
    selectedNode,
    filter,
    showAllDeliveries,
    setPriority,
    setDeliveryStatus,
    setValidationStage,
    setModule,
    resetFilter,
    selectNode,
    clearSelection,
    toggleShowAllDeliveries,
  } = useBuildStatus();

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 8 }}>
        建设看板
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        30 秒内回答：系统建设了多少、最近交付了什么、哪些已经能在线使用、下一步做什么。
      </Typography.Paragraph>

      <Alert
        type="info"
        title="本页面展示系统建设状态，不展示投资收益排名，不构成任何投资建议。"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <BuildStatusHeader snapshot={snapshot} />
      </Card>

      <Card size="small" style={{ marginBottom: 16 }}>
        <BuildStatusOverview stats={overview} />
      </Card>

      <Card title="最近交付时间线" size="small" style={{ marginBottom: 16 }}>
        <RecentDeliveries
          deliveries={recentDeliveries}
          showAll={showAllDeliveries}
          onToggle={toggleShowAllDeliveries}
        />
      </Card>

      <Card size="small" style={{ marginBottom: 16 }}>
        <CurrentActions readyToUse={snapshot.readyToUse} />
      </Card>

      <BuildStatusTree
        tree={tree}
        selectedId={selectedNode?.id}
        filter={filter}
        onPriorityChange={setPriority}
        onDeliveryStatusChange={setDeliveryStatus}
        onValidationStageChange={setValidationStage}
        onModuleChange={setModule}
        onReset={resetFilter}
        onSelect={selectNode}
      />

      <BuildStatusDetailDrawer node={selectedNode} onClose={clearSelection} />
    </div>
  );
}
