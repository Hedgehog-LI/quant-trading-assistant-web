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
| 工作台 | `/dashboard` | 今日概览、快捷操作、风险提醒 |
| 自选股 | `/watchlist` | 新增/编辑/停用自选股，按风格和关注级别筛选 |
| 交易计划 | `/trade-plan` | 新增/编辑盘前计划，标记状态和允许交易 |
| 风控计算器 | `/risk` | 输入资金和价格，计算建议仓位和风险等级 |
| 交易记录 | `/journal` | 手工记录交易，打情绪/错误标签 |
| 交易账本 | `/portfolio` | 持仓、已结算交易、盈亏与胜率（FIFO），手工维护当前价 |
| 盘后复盘 | `/review` | 每日总复盘和个股复盘，关联交易记录 |
| 设置 | `/settings` | 数据模式切换、JSON 导出/导入/清空 |

## 数据说明

当前业务数据保存在浏览器 **localStorage** 中（前缀 `qta:`）。

- 刷新页面后数据不丢失
- **建议定期在设置页导出 JSON 备份**
- 清空浏览器缓存会丢失数据
- localStorage 容量有限（通常 5~10MB），不建议存储海量历史数据

## 后端联调

当前业务默认使用 localStorage。后端 API 就绪后：

1. 在设置页切换数据模式为「后端模式」
2. 后端地址默认**留空**，走同源 `/api/v1`（由开发期 vite proxy 或生产 nginx 反代转发）；本地开发需要直连后端时才填写 `http://localhost:8080`
3. 后端地址在**每次请求时**读取并拼接为 `${apiBaseUrl}/api/v1`，切换后无需刷新页面

**当前接入范围**：

- 仅「交易账本」（`/portfolio`：持仓、已结算交易、盈亏、手工当前价）已接入后端 REST API。
- 交易记录、自选股、交易计划、盘后复盘等页面仍以浏览器 localStorage 为主。
- 后端模式下交易账本读取后端数据；交易记录页的本地新增**不会自动写入后端**（remote 写入后续再做）。
- 本系统不连接券商，不自动同步真实交易，当前价与交易流水均为手工维护，所有盈亏仅用于复盘，不构成投资建议。

后端项目：`/Users/joker/code/quant-trading-assistant`

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
