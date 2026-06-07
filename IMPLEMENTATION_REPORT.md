# 前端 MVP 实施汇报

> 完成时间：2026-06-07
> 基于现有骨架开发业务功能，未修改后端代码，未重新创建前端项目。

## 一、实施范围

在现有 Vite + React + TypeScript 骨架上，按 feature-based 架构补齐了 7 个业务页面和 localStorage 数据能力。

### 新建文件（35 个）

```
src/shared/
  types/domain.ts                          ← 所有领域类型（联合类型 + 模型接口）
  api/localStorageClient.ts                ← 统一 localStorage 读写
  utils/id.ts                              ← crypto.randomUUID() 封装
  utils/date.ts                            ← dayjs 日期工具
  utils/number.ts                          ← 金额/价格/百分比格式化

src/features/watchlist/
  model/options.ts                         ← 枚举选项（MarketType/TradeStyle/AttentionLevel）
  api/watchlistApi.ts                      ← localStorage CRUD
  hooks/useWatchlist.ts                    ← 业务 hook + 筛选 hook
  components/WatchlistTable.tsx            ← 表格组件
  components/WatchlistForm.tsx             ← Drawer 表单组件

src/features/tradeplan/
  model/options.ts                         ← PlanStatus 选项
  api/tradePlanApi.ts                      ← localStorage CRUD
  hooks/useTradePlan.ts                    ← 业务 hook + 筛选 hook
  components/TradePlanTable.tsx            ← 表格组件
  components/TradePlanForm.tsx             ← Drawer 表单组件

src/features/risk/
  model/types.ts                           ← RiskLevel 选项
  api/riskCalculator.ts                    ← decimal.js 纯计算函数
  hooks/useRiskCalculator.ts               ← 计算 hook + 校验
  components/RiskCalculatorForm.tsx        ← 输入表单
  components/RiskResultCard.tsx            ← 结果展示卡片

src/features/journal/
  model/options.ts                         ← TradeSide/ReviewStatus/EmotionTag/MistakeTag
  api/tradeJournalApi.ts                   ← localStorage CRUD + 批量更新状态
  hooks/useTradeJournal.ts                 ← 业务 hook + 筛选 hook
  components/TradeJournalTable.tsx         ← 表格组件
  components/TradeJournalForm.tsx          ← Drawer 表单组件

src/features/review/
  model/options.ts                         ← 复用 journal 的 REVIEW_STATUS
  api/reviewApi.ts                         ← localStorage CRUD
  hooks/useReview.ts                       ← 业务 hook + 自动标记 journal
  components/ReviewTable.tsx               ← 表格组件
  components/ReviewForm.tsx                ← Drawer 表单 + 关联交易选择

src/features/dashboard/
  hooks/useDashboard.ts                    ← 聚合 4 个 localStorage 数据源
  components/DashboardStats.tsx            ← 统计卡片 + 风险提醒
  components/QuickActions.tsx              ← 快捷跳转按钮

src/features/settings/
  api/settingsApi.ts                       ← 导出/导入/清空
  hooks/useSettings.ts                     ← 设置 hook
  components/DataManagement.tsx            ← 导出/导入/清空 UI

src/pages/settings.tsx                     ← 设置页面（新增）
```

### 修改的文件（7 个）

| 文件 | 修改内容 |
|------|----------|
| `src/app/layout.tsx` | 添加 Settings 菜单项 + 免责声明 Alert（antd v6 用 title 替代 message） |
| `src/app/router.tsx` | 添加 `/settings` 路由 |
| `src/test-setup.ts` | 添加 `window.matchMedia` mock（antd v6 需要） |
| `src/pages/dashboard.tsx` | 8 行占位 → 完整工作台页面 |
| `src/pages/watchlist.tsx` | 8 行占位 → 完整自选股 CRUD |
| `src/pages/trade-plan.tsx` | 8 行占位 → 完整盘前计划 CRUD |
| `src/pages/risk.tsx` | 8 行占位 → 风控计算器 |
| `src/pages/journal.tsx` | 8 行占位 → 完整交易记录 CRUD |
| `src/pages/review.tsx` | 8 行占位 → 完整盘后复盘 CRUD |

## 二、设计决策

### 2.1 feature-based 架构

每个业务模块自包含 `model/api/hooks/components`，页面只做编排。好处：

- 各 feature 可以独立开发和测试
- 类型和枚举不散落在全局
- 后续切 remote API 时只需修改 `api/` 层

### 2.2 localStorage 统一管理

所有 localStorage 操作通过 `shared/api/localStorageClient.ts`。页面和组件不直接调用 `window.localStorage`。好处：

- 统一前缀 `qta:`
- 序列化/反序列化集中处理
- 导出导入只需操作一个模块

### 2.3 风控计算使用 decimal.js

`features/risk/api/riskCalculator.ts` 使用 `Decimal` 避免浮点精度问题。公式与后端 `BACKEND_TODAY_MVP_IMPLEMENTATION_MANUAL.md` 完全对齐：

```
riskAmount = totalCapital × riskPercent
perShareRisk = buyPrice − stopLossPrice
riskBasedQuantity = floor(riskAmount / perShareRisk)
positionCapQuantity = floor(totalCapital × maxPositionRatio / buyPrice)
finalQuantity = min(riskBasedQuantity, positionCapQuantity)
finalQuantity = floor(finalQuantity / lotSize) × lotSize
estimatedLoss = finalQuantity × perShareRisk
positionAmount = finalQuantity × buyPrice
positionRatio = positionAmount / totalCapital
```

