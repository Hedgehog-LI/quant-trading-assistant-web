# Development Log (Frontend)

> 按时间记录前端仓库自身的开发里程碑（产品/架构/功能/缺陷/契约/治理的实质变化）。
> 普通问答 / 只读检查 / 错别字不追加。
>
> **跨仓开发历史**：OpenClaw、后端 D1/D3、行情 provider、板块采集、LongPort、治理收口等跨仓任务的
> 完整开发历史保存在**后端控制仓库** `docs/development/DEVELOPMENT_LOG.md`，本仓库不复制。
> 本文件仅记录前端仓库自身的开发条目。

---

## 2026-08-02 — 前端 AI 治理接入（SLICE-02 active docs）

- 新增前端 scoped active docs：`AGENTS.md`、`CLAUDE.md`、`docs/AI_DEVELOPMENT_INDEX.md`、
  `docs/AI_HANDOFF.md`、`docs/DEVELOPMENT_WORKFLOW.md`、`docs/ai/PROGRESSIVE_DISCLOSURE_PROTOCOL.md`、
  `docs/ai/SKILL_AND_AGENT_GOVERNANCE.md`。
- 新增 skill 引用 pointer stub：`docs/BUILD_CHECKLIST.md`、`docs/acceptance/ACCEPTANCE_LOG.md`、
  `docs/api/AGENT_ASSISTANT_API.md`、`docs/features/OPENCLAW_AGENT_ASSISTANT_DESIGN.md`、本文件。
- 新增目录占位：`docs/development/tasks/.gitkeep`、`docs/prompts/.gitkeep`。
- 前端 active docs 不复制后端 50+ 文档；跨仓事实指向后端控制仓库为更高来源。
- 治理树（`.agents/`、`.zcode/`、`.claude/skills/`、`scripts/`）由 SLICE-01 字节级移植，禁止本地手编。
- 自检：`node scripts/validate-ai-governance.mjs` 与 `node scripts/run-ai-governance-gates.mjs` 通过。
