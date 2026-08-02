# Development Workflow

> 定义前端仓库从需求到交接的标准流程，以及每阶段必须读 / 必须更新的文档。
> **AI 开发结束后必须执行“开发结束文档同步检查”。** 跨仓 API/DB/产品/治理事实以后端控制仓库为更高来源。

## 1. 日常开发流程

### 1.0 上下文加载

- **Level 1 必读**：`AGENTS.md` + `CLAUDE.md` + `docs/AI_DEVELOPMENT_INDEX.md` + `docs/AI_HANDOFF.md`
  + `git status --short`。
- **条件读取**：长任务、恢复任务或上下文风险任务再读 `docs/ai/PROGRESSIVE_DISCLOSURE_PROTOCOL.md`。
- **先产出**：本轮 Task Context Manifest（任务类型、影响模块、必读文档、禁止读取范围、计划验证命令）。
- **Skill**：启用 `qta-context-bootstrap`；本阶段只读和路由，不改代码、不判定完成。

### 1.1 开发与自检

- **前端约定**：feature-based（`features/<name>/{api,components,hooks,model}`）；mock/remote 双模式；
  不用 `any`；覆盖 loading/empty/error/validation/network/retry/permission 状态；盈利红亏损绿。
- **架构红线**：`src/features/**`、`src/pages/**` 不得直接用 `window.localStorage` / `localStorage`
  （走 `shared/api/localStorageClient`），不得直接 `import 'axios'`（走 `shared/api/client`）。
- **角色边界**：实施者可实现和运行自测，但只能标记 `SELF_CHECKED`，不得给出最终验收结论。
- **断点**：阶段完成、重复失败、外部阻塞或达到上下文预算时启用 `qta-task-checkpoint`。

### 1.2 提交前门禁

每次提交前必须通过前端四门：

```bash
npm run typecheck   # tsc -b --noEmit
npm run lint        # ESLint（含架构红线）
npm run test        # Vitest run
npm run build       # tsc -b && vite build
```

任一失败不得提交。新增功能必须有针对性测试覆盖核心场景与边界。

### 1.3 任务契约（非简单任务）

- 使用 `qta-task-contract` 冻结范围、非目标、AC、证据、验证维度、角色和停止条件。
- 标准/长任务由父上下文启用 `qta-development-orchestration` 或 `/qta-run`，选择 L0-L3 风险 lane 并冻结
  `contract_hash`；子角色只接收 TaskPacket。
- `/qta-run` 是无人值守流程：禁止 `AskUserQuestion`；可逆工程选择自动采用推荐项，产品/金融含义、
  破坏性操作、凭据授权或外部依赖确实无法安全继续时，必须持久化 `BLOCKED`。
- 父协调者创建 `<TASK-ID>-CONTROL.json`，每次角色派发和状态迁移前运行
  `node scripts/check-ai-task-control.mjs <control-file>`。

### 1.4 独立验收

- 必须由未参与实现的干净上下文执行 `qta-independent-verification`；验收者不得修复生产代码。
- 前端：`npm run typecheck` / `lint` / `test` / `build`；按任务契约分别记录
  `STATIC/AUTOMATION/RUNTIME/DEPLOYMENT`，未执行是 `NOT_VERIFIED`，环境缺失是 `BLOCKED`。
- 同时记录 `FUNCTIONAL/ARCHITECTURE`；二者都通过才可验收。

### 1.5 交付收口

- 只有独立验收允许交付后才启用 `qta-delivery-finalization`。
- 更新 `docs/AI_HANDOFF.md`（只保留当前接手事实，历史进 `docs/development/DEVELOPMENT_LOG.md`）。
- 父协调者创建 `finalization` 提交；只有 accepted revision 才能 delivery-push，
  禁止自动直推受保护/default 分支。

## 2. 开发结束文档同步检查（必做）

开发完成后逐项确认（**有变化才更新**）：

| 检查项 | 触发条件 | 必须更新的文档 |
| --- | --- | --- |
| 前端功能新增 / 状态 / 优先级变化 | 是 | `docs/AI_HANDOFF.md` + `docs/AI_DEVELOPMENT_INDEX.md`（路由）+ `docs/BUILD_CHECKLIST.md` |
| 前端路由 / feature 入口变化 | 是 | `docs/AI_DEVELOPMENT_INDEX.md §4` 路由表 |
| API 联调变化（新增/修改/删除接口） | 是 | 对应 mock / 契约；跨仓 API 索引与 mock 在后端控制仓库（`docs/mock/MOCK_REMOTE_CONTRACT.md` 若本仓库存在则同步） |
| 跨仓设计 / API / DB / 产品文档变化 | 是 | 后端控制仓库对应文档（前端不复制） |
| 跨会话接力 / 任务中断 / 上下文过大 | 是 | `docs/development/DEVELOPMENT_LOG.md`（本仓库 stub，跨仓详细记录在后端控制仓库） |

## 3. 治理同步规则（重要）

本前端仓库的治理树来自后端控制仓库，**字节级同步**，禁止本地漂移编辑：

- 治理树（byte-identical set，**禁止手编**）：`.agents/`、`.zcode/`（不含 session-local `.zcode/plans/`）、
  `scripts/`（不含 `scripts/sync-governance-from-source.mjs`）、`.claude/skills/`（生成镜像）。
- 重新同步通过 `scripts/sync-governance-from-source.mjs`：

  ```bash
  node scripts/sync-governance-from-source.mjs --source <control-repo-path> --baseline 563e84a
  # 仅校验不写入：
  node scripts/sync-governance-from-source.mjs --check --source <control-repo-path> --baseline 563e84a
  ```

- `.claude/skills/` 镜像由 `scripts/sync-ai-skills.mjs` 重新生成（同步脚本会自动调用）。
- 本地手写的只有：`AGENTS.md`、`CLAUDE.md`、`docs/**`、`GOVERNANCE_SOURCE.md`、`.gitignore`。
- 任何对治理树的手编都是 drift violation，会被 `--check` 拒绝。修改 Skill / Agent 必须先改后端
  控制仓库规范源，再同步；禁止在本仓库直接改 `.agents/`、`.zcode/`、`.claude/skills/`、治理 `scripts/`。
- Provenance 与最后一次同步见 `GOVERNANCE_SOURCE.md`。

## 4. 禁止

- 把未实际执行的验证写成通过。
- 用旧聊天或旧文档覆盖当前代码事实（冲突时按 `docs/AI_DEVELOPMENT_INDEX.md §2` 优先级裁决）。
- 关闭或绕过 ESLint 架构红线（localStorage / axios 限制）。
- 本地手编治理树（`.agents/`、`.zcode/`、`.claude/skills/`、治理 `scripts/`）。
- 由同一个上下文完成实现、修改测试、修复缺陷并给自己最终验收通过。
- 子角色 stage/commit/push，或父协调者把未验收的 checkpoint push 描述为可部署交付。
- 验证失败后无上限地循环修复；同一 failure fingerprint 最多两轮，第二轮仍失败且无新证据时写明阻塞原因。
