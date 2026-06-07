# Claude Code 会话交接文档

> 最后更新：2026-06-07
> 用途：新开 Claude Code 会话时，让 Claude 先读这份文档，快速恢复上下文。

## 一、项目总览

### 1.1 系统定位

量化交易辅助系统（Quant Trading Assistant，简称 QTA），本地优先的个人交易工作台。

**核心边界（不可违反）：**
- **不自动下单**，不连接真实券商
- **不保存**真实交易密钥、券商密码
- **不输出**"稳赚""必涨""无风险"结论
- 所有交易相关输出表达为：辅助信号 + 风险提示 + 人工确认

### 1.2 用户画像

- Java 开发者，有短线交易经验
- 希望用系统记录自选股、盘前计划、交易、复盘
- 希望数据积累后能做回测和规则优化
- 目前先求"周一能用"，后续迭代

### 1.3 仓库结构

```
/Users/joker/code/
├── quant-trading-assistant/          ← 后端（Java Spring Boot）
└── quant-trading-assistant-web/      ← 前端（React + TypeScript + Vite）
```

两个项目是独立的 Git 仓库。

### 1.4 GitHub 仓库

- 后端：`https://github.com/Hedgehog-LI/quant-trading-assistant`（待确认实际地址）
- 前端：`https://github.com/Hedgehog-LI/quant-trading-assistant-web.git`

注意：命令行 `git push` 会因为 GitHub 鉴权失败，需要在 IDEA 中执行 Push。

## 二、后端项目状态

### 2.1 技术栈

- Java 17、Spring Boot 3.5.14、Maven Wrapper
- Spring Web + Spring Data JPA + Spring Validation + Actuator
- Flyway（数据库迁移）、MySQL 8.4（生产）、H2（测试）
- MyBatis XML 写 SQL
- Docker Compose（app + mysql）

### 2.2 已完成的模块

后端 Today MVP 的 6 个业务模块已全部实现，共 80+ 个 Java 文件：

| 模块 | 路径 | 内容 |
|------|------|------|
| common | `com.quant.trade.common` | ApiResponse、ErrorCodeEnum、BusinessException、GlobalExceptionHandler、8 个枚举、工具类 |
| Watchlist | `com.quant.trade.watchlist` | 自选股 CRUD，symbol 唯一，软删除 |
| TradePlan | `com.quant.trade.tradeplan` | 盘前计划，同 symbol+date 唯一，allowedToTrade 校验 |
| RiskCalculator | `com.quant.trade.risk` | 仓位计算纯函数，BigDecimal 精度 |
| TradeJournal | `com.quant.trade.journal` | 交易记录，amount 自动计算，批量更新复盘状态 |
| Review | `com.quant.trade.review` | 盘后复盘，关联 journal 后自动标记 REVIEWED |
| Dashboard | `com.quant.trade.dashboard` | 聚合查询，不建表 |

分层：Controller → Service → Manager → DAO(Mapper) → Entity/DO，DTO/VO/Converter 齐全。

### 2.3 数据库

- Flyway migration `V2__create_today_mvp_tables.sql` 已建 4 张表：watchlist、trade_plan、trade_journal、review_note
- MyBatis XML mapper 4 个

### 2.4 测试

- 7 个测试类，33 个测试全部通过（`./mvnw test`）
- 使用 H2 内存数据库，不依赖真实 MySQL

### 2.5 后端 Git 状态

- 分支 `main`，所有业务代码已 staged（`git add -A` 已执行）
- **尚未 commit 和 push**，等你手动 commit
- 修改了 CLAUDE.md、pom.xml、application-local.properties、application-test.properties

### 2.6 后端关键文档

```
后端仓库根目录：
docs/API_TODAY_MVP.md                              ← API 接口文档（路径、请求、响应示例）
docs/claude/BACKEND_TODAY_MVP_IMPLEMENTATION_MANUAL.md  ← 后端实现手册
docs/claude/CLAUDE_CODE_EXECUTION_GUIDE.md          ← Claude 执行指南（含提示词模板）
docs/claude/FRONTEND_MVP_ARCHITECTURE_AND_CLAUDE_MANUAL.md ← 前端架构手册
```

## 三、前端项目状态

### 3.1 技术栈

- React 19、TypeScript 6、Vite 8
- Ant Design 6（注意：`Alert` 用 `title` 不用 `message`）
- React Router 7（统一用 `react-router`，不用 `react-router-dom`）
- Zustand（全局 UI 状态）、TanStack Query（预留 remote API）
- decimal.js（风控计算精度）、dayjs（日期）
- Vitest（单元测试）

### 3.2 tsconfig 关键约束

- `verbatimModuleSyntax: true` → type-only import 必须用 `import type`
- `erasableSyntaxOnly: true` → 禁止 TypeScript enum，用联合类型 + Map
- `noUnusedLocals: true` / `noUnusedParameters: true`

