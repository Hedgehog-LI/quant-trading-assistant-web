# MR-1B 市场全景前端实现与验收记录（2026-08-16）

> 任务：将 `/market-research` 重写为 V2 市场全景研究终端，消费 MR-1A `GET /api/v1/market-research/overview?market=CN&start=&end=`。分支 `codex/qta-v2-market-overview-complete`（前端候选 commit，未 push，等待 Codex 独立验收）。后端本任务只读核对，未改代码。
>
> **定点修复（2026-08-16 第二轮，验收发现）**：删除 mock 模式下的正弦/余弦合成市场全景数据（demoOverview/DEMO_INDUSTRIES/demoTradingDates 及 mock 分支全部移除）。市场全景仅消费真实后端数据：apiMode=mock 时查询禁用（不自动调用 remote），页面仅提示"市场全景需要后端数据模式，请在设置中切换为后端模式。"，不渲染任何模拟行情图，无演示水印。remote 行为不变（失败直接报错，绝不回退假数据）。

## 1. 目标与范围

- 五个证据区块：研究上下文栏、基准趋势与回撤、流动性与交易活跃度、市场广度、行业成交占比迁移、数据质量面板。
- 全状态处理：loading / error / NO_DATA / DEGRADED / INSUFFICIENT_WARMUP / LOW_*_COVERAGE / INDUSTRY_MIGRATION_BLOCKED / OFFICIAL_MONEY_FLOW=UNAVAILABLE / 指标 null 断点。
- 口径规则：null 一律显示 `--` 或图表断点，禁止当 0；金额 万/亿 两档；比值 ×100 百分比；illiquidity 科学计数法；remote 失败只报错重试，禁止回退假数据；市场全景仅消费真实后端数据，mock 模式提示切换后端模式且不渲染任何模拟行情。
- 视口：1440×900、1280×800、≤768px 移动。
- 不做：MR-2 官方资金流、策略、候选、盘中功能。

## 2. 工程结构（feature-based）

```text
src/features/market-overview/
├── model/types.ts                # MarketOverview 类型树（对齐后端 MarketOverviewVO 字段逐一对齐）
├── model/formatters.ts           # formatMoney(万/亿/元)/formatPercent/formatSignedPercent/formatIlliquidity/dash
├── model/overviewTransform.ts    # LWC LinePoint/HistogramPoint 转换(null→whitespace 断点)、迁移图层排序(Top-8+OTHER)与 tooltip 行
├── api/marketOverviewApi.ts      # 仅 remote：client.get('/market-research/overview') + unwrap，无任何本地合成数据
├── hooks/useMarketOverview.ts    # TanStack Query ['market-overview', market, start, end, mode] retry:false
└── components/
    ├── chartKit.ts               # chart 创建/透明背景/十字光标 tooltip/ResizeObserver/生命周期
    ├── BenchmarkTrendChart.tsx   # 3 pane：收盘+MA20/MA60 / 成交额柱 / 回撤%
    ├── ActivityLiquidityChart.tsx# 3 pane：成交额柱+中位数20/60 / 活跃度比值+活跃股占比% / illiquidity 中位+P90(科学计数)
    ├── BreadthChart.tsx          # 3 pane：上涨占比+高于MA20占比% / 涨跌家数红绿柱 / A/D 线
    ├── IndustryMigrationChart.tsx# 自研 SVG 堆叠面积(Top-8+OTHER, 0-100% 网格, 悬停逐日明细, 窄屏横滚)
    ├── OverviewContextBar.tsx    # CN/日期区间/查询/刷新/覆盖与预热统计/Provider/SAMPLE 边界 Popover
    └── QualityPanel.tsx          # DEGRADED 告警列表(code+affectedCount+中文说明)/资金流不可用/映射缺口/口径折叠
```

页面：`src/pages/market-research.tsx`（终端页重写）、`src/pages/market-research-sector.tsx`（P1.10-A 板块详情保留迁移）、`src/pages/market-overview.css`（含 ≤768px 响应式）。路由/菜单：`router.tsx`、`layout.tsx`（市场雷达→市场全景）。

## 3. API 集成说明

- remote：共享 axios client（settings.apiBaseUrl 为空 → 同源 `/api/v1`，开发期 Vite proxy `VITE_DEV_PROXY_TARGET=http://127.0.0.1:8080`），`unwrap<MarketOverview>` 解包；HTTP 400（如 market=US）与业务 success=false 统一走错误 UI + 重试，不渲染半截数据。
- 类型与后端 `MarketOverviewVO` 逐字段对齐：metadata（barCoverage/membershipCoverage/qualifiedTradingDays/qualityStatus/limitations/unavailableMetrics/coverageGap/providerAttribution）、benchmarkSeries、activitySeries、breadthSeries、liquidityProxySeries、industryTurnoverMigration、quality（findings/assumptions）。
- null 语义：转换层把 null 指标写成 lightweight-charts whitespace 点（`{time}`）形成可见断点，不连线、不补 0；DEGRADED 保留全部短期序列渲染，中期指标（MA60/60 日基线）预热不足保持断点。
- mock：市场全景不提供任何模拟行情。apiMode=mock 时 `useMarketOverview` 禁用查询（不自动调用 remote），页面仅渲染"市场全景需要后端数据模式，请在设置中切换为后端模式。"提示（testid `overview-mock-unavailable`），不渲染上下文栏与五类行情图；api 层无 mock 分支，无论 localStorage 模式如何都只走 HTTP。

