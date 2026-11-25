# Rust test cache depends on the shard assignment

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the review of branch `calummoore/ci-speed-native-fixed-costs-and-luqv`.
- **Location:** `.github/workflows/ci.yml`, the `save-if` inputs of the `repository` and `native` jobs, and `xtask/src/check/rust_partition.rs`.
- **Reason:** The branch fixes the direct problem: only the first test shard saves, and it holds `--lib` and the doc tests. The recommended fix adds a complete test build on a cache miss on `main`, so it needs its own timing comparison.
- **Category:** Performance.

- **Background:** The Repository and native test shards each build only their own Rust test targets, and they share one Rust build cache entry for each job and host. On `main`, only the first test shard saves the entry. That shard runs `--lib`, the unit tests of every Mokly library, and the doc tests. Their builds need every crates.io dependency of the Rust tests, because Cargo builds all dev-dependencies of a package for its library unit tests.
- **Problem:** The completeness of the saved entry depends on a rule of the partition: `--lib` stays on the first test shard. A later change of that rule, or a package without a library, can make the saved entry miss dependencies that other shards build again on every run.
- **Impact if no action:** None today. The rule is in the code and in the test unit rule of `docs/protocol/ci-verification-repository.md`.
- **Root question:** How does the saved Rust test cache stay complete whatever the test shard assignment is?
- **Options:**
  - **A.** Keep the rule, and add a note to the partition code that names the cache. Effort: Small.
  - **B.** On `main` and an exact cache miss only, let the first test shard build every test target with `cargo test --no-run` before the cache saves. Effort: Small.
  - **C.** Add a `main`-only job for each host that builds every test target and saves the entry. The test and lint shards only restore it. Effort: Medium.
- **Left out:** A saved entry for each test shard. The repository cache is already at its 10 GB limit.
- **Wider fix:** C. The entry comes from the complete build and does not depend on the assignment.
- **Recommendation:** B. It fills the entry only when it refreshes and adds no time to normal runs.
- **Action:** fix after merge, apply B.
