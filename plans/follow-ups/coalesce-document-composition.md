# Coalesce concurrent composition of one document key

- **Severity:** Low (estimate). **Effort:** Medium (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #225 and its completed plan, one of the
  three follow-ups of its acceptance decision.
- **Location:** `crates/mokly-graph/src/session_render.rs:42`.
- **Reason:** On 2026-10-28 the orchestrator deferred this to a later branch
  without an approved option, because it lay outside the pass scheduler of
  PR #225.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Document key:** the hash of the render inputs of one composed
    document. The render cache stores each composed document under it.
  - **Background pass:** the work of Serve after readiness that renders every
    view, to fill the render cache and the usage of every entry detail.
  - **Orchestrator:** the agent that coordinated the performance pull
    requests of 2026-10-27 to 2026-10-29 and answered their decisions for
    the user.
- **Background:**
  - PR #225, merged on 2026-10-28, renders the background pass in parallel.
  - `Session` in `crates/mokly-graph/src/session_render.rs:42` reads the
    render cache by document key. On a miss it composes the document. Two
    concurrent misses of one key both compose it.
  - `GraphDocuments` in `crates/mokly-server` coalesces requests for the same
    route, but different routes and links can reach one document key.
  - PR #225 measured the cost on 2026-10-28. Cache hits fell from 106 to 99
    or 100 on `examples/basic`, and from 408 to 377 to 380 on the React
    fixture. Concurrent misses repeated about 6 document compositions and
    11 stylesheet bundles for each example pass, about 0.2 s of work in
    total.
- **Problem:** Concurrent work can compose the same document key more than
  once.
- **Impact if no action:** Each parallel pass repeats some compositions. The
  measured cost was small.
- **Root question:** How does one document key compose once when several
  renders need it at the same time?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Coalesce concurrent misses of one document key in the graph
    session. The first miss composes, and the other requests wait for its
    artifact. Effort: Medium (estimate).
  - **C.** Share one in-flight map between document keys and stylesheet
    roots, so that both caches coalesce through one helper. Effort: Medium
    (estimate).
- **Left out:** Rendering every document before the pass. It repeats the
  serial pass that PR #225 replaced.
- **Wider fix:** C (estimate). One helper removes the repeated work of both
  caches.
- **Previous examples:** `GraphDocuments` in `crates/mokly-server` already
  coalesces requests for the same document route.
- **Related:**
  - [coalesce-stylesheet-bundles.md](./coalesce-stylesheet-bundles.md) has
    the same cause in the stylesheet cache and the same wider fix.
  - [serve-sidecar-prestart.md](./serve-sidecar-prestart.md) is the third
    follow-up of the same acceptance decision.
- **Recommendation:** B (estimate). It removes the repeated compositions in
  the one place that composes them. C best protects the codebase.
- **Action:** ask the user, because condition 6 holds (estimate): this is a
  performance finding, and no recorded user choice selects an option.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L100).
