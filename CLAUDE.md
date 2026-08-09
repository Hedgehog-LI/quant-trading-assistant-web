# CLAUDE.md — Claude Code Instructions for QTA Web

Instructions for Claude Code working in this frontend repository. For AI routing and the shared
governance policy, read `AGENTS.md` and `docs/ai/SKILL_AND_AGENT_GOVERNANCE.md` first.

## Project Overview

Local-first quantitative trading assistant frontend (React 19 + TypeScript 6 + Vite 8 + Ant Design 6).
It records watchlists, trading plans, risk calculations, trade journals, FIFO portfolio accounting,
position snapshots, and post-market reviews. It never auto-trades and never stores real keys.

- Entry points: `src/app/` (routing, layout, providers), `src/pages/` (page orchestration),
  `src/features/` (business modules), `src/shared/` (api, components, types, utils, stores).
- Product facts and module map: `README.md`.

## Working Rules

1. Understand the task before writing code. Read the affected feature module and its tests first.
2. Keep changes inside the affected feature; do not expand scope.
3. Do not call `window.localStorage` in pages or components — use `localStorageClient` from
   `src/shared/api`.
4. Use Ant Design Form/Table/Drawer/Modal; require second confirmation for delete/clear/import-overwrite.
5. Cover `loading`, `empty`, and `error` states on every data view.
6. No `any`. Business enums and options live in the feature `model`.
7. After any code change run all of:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   ```
   Fix failures before reporting done.

## AI Governance

- Skills: canonical `.agents/skills/`, Claude mirror `.claude/skills/` must stay byte-identical
  (`node scripts/sync-ai-skills.mjs`).
- Roles: `.zcode/agents/` are immutable templates; each run is a fresh role instance.
- Machine control file: `docs/development/tasks/<TASK-ID>-CONTROL.json`.
- Gates: `scripts/validate-ai-governance.mjs`, `scripts/check-ai-architecture.mjs`,
  `scripts/check-ai-delivery-ready.mjs`, `scripts/run-ai-governance-gates.mjs`.
- Progressive disclosure: `docs/ai/PROGRESSIVE_DISCLOSURE_PROTOCOL.md`.

## Boundaries

- This is the frontend repo. Do not copy backend business facts or product docs here.
- One implementer, one reviewer, one final verifier; never accept your own work.
- At most two repair rounds per failure fingerprint; then stop and write the blocker.
- No Stop hook; a client-native Goal is the only continuation controller.
- Do not push or merge without explicit instruction.