### 3.3 已完成的页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 工作台 | `/dashboard` | 统计卡片、风险提醒、快捷操作、高关注自选股、今日计划、待复盘交易 |
| 自选股 | `/watchlist` | 新增/编辑/停用/启用，按关键词+风格+关注级别筛选 |
| 交易计划 | `/trade-plan` | 新增/编辑，状态标记（草稿/激活/完成/取消），allowedToTrade 校验 |
| 风控计算 | `/risk` | 输入参数 → 计算仓位 → 展示结果+风险等级+免责声明 |
| 交易记录 | `/journal` | 新增/编辑，amount 自动计算，情绪/错误标签，按状态筛选 |
| 盘后复盘 | `/review` | 个股复盘+每日总复盘，关联交易记录，自动标记 REVIEWED |
| 设置 | `/settings` | 数据模式切换（本地/后端）、后端地址、JSON 导出/导入/清空 |

### 3.4 架构

feature-based 分层：

```
src/
├── app/          # 路由、布局、Provider
├── pages/        # 页面编排（不含业务逻辑）
├── features/     # 业务模块
│   └── {name}/
│       ├── model/     # 类型、枚举选项
│       ├── api/       # localStorage CRUD
│       ├── hooks/     # 业务 hook
│       └── components/# 业务组件
├── shared/       # 共享基础
│   ├── api/      # localStorageClient + axios
│   ├── components/ # DrawerFooter、ErrorBoundary
│   ├── types/    # domain.ts（所有领域类型）
│   ├── utils/    # id、date、number
│   └── stores/   # app-store（侧边栏折叠）
└── styles/
```

关键设计决策：
- **localStorage 统一管理**：所有读写通过 `shared/api/localStorageClient.ts`，前缀 `qta:`
- **Drawer 底部统一**：`shared/components/DrawerFooter.tsx`，Ant Design Button
- **ErrorBoundary**：`shared/components/ErrorBoundary.tsx`，包住路由
- **路由懒加载**：`app/router.tsx` 用 React.lazy + Suspense，主 chunk 305KB
- **设置页 remote 警告**：选择后端模式时明确提示"预留联调配置，当前 API 未接入"

### 3.5 测试

7 个测试文件，41 个测试全部通过：

| 文件 | 数 | 覆盖 |
|------|----|------|
| riskCalculator.test.ts | 8 | 正常计算、取整、风险等级、非法输入、免责声明 |
| localStorageClient.test.ts | 8 | CRUD、前缀过滤、export/import |
| watchlistApi.test.ts | 7 | 新增、转大写、更新、启停 |
| tradePlanApi.test.ts | 7 | 新增、更新、同日期重复 |
| tradeJournalApi.test.ts | 6 | amount 计算、批量状态更新 |
| reviewApi.test.ts | 4 | 个股/总复盘、关联 journal 标记 REVIEWED |
| app.test.tsx | 1 | App 启动 |

### 3.6 前端 Git 状态

- 分支 `main`，2 个 commit：
  - `b055a21` feat: harden frontend MVP quality（80 files, 9811 insertions）
  - `dc21671` docs: add delivery acceptance report
- **尚未 push**，需要在 IDEA 中执行 Git Push

### 3.7 前端报告文档

```
前端仓库根目录：
IMPLEMENTATION_REPORT.md           ← 第一轮：业务功能实现报告
QUALITY_IMPROVEMENT_REPORT.md      ← 第二轮：质量加固报告
DELIVERY_ACCEPTANCE_REPORT.md      ← 第三轮：交付验收报告
```

## 四、开发历程

### 轮次 1：项目初始化 + 文档规划

- 初始化 Spring Boot 后端项目
- 编写 AGENTS.md、ARCHITECTURE.md、DATABASE_DESIGN.md 等设计文档
- 编写 Claude Code 执行手册和提示词模板
- 编写前端架构规划文档

### 轮次 2：后端 Today MVP 实现（白天会话，已卡死）

- 按 BACKEND_TODAY_MVP_IMPLEMENTATION_MANUAL.md 实现全部 6 个模块
- Flyway V2 migration、Entity/Repository/Service/Controller/DTO/VO
- MyBatis XML mapper
- 33 个测试通过
- 会话在 IDEA Terminal 中卡死，后端代码已写完但未 commit

### 轮次 3：前端 MVP 实现

- 创建 Vite + React + TypeScript 项目
- 安装依赖（antd、zustand、react-router、decimal.js 等）
- 搭建 Layout/Router/Providers 骨架
- 实现 7 个页面（Dashboard/Watchlist/TradePlan/Risk/Journal/Review/Settings）
- localStorage CRUD + 风控计算 + Dashboard 聚合
- typecheck/lint/test/build 全部通过