## 4. 自动化验证

- `npm run typecheck` / `npm run lint` / `npm run test`（**53 files / 421 tests 全绿**）/ `npm run build` 通过；`git diff --check` 干净。
- 新增/重写测试：
  - `api/marketOverviewApi.test.ts`：remote 参数拼装、DEGRADED/NO_DATA 透传、HTTP 失败与业务失败 reject、mock 模式设置下仍只走 HTTP（返回值逐字段等于后端响应，无本地合成）且 HTTP 失败同样抛错不回退。
  - `model/overviewTransform.test.ts`（139 行）：格式化器边界（亿/万/元、百分比、科学计数、null→`--`）、null→whitespace 断点、迁移图层排序（OTHER 恒最后）与 tooltip 排序。
  - `src/pages/market-research.test.tsx`（重写）：OK 五区块 + 上下文栏数字、mock 模式不调接口不出图仅提示切换后端模式、覆盖率 null 显示 `--`、DEGRADED 告警 + 资金流不可用标签且图表保留、迁移阻断 Empty、NO_DATA 不渲染图表、remote 请求失败 + 重试（无任何假数据兜底）、刷新触发重复查询、板块详情页回归。

## 5. 真实后端联调（Docker）

环境：`qta-mysql`(MySQL 8.4，真实 2026-07 PoC 数据) + `qta-server`(8080)，Vite dev `VITE_DEFAULT_API_MODE=remote` + proxy。

curl 证据（与页面渲染逐位一致）：

| 请求 | 结果 |
| --- | --- |
| `overview?market=CN&start=2026-07-01&end=2026-07-31` | 200，DEGRADED；barCoverage 0.892754、membershipCoverage 0.673333、qualifiedTradingDays 0/120；基准 23 交易日；迁移 207 行（电子信息 24.98% rank1） |
| `overview?market=CN&start=2025-01-01&end=2025-01-31` | 200，NO_DATA（BENCHMARK_DATA_MISSING） |
| `overview?market=US&...` | 400 VALIDATION_ERROR |

页面 1440×900 上下文栏显示 89.3% / 67.3% / 0/120 / 样本 150 / 数据截至 2026-07-31，与 curl 完全一致；质量面板 3 项告警（LOW_MEMBERSHIP_COVERAGE·49、LOW_BAR_COVERAGE·23、INSUFFICIENT_WARMUP）与后端 findings 一致。

remote 完整性（不回退 mock）：proxy 目标不可达阶段（502）页面显示错误 Alert + 重试，未出现任何 mock 数据；恢复后真实数据渲染。

## 6. 浏览器验收（截图目录 `docs/development/screenshots/`）

| 视口/场景 | 截图 | 结论 |
| --- | --- | --- |
| 1440×900 首屏 | `market-overview-1440x900.png` | 上下文栏完整；基准三 pane 真实像素（收盘/MA20/MA60/成交额/回撤），无重叠溢出 |
| 1440×900 行业迁移区块 | `market-overview-migration-1440x900.png` | 彩色堆叠面积 + 0-100% 网格 + 日期轴 + 13 行业图例，无遮挡 |
| 1440×900 数据质量面板 | `market-overview-quality-1440x900.png` | DEGRADED 3 告警数值与后端一致；OFFICIAL_MONEY_FLOW 标签；映射缺口含未入分母金额；口径折叠 |
| 1280×800 | `market-overview-1280x800.png` / `-full.png` | 上三区块图表正常（注：浏览器 fullPage 采集在 ~2400px 截断，下两区块以 1440 滚动截图 + DOM 快照为证） |
| 390×844 移动 | `market-overview-390x844.png` | 无文字溢出/横向错位，查询/刷新可用，图表自适应 |

DOM 快照复核：五区块标题、LWC `Charting by TradingView` 归属、迁移图 aria 与 13 个真实行业名（电子信息/电子器件/机械行业/金融行业/有色金属/仪器仪表/家电行业/酿酒行业/玻璃行业/电器行业/生物制药/汽车制造/其他）全部在页。

## 7. 遗留与边界（真实事项）

- 候选 commit 未 push：前端分支 `codex/qta-v2-market-overview-complete`；后端仅文档同步分支同名。等待 Codex 独立验收后合并。
- 服务器部署 NOT_DEPLOYED；生产 Nginx 同源反代 `/api/v1` 路径与 MR-1A 合并 main 前该页面在 main 分支无后端。
- dataScope=SAMPLE（流通市值 Top-150∪基准）非全市场；OFFICIAL_MONEY_FLOW=UNAVAILABLE；真实数据在 0.90 门禁下常态 DEGRADED，属诚实门禁。
- `market_calendar` 回填后 qualifiedTradingDays 口径需复核（当前 0/120 为门禁真实输出）。
- MR-2（资金流四象限/候选/策略/盘中）未开始。
