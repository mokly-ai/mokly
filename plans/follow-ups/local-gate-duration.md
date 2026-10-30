# Keep the local gate within its run limit

- **Severity:** Low. **Effort:** Medium (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 188.
- **Location:** None. The 120-minute limit was a rule of the rebuild's
  delegate briefs, not of this repository.
- **Reason:** The plan recorded this item after the user's rule of
  2026-10-21 that new review items wait for the user after the merge.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Complete gate:** `cargo xtask check`, the full local verification.
  - **Detach limit:** the time after which the delegate's local executor
    stops waiting for a detached gate run.
- **Background:**
  - During the rebuild, a delegate ran the complete gate through a local
    executor with a 120-minute detach limit.
  - The gate on commit `a59b16f1` took 114 minutes. Another integration gate
    took 86 minutes.
  - Neither this repository nor the installed shared skills state the
    120-minute limit today.
- **Problem:** Normal variance can push a healthy gate past the detach
  limit.
- **Impact if no action:** A complete local verification can stop without a
  result, and the work waits for another run.
- **Root question:** How does a local complete gate finish within the time
  that its runner allows?
- **Options:**
  - **A.** Raise the detach limit for local gates in the delegate rules to
    three hours. Effort: Small (estimate).
  - **B.** Find the slowest suite and reduce its cost below the current
    limit. Effort: Medium (estimate).
- **Left out:** Remove the detach limit. It loses the guard against a hung
  run. Fewer than three approaches exist, because the run either gets more
  time or takes less.
- **Wider fix:** B. A cheaper suite helps local and hosted verification.
- **Previous examples:** The two long runs above.
- **Related:** [remote-testbox-timeout.md](remote-testbox-timeout.md) is
  about the time limit of the remote gate. Both are run limits of the same
  gate, so one measurement of suite times serves both.
- **Recommendation:** B. It improves the gate instead of only moving its
  limit.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user ruled that new review items wait for the user after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6461).
