import { Layout, Menu, Typography, Alert } from 'antd';
import {
  DashboardOutlined,
  StarOutlined,
  FileTextOutlined,
  CalculatorOutlined,
  BookOutlined,
  AccountBookOutlined,
  FormOutlined,
  SettingOutlined,
  ProjectOutlined,
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
  { key: '/review', icon: <FormOutlined />, label: '盘后复盘' },
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={toggle}>
        <div style={{ height: 32, margin: 16, textAlign: 'center' }}>
          <Typography.Text strong style={{ color: '#fff', fontSize: collapsed ? 14 : 16 }}>
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
      <Layout>
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            量化交易辅助系统
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            辅助记录 · 不自动交易
          </Typography.Text>
        </Header>
        <Content style={{ margin: 24 }}>
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
