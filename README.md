# Quant Trading Assistant Web

本地优先的量化交易辅助前端。不自动交易，不连接券商，不保存真实密钥。

## 项目定位

个人交易工作台，帮助用户：

- 盘前写自选股观察、交易计划、止损位和仓位计划
- 盘中快速使用风控计算器，手工记录真实操作
- 盘后补交易结果，复盘是否按计划执行

**所有计算仅辅助参考，不构成投资建议。**

## 技术栈

| 技术 | 用途 |
|------|------|
| React 19 | UI 框架 |
| TypeScript 6 | 类型安全 |
| Vite 8 | 构建和开发服务器 |
| Ant Design 6 | UI 组件库 |
| React Router 7 | 路由 |
| Zustand | 全局状态（侧边栏等） |
| TanStack Query | 服务端状态预留 |
| decimal.js | 风控计算精度 |
| dayjs | 日期处理 |
| Vitest | 单元测试 |

## 本地启动

```bash
npm install
npm run dev          # 启动开发服务器 http://localhost:5173
```

## 常用命令

```bash
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 检查
npm run test         # 运行测试
npm run build        # 生产构建
```

## 功能模块

| 页面 | 路径 | 功能 |
|------|------|------|
| 工作台 | `/dashboard` | 今日概览、快捷操作、风险提醒、待办中心（待复盘 / 未关联计划 / 缺少止损 / 快照过期 / 对账差异，点击跳转） |
| 自选股 | `/watchlist` | 新增/编辑/停用自选股，按风格和关注级别筛选 |
| 交易计划 | `/trade-plan` | 新增/编辑盘前计划，标记状态和允许交易 |
| 风控计算器 | `/risk` | 输入资金和价格，计算建议仓位和风险等级 |
| 交易记录 | `/journal` | 手工记录交易，打情绪/错误标签 |
| 交易账本 | `/portfolio` | 持仓、已结算交易、盈亏与胜率（FIFO），手工维护当前价 |
| 持仓快照 | `/position-snapshots` | 手工盘点实际持仓，草稿 / 确认 / 作废 / 历史查询，以及两次已确认快照对比、与截止时点 FIFO 账本对账 |
| 盘后复盘 | `/review` | 每日总复盘和个股复盘，关联交易记录 |
| 设置 | `/settings` | 数据模式切换、有效 API 地址展示、localhost 防误配、只读测试连接、JSON 导出/导入/清空 |

## 数据说明

数据保存位置取决于数据模式（见下节）：

- **本地模式（mock）**：业务数据保存在浏览器 **localStorage**（前缀 `qta:`）。刷新页面不丢失；清空浏览器缓存会丢失；localStorage 容量有限（通常 5~10MB），不建议存储海量历史数据。
- **后端模式（remote）**：核心业务数据通过 REST API 写入服务器 **MySQL**；浏览器 localStorage 仅保存数据模式等本地配置，不再保存业务数据。
- **JSON 导出仅包含浏览器 localStorage（设置与本地模式数据），不包含后端 MySQL 业务数据**；建议定期在设置页导出本地配置。

## 数据模式与后端联调

数据模式由「设置」页控制（每次请求现读设置，切换无需刷新页面）：

- **本地模式（mock）**：数据保存在浏览器 localStorage，不依赖后端，适合本地开发 / 离线兜底。
- **后端模式（remote）**：核心业务数据通过 REST API 写入后端数据库。后端地址默认**留空**走同源 `/api/v1`（开发期 vite proxy、生产 Nginx 反代转发）；本地需要直连后端时才填 `http://localhost:8080`，拼接为 `${apiBaseUrl}/api/v1`。
- **默认模式由环境变量 `VITE_DEFAULT_API_MODE` 控制**：开发默认 `mock`（见 `.env`），生产构建默认 `remote`（见 `.env.production`），默认值清晰可控。用户在设置页手动切换后，选择保存在浏览器 localStorage 并优先生效。

**后端模式已接入范围**（新增 / 编辑 / 删除 / 查询均走后端，核心数据落库）：

