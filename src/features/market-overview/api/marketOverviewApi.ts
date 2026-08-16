/**
 * MR-1A 市场全景 API adapter（仅 remote）。
 *
 * - GET /market-research/overview?market=&start=&end=（同源 /api/v1，由 shared client 提供）；
 *   失败直接抛错，禁止回退 mock。
 * - 市场全景仅消费真实后端数据：apiMode=mock 时由 useMarketOverview 禁用查询、
 *   页面提示切换后端模式，本层不提供任何模拟行情。
 */
import { client } from '../../../shared/api/client';
import { unwrap } from '../../../shared/api/unwrappers';
import type { MarketOverview } from '../model/types';

export type OverviewMarket = 'CN';

export function getMarketOverview(
  market: OverviewMarket, start: string, end: string,
): Promise<MarketOverview> {
  return unwrap<MarketOverview>(client.get('/market-research/overview', {
    params: { market, start, end },
  }));
}
