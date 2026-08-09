# AGENTS.md — Quant Trading Assistant Web

This file routes AI agents (Claude / ZCode / Codex) to the right context, role, and gates for this
frontend repository. It is the frontend-specific overlay on top of the shared governance policy in
`docs/ai/SKILL_AND_AGENT_GOVERNANCE.md`.

## What This Repo Is

A local-first quantitative trading assistant frontend. It is a personal trading workbench that helps
write watchlists, trading plans, risk checks, trade journals, portfolio FIFO accounting, position
snapshots, and post-market reviews. It does not auto-trade, does not connect to brokers, and does not
store real keys.

- Stack: React 19, TypeScript 6, Vite 8, Ant Design 6, React Router 7, Zustand, TanStack Query,
  decimal.js, dayjs, Vitest. `axios` is used only inside `src/shared/api`.
- Data modes: local (`mock`, browser localStorage with `qta:` prefix) and remote (`remote`, REST API).
  The mode is read per request from settings, so switching needs no refresh.
- Product facts, module map, and run instructions: see `README.md`.

## Session Start Checklist (Level 1)

```text
AGENTS.md
CLAUDE.md
README.md
git status --short
```

Then decide the task type and affected module before reading more. See
`docs/ai/PROGRESSIVE_DISCLOSURE_PROTOCOL.md` for the full routing and budget rules.

## Frontend Architecture Rules

- Feature-based structure under `src/features/*/` with `model` / `api` / `hooks` / `components`.
- `src/pages/` only orchestrates pages; business logic stays in `src/features/*/hooks`.
- `src/shared/api` owns all HTTP (`axios`) and localStorage access via `localStorageClient`.
  Pages and components must not call `window.localStorage` directly.
- `src/shared/` holds generic components, types, utils, and Zustand stores.
- Use Ant Design `Form` for forms and Ant Design `Table` for tables. Add/edit via Drawer or Modal.
- Delete, clear, and import-overwrite actions require a second confirmation.
- Pages must handle `loading`, `empty`, and `error` states.
- Do not build marketing/hero/landing pages.
- TypeScript without `any`; business enums and options live in the feature `model`.

## Build and Verification Commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Run all four for any React change. `npm run dev` starts the Vite dev server on
http://localhost:5173 (bind `localhost`, not `127.0.0.1`). Do not change the default proxy target in
`vite.config.ts`; override via `.env.local` when needed.

## AI Governance for This Repo

- Skills: canonical source in `.agents/skills/` (8 skills). Claude mirror lives in `.claude/skills/`
  and must stay byte-identical; run `node scripts/sync-ai-skills.mjs` after any skill edit.
- Fixed ZCode roles: `.zcode/agents/` (test-designer, implementer, code-reviewer, final-verifier).
  Treat templates as immutable; each lifecycle invocation is a fresh, disposable role instance.
- Machine control file: `docs/development/tasks/<TASK-ID>-CONTROL.json`, validated by
  `scripts/check-ai-task-control.mjs`. Runtime artifacts (`.qta-governance/`, candidate patches) are
  git-ignored and never committed.
- Governance gates:
  - `scripts/validate-ai-governance.mjs` — structure, mirror, metadata, role-policy checks.
  - `scripts/check-ai-architecture.mjs` — module size, responsibility, layering gate.
  - `scripts/evaluate-skill-triggers.mjs` — static trigger routing regression cases.
  - `scripts/check-ai-delivery-ready.mjs <control-file>` — explicit delivery gate, exit 0 required.
  - `scripts/run-ai-governance-gates.mjs` — combined gate suite.
- Full policy, role boundaries, and lifecycle rules: `docs/ai/SKILL_AND_AGENT_GOVERNANCE.md`.

## Explicit Boundaries

- This repo owns frontend product facts and docs. Do not copy backend business facts, API reference
  documents, or database design into this repo's AI documentation.
- A single agent is responsible for one implementation slice. One implementer, one independent
  reviewer, and one final verifier must stay distinct role instances; the implementer never accepts
  its own work.
- Same failure fingerprint: at most two numbered repair rounds. Stop and write the blocker if the
  second round still fails without new evidence.
- Context budget: 25% freeze discoveries, 40% checkpoint before new workstreams, 60% handoff to a
  clean context. First automatic compaction requires an immediate checkpoint and role end.
- No Stop hook is registered; a client-native Goal is the only continuation controller. Never start
  an unrequested follow-up loop.
- Never push or merge without explicit instruction from the human owner.
