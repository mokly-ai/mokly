# PostCSS request order varies between runs

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from the step A review round 2 of PR #228 and the
  step B review round 2 of PR #242.
- **Location:** `crates/mokly-graph/src/workers.rs:171`, where the render
  workers bundle the stylesheet roots of one preparation in parallel.
- **Reason:** Each choice changes the PostCSS contract or gives back part of
  the parallel gain of PR #228, so the user decides.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **PostCSS context:** one consumer PostCSS child process with its own
    plugin state, used for all stylesheets of one preparation attempt.
  - **Protected-file diagnostic:** the error that names a stylesheet whose
    PostCSS plugin read a protected local file.
  - **Orchestrator:** the agent that coordinated the performance pull
    requests of 2026-10-27 to 2026-10-29 and answered their decisions for
    the user.
- **Background:** Since PR #228, graph preparation bundles its stylesheet
  roots in parallel on the render workers. The requests of one PostCSS
  context still reach the sidecar one at a time, but their order now
  depends on worker timing. The sidecar keeps cumulative read evidence for
  each context. On 2026-10-28 the orchestrator made the generation key
  independent of this order: it hashes the output key of each resource in
  place of its input key. It rejected a fixed request order for that key,
  because the order removes much of the parallel gain.
- **Problem:** A plugin that keeps state across the stylesheets of one
  context can emit different CSS between two runs. The protected-file
  diagnostic can name a different stylesheet between runs, because request
  order decides which roots list a local file that a plugin loads late. The
  cumulative module evidence of each result also depends on the order.
- **Impact if no action:** Equal inputs can give different output for such a
  plugin, and a diagnostic can change its text between runs. The output
  checks of `examples/basic` found no difference, because only one of its
  stylesheets uses Tailwind.
- **Root question:** How should Mokly make PostCSS output and diagnostics
  predictable across parallel runs?
- **Options:**
  - **A.** State in the PostCSS contract that the request order within a
    context is not fixed, and that a plugin must not keep state across
    stylesheets. Make the protected-file diagnostic name the first
    stylesheet in root order. Effort: Small (estimate).
  - **B.** Fix the request order of each context: each root waits for its
    turn in root order, and the read inventories still overlap. It gives
    back part of the parallel gain, which the orchestrator rejected for the
    generation key on 2026-10-28 for that reason. Effort: Medium
    (estimate).
  - **C.** Apply A. Also give each result of a context the evidence of the
    whole context, so that the cumulative module evidence does not depend
    on the order. Effort: Medium (estimate).
- **Left out:** A separate PostCSS process for each stylesheet loses shared
  plugin and module evidence.
- **Wider fix:** B. A fixed order removes the class, but it costs the gain.
- **Previous examples:** On 2026-10-28 the orchestrator made the generation
  key independent of the request order, for the same parallel bundling.
- **Recommendation:** A (estimate). It keeps the parallel gain and turns the
  open behaviour into a stated rule. B best protects output equality for a
  stateful plugin.
- **Action:** ask the user, because condition 1 holds (estimate): A adds a
  rule to the PostCSS contract that no recorded user decision covers.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/ee7d8ea739bd103aacd001f8e75e5aa144929348/plans/stylesheet-bundle-performance.md?plain=1#L632).
