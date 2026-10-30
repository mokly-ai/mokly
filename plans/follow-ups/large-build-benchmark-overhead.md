# Explain the large build benchmark overhead

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #220 and its completed plan, which put the
  problem outside the scope of its review.
- **Location:** `scripts/large/benchmark.ts:92` and
  `scripts/large/memory.ts:1`.
- **Reason:** The overhead comes from the benchmark harness, which PR #220
  did not change.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Large benchmark harness:** the opt-in scripts under `scripts/large/`.
    They build the large HTML and React fixtures, sample the memory of the
    process tree, and record the timings.
- **Background:**
  - The `build` scenario starts at `scripts/large/benchmark.ts:92`. It runs
    the CLI and samples the memory of the CLI process tree and of the whole
    harness tree, through `scripts/large/memory.ts`.
  - PR #220 measured on 2026-10-26 and 2026-10-27 through the harness, and
    again with direct runs of the same release binaries on the same machine.
- **Problem:** The harness adds a large and uneven overhead:
  - Large React fixture, old binary: 1,056.5 s through the harness against
    455.9 s direct, 2.3 times longer.
  - Large React fixture, new binary: 177.0 s through the harness against
    142.2 s direct.
  - Large HTML fixture: 166.2 s against 86.0 s for the old binary, and
    44.1 s against 39.9 s for the new binary.
  - The source of the overhead was not found or recorded.
- **Impact if no action:** Harness measurements overstate build times, most
  for slow builds. A before and after comparison can show a gain that a
  direct run does not show.
- **Root question:** How do the large benchmark measurements show the build
  time that a direct run gives?
- **Options:**
  - **A.** Change nothing, and compare only direct runs. Effort: Small.
  - **B.** Profile one harness run against a direct run of the same binary.
    Name the source, for example memory sampling or output parsing, and
    remove it. Effort: Small (estimate).
  - **C.** Record a direct-run control with each harness run, and report the
    overhead beside each build time. Effort: Medium (estimate).
- **Left out:** A time limit in a required test. The harness is an opt-in
  benchmark outside the test tree.
- **Wider fix:** C (estimate). Every later report then shows its own
  overhead.
- **Previous examples:** None found.
- **Related:** [large-benchmark-liveness.md](./large-benchmark-liveness.md)
  concerns the 300-second deadline of the same build scenario, at
  `scripts/large/benchmark.ts:68`. Both items change the build scenario of
  this harness, so one branch can handle both. Their causes differ: that
  deadline stops healthy builds, and this item is time that the harness
  adds.
- **Recommendation:** B (estimate). It explains the measured gap before the
  harness gets more measurement duties.
- **Action:** ask the user, because condition 6 holds (estimate): this is a
  performance finding about an opt-in tool.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/build-head-capture.md?plain=1#L209).
