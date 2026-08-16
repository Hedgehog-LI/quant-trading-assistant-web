/**
 * 市场全景查询 hook：TanStack Query，key 含市场/窗口/数据模式；
 * 窗口变化自动重新查询，retry=false（失败立即进入 error 态，禁止静默重试或回退）。
 */
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '../../settings/api/settingsApi';
import { getMarketOverview, type OverviewMarket } from '../api/marketOverviewApi';

export function useMarketOverview(market: OverviewMarket, start: string, end: string) {
  const mode = getSettings().apiMode;
  return useQuery({
    queryKey: ['market-overview', market, start, end, mode],
    queryFn: () => getMarketOverview(market, start, end),
    enabled: Boolean(start) && Boolean(end),
    retry: false,
  });
}
