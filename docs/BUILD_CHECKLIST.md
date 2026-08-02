# Build Checklist (Frontend)

> 本文件记录前端仓库的构建进度与勾选。跨仓构建状态、后端测试/package、Docker/MySQL 运行时验收
> 以**后端控制仓库** `docs/BUILD_CHECKLIST.md` 为准（本文件不复制后端清单）。

## 1. 状态图例

- `[x]` 已完成并已基本验收。
- `[~]` 已实现但仍需补齐文档、体验、部署或边界。
- `[ ]` 未开始或只停留在设计。

## 2. 前端基础

- [x] React 19 + Vite 8 + TypeScript 6 + Ant Design 6 项目初始化。
- [x] feature-based 目录结构（`features/<name>/{api,components,hooks,model}`、`shared/`、`pages/`、`app/`）。
- [x] ESLint 架构红线：`features/`、`pages/` 禁止直接 localStorage / axios（走 `shared/api/*`）。
- [x] mock / remote 双模式数据层（`shared/api/localStorageClient` + `shared/api/client`）。
- [x] Vitest 单元测试。

## 3. 前端功能模块

- [x] 工作台（`/dashboard`）、自选股、交易计划、风控计算器、交易记录、交易账本、持仓快照、盘后复盘、设置。
- [x] 行情工作台 / 板块 / 采集任务查看页（`/market-workspace`、`/market-segments`、`/market-data`）。
- [x] security-directory D2：共享 `SecuritySelector`（`src/shared/components/SecuritySelector.tsx`）。

## 4. AI 治理接入（前端仓库）

- [x] 治理树字节级移植（`.agents/`、`.zcode/`、`.claude/skills/`、`scripts/`）+ provenance。
- [x] 7 个前端 scoped active docs + skill 引用 stub。
- [x] `node scripts/validate-ai-governance.mjs` 与 `node scripts/run-ai-governance-gates.mjs` 通过。

## 5. 跨仓构建状态

后端测试 / package / Docker / curl / 浏览器验收、API 契约与产品路线图均记录在后端控制仓库
`docs/BUILD_CHECKLIST.md`，不在本仓库复制维护。前端只维护自己的 typecheck/lint/test/build 四门。

## 6. 每轮前端开发检查

- [ ] 页面不直接访问 localStorage，走 `shared/api/localStorageClient`。
- [ ] remote 模式走 `shared/api/client`，不直接 `import 'axios'`。
- [ ] API Key 不进前端。
- [ ] UI 文案不误导用户（localStorage 不是正式数据源）。
- [ ] `npm run typecheck` / `lint` / `test` / `build` 全部通过。
- [ ] 治理树未被本地手编（用 `scripts/sync-governance-from-source.mjs --check` 验证）。
