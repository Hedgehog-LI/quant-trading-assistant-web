import { Alert, Col, Row, Typography } from 'antd';
import { BuildStatusCapabilityBars } from '../features/build-status/components/BuildStatusCapabilityBars';
import { BuildStatusDetailDrawer } from '../features/build-status/components/BuildStatusDetailDrawer';
import { BuildStatusLegend } from '../features/build-status/components/BuildStatusLegend';
import { BuildStatusSummary } from '../features/build-status/components/BuildStatusSummary';
import { BuildStatusTree } from '../features/build-status/components/BuildStatusTree';
import { useBuildStatus } from '../features/build-status/hooks/useBuildStatus';

export function BuildStatusPage() {
  const {
    summaryCards,
    capabilities,
    tree,
    selectedNode,
    filter,
    setPriority,
    setStatus,
    setMaturity,
    selectNode,
    clearSelection,
  } = useBuildStatus();

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 8 }}>
        建设看板
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        从产品经理和理财经理视角查看系统建设路线、当前成熟度、数据可信度和下一步优先事项。
      </Typography.Paragraph>

      <Alert
        type="info"
        title="本页面展示系统建设状态，不展示投资收益排名，不构成任何投资建议。"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <BuildStatusSummary cards={summaryCards} />

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <BuildStatusCapabilityBars capabilities={capabilities} />
        </Col>
        <Col xs={24} lg={8}>
          <BuildStatusLegend />
        </Col>
      </Row>

      <div style={{ marginTop: 16 }}>
        <BuildStatusTree
          tree={tree}
          selectedId={selectedNode?.id}
          filter={filter}
          onPriorityChange={setPriority}
          onStatusChange={setStatus}
          onMaturityChange={setMaturity}
          onSelect={selectNode}
        />
      </div>

      <BuildStatusDetailDrawer node={selectedNode} onClose={clearSelection} />
    </div>
  );
}
