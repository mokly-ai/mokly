# Testbox warmup installs nextest from the warmup ref

- **Severity:** High. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from [PR #517](https://github.com/mokly-ai/mokly/pull/517).
- **Location:** `.github/workflows/blacksmith-testbox.yml`, `scripts/verification/testbox-suite.mjs`, and `xtask/scripts/testbox-cloud.mjs`.
- **Reason:** The fix changes the post-sync preparation of every remote worker. PR #517 owns only the Rust test commands and their install steps.
- **Category:** Process.

- **Background:** The Repository, Native, and Cloud Rust suites run their Rust tests with cargo-nextest. `.config/nextest.toml` requires a nextest version, and `cargo xtask toolchain-pins` compares the installed version with the pin. A remote run warms each Testbox from a Git ref, `main` by default, and then syncs the developer's tree. Only the warmup workflow installs nextest.
- **Problem:** A box installs the nextest of its warmup ref, not of the synced tree. Until PR #517 merges, `main` installs no nextest. After it merges, a branch that raises the pin still gets the older nextest from `main`.
- **Impact if no action:** The remote Repository and Cloud Rust workers fail at the nextest preflight, and the remote toolchain pin check fails, until the change merges or the run sets `MOKLY_TESTBOX_REF` to the branch. Hosted CI is not affected.
- **Root question:** How does each remote worker get the nextest that the synced tree requires?
- **Options:**
  - **A.** Keep the warmup install. Document that a pin change needs `MOKLY_TESTBOX_REF`. Terraform and Helm already follow this rule. Effort: Small (estimate).
  - **B.** Install the pinned nextest after the sync in the suite wrappers, as the viewer command installs Bun from `.bun-version`. Effort: Medium (estimate).
  - **C.** Share one pin-driven installer between hosted CI and the Testbox wrappers. Effort: Large (estimate).
- **Left out:** None.
- **Wider fix:** C. One installer reads the pin from the tree that each environment verifies.
- **Previous examples:** PR #275 (`76d69b632`) moved the Bun install after the sync for the same reason. See `docs/protocol/remote-verification-testbox.md`.
- **Related:** None.
- **Recommendation:** B (estimate). It follows the Bun rule and keeps hosted CI unchanged.
- **Action:** fix after merge, apply B.
