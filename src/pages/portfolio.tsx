import { useState } from 'react';
import { Typography, Tabs, Alert, Button, Spin, Empty, message } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import { usePortfolio } from '../features/portfolio/hooks/usePortfolio';
import { PortfolioSummaryCards } from '../features/portfolio/components/PortfolioSummaryCards';
import { PositionTable } from '../features/portfolio/components/PositionTable';
import { ClosedTradeTable } from '../features/portfolio/components/ClosedTradeTable';
import { PriceSnapshotForm, PriceSnapshotTable } from '../features/portfolio/components/PriceSnapshotForm';
import type { PriceFormValues } from '../features/portfolio/components/PriceSnapshotForm';
import { today } from '../shared/utils/date';

export function PortfolioPage() {
  const {
    summary,
    positions,
    closedTrades,
    prices,
    loading,
    error,
    isEmpty,
    apiMode,
    filters,
    setFilters,
    refresh,
    upsertPrice,
  } = usePortfolio();
  const [priceOpen, setPriceOpen] = useState(false);

  const handlePriceSubmit = async (values: PriceFormValues) => {
    try {
      await upsertPrice({
        symbol: values.symbol.trim().toUpperCase(),
        name: values.name,
        currentPrice: values.currentPrice,
        priceDate: values.priceDate,
        note: values.note,
      });
      message.success('当前价已保存');
      setPriceOpen(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  if (loading && !summary) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="加载失败"
        description={error}
        action={
          <Button size="small" onClick={() => void refresh()}>
            重试
          </Button>
        }
        showIcon
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          交易账本
        </Typography.Title>
        <Button icon={<DollarOutlined />} onClick={() => setPriceOpen(true)}>
          维护当前价
        </Button>
      </div>

      <Alert
        type="warning"
        message={summary?.disclaimer ?? '本页面仅用于交易记录和复盘，不构成投资建议。'}
        style={{ marginBottom: 12 }}
        showIcon
      />

      {apiMode === 'remote' ? (
        <Alert
          type="info"
          showIcon
          message="数据来源：后端 API"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>账本数据来源于后端 API，按后端交易流水实时计算（FIFO）。</li>
              <li>后端模式下，交易记录、交易账本等核心业务数据均通过 REST API 读写后端数据库；本页与「交易记录」页共用同一份后端数据。</li>
              <li>当前价为手工维护，不连接券商、不接实时行情，不构成投资建议。</li>
            </ul>
          }
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert
          type="info"
          message="数据来源：本地浏览器。交易记录页录入的流水会在此实时计算（FIFO）。"
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {isEmpty ? (
        <Empty description="暂无交易记录，请先到「交易记录」页录入买入 / 卖出流水" />
      ) : (
        <Tabs
          defaultActiveKey="summary"
          items={[
            {
              key: 'summary',
              label: '账本概览',
              children: <PortfolioSummaryCards summary={summary} />,
            },
            {
              key: 'positions',
              label: `当前持仓 (${positions.length})`,
              children: <PositionTable positions={positions} />,
            },
            {
              key: 'closed',
              label: `已结算交易 (${closedTrades.length})`,
              children: (
                <ClosedTradeTable closedTrades={closedTrades} filters={filters} setFilters={setFilters} />
              ),
            },
            {
              key: 'prices',
              label: '当前价维护',
              children: <PriceSnapshotTable prices={prices} title={`已维护当前价 (${prices.length})`} />,
            },
          ]}
        />
      )}

      <PriceSnapshotForm
        open={priceOpen}
        onClose={() => setPriceOpen(false)}
        onSubmit={handlePriceSubmit}
        defaultDate={today()}
      />
    </div>
  );
}
