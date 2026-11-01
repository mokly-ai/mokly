# Explain the large build benchmark overhead

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
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
  - On 2026-10-28, with the release binary in both runs on a quiet
    eight-CPU machine, the harness and a direct run took about the same
    time: 39.1 s against 42.7 s for the large HTML fixture, and 125.6 s
    against 127.2 s for the large React fixture. Before 2026-11-01 the
    build scenario timed whichever binary the host package held, often the
    debug binary that `npm run build` installs. So a part of the measured
    gap can come from two different binaries.
- **Impact if no action:** Harness measurements overstate build times, most
  for slow builds. A before and after comparison can show a gain that a
  direct run does not show.
- **Root question:** How do the large benchmark measurements show the build
  time that a direct run gives?
- **Options:**
  - **A.** Change nothing, and compare only direct runs. Effort: Small.
  - **B.** Profile one harness run against a direct run of the same binary.
    Name the source, for example memory sampling or output parsing, and
    remove it. Effort: Small.
  - **C.** Record a direct-run control with each harness run, and report the
    overhead beside each build time. Effort: Medium.
- **Left out:** A time limit in a required test. The harness is an opt-in
  benchmark outside the test tree.
- **Wider fix:** C would expose overhead in every benchmark report. It adds
  report content that no recorded requirement covers, so it needs a decision. B
  can find and remove the existing overhead first.
- **Previous examples:** None found.
- **Related:** [large-benchmark-liveness.md](./large-benchmark-liveness.md)
  concerns the fixed waits of the same harness. Its build part is fixed:
  since 2026-11-01, each output line restarts the 300-second build
  deadline, and the build scenario builds and installs the release binary.
  Its Changes wait stays open. The causes differ: a fixed wait stops a
  healthy run, and this item is time that the harness adds.
- **Recommendation:** B. It explains the measured gap before the
  harness gets more measurement duties.
- **Action:** fix after merge, apply B, because the benchmark harness lies
  outside the render-once change that found the overhead.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/build-head-capture.md?plain=1#L209).
