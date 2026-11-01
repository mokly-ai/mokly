# Avoid sidecar startup waits during background renders

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #225 and its completed plan, one of the
  three follow-ups of its acceptance decision.
- **Location:** `crates/mokly-sidecar/src/pool.rs:75` and line 119, and
  `crates/mokly-cli/src/serve_pool.rs:49`.
- **Reason:** On 2026-10-28 the coordinating agent accepted the missed targets
  of PR #225 and deferred pool startup work outside its pass scheduler.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Background pass:** the work of Serve after readiness that renders every
    view, to fill the render cache and the usage of every entry detail.
  - **Sidecar pool:** the Node render processes of `mokly-sidecar`. Each
    sidecar must replay the bundle generation before its first render.
  - **Orchestrator:** the agent that coordinated the performance pull
    requests of 2026-10-27 to 2026-10-29 and answered their decisions for
    the user.
- **Background:**
  - PR #225, merged on 2026-10-28, renders the background pass in a sliding
    window of the smaller of the worker count and the sidecar count.
  - The pool spawns its processes on demand, in `acquire` and `spawn` of
    `crates/mokly-sidecar/src/pool.rs:75` and line 119. Each spawn took
    about 0.3 s, and each replay of the generation 0.2 to 0.3 s, in
    parallel.
  - On `examples/basic`, the first wave of the pass waited 0.75 to 0.85 s
    while the pool spawned five more sidecars and replayed the generation on
    each. The pass took 4.9 to 5.3 s against a 4 s target.
  - On 2026-10-28 the orchestrator accepted the measured result and left the
    pre-start to a later item. PR #225 named two approaches: start the
    sidecars and replay the generation before the pass, or let a request
    take the first sidecar that becomes ready.
- **Problem:** The first renders of every background pass wait for sidecar
  startup.
- **Impact if no action:** Each pass keeps about 0.8 s of startup wait, also
  after each watched rebuild.
- **Root question:** How does the background pass start rendering without
  waiting for sidecar startup?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Start the sidecars of the window and replay the generation before
    the pass begins. Effort: Medium.
  - **C.** Let a waiting render take the first sidecar that becomes ready,
    instead of a sidecar that still starts. Effort: Medium.
- **Left out:** A larger render window. The window already equals the
  sidecar count, and more renders would only queue.
- **Wider fix:** C. Every request, not only the pass, then avoids
  a wait for one starting sidecar.
- **Previous examples:** None found.
- **Related:**
  [coalesce-document-composition.md](./coalesce-document-composition.md) owns
  the document and stylesheet cache follow-ups of the same acceptance decision.
  It removes repeated cache work.
  The
  [large React startup item at its last commit](https://github.com/mokly-ai/mokly/blob/75bacb9d016205c804633b79ff0e8496c6c07929/plans/follow-ups/large-react-startup.md)
  targeted usable startup of large React catalogues. It closed on 2026-11-01,
  when large React startup measured about 3.7 s, cold and warm. This item
  concerns the first background renders after readiness.
- **Recommendation:** C. Pool-level acquisition removes the wait on a starting
  sidecar for every request while keeping on-demand startup. The record first
  recommended B.
- **Action:** fix after merge, apply C, because the pool scheduling change lies
  outside the pass scheduler that found the startup wait.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L93).
