# Plan-candidate overflow boundary has one test

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-26, from branch `calummoore/ci-speed-test-scope-items-9-to-15-and-19-rsi4` (PR #565), test-scope item 12B.
- **Location:** `tests/sidecar_plan_candidates_reference.test.ts`, `tests/helpers/reference_plan_candidates.ts`, `packages/mokly/src/sidecar/plan-candidates.ts:234`.
- **Reason:** The user's test-scope decision removes equivalence proofs, but this proof's removal failed, so the test stays until the user chooses.

- **Terms:**
  - **Collector:** `PlanCandidates` in `packages/mokly/src/sidecar/plan-candidates.ts`. It collects the plan-only candidate names of a captured compile under a charge budget. When a charge does not fit, it sets `overflow`.
- **Background:** `tests/sidecar_plan_candidates_reference.test.ts` compares the collector with a frozen older copy in `tests/helpers/reference_plan_candidates.ts`, in seeded random cases and at the byte-budget overflow boundary. It takes about 2.3 s. On 2026-11-26 the user's test-scope decision 12B removed equivalence proofs.
- **Problem:** The removal proof failed. A change of `bytes > this.room()` to `bytes >= this.room()` in `plan-candidates.ts` failed only this test. So it is the only check of the overflow boundary.
- **Impact if no action:** About 2.3 s of Viewer test time stays.
- **Root question:** How does the overflow boundary of the collector keep its check?
- **Options:**
  - **A.** Keep the reference test. Effort: Small.
  - **B.** Write a boundary test with literal values, then remove the reference test. Effort: Medium.
- **Left out:** Remove the test as it is, because the boundary would then have no test.
- **Wider fix:** None. The removal rule of the `testing` skill already keeps a test whose proof fails.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/plan-candidate-repeat-bounds.md` and `plans/follow-ups/plan-candidate-repeat-overflow.md` change the same collector and name this test. B must keep their cases.
- **Recommendation:** A. The testing rules keep a test when its proof fails, and the saving is 2.3 s.
- **Action:** ask the user, because it is a scope choice under the user's decision 12B.
