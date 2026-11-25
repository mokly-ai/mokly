# Rust test shard commands take a plain target list

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the review of branch `calummoore/ci-speed-native-fixed-costs-and-luqv`.
- **Location:** `xtask/src/check/runner.rs`, `rust_test_shard`, and `xtask/src/check/rust_commands.rs`, `nextest`.
- **Reason:** The branch adds a runner test that checks the nextest arguments of two populated shards. The type change refactors shared command construction.
- **Category:** Code structure.

- **Background:** `cargo xtask rust-test-shard` reads the Rust test units from Cargo metadata, selects the units of one shard, and passes their target arguments to `nextest`. `nextest` takes a plain list of strings.
- **Problem:** Nothing in the types stops a caller from passing the complete unit inventory to `nextest`. Only the runner test catches that mistake.
- **Impact if no action:** A refactor can make every shard compile and run every test target again. The runner test fails in that case.
- **Root question:** How can the command builder accept only the units of one shard?
- **Options:**
  - **A.** Keep the plain list and the runner test. Effort: Small.
  - **B.** Add a type for the units of one shard that only the partition creates, and let `nextest` take that type. Effort: Medium.
- **Left out:** A lint. A type gives the same protection with no new check.
- **Wider fix:** B.
- **Recommendation:** B. It makes the wrong call fail to compile.
- **Action:** fix after merge, apply B.
