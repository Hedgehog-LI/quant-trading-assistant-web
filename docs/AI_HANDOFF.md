# AI Handoff

> 本文件只记录**前端仓库当前接手所需事实**。跨仓历史开发细节见后端控制仓库的
> `docs/development/DEVELOPMENT_LOG.md`；跨仓验收记录见 `docs/acceptance/ACCEPTANCE_LOG.md`。
> 若与代码冲突，以代码、自动化测试、`docs/BUILD_CHECKLIST.md`、后端控制仓库文档为准
>（优先级见 `docs/AI_DEVELOPMENT_INDEX.md §2`）。

## 项目定位

Quant Trading Assistant Web：本地优先的交易辅助前端工作台（自选股 / 计划 / 交易 / 账本 / 持仓快照 /
复盘 / 行情 / 设置）。**不自动交易、不连券商、不存密钥、不承诺收益。**

## 仓库与技术栈

| 仓库 | 路径 | 技术栈 |
| --- | --- | --- |
| 前端（本仓库） | `/Users/joker/code/qta-worktrees/frontend-governance-web` | React 19、Vite 8、TypeScript 6、Ant Design 6、React Router 7、Zustand、TanStack Query、axios（仅经 `shared/api/client`）、decimal.js、dayjs、Vitest |
| 后端 + 跨仓文档 / 治理规范源 | 后端控制仓库 | Java 17、Spring Boot、MyBatis XML、Flyway、MySQL 8.4 |

## 当前状态（2026-08）

- **AI 治理已接入前端仓库**：固定角色、Skill 规范源（`.agents/skills/`）、Hook、机器控制文件、
  独立验收和 delivery-ready 门禁已从后端控制仓库字节级同步；可独立 `/qta-run`。治理树来自控制仓库，
  禁止本地漂移编辑（见 `GOVERNANCE_SOURCE.md`）。
- **P1 功能已上线**：交易账本、持仓快照（草稿/确认/作废/对比/账本对账）、复盘、行情工作台、
  板块、采集任务查看、设置（mock/remote 双模式）。
- **security-directory D2 已交付**：`src/shared/components/SecuritySelector.tsx`
  （+ `SecuritySelector.test.tsx`）共享证券选择器，首批接入最新价、历史日 K、采集计划、板块成员。
  跨仓 D1/D3 后端能力与设计在后端控制仓库。
- **数据模式**：mock（localStorage，前缀 `qta:`）与 remote（REST API → 后端 MySQL）双模式；
  后端地址留空走同源 `/api/v1`。

## 架构红线（与 eslint.config.js 一致）

- `src/features/**`、`src/pages/**` 禁止直接用 `window.localStorage` / `localStorage`，
  必须走 `shared/api/localStorageClient`。
- `src/features/**`、`src/pages/**` 禁止直接 `import 'axios'`，必须走 `shared/api/client`。
- ESLint `no-restricted-syntax` / `no-restricted-imports` 强制；不要关闭或绕过。

## 接手顺序（新会话）

1. 启用 skill `qta-context-bootstrap`（规范源 `.agents/skills/`，分阶段加载上下文）。
2. `AGENTS.md` → `CLAUDE.md` → `docs/AI_DEVELOPMENT_INDEX.md` → 本文件。
3. 按任务类型路由（`AI_DEVELOPMENT_INDEX.md §4`）只读必要文档；Historical 文档（§6）不必读。

## 完成定义（前端）

- `npm run typecheck` / `lint` / `test` / `build` 全部通过。
- 新增 / 修改功能同步更新 `docs/AI_HANDOFF.md` 与 `docs/AI_DEVELOPMENT_INDEX.md` 路由；
  API 变化同步对应 mock/契约（跨仓在后端控制仓库）。
- 未经用户明确要求，**不自动 commit / push / 部署远程**。
