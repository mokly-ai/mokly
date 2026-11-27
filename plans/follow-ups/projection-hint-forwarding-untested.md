# No test catches a dropped projection hint

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-product-hot-spots-found-by-slow-o47c`, review finding 7 and its check.
- **Location:** `crates/mokly-source-interface/src/tree.rs:89` (`SourceTree::hint_projections`), `crates/mokly-graph/src/source_snapshot.rs:117`, `crates/mokly-cli/src/cancelled_work.rs:47`, `crates/mokly-render/src/sources.rs:141`.
- **Reason:** The branch had ended its fix rounds, and the strongest option adds a build error, which needs the user's approval.

- **Terms:**
  - **Projection hint:** `SourceTree::hint_projections`, which names paths that later projections ask for, so that `GitTree` can look them up in one batch. Its default body does nothing.
  - **Wrapper:** a `SourceTree` that forwards to an inner tree, such as `SideTree`, `SourceSnapshot`, `CancellableTree`, `LeasedTree`, `RecordingTree`, and `InjectedTree`.
- **Background:** Each wrapper must forward the hint, or the default drops it without a sign. The tests check the hint at the inventory with a mock tree (`crates/mokly-render/src/_tests_/postcss_module_hint_tests.rs`) and at `GitTree` directly (`crates/mokly-compare/src/_tests_/git_hint_tests.rs`). No test runs a hint through the wrappers.
- **Problem:** If a wrapper stops forwarding the hint, every test still passes, and the test `changed_postcss_module_keeps_the_historical_plugin_output` goes back from 92 to about 552 Git processes without an assertion failure.
- **Impact if no action:** A later change can lose the batching without any failed check.
- **Root question:** How can Mokly make sure that every wrapper in the base chain passes a projection hint on to the Git reader?
- **Options:**
  - **A.** Run one inventory case through `SideTree`, `SourceSnapshot`, and `GitTree` with a counting repository, and assert one lookup for two hinted dependency paths. Effort: Small (estimate).
  - **B.** Add a hint case to the forwarding tests of each wrapper, `CancellableTree` included, and assert the paths that reach the inner tree. Effort: Small (estimate).
  - **C.** Remove the default body of `hint_projections`, so that a wrapper that does not forward it fails the build. Effort: Small (estimate). It adds a build error, so it needs the user's approval.
- **Left out:** Extending the historical PostCSS integration test with a Git command count, because another workspace owns that test file now and A catches the same defect without Node or Git.
- **Wider fix:** C, because it stops the class at compile time for each new wrapper.
- **Recommendation:** A and B (estimate), without a new build error.
- **Action:** fix after merge, with options A and B. Ask the user before C.
