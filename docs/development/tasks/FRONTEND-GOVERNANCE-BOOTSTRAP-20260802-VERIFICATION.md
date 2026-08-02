# Independent Verification — FRONTEND-GOVERNANCE-BOOTSTRAP-20260802 (web-repo ledger)

- Verifier: FV-RUN-001 (fresh qta-final-verifier, dispatch DISP-FV-001), session FV-RUN-001-SESSION
- Candidate: web `16292dd15f5036ee8ab39fe95be36d715c920c6d` (tree `377a2dc42c43eadf0f3cec9d495d8927718229b1`)
- Baseline: web `0cf382fec889bbecb567fd27064040b3901b9c27`
- Lane: L2 (web-scoped ledger: AC-01/02/03/04/05/07/08)

## Verdict: ACCEPTED (web-repo scope)

This web-repo control ledger tracks the frontend governance-bootstrap candidate `16292dd`. The candidate is the work product committed on branch `codex/frontend-governance-bootstrap-20260802`. All web-scoped ACs pass with machine receipts produced by FV-RUN-001 in this repo (candidateIdentity = web HEAD).

## AC results (web scope)
- AC-01 PASS — TEST-01 receipt: `node scripts/run-ai-governance-gates.mjs` exit 0, "QTA AI governance gates passed.", 58/58 tests.
- AC-02 PASS — TEST-02 receipt: `node scripts/sync-governance-from-source.mjs --check --source <control> --baseline 563e84a` exit 0, "0 byte diffs".
- AC-03 PASS — TEST-03 receipt: .gitignore has 4 rules; check-ignore exit 0; ls-files untracked; no .env in diff; env still tracked.
- AC-04 PASS — TEST-04 receipt: `node scripts/validate-ai-governance.mjs` exit 0, "AI governance validation passed: 10 skills, 4 agents.".
- AC-05 PASS — TEST-05a/b/c/d receipts: typecheck/lint/test(303)/build all exit 0; src/** empty diff.
- AC-07 PASS — TEST-07 receipt: smoke dimension; business-impact = GOVERNANCE_SOURCE.md only; frontend ran full /qta-run loop.
- AC-08 PASS — TEST-08b receipt: check-ai-architecture.mjs errorCount=0, status=PASS (report sha256 6ba8d10ee0dc30f42310c80453128cdc2cc989451569a8ca9a615be20a24bdcc).

## Dimensions
- STATIC: PASS (AC-03, AC-04) — AUTOMATION: PASS (AC-01,02,05,07,08) — RUNTIME: NOT_REQUIRED — DEPLOYMENT: NOT_REQUIRED

## Architecture gate
- check-ai-architecture.mjs --base 0cf382f --candidate-identity 16292dd --json-output report: exit 0, errorCount=0, warningCount=0, status=PASS, files=[], additions=0.

## Candidate integrity
- candidateBefore.head = candidateAfter.head = 16292dd; candidateUnchanged=true across all 10 receipts.

## Note on dispatch receipts
The fixed-role dispatches (TD/IMPL x4/CR/FV) for this task were executed from the parent session whose ZCODE_PROJECT_DIR points at the backend control repo, so the governance Hook recorded their dispatch receipts in the control repo's `.git/qta-governance/` store, not this web repo's. This web-repo ledger therefore cannot satisfy the `dispatchAuditErrors` cross-check locally; the dispatch receipts are reconciled in the control-repo ledger (same task ID, same dispatch IDs). The evidence receipts (TEST-*.receipt.json) ARE produced in and bound to this web repo.
