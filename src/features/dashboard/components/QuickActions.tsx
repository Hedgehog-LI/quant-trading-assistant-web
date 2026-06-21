import { Card, Button, Space } from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  CalculatorOutlined,
  BookOutlined,
  WalletOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router';

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card title="快捷操作" size="small">
      <Space wrap>
        <Button icon={<PlusOutlined />} onClick={() => navigate('/watchlist')}>
          新增自选股
        </Button>
        <Button icon={<FileTextOutlined />} onClick={() => navigate('/trade-plan')}>
          写计划
        </Button>
        <Button icon={<CalculatorOutlined />} onClick={() => navigate('/risk')}>
          风控计算
        </Button>
        <Button icon={<BookOutlined />} onClick={() => navigate('/journal')}>
          记录交易
        </Button>
        <Button icon={<WalletOutlined />} onClick={() => navigate('/portfolio')}>
          查看交易账本
        </Button>
        <Button icon={<FormOutlined />} onClick={() => navigate('/review')}>
          写复盘
        </Button>
      </Space>
    </Card>
  );
}