### 2.4 联合类型代替 TypeScript enum

tsconfig 中 `erasableSyntaxOnly: true` 禁止 TypeScript enum。使用联合类型 + Map 配置：

```typescript
export type TradeStyle = 'SHORT_TERM' | 'DO_T' | 'SWING' | 'OBSERVE';
export const TRADE_STYLE_MAP = new Map(TRADE_STYLE_OPTIONS.map(o => [o.value, o]));
```

### 2.5 antd v6 适配

- `Alert` 组件 `message` prop 改为 `title`
- `Form.useWatch` 用于条件渲染
- `Checkbox.Group` 用于关联交易记录选择

## 三、质量检查结果

| 命令 | 结果 |
|------|------|
| `npm run typecheck` | ✅ 通过，0 error |
| `npm run lint` | ✅ 通过，0 error, 0 warning |
| `npm run test` | ✅ 1/1 passed |
| `npm run build` | ✅ 构建成功（dist/ 产出完整） |

## 四、业务规则实现情况

| 规则 | 状态 |
|------|------|
| TradePlan `allowedToTrade=true` 时必须填写 buyCondition、stopLossPrice、plannedPositionRatio | ✅ 页面层校验 + 表单 Alert 提示 |
| plannedPositionRatio 范围 0~1 | ✅ InputNumber min=0 max=1 |
| takeProfitPrice > stopLossPrice | ✅ 页面层校验 |
| RiskCalculator 中 stopLossPrice >= buyPrice 时禁止计算 | ✅ hook 层校验 + 错误提示 |
| finalQuantity 按 lotSize 向下取整 | ✅ decimal.js `div(lotSize).floor().mul(lotSize)` |
| TradeJournal BUY 且无 planStopLoss 时给 warning | ✅ Alert 提示 |
| Review 支持每日总复盘和个股复盘 | ✅ symbol 可留空 |
| Review 关联交易记录后自动标记 REVIEWED | ✅ `batchUpdateReviewStatus` |
| 删除/清空/导入覆盖必须二次确认 | ✅ Popconfirm 确认 |
| localStorage 只能通过统一 localStorageClient | ✅ 所有读写走 localStorageClient |
| 页面明确显示不自动交易 | ✅ layout 全局 Alert + Dashboard Alert + Settings Alert |

## 五、已知限制和简化点

1. **chunk 过大**：构建产物 1430KB（gzip 438KB），可通过 dynamic import() 做 code-splitting 优化。MVP 阶段可接受。
2. **测试覆盖不足**：目前只有 App 启动测试。建议后续补充：
   - `riskCalculator.ts` 纯函数单元测试
   - 各 localStorage API adapter 测试
   - 各 feature hook 测试
3. **remote API 未实现**：`shared/api/client.ts` 已预留 axios 实例，但各 feature 的 remote 模式调用逻辑尚未实现。localStorage 模式完整可用。
4. **无错误边界**：未实现 React ErrorBoundary，生产环境建议添加。
5. **无路由懒加载**：所有页面同步加载，后续可用 `React.lazy()` + `Suspense` 优化。

## 六、下一步建议

1. **启动 dev server 验证**：`cd /Users/joker/code/quant-trading-assistant-web && npm run dev`，在浏览器手动操作新增/编辑/刷新流程
2. **补充单元测试**：优先覆盖 `riskCalculator.ts` 和各 localStorage API
3. **前端接入后端 API**：在各 feature 的 api/ 层实现 remote 模式，通过 Settings 切换
4. **code-splitting**：优化首屏加载速度
5. **提交代码**：`git add . && git commit -m "feat: implement frontend MVP with localStorage"`

## 七、自审角色检查

### 7.1 架构师视角

- ✅ feature-based 分层清晰，shared 和 features 职责明确
- ✅ pages 只做编排，不含业务逻辑
- ✅ localStorage 抽象层干净，后续切 remote 只改 api/ 层
- ⚠️ shared/types/domain.ts 包含所有领域类型，后续模块增多可考虑按 feature 拆分

### 7.2 资深前端工程师视角

- ✅ 无 any，类型严格
- ✅ 无魔法字符串，枚举集中管理
- ✅ 组件文件 PascalCase，hooks 用 useXxx
- ✅ antd Form/Table/Drawer/Modal 一致使用
- ✅ verbatimModuleSyntax 要求 type-only import 遵守
- ⚠️ 部分 Drawer 底部按钮用手写 style，后续可抽取为通用组件

### 7.3 代码审查者视角

- ✅ 文件职责单一，无超 300 行的组件
- ✅ 风控计算纯函数与 UI 完全分离
- ✅ 业务错误用 message.error 展示，不吞异常
- ⚠️ 部分页面 cast 类型（如 `values as Omit<WatchlistItem, ...>`），后续可优化类型推导

### 7.4 QA 测试工程师视角

- ✅ typecheck/lint/test/build 全部通过
- ✅ 构建产物完整
- ⚠️ 缺少业务逻辑单元测试
- ⚠️ 未做 dev server 手动验证

### 7.5 产品可用性检查者视角

- ✅ 7 个页面都有实际功能
- ✅ 免责声明在 layout、dashboard、settings 三处展示
- ✅ 删除/清空/导入有二次确认
- ✅ 刷新后数据不丢失（localStorage 持久化）
- ⚠️ 未启动 dev server 做真实浏览器验证
