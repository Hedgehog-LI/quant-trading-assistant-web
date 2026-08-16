/**
 * 市场全景查询 hook：TanStack Query，key 含市场/窗口/数据模式；
 * 窗口变化自动重新查询，retry=false（失败立即进入 error 态，禁止静默重试或回退）。
 * 市场全景仅消费真实后端数据：apiMode=mock 时查询禁用（不自动调用 remote），
 * 由页面渲染"切换后端模式"提示，不渲染任何模拟行情。
 */
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '../../settings/api/settingsApi';
import { getMarketOverview, type OverviewMarket } from '../api/marketOverviewApi';

export function useMarketOverview(market: OverviewMarket, start: string, end: string) {
  const mode = getSettings().apiMode;
  return useQuery({
    queryKey: ['market-overview', market, start, end, mode],
    queryFn: () => getMarketOverview(market, start, end),
    enabled: mode === 'remote' && Boolean(start) && Boolean(end),
    retry: false,
  });
}
