import { Alert, Card, Col, Row, Tag, Typography } from 'antd';
import { Link } from 'react-router';
import type { BuildCurrentActionLink } from '../model/types';

interface Props {
  readyToUse: BuildCurrentActionLink[];
}

interface InProgressItem {
  name: string;
  state: string;
  stage: string;
  updatedAt: string;
  remaining: string;
}

const IN_PROGRESS_ITEMS: InProgressItem[] = [
  {
    name: 'P1.4b-D2 前端共享 SecuritySelector',
    state: '已集成四流（候选）',
    stage: '前端 + 目录 API',
    updatedAt: '2026-08-03',
    remaining: '交付收口同步（BUILD_CHECKLIST 勾选、看板节点）',
  },
  {
    name: 'P1.4b-D3 目录同步基础',
    state: '代码与自动化条件验收',
    stage: '后端同步服务',
    updatedAt: '2026-08-02',
    remaining: 'Docker/MySQL RUNTIME 验证',
  },
  {
    name: 'P1.7 板块相对强弱分析',
    state: '设计已冻结',
    stage: '分析层设计',
    updatedAt: '2026-08-09',
    remaining: '实现分析层 + 前端展示',
  },
  {
    name: 'P1.6 板块自动采集部署验收',
    state: '自动化已交付',
    stage: '部署后真实验收',
    updatedAt: '2026-07-22',
    remaining: '两个时间桶最小真实验收',
  },
];

interface NextAction {
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  action: string;
  dependsOn: string;
}

const PRIORITY_ORDER: NextAction['priority'][] = ['P0', 'P1', 'P2', 'P3'];

const NEXT_ACTIONS: NextAction[] = [
  {
    priority: 'P0',
    action: 'P1.4b-D4：将目录/SecuritySelector 推广到自选/计划/交易/风控/快照，并完成 A/H/US E2E',
    dependsOn: 'D2/D3 已收口',
  },
  {
    priority: 'P0',
    action: 'P1.6 部署后完成两时间桶最小真实验收',
    dependsOn: '服务器部署 + 行情权限',
  },
  {
    priority: 'P1',
    action: 'P1.7 按冻结设计实现板块相对强弱、轮动持续性与龙头贡献分析',
    dependsOn: '板块快照数据积累',
  },
  {
    priority: 'P1',
    action: '港美股分钟采集补齐交易日历、时区与 scheduler',
    dependsOn: 'Longbridge 鉴权恢复',
  },
  {
    priority: 'P2',
    action: '指标计算（MA/MACD/RSI/BOLL）与简化回测',
    dependsOn: '行情数据资产稳定',
  },
];

const BLOCKERS: { type: string; title: string; detail: string }[] = [
  {
    type: '外部数据源',
    title: 'Longbridge 外部鉴权故障（2026-07-19 起）',
    detail: 'SDK 凭据被服务端拒绝（401004/401102），官方签名 HTTPS 排行通道仍可用；盘中分钟采集依赖 SDK 通道，待重新部署验证。',
  },
  {
    type: '部署',
    title: 'P1.8 Agent 助手无法上线',
    detail: '服务器公网 + Nginx deny + QQ OpenID allowlist 未配置，Agent API 不能暴露；未部署前不算可用。',
  },
  {
    type: '验证缺口',
    title: 'D1/D3 Docker/MySQL RUNTIME 未验证',
    detail: 'H2 自动化结果不能冒充 MySQL/部署证据；不能宣称目录同步已部署。',
  },
];

const BLOCKER_COLOR: Record<string, string> = {
  外部数据源: 'orange',
  部署: 'red',
  验证缺口: 'gold',
};

export function CurrentActions({ readyToUse }: Props) {
  return (
    <div>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={8}>
          <Card title="现在可直接使用" size="small">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {readyToUse.map((item) => (
                <div key={item.path} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Link to={item.path}>{item.label}</Link>
                  <Typography.Text code style={{ fontSize: 12 }}>
                    {item.path}
                  </Typography.Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="正在建设" size="small">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {IN_PROGRESS_ITEMS.map((item) => (
                <div key={item.name}>
                  <Typography.Text strong>{item.name}</Typography.Text>
                  <div>
                    <Tag color="blue">{item.state}</Tag>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {item.stage} · 更新 {item.updatedAt}
                    </Typography.Text>
                  </div>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    剩余验收：{item.remaining}
                  </Typography.Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="下一步建议" size="small">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...NEXT_ACTIONS]
                .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
                .map((item) => (
                  <div key={item.action}>
                    <Tag color={item.priority === 'P0' ? 'red' : item.priority === 'P1' ? 'orange' : 'blue'}>
                      {item.priority}
                    </Tag>
                    <Typography.Text>{item.action}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginLeft: 28 }}>
                      依赖：{item.dependsOn}
                    </Typography.Text>
                  </div>
                ))}
            </div>
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 12 }}>
        <Alert
          type="warning"
          showIcon
          title="阻塞与风险事项"
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {BLOCKERS.map((b) => (
                <div key={b.title}>
                  <Tag color={BLOCKER_COLOR[b.type]}>{b.type}</Tag>
                  <Typography.Text strong>{b.title}</Typography.Text>
                  <Typography.Text type="secondary" style={{ display: 'block' }}>
                    {b.detail}
                  </Typography.Text>
                </div>
              ))}
            </div>
          }
        />
      </div>
    </div>
  );
}
