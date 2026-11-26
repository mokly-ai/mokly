# Windows native shards place work unevenly

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-26, from branch `calummoore/ci-speed-shard-weight-refresh-2`.
- **Location:** `scripts/verification/rust-test-weights.json`, `scripts/verification/rust-test-weights.mjs` (`testSeconds`), `xtask/src/check/rust_partition.rs`.
- **Reason:** The fix changes the format of the Rust weight file or the placement, and Windows sets the CI wall clock.

- **Terms:**
  - **Native Windows shards:** The `Native (windows-2025, shard {n}/7)` CI jobs. Shard 1 runs the lints. Each other shard runs one weighted share of the Rust test units.
- **Background:** The Rust test weights hold one `testSeconds` value for each unit: the mean over Linux, macOS, and Windows. `compileSeconds` comes from a Linux build. Every host places its units by these same numbers.
- **Problem:** On Windows, one test shard is always much slower than the others. In run 45795355407, shard 3/7 took 9m 01s, and the other test shards took 5m 57s to 8m 29s. With eight shards in run 45797753698, shard 7/8 took 9m 02s, and the other test shards took 4m 43s to 6m 38s. That shard set the wall clock of both runs.
- **Impact if no action:** CI stays at about 9.5 minutes, and an extra Windows shard does not help.
- **Root question:** How do the Windows test shards get an even share of the Windows work?
- **Options:**
  - **A.** Keep one `testSeconds` map for each host, and place each host's shards by its own map. Effort: Medium.
  - **B.** Add a Windows factor to the compile part, measured from the Windows build times. Effort: Small.
  - **C.** Split the heaviest Windows units, such as the `mokly-cli` and `mokly-compare` integration tests, into nextest slices. Effort: Small.
- **Left out:** More Windows shards: run 45797753698 showed no gain with eight.
- **Wider fix:** A.
- **Previous examples:** Commit `02db327d7` balanced the macOS shards by hand with `docSeconds`.
- **Recommendation:** A. Each host then uses its own measured times.
- **Action:** ask the user, because it changes the weight file format that open decision 56 also touches.
