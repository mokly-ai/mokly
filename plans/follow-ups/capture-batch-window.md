# Captures wait for the slowest view of each batch

- **Severity:** Medium (estimate). **Effort:** Medium (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from the final report of PR #220 in the closed
  "perf: single pass render (follow on)" workspace, 2026-10-27, which named
  it as a possible follow-up.
- **Location:** `crates/mokly-graph/src/session_collection.rs:28` and
  `crates/mokly-graph/src/workers.rs:148`.
- **Reason:** PR #220 did not measure the gain, and the change touches the
  shared capture path of `build` and Serve.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Capture:** the compressed in-memory copy of every document of one
    side that Changes and `build` keep and read again.
  - **Fixed batch:** a group of routes that starts together and ends only
    when its slowest route ends.
  - **Sliding window:** a bound on routes in flight, where the next route
    starts as soon as any route ends.
- **Background:**
  - `collect_validated` in `crates/mokly-graph/src/session_collection.rs:28`
    takes routes in fixed batches of `comparison_parallelism`, the worker
    count. It waits for the whole batch through `RenderWorkers::comparison`
    before it starts the next one.
  - The head capture of `build` and the base capture of `build` and Serve
    both use this path.
  - On 2026-10-27, PR #220 built the large React fixture, 5,850 documents
    on each side, with 8 CPUs and 2 sidecars. The two capture passes took
    about 96 s of the 142 s build. The earlier fully parallel build check
    had rendered the same head documents in about 32 s.
  - PR #220 estimated that a sliding window could save about 30 s of that
    build. Nobody measured it.
  - `docs/protocol/mokly-on-demand.md` records the same choice for Serve's
    background pass: a sliding window, because fixed batches leave workers
    idle behind one slow view.
  - `crates/mokly-graph/README.md` keeps at most one transient input per
    render worker, and validation keeps failure and warning order. A window
    must keep both.
- **Problem:** One slow view leaves the other workers idle until its batch
  ends, in every capture pass.
- **Impact if no action:** Large React builds and each first Changes run
  keep this idle time. The cost grows with the spread of render times.
- **Root question:** How does a capture keep every worker busy and still
  deliver views to the collector in route order?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** A sliding window of the same size. Encode each finished view on
    its worker, and keep only the encoded results until their turn in route
    order. Effort: Medium (estimate).
  - **C.** B, with a window bounded by the smaller of the worker count and
    the sidecar pool size, as the background pass does. Effort: Medium
    (estimate).
- **Left out:** Render a whole side at once. It breaks the bound of one
  transient input for each worker.
- **Wider fix:** C. One window rule then serves the background pass and
  every capture.
- **Previous examples:** PR #225 moved Serve's background pass from fixed
  batches to a sliding window.
- **Related:**
  - [background-base-render-pool.md](./background-base-render-pool.md): in
    Serve, base capture jobs that wait at the admission gate hold render
    workers. A busier window can stall more foreground renders, so do that
    item first or together.
- **Recommendation:** C. It follows the rule that the background pass
  already uses. Measure the large React fixture before and after.
- **Action:** fix after merge, apply C, because the gain needs a
  measurement first, and the Serve foreground risk depends on the render
  pool item.
