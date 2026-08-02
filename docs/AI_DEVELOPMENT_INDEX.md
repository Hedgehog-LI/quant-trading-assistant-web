# AI Development Index

> 唯一总入口。Claude Code / Codex / ZCode 接手前端仓库时**先读本文件**，再按任务类型路由。
> 本文件只做导航，不堆细节；详细事实在各专项文档。

## 1. 项目一句话

Quant Trading Assistant Web：本地优先的交易辅助前端工作台（自选股 / 计划 / 交易 / 账本 / 持仓快照 /
复盘 / 行情目录 / 板块 / 采集任务 / 工作台 / 设置）。**不自动交易、不连接券商、不保存密钥、不承诺收益。**
它是后端 Spring Boot 系统的前端，与后端控制仓库共用同一套 QTA AI 治理。

## 2. 信息真实性优先级（冲突裁决顺序，从高到低）

1. **实际代码 + 自动化测试**（最高事实来源：`npm run typecheck/lint/test/build`）
2. `docs/AI_HANDOFF.md`（当前接手事实）+ `docs/BUILD_CHECKLIST.md`
3. 后端控制仓库的 API / DB / 产品设计 / 治理文档（跨仓事实以控制仓库为更高来源）
4. `docs/development/DEVELOPMENT_LOG.md` + `docs/acceptance/ACCEPTANCE_LOG.md`（cross-repo 记录在控制仓库）
5. 历史交接 / 历史提示词（仅参考，**不覆盖当前事实**）

**禁止**用旧聊天或旧文档覆盖当前代码事实。

## 3. 新会话推荐阅读顺序

1. 启用项目 skill：`qta-context-bootstrap`（规范源 `.agents/skills/`；`.claude/skills/` 是生成的镜像）。
2. 读入口：`AGENTS.md` → `CLAUDE.md` → 本文件 → `docs/AI_HANDOFF.md`。
3. 长任务、恢复任务或上下文风险任务再读 `docs/ai/PROGRESSIVE_DISCLOSURE_PROTOCOL.md`。
4. 按下方“任务类型路由”只读必要文档；每次额外读取都说明原因。

## 4. 任务类型路由

| 任务类型 | 必读文档（除入口外） |
| --- | --- |
| 任意前端开发 | `docs/BUILD_CHECKLIST.md`、`docs/DEVELOPMENT_WORKFLOW.md`、`docs/AI_HANDOFF.md`；启用 `qta-frontend-implementation` skill |
| 页面 / 路由 / 交互 | 对应 `src/features/<name>/` 与 `src/pages/<page>.tsx`；`src/shared/api/client`、`localStorageClient` |
| 行情目录 / 证券检索 / `SecuritySelector` | `src/shared/components/SecuritySelector.tsx` + 其测试；跨仓设计在后端控制仓库 `docs/features/SECURITY_DIRECTORY_SEARCH_DESIGN.md` |
| 行情工作台 / 板块 / 采集任务 | `src/pages/market-workspace.tsx`、`market-segments.tsx`、`market-data.tsx`；跨仓 API 契约在后端控制仓库 |
| 后端联调 / API 变化 | `src/shared/api/client.ts`、`unwrappers.ts`；跨仓 API 索引与 mock 契约在后端控制仓库（`docs/api/`、`docs/mock/MOCK_REMOTE_CONTRACT.md`） |
| 标准 / 长任务 / 跨仓库 / 高风险闭环 | 当前 git baseline；父上下文启用 `qta-development-orchestration`（或 `/qta-run`），并用 `qta-task-contract` 冻结契约 |
| OpenClaw / QQ 远程助手 | 跨仓设计在后端控制仓库 `docs/features/OPENCLAW_AGENT_ASSISTANT_DESIGN.md`、`docs/api/AGENT_ASSISTANT_API.md`；仅明确 OpenClaw/QQ 时启用 `qta-openclaw-integration` |
| 长任务断点 / 上下文压缩 / 跨工具交接 | 当前任务契约、diff、验证证据；启用 `qta-task-checkpoint` skill |
| 独立测试验收 | 当前任务契约、冻结 diff、实现者自检证据、`docs/acceptance/ACCEPTANCE_LOG.md`；在未参与实现的干净上下文启用 `qta-independent-verification` skill |
| 交付与文档收口 | 独立验收报告、最终 diff、受影响的唯一事实来源；启用 `qta-delivery-finalization` skill |

## 5. 单一事实来源映射（避免多份维护同一事实）

| 事实 | 唯一来源 |
| --- | --- |
| 前端当前接手事实 | `docs/AI_HANDOFF.md`（精简，历史进 `docs/development/DEVELOPMENT_LOG.md`） |
| 前端构建进度 / 勾选 | `docs/BUILD_CHECKLIST.md` |
| 前端开发流程与同步规则 | `docs/DEVELOPMENT_WORKFLOW.md` |
| AI 渐进式加载 / 轻量交接协议 | `docs/ai/PROGRESSIVE_DISCLOSURE_PROTOCOL.md` |
| Skill / Agent 职责、触发、权限与维护 | `docs/ai/SKILL_AND_AGENT_GOVERNANCE.md` |
| 活跃 AI 任务生命周期、角色实例、预算和候选身份 | `docs/development/tasks/<TASK-ID>-CONTROL.json` |
| 治理规范源 / 同步方案 | `GOVERNANCE_SOURCE.md`（治理树字节级来自后端控制仓库） |
| API / DB / 产品设计 / 架构决策 / OpenClaw | 后端控制仓库（跨仓事实以控制仓库为更高来源；本仓库仅保留 pointer stub） |
| 跨仓开发历史 / 验收记录 | 后端控制仓库 `docs/development/DEVELOPMENT_LOG.md`、`docs/acceptance/ACCEPTANCE_LOG.md` |

## 6. Historical 文档（仅参考，不在主流程）

当前前端仓库为新建治理，尚无标 Historical 的文档（none yet）。后续若产生仅排查历史时参考的文档，
将在此列出；新会话**不必读**，仅排查历史时参考。

## 7. 完成定义

**前端**：`npm run typecheck` / `lint` / `test` / `build` 全部通过；遵守 ESLint 架构红线
（`features/`、`pages/` 不得直接用 localStorage 或 axios）；文案不误导用户把 localStorage 当正式数据源。

**所有任务结束**：实现结束只记为 `SELF_CHECKED`；独立验收通过后才按 `docs/DEVELOPMENT_WORKFLOW.md`
执行交付文档同步。长任务、中断任务或跨会话任务必须使用 `qta-task-checkpoint` 写轻量交接。
