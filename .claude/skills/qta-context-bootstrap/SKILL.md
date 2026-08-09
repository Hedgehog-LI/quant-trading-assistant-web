---
name: qta-context-bootstrap
description: Use at the start or resume of a Quant Trading Assistant task to load minimal authoritative context, classify the request, and route one lifecycle stage. This is read-only and never implements, tests, reviews, or finalizes work.
when_to_use: Start a new QTA conversation, resume a checkpoint, recover from compaction, or clarify repository and task scope. Do not repeat it in an unchanged active task.
---

# QTA Context Bootstrap

## Purpose

Establish a small, trustworthy context before any design, implementation, review, or delivery work.
This skill is a read-only router. It must not edit code, change task status, or claim acceptance.

## Trigger Conditions

Invoke this skill when any of the following is true:

- A new conversation starts in either QTA repository.
- Context was compressed, cleared, or handed off.
- The user asks to continue, resume, inspect current progress, or determine the next task.
- The current task type, authoritative documents, or repository boundary is unclear.

Do not invoke it repeatedly in the same task unless the task scope changes or context is lost.

## Progressive Loading

### Level 1: Always Read

1. `AGENTS.md`
2. `CLAUDE.md`
3. `README.md`
4. `git status --short`

If the task touches the backend, also read the backend repository's `AGENTS.md`, handoff, and status.
Read `docs/ai/PROGRESSIVE_DISCLOSURE_PROTOCOL.md` only when the task is long-running, resumed, or at risk of
context growth.

### Level 2: Read by Task Type

- Product/design: the relevant feature design and product roadmap.
- Frontend: feature source, API client contract, route, and frontend conventions.
- Cross-repository: read only the backend module source and API contract the task actually touches.
- Review/acceptance: task contract, `<TASK-ID>-CONTROL.json`, frozen diff, test evidence, and acceptance log.

### Level 3: Read Only When Referenced

Read linked architecture decisions, provider documents, deployment notes, or historical decisions only when
the Level 2 material points to them or a concrete conflict requires them.

### Level 4: Historical Material

Do not load archived reports, historical handoffs, or old plans by default. They are evidence only, not
current truth.

## Task Classification

Classify the request into one primary stage:

1. Requirement/design
2. Task contract
3. Frontend implementation
4. Checkpoint/handoff
5. Independent verification
6. Delivery finalization

Route to exactly the skills needed for that stage. Domain overlays supplement a lifecycle skill; they do not
replace it.

## Required Output

Before substantial work, state:

- Current task
- Task type and repository scope
- Affected module
- Authoritative documents loaded
- Documents that may be read only if needed
- Explicitly prohibited reading scope
- Current baseline and dirty-worktree risks
- Active task control validation result when resuming a governed task
- Skill(s) to invoke next
- Planned edits and verification
- Checkpoint/handoff target

Keep this digest concise. Do not paste entire documents into the conversation.

## Stop Conditions

Stop and report a conflict when:

- Two active documents disagree on current facts.
- An active machine control file is invalid or contradicts the prose task state.
- The requested scope cannot be isolated from unrelated dirty changes.
- A required repository or task contract is missing.

Otherwise route immediately to the next skill.
