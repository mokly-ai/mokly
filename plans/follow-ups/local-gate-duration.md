# Keep the local gate within its run limit

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** None. This item changes the local executor process.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** performance.
- **Background:** The local executor detaches a gate after 120 minutes. One gate took 114 minutes, and one batch took 86 minutes.
- **Problem:** Normal variance can push a healthy gate past the detach limit.
- **Impact if no action:** A complete local verification can stop without a result.
- **Root question:** How should Mokly keep the local gate within its run limit?
- **Options:**
  - **A.** Raise the local detach limit to three hours. Effort: Small.
  - **B.** Find the slowest suite and reduce its cost below the current limit. Effort: Medium.
- **Left out:** Removing the detach limit loses liveness control.
- **Wider fix:** B. Reducing suite cost protects local and hosted verification.
- **Previous examples:** User item 188 records the two long runs.
- **Recommendation:** B. It improves the gate instead of only moving its limit.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6461).
