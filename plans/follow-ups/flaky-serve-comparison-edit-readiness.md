# Serve comparison specs run out of time under load

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the branch `calummoore/removed-entries-all-section-n5a3`, during the repeat runs of a changed browser spec. Updated on 2026-11-26 with a reproduction, the source, and the fix.
- **Location:** `Cargo.toml`, which sets no dev profile for `sha2`. `crates/mokly-compare/src/render_image.rs:32`, where `SystemImage::digest` hashes the running executable. `tests/browser/serve_removed_evidence.spec.ts:35` and `:155`, the two journeys. `tests/browser/serve_comparison_fixture.ts:168`, the `ready` wait.
- **Reason:** The fix changes the root `Cargo.toml`, and the branch that found the source could change only the fixture, the spec, and Serve code.

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
  - A build with `[profile.dev.package.sha2] opt-level = 3`, not committed,
    cut that thread to 0.5 to 0.6 seconds and the process to 5.4 to 9.2
    seconds. The first test then took 13.3 to 18.3 seconds instead of 20.9
    to 30.5.
  - Under memory thrash with full swap, base waits ran past the 30-second
    poll with that build too. Such a machine is too slow for both limits.
  - Since 2026-11-26, the error of a failed wait gives its duration, the
    state that it wanted, and each index state that it read, before the
    Serve output.
- **Problem:** Under CPU load, the journeys of this spec use most or all of
  their 60-second test time limit. More than half of the CPU of each debug
  Serve process goes to the hash of its own executable.
- **Impact if no action:** Browser runs on busy machines fail now and then
  in the Serve comparison specs. Each failure reads as a fault of Serve
  readiness.
- **Root question:** How do the Serve comparison specs finish well within
  their test time limit on a loaded 4-CPU machine?
- **Options:**
  - **A.** Compile `sha2` with `opt-level = 3` in the dev profile of the root
    `Cargo.toml`. The debug build then hashes its executable in about half a
    second. Only the build settings change. Effort: Small.
  - **B.** Compile every dependency with `opt-level = 1` or higher in the dev
    profile. Serve gets faster still, but each clean debug build takes
    longer. Effort: Small.
  - **C.** Raise the test time limit of the Serve comparison specs to three
    times their typical duration on a loaded machine. This raises a time
    limit, so it needs approval. Effort: Small.
  - **D.** Split the two journeys of this spec into shorter tests, and keep
    every assertion. Each new test starts its own Serve, which computes the
    hash again, and the second journey needs both of its base moves.
    Effort: Medium.
  - **E.** Compute the render store identity at the lowest thread priority.
    The hash then yields to the work of Serve, but it still uses the CPU.
    Effort: Medium.
- **Left out:** A retry, a sleep, or a longer poll, because the `testing`
  skill rules them out and no poll stalled.
- **Wider fix:** A. It cuts the CPU of every debug Serve process in every
  browser and Node test.
- **Previous examples:** `plans/follow-ups/flaky-browser-host-setup.md`,
  deleted in commit `47a563ea0` when browser setup errors started to name
  the failed host.
- **Recommendation:** A. It removes the largest measured cost at its source,
  with a build setting and no change of behaviour.
- **Action:** fix after merge, apply A, because the fix changes the root
  `Cargo.toml`, which the branch that found the source could not change.
