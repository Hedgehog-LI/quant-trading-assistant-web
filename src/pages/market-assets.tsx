/**
 * P1.9-A 行情资产主页面：仅做编排，业务状态集中在 useMarketAssetView。
 *
 * - 未选证券：展示已真实入库的资产目录，不请求 series；
 * - 已选证券：工具栏 →（availability 空：尚未采集；否则 摘要/图表/健康/原始数据）→ 相关采集记录；
 * - remote 空数据不回退 mock，未登记/未采集/系统错误分开表达。
 */
import { useState } from 'react';
import { Alert, Button, Card, Skeleton, Space, Typography } from 'antd';
import { useNavigate } from 'react-router';
import { MarketAssetHealth } from '../features/market-assets/components/MarketAssetHealth';
import { MarketAssetSummary } from '../features/market-assets/components/MarketAssetSummary';
import { MarketAssetTable } from '../features/market-assets/components/MarketAssetTable';
import { MarketAssetToolbar } from '../features/market-assets/components/MarketAssetToolbar';
import { MarketCandlestickChart } from '../features/market-assets/components/MarketCandlestickChart';
import { MarketAssetCatalog } from '../features/market-assets/components/MarketAssetCatalog';
import { RelatedCollectionRuns } from '../features/market-assets/components/RelatedCollectionRuns';
import { useMarketAssetView, type UseMarketAssetViewResult } from '../features/market-assets/hooks/useMarketAssetView';
import { useMarketAssetCatalog } from '../features/market-assets/hooks/useMarketAssetQuery';
import { hasApiErrorCode } from '../shared/api/errors';

const { Title, Text } = Typography;

function NoSymbolView({ onSelect, onCollect }: { onSelect: (symbol: string) => void; onCollect: () => void }) {
  const [market, setMarket] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const catalog = useMarketAssetCatalog({ market: market || undefined, keyword: keyword || undefined, page, size });

  return (
    <div>
      <Title level={4}>行情数据资产</Title>
      <Text type="secondary">查看已经落库的日 K、分钟 K、覆盖范围、质量和采集记录。</Text>
      {catalog.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 16 }}
          title="资产目录加载失败"
          description={catalog.error instanceof Error ? catalog.error.message : '请稍后重试'}
          action={<Button onClick={() => void catalog.refetch()}>重试</Button>}
        />
      )}
      <div style={{ marginTop: 16 }}>
        <MarketAssetCatalog
          items={catalog.data?.items ?? []}
          total={catalog.data?.total ?? 0}
          page={page}
          size={size}
          loading={catalog.isLoading}
          market={market}
          keyword={keyword}
          onMarketChange={(next) => { setMarket(next ?? ''); setPage(1); }}
          onKeywordChange={(next) => { setKeyword(next.trim()); setPage(1); }}
          onPageChange={(nextPage, nextSize) => { setPage(nextPage); setSize(nextSize); }}
          onOpen={onSelect}
          onRefresh={() => void catalog.refetch()}
          onCollect={onCollect}
        />
      </div>
    </div>
  );
}

/** 已选证券的内容编排：工具栏 + availability/系列/健康/原始数据 + 相关采集记录。 */
function AssetViewerContent({ view, onCollect }: { view: UseMarketAssetViewResult; onCollect: () => void }) {
  const {
    symbol,
    interval,
    rangeError,
    hasCombinations,
    availabilityLoading,
    availabilityQuery,
    seriesQuery,
    relatedQuery,
  } = view;
  const series = seriesQuery.data;

  return (
    <div>
      <Title level={4}>行情数据资产</Title>
      <Space style={{ marginBottom: 12 }} wrap>
        <Text type="secondary">已选证券：{symbol}</Text>
        <Button size="small" type="link" onClick={() => view.setSymbol('')}>返回资产列表</Button>
      </Space>

      <MarketAssetToolbar
        symbol={symbol}
        onSymbolChange={view.setSymbol}
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

      {availabilityQuery.isError && hasApiErrorCode(availabilityQuery.error, 'STOCK_NOT_FOUND') && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          title="尚未建立该证券的行情资产"
          description={`${symbol} 还没有登记到证券主数据。请先在行情工作台创建采集计划。`}
          action={<Button type="primary" onClick={onCollect}>去行情工作台</Button>}
        />
      )}

      {availabilityQuery.isError && !hasApiErrorCode(availabilityQuery.error, 'STOCK_NOT_FOUND') && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 16 }}
          title="证券信息查询失败"
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
          title="尚未采集该证券数据"
          description="该证券当前没有已采集的行情组合，可先创建采集计划后再回到此处查看。"
          action={<Button type="primary" onClick={onCollect}>去行情工作台</Button>}
        />
      )}

      {hasCombinations && (
        <>
          {rangeError != null && (
            <Alert type="warning" showIcon style={{ marginTop: 16 }} title={rangeError} data-testid="page-range-error" />
          )}

          {rangeError == null && seriesQuery.isError && (
            <Alert
              type="error"
              showIcon
              style={{ marginTop: 16 }}
              title="行情数据查询失败"
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
                <MarketAssetSummary summary={series?.summary ?? null} loading={seriesQuery.isLoading} />
              </div>
              <Card title="K 线与成交量" size="small" style={{ marginTop: 16 }}>
                <MarketCandlestickChart
                  bars={series?.bars ?? []}
                  interval={interval}
                  loading={seriesQuery.isLoading}
                />
              </Card>
              <Card title="数据健康" size="small" style={{ marginTop: 16 }}>
                <MarketAssetHealth
                  availability={series?.availability ?? null}
                  quality={series?.quality ?? null}
                  loading={seriesQuery.isLoading}
                />
              </Card>
              <Card title="原始数据" size="small" style={{ marginTop: 16 }}>
                <MarketAssetTable bars={series?.bars ?? null} loading={seriesQuery.isLoading} />
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

export function MarketAssetsPage() {
  const view = useMarketAssetView();
  const navigate = useNavigate();
  const goCollect = () => navigate('/market-workspace');

  if (!view.symbol) {
    return <NoSymbolView onSelect={view.setSymbol} onCollect={goCollect} />;
  }

  return <AssetViewerContent view={view} onCollect={goCollect} />;
}
