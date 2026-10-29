# PostCSS request order varies between runs

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from the step A review round 2 of PR #228 and the
  step B review round 2 of PR #242.
- **Location:** `crates/mokly-graph/src/workers.rs`, where the render workers
  bundle the stylesheet roots of one preparation in parallel.
- **Reason:** Each choice changes the PostCSS contract or gives back part of
  the parallel gain of PR #228, so the user decides.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **PostCSS context:** one consumer PostCSS child process with its own
    plugin state, used for all stylesheets of one preparation attempt.
- **Background:** Since PR #228, graph preparation bundles its stylesheet
  roots in parallel on the render workers. The requests of one PostCSS
  context still reach the sidecar one at a time, but their order now
  depends on worker timing. The sidecar keeps cumulative read evidence for
  each context.
- **Problem:** A plugin that keeps state across the stylesheets of one
  context can emit different CSS between two runs. The protected-file
  diagnostic can name a different stylesheet between runs, because request
  order decides which roots list a local file that a plugin loads late. The
  cumulative module evidence of each result also depends on the order.
- **Impact if no action:** Equal inputs can give different output for such a
  plugin, and a diagnostic can change its text between runs. The output
  checks of `examples/basic` found no difference, because only one of its
  stylesheets uses Tailwind.
- **Options:**
  - **A.** State in the PostCSS contract that the request order within a
    context is not fixed, and that a plugin must not keep state across
    stylesheets. Make the protected-file diagnostic name the first
    stylesheet in root order. Effort: Small.
  - **B.** Fix the request order of each context: each root waits for its
    turn in root order, and the read inventories still overlap. It gives
    back part of the parallel gain. Decision 11 of the plan rejected a fixed
    request order for the generation key for that reason. Effort: Medium.
- **Wider fix:** B. A fixed order removes the class, but it costs the gain.
- **Previous examples:** Decision 11 of the stylesheet bundle performance
  plan made the generation key independent of the request order.
- **Recommendation:** A. It keeps the parallel gain and turns the open
  behaviour into a stated rule. B best protects output equality for a
  stateful plugin.
- **Action:** ask the user, because condition 1 holds: A adds a rule to the
  PostCSS contract that no recorded user decision covers.
