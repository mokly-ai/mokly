# Use the isolated Git test helper

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-compare/tests/large_sources_tests.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** test.
- **Background:** Rust Git tests use a support helper that isolates global Git settings. One large-sources test starts Git directly.
- **Problem:** A global setting such as `commit.gpgsign=true` can make the test fail locally.
- **Impact if no action:** The test result depends on the developer's Git configuration.
- **Root question:** How should Mokly use the isolated Git test helper?
- **Options:**
  - **A.** Use the existing isolated `support::git` helper. Effort: Small.
  - **B.** Apply A and add a gate that rejects direct Git commands outside support modules. Effort: Medium.
- **Left out:** Clearing one known Git variable misses other global settings.
- **Wider fix:** B. The gate prevents new unisolated Git tests.
- **Previous examples:** W8 decision 7 found the direct command in `large_sources_tests.rs`.
- **Recommendation:** A. It removes the current nondeterminism. B best protects the class.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6319).
