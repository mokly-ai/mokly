# App shard 1 runs logic tests that placement ignores

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from branch `calummoore/ci-speed-shard-balance-tooling-nnht`, outside its review scope.
- **Location:** `packages/app/src/_tests_/browser-shards.ts`, `xtask/src/check/cloud_shards.rs` (`app_commands`).
- **Reason:** The problem is in the app shard placement, outside the scope of the branch that found it.

- **Background:** CI runs the app browser suite as eight `App checks {n}/8` jobs. Whole spec files go to the shard with the least measured seconds. Shard 1 also runs `test:logic` before its browser specs.
- **Problem:** The placement does not count the logic tests, so shard 1 gets the same browser load as the other shards plus the logic tests. `App checks 1/8` was the slowest App shard in run 45710272091, at 7m 51s against 5m 31s for the fastest.
- **Impact if no action:** Shard 1 stays the slowest App shard after every weight refresh, and the shard balance section of `CI timing` keeps showing the spread.
- **Root question:** How does the app placement balance the extra work of shard 1?
- **Options:**
  - **A.** Charge the measured logic-test seconds to shard 1 before the placement starts. Effort: Small.
  - **B.** Move the logic tests to their own job or to the lightest shard. Effort: Small.
- **Left out:** A third approach adds nothing that A and B do not cover.
- **Wider fix:** None.
- **Previous examples:** The Rust and mockup shards keep their extra work on dedicated shards, as `xtask/src/check/rust_commands.rs` and `cloud_shards.rs` show.
- **Recommendation:** A. It keeps the job count and uses the existing weights.
- **Action:** fix after merge, apply A, because it is outside the scope of the branch that found it.
