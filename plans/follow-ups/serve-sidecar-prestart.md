# Start sidecars before the background pass

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #225 and its completed plan, one of the
  three follow-ups of its acceptance decision.
- **Location:** `crates/mokly-sidecar/src/pool.rs:75` and line 119, and
  `crates/mokly-cli/src/serve_pool.rs:49`.
- **Reason:** On 2026-10-28 the orchestrator accepted the missed targets of
  PR #225 and deferred the pre-start without choosing between its two
  approaches, because the startup cost lies in the sidecar pool.

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
    the pass begins. Effort: Medium (estimate).
  - **C.** Let a waiting render take the first sidecar that becomes ready,
    instead of a sidecar that still starts. Effort: Medium (estimate).
- **Left out:** A larger render window. The window already equals the
  sidecar count, and more renders would only queue.
- **Wider fix:** C (estimate). Every request, not only the pass, then avoids
  a wait for one starting sidecar.
- **Previous examples:** None found.
- **Related:**
  - [coalesce-stylesheet-bundles.md](./coalesce-stylesheet-bundles.md) and
    [coalesce-document-composition.md](./coalesce-document-composition.md)
    are the other two follow-ups of the same acceptance decision. Each
    removes a different part of the pass time.
  - [large-react-startup.md](./large-react-startup.md) targets the usable
    startup of large React catalogues, where JavaScript compilation takes
    most of the time. Both items touch Serve startup and the sidecar pool,
    but this item removes only the sidecar start wait of the first
    background renders. The work differs, so the items stay separate.
- **Recommendation:** B (estimate). PR #225 expected a gain of about 0.8 s
  for each pass from it.
- **Action:** ask the user, because condition 6 holds (estimate): this is a
  performance finding, and no recorded user choice selects an option.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L93).
