# Serve comparison specs run out of time under load

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-20, from the branch `calummoore/removed-entries-all-section-n5a3`, during the repeat runs of a changed browser spec. Updated on 2026-11-26 by the branch `calummoore/ci-speed-flaky-follow-ups-b-and-new-k3dt` with a reproduction, the source, and the `sha2` build setting.
- **Location:** `Cargo.toml`, whose dev profile compiles `sha2` with `opt-level = 3` since 2026-11-26. `crates/mokly-compare/src/render_image.rs:32`, where `SystemImage::digest` hashes the running executable. `tests/browser/serve_removed_evidence.spec.ts:35` and `:155`, the two journeys. `tests/browser/serve_comparison_fixture.ts`, the `ready` wait, and `tests/browser/serve_ready_log.ts`, its failure report.
- **Reason:** The `sha2` setting cut the CPU of each debug Serve process, but it does not make the journeys deterministic, and each remaining option needs the user.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Serve comparison fixture:** the Playwright fixture in
    `tests/browser/serve_comparison_fixture.ts`. It starts a watching Serve
    host over a Git fixture repository. Its `ready` wait, which `edit` and
    `moveBase` use, polls the index for up to 30 seconds.
  - **Test time limit:** the 60-second Playwright timeout of each test,
    which `playwright.config.ts` sets as a hang guard.
  - **Render store identity:** the build identity of the render store. On
    Linux, Serve computes it at start as a SHA-256 hash of its own running
    executable, `/proc/self/exe`.
  - **Debug build:** the 638 MB native binary that `npm run build` makes
    with the dev profile. The browser specs run it.
- **Background:**
  - On 2026-11-20,
    `npx playwright test tests/browser/serve_removed_evidence.spec.ts --repeat-each=10`
    gave 19 passes and 1 failure on a loaded machine with a disk close to
    full. "background baselines reconcile removed rows and invalidate
    changed historical views" failed at `changes.edit(...)` with "Serve
    comparison did not become ready".
  - When the test deadline comes before the 30-second poll ends,
    `expect.poll` stops 250 ms before the deadline. The fixture then
    throws the same error. Only its cause says "Test timeout of 60000ms
    exceeded", after the whole Serve output. A standalone probe showed this
    on 2026-11-26.
  - On 2026-11-26, 40 runs of the spec with 1 worker passed, at a load
    average of 12 to 25 on 4 CPUs. The body of the first test took up to
    49.1 seconds of its 60.
  - 40 more runs with 2 workers, a scratch `cargo build -j 3` loop, and two
    CPU spinners gave 38 passes and 2 failures. Both failed at
    `changes.moveBase("base")` in "a background baseline places a removed
    variant under its parent", with the cause "Test timeout of 60000ms
    exceeded". Serve was still preparing the new base, and the index said
    `pending`.
  - In the same 40 runs, two bodies of the first test took 57.2 and 59.2
    seconds. The `--debug-timings` events showed no stall. Each edit wait
    ended within 1 to 13.4 seconds, and its rebuild, usage pass, and
    classification ran back to back.
  - Each Serve process of the spec used 15.3 to 23.1 seconds of CPU. Of
    that, its `mokly-documents` thread used 9.4 to 11.7 seconds to compute
    the render store identity. The debug build compiles `sha2` without
    optimization. `sha256sum` hashes the same file in 0.5 seconds.
  - On 2026-11-26, `[profile.dev.package.sha2] opt-level = 3` went into the
    root `Cargo.toml`. It cut that thread to 0.51 to 0.61 seconds. With the
    timing flag on, the median CPU of each process fell from 18.2 to 21.9
    seconds to 10.0 to 13.4 seconds.
  - After that change, 40 runs with 2 workers, the build loop, and two CPU
    spinners passed 40 of 40. A paired control on the old build passed 40 of
    40 too. In both batches swap filled after 6 minutes, and a watchdog
    stopped the build loop, so the load was lighter than in the batch with 2
    failures. The median first-test time did not move: 22.5 seconds before
    and 23.0 seconds after. Only the slowest runs got faster: 41.2 seconds
    on the old build and 35.8 seconds on the new one.
  - On an idle machine after the change, the two journeys took 14.4 and 8.1
    seconds.
  - Under memory thrash with full swap, base waits ran past the 30-second
    poll with that build too. Such a machine is too slow for both limits.
  - Since 2026-11-26, the error of a failed wait first names what ended it:
    a failed step with its error and the error's cause, or a time limit with
    the step that was still in progress. Then it gives the state that it
    wanted and each index state that it read, before the Serve output.
- **Problem:** Under heavy CPU load, the journeys of this spec can still use
  all of their 60-second test time limit. On a loaded 4-CPU machine the
  median first journey takes about 23 seconds, so the limit is about 2.6
  times that, below the three times that the hang-guard rule of
  `docs/protocol/ci-test-timing.md` asks for.
- **Impact if no action:** Browser runs on busy machines fail now and then
  in the Serve comparison specs. Each failure reads as a fault of Serve
  readiness.
- **Root question:** How do the Serve comparison specs finish well within
  their test time limit on a loaded 4-CPU machine?
- **Options:**
  - **A.** Applied on 2026-11-26: compile `sha2` with `opt-level = 3` in the
    dev profile. It removed about 10.5 seconds of CPU from each debug Serve
    start, but the paired counts do not show that the timeouts went away.
  - **B.** Compile every dependency with `opt-level = 1` or higher in the dev
    profile. Serve gets faster still, but each clean debug build takes
    longer, and no measurement shows how much of the remaining CPU this
    removes. Effort: Medium.
  - **C.** Raise the test time limit of the two journeys to three times
    their duration on a loaded machine, for example with `test.slow()`, 180
    seconds. The limit is a hang guard, so no checked behaviour changes. A
    real hang then takes up to 180 seconds to fail. Only the user can raise
    a time limit. Effort: Small.
  - **D.** Split the two journeys into shorter tests, and keep every
    assertion. Each new test starts its own Serve and repeats the base moves
    that set up its state, so the suite runs longer. Effort: Medium.
  - **F.** Drop the item. The journeys take 14.4 and 8.1 seconds on an idle
    machine, so the limit allows more than four times that. A later timeout
    then has no open record. Effort: Small.
- **Left out:** A retry, a sleep, or a longer poll, because the `testing`
  skill rules them out and no poll stalled. A lower thread priority for the
  hash, because the hash now takes half a second.
- **Wider fix:** A, which is applied. It cut the CPU of every debug Serve
  process in every browser and Node test.
- **Previous examples:** `plans/follow-ups/flaky-browser-host-setup.md`,
  deleted in commit `47a563ea0` when browser setup errors started to name
  the failed host.
- **Recommendation:** C. It brings the hang guard to the three times that
  the timing contract asks for on the machines that run these specs, and it
  changes no checked behaviour. F is the cheapest when the user accepts rare
  timeouts on loaded agent machines.
- **Action:** ask the user, because each remaining option raises a time
  limit, drops the record, or adds run time, and only the user can choose
  one of those.