### 轮次 4：前端质量加固

- README 替换 Vite 默认
- Settings 补齐数据模式和后端地址 UI（带 remote 警告）
- 抽取 DrawerFooter 共享组件，替换所有原生 button
- 导入改用 Modal.confirm 二次确认，移除 alert()
- 新增 ErrorBoundary 包住应用
- 路由懒加载（1430KB → 305KB）
- 补充 40 个单元测试（共 41 个）
- 全部质量检查通过

### 轮次 5：交付验收

- 核验 12 个关键文件，报告与代码完全一致
- 代码搜索确认无原生 button/alert/any/直接 localStorage
- typecheck/lint/test/build 通过
- Dev server 启动正常（http://localhost:5173/）
- 人工验收清单已输出，用户确认"页面正常显示"，暂不逐项验收

## 五、下一步建议（按优先级）

### 5.1 立即可做

1. **后端 commit + push**：后端代码已 staged，需要 commit 和 push
2. **前端 IDEA Push**：前端 2 个 commit 需要在 IDEA 中推送到 origin/main
3. **浏览器人工验收**：按验收清单逐项操作（清单在 DELIVERY_ACCEPTANCE_REPORT.md）

### 5.2 短期（本周内）

4. **前端接入后端 API**：各 feature 的 api/ 层实现 REST API 调用，通过 Settings 切换模式
5. **Docker Compose 联调**：启动 MySQL + 后端，前端切 remote 模式验证
6. **补充组件测试**：React Testing Library 组件级测试

### 5.3 中期

7. **日 K 数据导入**：支持 CSV 手工导入日线数据
8. **技术指标计算**：MA、MACD、RSI、BOLL
9. **ECharts 图表**：K 线图、资金曲线
10. **回测引擎**：策略定义 + 历史回测

## 六、新会话提示词模板

### 6.1 继续前端开发

```text
你现在接手 quant-trading-assistant-web 前端项目。

请先阅读：
- /Users/joker/code/quant-trading-assistant-web/SESSION_HANDOFF.md（本文档）
- /Users/joker/code/quant-trading-assistant-web/IMPLEMENTATION_REPORT.md
- /Users/joker/code/quant-trading-assistant-web/QUALITY_IMPROVEMENT_REPORT.md

当前状态：前端 MVP 已完成，localStorage 模式可用，41 个测试通过。

当前任务：（在此描述你的任务）

要求：
- 不要修改后端项目
- 不要删除已有报告
- 继续遵守 feature-based 架构
- localStorage 只通过 localStorageClient
- 不使用 any、不使用 TypeScript enum
- 完成后运行 typecheck/lint/test/build
```

### 6.2 继续后端开发

```text
你现在接手 quant-trading-assistant 后端项目。

请先阅读：
- AGENTS.md
- CLAUDE.md
- docs/API_TODAY_MVP.md
- docs/claude/BACKEND_TODAY_MVP_IMPLEMENTATION_MANUAL.md

前端项目状态：前端 MVP 已在 /Users/joker/code/quant-trading-assistant-web 完成。

当前任务：（在此描述你的任务）

要求：
- 不要修改前端项目
- 遵循 Alibaba Java 编码规范
- Controller 不返回 Entity
- 金额使用 BigDecimal
- 修改前先列文件清单
- 完成后运行 ./mvnw test
```

### 6.3 前后端联调

```text
你现在接手 quant-trading-assistant-web 前端项目，需要接入后端 API。

请先阅读：
- /Users/joker/code/quant-trading-assistant-web/SESSION_HANDOFF.md
- /Users/joker/code/quant-trading-assistant/docs/API_TODAY_MVP.md
- /Users/joker/code/quant-trading-assistant-web/src/shared/api/client.ts

后端已部署在 http://localhost:8080，API 基础路径 /api/v1。

当前任务：将前端各 feature 的 api/ 层从 localStorage 切换到 REST API。

要求：
- 保留 localStorage 模式作为 fallback
- Settings 页的 mock/remote 切换要生效
- 不修改后端代码
- 完成后运行 typecheck/lint/test/build
```

## 七、关键约束速查

| 约束 | 说明 |
|------|------|
| 不自动交易 | 系统只做辅助记录、计算、复盘 |
| 不连接券商 | 不接券商 SDK/API，不保存密钥 |
| localStorage 统一 | 只通过 `shared/api/localStorageClient.ts` |
| 不使用 any | TypeScript 严格模式 |
| 不使用 enum | 用联合类型 + options Map |
| Alert 用 title | antd v6 用 `title` 不用 `message` |
| Drawer 统一 | 使用 `shared/components/DrawerFooter.tsx` |
| 金额用 BigDecimal | 后端所有金额/价格/比例 |
| git push 用 IDEA | 命令行 push 会鉴权失败 |
