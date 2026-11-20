# Give background base work its own render pool

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #228, decision 9 of the stylesheet bundle
  performance plan, and review finding 1 of step A.
- **Location:** `crates/mokly-cli/src/serve_changes_native.rs:194`,
  `crates/mokly-cli/src/serve_pool.rs:93`, and
  `crates/mokly-graph/src/session_collection.rs:28`.
- **Reason:** The orchestrator chose to change the shared render pool in a
  separate branch, because the base comparison capture on `origin/main` has
  the same problem and needs its own review.

- **Terms:**
  - **Base side:** the historical version of the catalogue that Serve's
    Changes classification prepares beside the live catalogue.
  - **Render pool:** the machine-sized thread pool, `ThreadWorkers`, that
    runs render and bundle jobs.
  - **Admission gate:** the Serve sidecar gate in
    `crates/mokly-cli/src/serve_pool.rs`. It lets queued base work call a
    sidecar only while no foreground request is active.
  - **Orchestrator:** the agent that coordinated the performance pull
    requests of 2026-10-27 to 2026-10-29 and answered their decisions for
    the user.
  - **Kept base:** the captured base side that Serve keeps between Changes
    classifications, under the
    [Serve base lifetime rule](../../docs/protocol/mokly-base-preparation.md#serve-base-lifetime).
- **Background:**
  - The base runtime of Serve wraps the shared render pool, in
    `Source::classification_runtime` at
    `crates/mokly-cli/src/serve_changes_native.rs:194`. So base jobs and
    foreground document renders use the same workers.
  - `acquire` in `crates/mokly-cli/src/serve_pool.rs:93` makes a base call
    wait while a foreground request is active. A base job that waits there
    still holds its render worker.
  - The first review of PR #228, which bundles stylesheet roots in
    parallel, found on 2026-10-28 that base stylesheet jobs could deadlock
    foreground renders this way. Severity High. PR #228 fixed that case:
    base stylesheet roots bundle on the classification thread.
  - The base comparison capture in
    `crates/mokly-graph/src/session_collection.rs:28` can still fill every
    render worker with jobs that wait at the admission gate.
  - Serve keeps one captured base between classifications. The base
    capture then runs only on a fresh preparation. A reuse of the kept base
    captures nothing, but it still renders the base views that the kept
    capture does not hold, on the same workers. A selected capture does the
    same.
  - A kept base follows only the stop of Serve. A replaced or cancelled
    reader cannot cancel a kept-base call that waits at the admission gate.
    That call ends its wait when the foreground request ends or Serve stops.
  - On 2026-10-28 the orchestrator chose the wider fix: a separate render
    pool for background base work, in a later branch. The orchestrator
    rejected the same change in PR #228, because the base comparison
    capture on `origin/main` has the same problem and needs its own review.
- **Task:**
  1. Give Serve's background base work its own render pool, so that no base
     job holds a worker that a foreground render needs.
  2. Cover the base comparison capture in `session_collection.rs`.
  3. Add a test in which base jobs wait at the admission gate while a
     foreground render still gets a worker.
- **Impact if no action:** While a base comparison capture or a kept-base
  render waits at the admission gate, a foreground document render can wait
  for a free worker. Queued base calls wait until no foreground request is
  active. During a fresh preparation, the preview request can stall until
  the base attempt is cancelled. A kept-base call ends its wait only when
  the foreground request ends, for example at its deadline, or when Serve
  stops. Cancelling its reader no longer ends that wait.
- **Needs:** Nothing. The task needs no deployed change and no credentials.
- **Done when:** Base comparison capture jobs and the other base jobs,
  kept-base renders included, run on their own pool, and a test shows that a
  foreground render finishes while base jobs wait at the admission gate.
- **Related:** `plans/follow-ups/css-bundling-global-pool.md` measures the
  global Rayon pool that base stylesheet bundles start on the classification
  thread. Both items come from the same admission gate. The base pool of this
  item is one candidate direction there, because it would also hold the base
  bundle loads. `plans/follow-ups/cold-start-base-overlap-memory.md` records a
  closed cold-start overlap of base work. Like main, it captured only after
  usage, so its capture did not compete with usage for render workers. Browser
  requests during that capture can still meet this stall.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/ee7d8ea739bd103aacd001f8e75e5aa144929348/plans/stylesheet-bundle-performance.md?plain=1#L639).
