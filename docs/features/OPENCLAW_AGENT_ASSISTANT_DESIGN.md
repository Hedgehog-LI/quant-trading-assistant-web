# OpenClaw Agent Assistant Design (Pointer Stub)

> **状态**：前端仓库 pointer stub，用于让 QTA AI 治理 skill 引用路径解析。
>
> **权威来源（authoritative source）**：后端控制仓库 `docs/features/OPENCLAW_AGENT_ASSISTANT_DESIGN.md`
> 与 `docs/decisions/ADR-0011-openclaw-agent-facade-and-tool-boundary.md`。
>
> OpenClaw / QQ 远程只读助手的产品设计、安全边界、后端 `com.quant.trade.agent` 模块、Spring Security
> 鉴权、统一审计 filter、限流、TrustedAnswer 契约、OpenClaw 原生 Tool Plugin（factory 模式 + TypeBox +
> 双超时 + OpenID allowlist）的完整设计均在后端控制仓库维护，本仓库不复制。
>
> 仅当明确属于 OpenClaw / QQ Agent API 场景时，才在父协调器启用 `qta-openclaw-integration` skill；
> API 契约见 `docs/api/AGENT_ASSISTANT_API.md`（同样是 pointer stub，权威来源在后端控制仓库）。
