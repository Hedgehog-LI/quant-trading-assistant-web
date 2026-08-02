# Task Contract: FRONTEND-GOVERNANCE-BOOTSTRAP-20260802 (web-repo ledger)

## Contract Identity
- Status: FROZEN
- Contract version: 1 (web-repo ledger split from the cross-repo contract; web scope only)
- Frozen at: 2026-08-02T16:30:00Z
- Lane: L2

## Objective (web scope)
Deliver and verify the independent `/qta-run` AI governance bootstrap in the frontend web repo: byte-identical governance scaffolding ported from the backend control repo, single-source-of-truth sync model, frontend-scoped docs, and a real L1 smoke lifecycle — all verifiable against the web candidate commit `16292dd`.

## Authority
- Baseline commit: 0cf382fec889bbecb567fd27064040b3901b9c27 (web main)
- Baseline branch: codex/frontend-governance-bootstrap-20260802
- Candidate commit: 16292dd15f5036ee8ab39fe95be36d715c920c6d
- Governance source: backend control repo frontend-governance-control @ 563e84a

## Acceptance Criteria (web scope)
- AC-01: run-ai-governance-gates.mjs green (AUTOMATION)
- AC-02: sync-governance-from-source.mjs --check 0 byte diffs (AUTOMATION)
- AC-03: .gitignore rules + no secrets staged (STATIC)
- AC-04: validate-ai-governance.mjs 0 errors (STATIC)
- AC-05: npm typecheck/lint/test/build green, src/ empty diff (AUTOMATION)
- AC-07: L1 smoke lifecycle DELIVERY_READY (AUTOMATION)
- AC-08: check-ai-architecture.mjs errorCount=0 (AUTOMATION)

## Verification Plan
STATIC=Yes, AUTOMATION=Yes, RUNTIME=No, DEPLOYMENT=No.

## Role Assignments
All four fixed roles ran in fresh sessions for the cross-repo task; this web ledger binds the FINAL_VERIFIER (FV-RUN-001) evidence to the web candidate.