| 模块 | 后端路径 |
|------|----------|
| 交易账本（持仓、已结算交易、盈亏、手工当前价） | `/api/v1/portfolio/*` |
| 持仓快照（草稿、确认、作废、历史与详情） | `/api/v1/position-snapshots/*` |
| 自选股 | `/api/v1/watchlist` |
| 交易计划 | `/api/v1/trade-plans` |
| 交易记录 | `/api/v1/trade-journals` |
| 盘后复盘 | `/api/v1/reviews` |

「今日工作台」会在后端模式下并发拉取上述数据聚合展示；「风控计算器」为纯前端计算，不涉及后端持久化。

> 说明：本地模式录入的数据**不会自动同步**到后端，反之亦然——两套数据源相互独立。本系统不连接券商，不自动同步真实交易，当前价与交易流水均为手工维护，所有盈亏仅用于复盘，不构成投资建议。

后端项目：`/Users/joker/code/quant-trading-assistant`

## 运行架构与排障

本系统有两套运行形态，请勿混淆：

### 本机开发（当前默认）

| 组件 | 地址 | 说明 |
|------|------|------|
| 前端 Vite dev | http://localhost:5173 | `npm run dev`；开发期 `/api` 经 Vite proxy 转发到 8080 |
| 后端 Spring Boot | http://localhost:8080 | 本机直接运行（profile=local），连 Docker 内 MySQL |
| MySQL | 127.0.0.1:3306 | Docker 容器 `qta-mysql`，仅绑定本机回环，不暴露公网 |

> Vite 默认绑定 IPv6 `[::1]:5173`，请用 `http://localhost:5173` 访问（`127.0.0.1` 直连可能失败）。

Vite 代理目标由 `VITE_DEV_PROXY_TARGET` 控制，默认值是 `http://localhost:8080`。如果通过 SSH
把服务器后端 `18081` 端口映射到了 Mac 本机，请创建不提交 Git 的 `.env.local`：

```bash
VITE_DEV_PROXY_TARGET=http://localhost:18081
```

修改后需要重新启动 `npm run dev`。不要直接把 `vite.config.ts` 的默认端口改成服务器端口，
否则会破坏本机 Spring Boot 运行在 8080 时的标准开发流程。

### 生产部署（服务器）

1. 后端：`docker compose up -d --build`（容器 `qta-server`，端口 8080）+ MySQL 容器 `qta-mysql`。
2. 前端：`npm run build` 产出 `dist/`，交由 Nginx 托管；Nginx 将 `/api/` 反代到后端 8080（**反代目标勿重复拼接 `/api/v1`**）。
3. 前端「设置」页切换为后端模式，地址留空即走同源 `/api/v1`，由 Nginx 转发。

### 排障命令

```bash
curl http://localhost:8080/actuator/health           # 后端健康检查
curl http://localhost:8080/api/v1/portfolio/summary  # 直连后端业务接口
curl http://localhost:5173/                           # 前端首页（本机 dev）
curl http://localhost:5173/api/v1/portfolio/summary  # 经 Vite proxy 验证联调
npm run typecheck && npm run lint && npm run test && npm run build
```

## 项目结构

```
src/
├── app/                    # 应用级：路由、布局、Provider
├── pages/                  # 页面编排（不含业务逻辑）
├── features/               # 业务模块（feature-based）
│   ├── watchlist/          # model / api / hooks / components
│   ├── tradeplan/
│   ├── risk/
│   ├── journal/
│   ├── portfolio/
│   ├── position-snapshot/
│   ├── review/
│   ├── dashboard/
│   └── settings/
├── shared/                 # 共享基础
│   ├── api/                # localStorageClient、axios 实例
│   ├── components/         # DrawerFooter、ErrorBoundary
│   ├── types/              # 领域类型
│   ├── utils/              # 日期、数字、ID 工具
│   └── stores/             # Zustand 全局状态
└── styles/
```

## 风险声明

本系统是交易辅助记录和复盘工具：

- **不自动交易**
- **不连接券商**
- **不保存真实交易密钥**
- 所有风控计算结果仅为辅助参考，不构成任何投资建议
- 投资有风险，入市需谨慎
