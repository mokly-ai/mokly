# Keep the local gate within its run limit

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 188.
- **Location:** None. The 120-minute limit was a rule of the rebuild's
  delegate briefs, not of this repository.
- **Reason:** The Rust rebuild merged with this run limit open, and the suite
  cost work reaches the whole gate, so it needs a separate branch.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Complete gate:** `cargo xtask check`, the full local verification.
  - **Detach limit:** the longest time that an agent's background command
    may run. The agent's tool then stops the command.
- **Background:**
  - During the rebuild, a delegate ran the complete gate through a local
    executor with a 120-minute detach limit.
  - The gate on commit `a59b16f1` took 114 minutes. Another integration gate
    took 86 minutes.
  - Neither this repository nor the installed shared skills state the
    120-minute limit today.
  - On 2026-10-30 the Bash tool of Claude Code stops a background command
    at its timeout. That timeout is at most 7,200,000 ms, which is 120
    minutes. A foreground command has at most 1,800,000 ms, which is 30
    minutes.
  - The local executor runs the suites one after another in one checkout,
    as `docs/protocol/remote-verification.md:9` says.
  - No record gives the time of the complete local gate on the code of
    2026-10-30.
- **Problem:** Normal variance can push a healthy gate past the detach
  limit.
- **Impact if no action:** A complete local verification can stop without a
  result, and the work waits for another run.
- **Root question:** How does a local complete gate finish within the time
  that its runner allows?
- **Options:**
  - **A.** Raise the detach limit for local gates in the delegate rules to
    three hours. A rule alone cannot do this, because 120 minutes is the
    maximum of the agent's tool. A needs a setting of that tool, if the tool
    has one. Effort: Small.
  - **B.** Find the slowest suite and reduce its cost below the current
    limit. Effort: Medium.
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
- **Action:** fix after merge, apply B, because a faster suite keeps every check
  of the gate, and it raises no time limit.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6461).
