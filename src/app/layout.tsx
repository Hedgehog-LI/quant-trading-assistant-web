import { Layout, Menu, Typography, Alert, Grid } from 'antd';
import {
  DashboardOutlined,
  StarOutlined,
  FileTextOutlined,
  CalculatorOutlined,
  BookOutlined,
  AccountBookOutlined,
  PieChartOutlined,
  FormOutlined,
  SettingOutlined,
  ProjectOutlined,
  LineChartOutlined,
  FundProjectionScreenOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { useAppStore } from '../shared/stores/app-store';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
  { key: '/watchlist', icon: <StarOutlined />, label: '自选股' },
  { key: '/trade-plan', icon: <FileTextOutlined />, label: '交易计划' },
  { key: '/risk', icon: <CalculatorOutlined />, label: '风控计算' },
  { key: '/journal', icon: <BookOutlined />, label: '交易记录' },
  { key: '/portfolio', icon: <AccountBookOutlined />, label: '交易账本' },
  { key: '/position-snapshots', icon: <PieChartOutlined />, label: '持仓快照' },
  { key: '/review', icon: <FormOutlined />, label: '盘后复盘' },
  { key: '/market-data', icon: <LineChartOutlined />, label: '行情数据' },
  { key: '/market-workspace', icon: <FundProjectionScreenOutlined />, label: '行情工作台' },
  { key: '/market-segments', icon: <FundProjectionScreenOutlined />, label: '板块管理' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  { key: '/build-status', icon: <ProjectOutlined />, label: '建设看板' },
];

/**
 * 应用主布局。Ant Design Sider + Header + Content。
 */
export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggle = useAppStore((s) => s.toggleSidebar);
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const effectiveCollapsed = isMobile || collapsed;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible={!isMobile}
        collapsed={effectiveCollapsed}
        collapsedWidth={isMobile ? 64 : 80}
        trigger={isMobile ? null : undefined}
        onCollapse={() => { if (!isMobile) toggle(); }}
      >
        <div style={{ height: 32, margin: 16, textAlign: 'center' }}>
          <Typography.Text strong style={{ color: '#fff', fontSize: effectiveCollapsed ? 14 : 16 }}>
            QTA
          </Typography.Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout style={{ minWidth: 0 }}>
        <Header style={{ padding: isMobile ? '0 12px' : '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography.Title level={4} style={{ margin: 0, fontSize: isMobile ? 16 : undefined }}>
            量化交易辅助系统
          </Typography.Title>
          {!isMobile && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              辅助记录 · 不自动交易
            </Typography.Text>
          )}
        </Header>
        <Content style={{ margin: isMobile ? 12 : 24, minWidth: 0, overflow: 'hidden' }}>
          <Alert
            type="info"
            title="本系统只做交易辅助记录、风控计算和复盘，不自动交易，不连接券商，不保存真实密钥。"
            style={{ marginBottom: 16 }}
            showIcon
            closable
          />
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
