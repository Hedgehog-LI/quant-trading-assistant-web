# Skill And Agent Governance

> 本文是前端仓库的 Skill、固定 Agent、父协调流程、证据身份、成本预算和 Git 阶段门禁的唯一事实来源。
> Skill 定流程，Agent 模板定角色，父协调器定顺序，Hook/脚本定强制约束，机器控制文件负责跨对话记忆。
> 当前控制协议为 schema v3；本地仍是 `ADVISORY` 防误操作边界，不冒充平台级安全隔离。
>
> **治理规范源同步模型**：本仓库的治理树（`.agents/`、`.zcode/`、`.claude/skills/`、治理 `scripts/`）
> 字节级来自后端控制仓库，禁止本地漂移编辑（见 `GOVERNANCE_SOURCE.md` 与 `docs/DEVELOPMENT_WORKFLOW.md §3`）。
> 修改 Skill/Agent 必须先改后端控制仓库规范源，再用 `scripts/sync-governance-from-source.mjs` 同步。

## 1. 目录与兼容策略

- `.agents/skills/`：十个项目 Skill 的规范源，ZCode 和 Codex 从这里发现项目 Skill（**字节级同步，禁止手编**）。
- `.agents/skill-manifest.json`：静态启发式路由策略，不是模型真实触发器。
- `.agents/skill-evals/trigger-cases.json`：静态精确集合回归用例。
- `.claude/skills/`：Claude 兼容镜像，由 `scripts/sync-ai-skills.mjs` 生成，内容必须与规范源一致（**禁止手编**）。
- `.zcode/agents/`：四个项目级固定 ZCode 角色模板（**字节级同步，禁止手编**）。
- `.zcode/commands/qta-run.md`：显式父协调入口 `/qta-run`。
- `.zcode/config.json`：项目级 ZCode Hook，启用通用危险操作前置拦截。
- `docs/development/tasks/`：任务契约、状态、角色 artifact 和验收报告。
- `docs/development/tasks/<TASK-ID>-CONTROL.json`：生命周期和预算的机器事实源。
- `scripts/evaluate-skill-triggers.mjs`：启发式静态路由 lint，不代表模型真实选择结果。
- `scripts/validate-ai-governance.mjs`：结构、镜像、元数据和角色策略静态校验。
- `scripts/check-ai-task-control.mjs`：任务状态、角色实例、候选身份和 verdict 不变量校验。
- `scripts/check-ai-architecture.mjs`：变更文件规模、职责和分层风险门禁。
- `scripts/run-ai-evidence-command.mjs`：低噪声执行冻结验证命令并生成角色/session/候选绑定回执。
- `scripts/check-ai-delivery-ready.mjs`：Goal 唯一完成门禁，检查角色来源、机器证据、Git 跟踪和脏路径。
- `scripts/zcode-governance-hook.mjs`：ZCode 通用危险操作前置拦截。
- `scripts/sync-governance-from-source.mjs`：从后端控制仓库字节级同步治理树（本仓库本地新增，非 byte-identical 集）。
- `.git/qta-governance/`：Hook 生成的 session 首见回执、固定角色 dispatch 回执与控制文件哈希链；
  不入库、禁止角色直接访问。

## 2. 十个 Skill 的边界

| Skill | 负责 | 不负责 |
|---|---|---|
| `qta-context-bootstrap` | 最小上下文、任务分类、单阶段路由 | 实现、测试、验收 |
| `qta-development-orchestration` | 父级 lane、状态机、角色顺序、Git 门禁 | 充当任何子角色 |
| `qta-product-design` | 产品行为、业务口径、范围、AC 草案 | 写代码、判定交付 |
| `qta-task-contract` | 冻结范围、AC、证据、角色、停止条件 | 实现 |
| `qta-backend-implementation` | 后端实现与自检 | 独立验收 |
| `qta-frontend-implementation` | 前端实现与自检 | 独立验收 |
| `qta-openclaw-integration` | OpenClaw 安全和领域约束叠加 | 泛化 Agent/专家团任务 |
| `qta-task-checkpoint` | 进度、证据、阻塞、下一步存档 | 宣称完成 |
| `qta-independent-verification` | 干净上下文独立验收 | 修复代码或普通审查 |
| `qta-delivery-finalization` | 验收后的文档、看板、部署交底 | 绕过验收或修复代码 |

运行时一次选择一个 lifecycle stage，可额外选择一个 domain overlay；父协调器是 controller，不是
lifecycle stage。

## 3. 固定角色与持久化

