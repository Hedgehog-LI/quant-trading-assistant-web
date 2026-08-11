/**
 * P1.9-A 行情资产查看器跳转入口：统一封装 navigate('/market-assets?<query>')，
 * 避免旧页面（market-workspace / market-data）散落 navigate 拼接字符串。
 */
import type { NavigateFunction } from 'react-router';
import { buildAssetViewerQuery } from './assetViewerLink';
import type { AssetViewerParams } from './assetViewerLink';

/** 打开行情资产查看器（携带已解析的参数，非法参数由查看器回退默认）。 */
export function openAssetViewer(navigate: NavigateFunction, params: AssetViewerParams): void {
  navigate(`/market-assets?${buildAssetViewerQuery(params)}`);
}
