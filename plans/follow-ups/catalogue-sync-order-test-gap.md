# Catalogue sync test skips request order

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the final review of the deleted Stripe catalogue sync plan. That review reported it on 2026-09-27 as its Low finding, and nobody applied it. Its text comes from the billing branch's merge reviews before PR #19 merged, which named it again.
- **Location:** `xtask/tests/cli/stripe_catalogue/sync_tests.rs:98`, `xtask/src/stripe_catalogue/apply.rs:145`.
- **Reason:** It is a missing-test finding, and missing-test findings wait for the user.
- **Category:** Test.

- **Terms:**
  - **Predecessor:** The old seat price that a catalogue sync replaces. The sync first repairs its seat metadata, then creates the replacement, which takes over the lookup key.
  - **Stripe double:** The local HTTP server that the `xtask` command tests use in place of Stripe. It records each request.
- **Background:** `reconcile_price` in `xtask/src/stripe_catalogue/apply.rs` repairs a drifted predecessor before it creates the replacement price. The order matters: the repair must succeed before the lookup key moves.
- **Problem:** The test `drifted_predecessor_is_repaired_before_replacement` checks the report lines and the final Stripe state only. It does not check that the repair request comes before the create request, or that a refused repair stops the create.
- **Impact if no action:** A refactor could move the lookup key before the repair, and the test would still pass.
- **Root question:** How does the test suite prove that the repair always comes before the replacement?
- **Options:**
  - **A.** In the existing command test, assert the recorded request order of the Stripe double. Add a case where the double refuses the repair and no create request follows. Effort: Small.
  - **B.** Add a focused unit test of the reconcile step with ordered mock expectations. Effort: Small.
- **Left out:** Changing nothing keeps the gap.
- **Wider fix:** None. The double already records requests, so a direct test closes the gap.
- **Previous examples:** None found.
- **Related:** [`plans/follow-ups/unidentified-review-findings-need-verification.md`](https://github.com/mokly-ai/mokly-cloud/blob/10834d30c83cb54b5bdfdb719b99b98febf56fd0/plans/follow-ups/unidentified-review-findings-need-verification.md) listed this finding without its text until 2026-11-01.
- **Recommendation:** A. It uses the existing double and tests the real command path.
- **Action:** ask the user, because condition 6 holds: missing-test findings wait for the user.
