# Reduce catalogue-wide owned-proof memory

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** Owned-instance proof collection in `crates/mokly-compare`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** performance.
- **Background:** Owned-instance proof waits for catalogue-wide own-page proof. Each view can retain two whole-document indexes and candidate proofs.
- **Problem:** A large catalogue can retain an estimated 190 MiB before collection ends. The cost has not been measured.
- **Impact if no action:** Changes can use substantially more memory on large catalogues.
- **Root question:** How should Mokly reduce catalogue-wide owned-proof memory?
- **Options:**
  - **A.** Keep passing the proof state by value. Effort: Small.
  - **B.** Keep compact candidates only for owners with changed rules and deduplicate instance chains. Effort: Medium.
  - **C.** Add a counted test at two catalogue sizes without changing retention. Effort: Medium.
- **Left out:** Dropping candidate proof loses owned-instance evidence.
- **Wider fix:** B. Compact candidates remove whole-document retention.
- **Previous examples:** Decision 73 C introduced the catalogue-wide wait.
- **Recommendation:** B. It removes the estimated regression instead of only measuring it.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5878).
