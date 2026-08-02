# Independent Verification — FRONTEND-GOVERNANCE-BOOTSTRAP-20260802 (web-repo ledger)

- Verifier: FV-WEB-001 (fresh qta-final-verifier, dispatch DISP-FV-WEB-001), session FV-WEB-001-SESSION
- Candidate mode: SNAPSHOT; identity `f36e6cfa7cbb563e38920dcf852d332a4e43ee44ca4efa996015be05114c3ba8` (manifest sha256)
- Baseline: web `0cf382fec889bbecb567fd27064040b3901b9c27`
- Lane: L0 (web-scoped ledger: AC-W1/AC-W2/AC-W3)

## Verdict: ACCEPTED

All 10 frozen tests passed with machine receipts bound to the SNAPSHOT candidate identity; candidate identity unchanged before/after all gates; both required dimensions (STATIC, AUTOMATION) PASS.

## AC results
- AC-W1 (governance gates green): TEST-01 PASS (run-ai-governance-gates 58/58), TEST-04 PASS (validate-ai-governance 0 errors).
- AC-W2 (byte-identical sync + secret safety): TEST-02 PASS (sync-governance-from-source --check 0 byte diffs), TEST-03 PASS (.claude/settings.local.json ignored + untracked + in .gitignore).
- AC-W3 (zero-regression + smoke + architecture): TEST-05a/b/c/d PASS (typecheck/lint/vitest/vite build), TEST-07 PASS (no src/ diff + Smoke-validated), TEST-08b PASS (check-ai-architecture errorCount=0 status=PASS).

## Architecture gate
- check-ai-architecture.mjs --base 0cf382f: errorCount=0, warningCount=0, status=PASS, additions=0, files=0. Report sha256 6ba8d10ee0dc30f42310c80453128cdc2cc989451569a8ca9a615be20a24bdcc.

## Dimensions
- STATIC: PASS — AUTOMATION: PASS — RUNTIME: NOT_REQUIRED — DEPLOYMENT: NOT_REQUIRED

## Candidate integrity
- manifest sha256 unchanged across all 10 receipts; candidateUnchanged=true for all.

## Notes
- TEST-03 gate used spawnSync (check-ignore exit 0, ls-files --error-unmatch nonzero, .gitignore contains the rule).
- TEST-08b arch gate re-run standalone (errorCount=0), report bound via --report-file (the gate's generatedAt timestamp would otherwise mutate the tracked report mid-wrapper).
