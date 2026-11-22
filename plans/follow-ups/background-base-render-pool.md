# Give kept-base reads their own render workers

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #228, decision 9 of the stylesheet bundle
  performance plan, and review finding 1 of step A. Narrowed on 2026-11-19 by
  the miss-first base capture branch, which covered the fresh base capture and
  its early renders.
- **Location:** `Source::classification_runtime` in
  `crates/mokly-cli/src/serve_changes_native.rs`, `CaptureWorkers` in
  `crates/mokly-cli/src/capture_workers.rs`, `ScheduledPool::request` in
  `crates/mokly-cli/src/serve_pool.rs`, `Gate::acquire` in
  `crates/mokly-cli/src/serve_gate.rs`, `BaseReader` in
  `crates/mokly-compare/src/base_reader.rs`, and `capture_side` in
  `crates/mokly-server/src/comparison_capture.rs`.
- **Reason:** The miss-first base capture branch kept its change to the fresh
  base capture and its early renders, so the reads through the kept base need
  their own branch and review.

- **Terms:**
  - **Base side:** the historical version of the catalogue that Serve's
    Changes classification prepares beside the live catalogue.
  - **Render pool:** the machine-sized thread pool, `ThreadWorkers`, that
    runs render and bundle jobs.
  - **Admission gate:** the Serve sidecar gate in
    `crates/mokly-cli/src/serve_gate.rs`. It lets queued base work call a
    sidecar only while no foreground request is active.
  - **Orchestrator:** the agent that coordinated the performance pull
    requests of 2026-10-27 to 2026-10-29 and answered their decisions for
    the user.
  - **Kept base:** the captured base side that Serve keeps between Changes
    classifications, under the
    [Serve base lifetime rule](../../docs/protocol/mokly-base-preparation.md#serve-base-lifetime).
- **Background:**
  - The base runtime of Serve wraps the shared render pool, in
    `Source::classification_runtime` in
    `crates/mokly-cli/src/serve_changes_native.rs`. Before 2026-11-19, base
    render jobs and foreground document renders used the same workers.
  - `ScheduledPool::request` in `crates/mokly-cli/src/serve_pool.rs` calls
    `Gate::acquire` in `crates/mokly-cli/src/serve_gate.rs`. That call makes a
    base call wait while a foreground request is active. A base job that waits
    there still holds its render worker.
  - The first review of PR #228, which bundles stylesheet roots in
    parallel, found on 2026-10-28 that base stylesheet jobs could deadlock
    foreground renders this way. Severity High. PR #228 fixed that case:
    base stylesheet roots bundle on the classification thread.
  - Until 2026-11-19, the base comparison capture in
    `crates/mokly-graph/src/session_collection.rs` could fill every render
    worker with jobs that wait at the admission gate.
  - On 2026-11-19, the miss-first base capture branch gave two cases render
    workers that foreground renders do not use. The cases are the capture
    window of a fresh base, and its early renders. An early render is a render
    of a base view that no render cache tier holds, and it starts before the
    capture reaches that view. The rule is in the
    [on-demand contract](../../docs/protocol/mokly-on-demand.md#background-work-and-replacement).
  - `Source::classification_runtime` now wraps the base workers in
    `CaptureWorkers` from `crates/mokly-cli/src/capture_workers.rs`. Its
    capture pool comes from `crates/mokly-cli/src/serve_capture_workers.rs`.
    Its thread count is the smaller of the worker count and the gate's
    admission limit. `CaptureWorkers` runs the capture window and the early renders on
    that pool, and it forwards every other job, ordinary reads included, to
    the shared workers.
  - That branch kept the process pool, memory admission, the per-call claims,
    and root scheduling. It rejected a claim before each job on a shared
    worker, because a claim covers one call, not a whole job. It rejected a
    separate pool for foreground renders, because it changes how a foreground
    request waits for a busy worker. It also found that a read that finds its
    view in the render cache can still render after an eviction. So a read
    cannot stay on the shared workers only because its view was cached.
  - Serve keeps one captured base between classifications. The base capture
    then runs only on a fresh preparation. A reuse of the kept base captures
    nothing, but it still renders the base views that the kept capture does
    not hold, on the shared workers. A selected capture of the on-demand
    comparison routes, in `crates/mokly-server/src/comparison_capture.rs`,
    does the same. A reuse reads the kept base through `BaseReader` in
    `crates/mokly-compare/src/base_reader.rs`.
  - A kept base follows only the stop of Serve. A replaced or cancelled
    reader cannot cancel a kept-base call that waits at the admission gate.
    That call ends its wait when the foreground request ends or Serve stops.
  - On 2026-10-28 the orchestrator chose the wider fix: a separate render
    pool for background base work, in a later branch. The orchestrator
    rejected the same change in PR #228, because the base comparison
    capture on `origin/main` has the same problem and needs its own review.
- **Task:**
  1. Give the reads through the kept base their own render workers, as the
     fresh base capture and its early renders already have. Cover the base
     views that a reuse renders because the kept capture does not hold them,
     and the selected captures that read the kept base.
  2. Keep the process pool, memory admission, the per-call claims, and root
     scheduling unchanged.
  3. Add a test in which kept-base read jobs wait at the admission gate while
     a foreground render still gets a worker.
- **Impact if no action:** While a kept-base render or a selected capture
  waits at the admission gate, a foreground document render can wait for a
  free worker. Queued base calls wait until no foreground request is active.
  A kept-base call ends its wait only when the foreground request ends, for
  example at its deadline, or when Serve stops. Cancelling its reader no
  longer ends that wait.
- **Needs:** Nothing. The task needs no deployed change and no credentials.
- **Done when:** Reads through the kept base, the selected captures included,
  run on render workers that foreground renders do not use. A test shows that
  a foreground render finishes while those jobs wait at the admission gate.
- **Related:** `plans/follow-ups/css-bundling-global-pool.md` measures the
  global Rayon pool that base stylesheet bundles start on the classification
  thread. Both items come from the same admission gate. The base pool of this
  item is one candidate direction there, because it would also hold the base
  bundle loads. `plans/follow-ups/cold-start-base-overlap-memory.md` records a
  closed cold-start overlap of base work. Like main, it captured only after
  usage, so its capture did not compete with usage for render workers. Browser
  requests during that capture can still meet this stall.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/ee7d8ea739bd103aacd001f8e75e5aa144929348/plans/stylesheet-bundle-performance.md?plain=1#L639).
