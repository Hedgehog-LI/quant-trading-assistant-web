/**
 * P1.9-A 行情资产主页面：仅做编排，业务状态集中在 useMarketAssetView。
 *
 * - 未选证券：证券选择器 + 常用证券入口，不请求 series；
 * - 已选证券：工具栏 →（availability 空：尚未采集；否则 摘要/图表/健康/原始数据）→ 相关采集记录；
 * - 数据源标识：mock 数据显著标 LOCAL_DEMO，remote 空数据不回退 mock。
 */
import { Alert, Button, Card, Skeleton, Space, Tag, Typography } from 'antd';
import { SecuritySelector } from '../shared/components/SecuritySelector';
import { MarketAssetHealth } from '../features/market-assets/components/MarketAssetHealth';
import { MarketAssetSummary } from '../features/market-assets/components/MarketAssetSummary';
import { MarketAssetTable } from '../features/market-assets/components/MarketAssetTable';
import { MarketAssetToolbar } from '../features/market-assets/components/MarketAssetToolbar';
import { MarketCandlestickChart } from '../features/market-assets/components/MarketCandlestickChart';
import { RelatedCollectionRuns } from '../features/market-assets/components/RelatedCollectionRuns';
import { useMarketAssetView } from '../features/market-assets/hooks/useMarketAssetView';

const { Title, Text } = Typography;

const QUICK_ACCESS = [
  { symbol: 'SH.600519', label: '贵州茅台' },
  { symbol: 'SZ.000001', label: '平安银行' },
  { symbol: 'HK.00700', label: '腾讯控股' },
  { symbol: 'US.AAPL', label: 'Apple' },
];

function NoSymbolView({ onSelect }: { onSelect: (symbol: string) => void }) {
  return (
    <div>
      <Title level={4}>行情资产</Title>
      <Text type="secondary">查询已采集的历史行情 K 线、区间摘要与数据健康。历史行情是事实，不构成投资建议。</Text>
      <Card title="选择证券" style={{ marginTop: 16, maxWidth: 520 }}>
        <SecuritySelector onChange={onSelect} />
      </Card>
      <Card title="常用证券（演示入口）" style={{ marginTop: 16, maxWidth: 520 }}>
        <Space wrap>
          {QUICK_ACCESS.map((q) => (
            <Button key={q.symbol} onClick={() => onSelect(q.symbol)} data-testid={`quick-access-${q.symbol}`}>
              {q.label} · {q.symbol}
            </Button>
          ))}
        </Space>
      </Card>
    </div>
  );
}

export function MarketAssetsPage() {
  const view = useMarketAssetView();
  const {
    symbol,
    setSymbol,
    interval,
    availabilityQuery,
    seriesQuery,
    relatedQuery,
    apiMode,
    rangeError,
    hasCombinations,
    availabilityLoading,
  } = view;

  if (!symbol) {
    return <NoSymbolView onSelect={setSymbol} />;
  }

  return (
    <div>
      <Title level={4}>行情资产</Title>
      <Space style={{ marginBottom: 12 }} wrap>
        <Text type="secondary">已选证券：{symbol}</Text>
        {apiMode === 'mock' && (
          <Tag color="gold" data-testid="local-demo-tag">
            LOCAL_DEMO 演示数据
          </Tag>
        )}
      </Space>

      <MarketAssetToolbar
        symbol={symbol}
        onSymbolChange={setSymbol}
        availabilityLoading={availabilityLoading}
        intervalOptions={view.intervalOptions}
        interval={view.interval}
        onIntervalChange={view.setInterval}
        dataSourceOptions={view.dataSourceOptions}
        dataSource={view.dataSource}
        onDataSourceChange={view.setDataSource}
        adjustTypeOptions={view.adjustTypeOptions}
        adjustType={view.adjustType}
        onAdjustTypeChange={view.setAdjustType}
        rangePresets={view.rangePresets}
        activePreset={view.activePreset}
        onApplyPreset={view.applyPreset}
        from={view.from}
        to={view.to}
        onCustomRange={view.setCustomRange}
        rangeError={rangeError}
      />

      {availabilityQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 16 }}
          message="证券信息查询失败"
          description={availabilityQuery.error instanceof Error ? availabilityQuery.error.message : '请稍后重试'}
          action={
            <Button data-testid="availability-retry" onClick={() => void availabilityQuery.refetch()}>
              重试
            </Button>
          }
        />
      )}

      {availabilityLoading && !hasCombinations && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
      )}

      {!availabilityLoading && !hasCombinations && availabilityQuery.isSuccess && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="尚未采集该证券数据"
          description="该证券当前没有已采集的行情组合，可先创建采集计划后再回到此处查看。"
        />
      )}

      {hasCombinations && (
        <>
          {rangeError != null && (
            <Alert type="warning" showIcon style={{ marginTop: 16 }} message={rangeError} data-testid="page-range-error" />
          )}

          {rangeError == null && seriesQuery.isError && (
            <Alert
              type="error"
              showIcon
              style={{ marginTop: 16 }}
              message="行情数据查询失败"
              description={seriesQuery.error instanceof Error ? seriesQuery.error.message : '请稍后重试'}
              action={
                <Button data-testid="series-retry" onClick={() => void seriesQuery.refetch()}>
                  重试
                </Button>
              }
            />
          )}

          {rangeError == null && !seriesQuery.isError && (
            <>
              <div style={{ marginTop: 16 }}>
                <MarketAssetSummary summary={seriesQuery.data?.summary ?? null} loading={seriesQuery.isLoading} />
              </div>
              <Card title="K 线与成交量" size="small" style={{ marginTop: 16 }}>
                <MarketCandlestickChart
                  bars={seriesQuery.data?.bars ?? []}
                  interval={interval}
                  loading={seriesQuery.isLoading}
                />
              </Card>
              <Card title="数据健康" size="small" style={{ marginTop: 16 }}>
                <MarketAssetHealth
                  availability={seriesQuery.data?.availability ?? null}
                  quality={seriesQuery.data?.quality ?? null}
                  loading={seriesQuery.isLoading}
                />
              </Card>
              <Card title="原始数据" size="small" style={{ marginTop: 16 }}>
                <MarketAssetTable bars={seriesQuery.data?.bars ?? null} loading={seriesQuery.isLoading} />
              </Card>
            </>
          )}

          <Card title="相关采集计划与记录" size="small" style={{ marginTop: 16 }}>
            <RelatedCollectionRuns data={relatedQuery.data ?? null} loading={relatedQuery.isLoading} />
          </Card>
        </>
      )}
    </div>
  );
}
