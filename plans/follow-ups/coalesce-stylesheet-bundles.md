# Coalesce concurrent bundles of one stylesheet root

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #225 and its completed plan, one of the
  three follow-ups of its acceptance decision.
- **Location:** `crates/mokly-render/src/stylesheet_cache.rs:54` and line 168.
- **Reason:** On 2026-10-28 the orchestrator deferred this to the stylesheet
  bundle performance work without an approved option, because the stylesheet
  cache lay outside the pass scheduler of PR #225.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Stylesheet root:** one configured or component stylesheet that the
    render runtime bundles with its imports into one CSS output.
  - **Background pass:** the work of Serve after readiness that renders every
    view, to fill the render cache and the usage of every entry detail.
  - **Orchestrator:** the agent that coordinated the performance pull
    requests of 2026-10-27 to 2026-10-29 and answered their decisions for
    the user.
- **Background:**
  - PR #225, merged on 2026-10-28, renders the background pass in parallel.
    Several views can then miss the stylesheet cache for the same root at
    the same time.
  - `lookup` in `crates/mokly-render/src/stylesheet_cache.rs:54` reads a
    record, and `bundle` at line 168 bundles the root on a miss. Nothing
    makes a second request wait for a bundle in flight.
  - PR #225 measured the pass on `examples/basic` on 2026-10-28. The
    parallel pass bundled 14 stylesheets where the serial pass bundled 3.
    Concurrent misses repeated about 11 stylesheet bundles and 6 document
    compositions for each pass, about 0.2 s of work in total.
  - PR #228 bundles the stylesheet roots in parallel during graph
    preparation, and PR #242 shares module evidence across bundles. They
    merged on 2026-10-28 and 2026-10-29. No measurement of the repeat count
    after both of them was recorded.
  - Graph preparation bundles every stylesheet root and stores its CSS in
    the render cache, at `crates/mokly-graph/src/graph.rs:123-139`. The pass
    bundles a root again only after a render-cache miss and a
    stylesheet-store miss, at `crates/mokly-graph/src/evaluation.rs:30-33`.
- **Problem:** Concurrent misses for one stylesheet root can bundle it more
  than once.
- **Impact if no action:** Each pass can repeat stylesheet bundles and their
  PostCSS work. The measured cost was small, about 0.2 s with the document
  repeats.
- **Root question:** How does one stylesheet root bundle once when several
  renders need it at the same time?
- **Options:**
  - **A.** Change nothing. Measure the repeat count again after PR #228 and
    PR #242 first. Effort: Small.
  - **B.** Coalesce concurrent misses of one root in the stylesheet cache.
    The first miss bundles, and the other requests wait for its record.
    Effort: Medium.
  - **C.** Share one in-flight map between stylesheet roots and document
    keys, so that both caches coalesce through one helper. Effort: Medium.
- **Left out:** Bundling every root before the pass. Graph preparation
  already bundles the roots in parallel since PR #228.
- **Wider fix:** C. One helper removes the repeated work of both
  caches.
- **Previous examples:** `GraphDocuments` in `crates/mokly-server` already
  coalesces requests for the same document route.
- **Related:**
  - [coalesce-document-composition.md](./coalesce-document-composition.md)
    has the same cause in the document cache and the same wider fix.
  - [serve-sidecar-prestart.md](./serve-sidecar-prestart.md) is the third
    follow-up of the same acceptance decision.
- **Recommendation:** A. The measured cost is small, and no
  count after PR #228 and PR #242 exists, so a new measurement must show the
  need first.
- **Action:** fix after merge, apply A, because no repeat count after PR #228
  and PR #242 exists. Measure before choosing a cache change.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L98).