| Agent | 上下文 | 工具边界 | 输出 |
|---|---|---|---|
| `qta-test-designer` | 干净 | 只读、不执行命令 | 可证伪 AC、测试矩阵、契约 amendment artifact |
| `qta-implementer` | 独立实现上下文 | `bypassPermissions` 无人值守；可读写、自测，不可 Git/子代理 | 代码、自检、变更清单、候选提交建议 |
| `qta-code-reviewer` | 干净 | 只读、不执行命令 | 绑定 candidate hash 的 findings 或 `REVIEW_CLEAR` |
| `qta-final-verifier` | 干净临时 worktree | `bypassPermissions` 无人值守；无 Edit/Write，仅 Bash 门禁与脚本回执 | 逐 AC 证据、前后 hash、唯一验收结论 |

固定 Agent 是不可变模板，不是可反复续聊的实例。初始实现、每轮 repair、每代 review 和最终
verification 都创建新的 `role_run_id + session_id`，返回 artifact 后立即结束。每个角色只接收
TaskPacket，不接收完整聊天历史。任何角色都禁止创建子 Agent。

`executorType`、Agent 定义、能力和执行结果是结构化字段。父协调器替代实施者/审查者/核验者时只能
记录 `POLICY_VIOLATION`，不能接收 artifact。每次已发起的 timeout、plan-only、failed、cancelled
尝试均以终态事件追加，不能在压缩或交接时省略。两个同 slice timeout 后必须 `BLOCKED` 并重新切片。

`/qta-run` 是无人值守交互边界：active parent 的 `AskUserQuestion` 被 Hook 阻断；可逆工程选择采用
推荐项，产品/金融含义、破坏性授权、凭据或外部依赖确实无法安全继续时，父协调器必须写入 `BLOCKED`。
`bypassPermissions` 只移除 implementer 和 final verifier 的 Bash 审批，不扩大工具白名单、写路径、
Git 权限或任务范围。

本地 Hook、回执和 `.git` 哈希链用于防误操作、漂移和普通重写，不能抵抗拥有同一 macOS 用户任意 Bash
权限的恶意代码；因此控制文件一律记录 `ADVISORY`，严禁把本地证据写成 `ENFORCED`。

## 4. 父协调状态机

显式长任务优先使用 `/qta-run <任务或契约路径>`。Lane 按风险而不是耗时选择：L0（≤3 AC，文档/机械
低风险）、L1（≤5 AC，单模块）、L2（≤8 AC，migration/事务/兼容/provider/性能）、L3（≤10 AC，资金/
鉴权/跨仓/不可逆）。状态必须顺序迁移：

```text
CONTEXT_READY -> CONTRACT_DRAFTED -> TEST_DESIGN_READY -> CONTRACT_FROZEN
-> IMPLEMENTING -> SELF_CHECKED -> CANDIDATE_FROZEN -> REVIEW_CLEAR
-> VERIFIED -> FINALIZED -> DELIVERY_READY
```

`VERIFIED` 同时要求 `FUNCTIONAL=PASS` 和 `ARCHITECTURE=PASS`。同一 failure fingerprint 最多两轮修复。
父协调者必须持续到 `DELIVERY_READY`、`BLOCKED` 或用户明确停止；`FINALIZED` 只说明交付文档已整理。

初始实现必须在契约中拆成 bounded slice：每个 slice 最多 3 个 AC、8 个预期文件、500 行生产代码增量。
父协调器只组装状态和 Git，不写业务实现。

## 5. Git、Commit 和 Push

父协调者是唯一 Git owner，子角色不得 stage、commit、rebase、merge 或 push。每个固定角色派发的
TaskPacket 必须以两行机器契约开头（`# Task Packet: <TASK-ID> / <ROLE> / <ROLE-RUN-ID>` +
`- Dispatch ID: <DISPATCH-ID>`）。

阶段提交：`contract` → `candidate` → `repair-N` → `finalization`。每次提交前检查 staged 路径只属于当前
TaskPacket，不含密钥、`.env` 或运行产物。`checkpoint push` 仅备份任务分支；`delivery push` 只能推送
未变化的 accepted candidate + finalization。禁止自动直推受保护/default 分支、force push，禁止把 push
失败写成成功。

## 6. 当前静态维护门禁

修改治理树必须先在后端控制仓库改规范源，再用 `scripts/sync-governance-from-source.mjs` 同步到本仓库，
然后运行：

```bash
node scripts/evaluate-skill-triggers.mjs
node scripts/validate-ai-governance.mjs
node scripts/run-ai-governance-gates.mjs
```

前端额外门禁：`npm run typecheck` / `lint` / `test` / `build`。这些静态门禁不能替代下一阶段的 Hook、
真实角色调用和真实模型触发测试。前端验收还需独立 verifier 在 disposable worktree 中运行，前后 tracked
tree 必须不变；实现者最高只能标记 `SELF_CHECKED`。

避免假绿灯：AC 在实现前冻结，不能由实现者在失败后降低；测试数量、构建成功不能单独证明业务 AC；
Reviewer 和 verifier 检查相同 candidate/hash generation；两轮同因失败后停止并 checkpoint。
