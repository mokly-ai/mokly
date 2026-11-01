# Coalesce concurrent fills of both render caches

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #225 and its completed plan, two follow-ups of its acceptance decision. The records were consolidated on 2026-11-01.
- **Location:** `crates/mokly-graph/src/session_render.rs:42`, `crates/mokly-render/src/stylesheet_cache.rs:54`, `:141`, and `:168`, and `crates/mokly-render/src/postcss_read_inventory.rs:19`.
- **Reason:** On 2026-10-28 the coordinating agent deferred both cache changes outside the pass scheduler of PR #225. One later branch owns their shared fix.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Document key:** the hash of the render inputs of one composed document, which identifies its render-cache entry.
  - **Stylesheet root:** one configured or component stylesheet that the render runtime bundles with its imports.
  - **Background pass:** Serve work after readiness that renders every view to fill the render cache and entry usage.
  - **Coalescing:** concurrent misses of one key share one pending operation instead of repeating that operation.
- **Background:**
  - PR #225, merged on 2026-10-28, renders the background pass in parallel.
  - The coordinating agent managed the performance pull requests of 2026-10-27 to 2026-10-29 and answered their decisions for the user.
  - It deferred document coalescing to a later branch and stylesheet coalescing to later stylesheet-bundle performance work, outside the pass scheduler.
  - `Session` reads the render cache by document key. On a miss it composes the document. Concurrent misses of one key can both compose it.
  - `GraphDocuments` in `crates/mokly-server` coalesces one document route. Different routes and links can still reach one document key.
  - Stylesheet `lookup` reads a record, and `bundle` bundles its root on a miss. Another request does not wait for that bundle.
  - On 2026-10-28, document-cache hits fell from 106 to 99 or 100 on `examples/basic`. React-fixture hits fell from 408 to 377 to 380.
  - The example pass bundled 14 stylesheets instead of the serial pass's 3. It repeated about 6 document compositions and 11 stylesheet bundles.
  - Those repeated operations cost about 0.2 s per example pass in total.
  - PR #227 later changed document-key construction. PR #228 bundled stylesheet roots in parallel during graph preparation. Both merged on 2026-10-28.
  - PR #242 shared module evidence across bundles on 2026-10-29. No later repeat count was recorded for either cache.
  - Graph preparation already bundles every stylesheet root into the render cache, at `crates/mokly-graph/src/graph.rs:123-139`.
  - The pass bundles a root again only after both caches miss, at `crates/mokly-graph/src/evaluation.rs:30-33`.
  - Stylesheet `deliver`, at `stylesheet_cache.rs:141`, replays a record's read evidence into each attempt. Sharing a bundle must preserve that replay.
- **Problem:** Concurrent misses can compose one document key or bundle one stylesheet root more than once.
- **Impact if no action:** Parallel passes can repeat document composition and PostCSS work. The recorded cost was small and predates later cache changes.
- **Root question:** How does each cache share concurrent work for one input without repeating it?
- **Options:**
  - **A.** Change no cache. Measure current repeat counts after PR #227, PR #228, and PR #242. Effort: Small.
  - **B.** Coalesce document-key misses in the graph session. The first request composes, and other requests wait for its artifact. Effort: Medium.
  - **C.** Measure both caches on current `main` first to record the baseline. Then use one shared coalescing helper for document keys and stylesheet roots. Preserve each attempt's read-evidence replay. Release waiters after an owner failure. The measurement is evidence, not a new gate or an approval step. Effort: Medium.
  - **D.** Coalesce stylesheet-root misses only. The first request bundles, and other requests wait for its record. Preserve read-evidence replay into each attempt. Effort: Medium.
- **Left out:** Rendering all documents before the pass restores the serial work that PR #225 replaced. Bundling all roots before the pass already happens since PR #228.
- **Wider fix:** C. One helper removes both repeated-work paths. It can reuse the pending-cell ownership pattern that ModuleDigests already uses.
- **Previous examples:** `GraphDocuments` coalesces document-route requests. `ModuleDigests` in `postcss_read_inventory.rs:19` shares a pending module digest and releases waiters if its owner fails.
- **Related:** [serve-sidecar-prestart.md](./serve-sidecar-prestart.md) removes the sidecar-start wait from the same pass. It has a different cause and fix.
- **Recommendation:** C. It removes both repeated-work paths through one owner while preserving output and evidence. The current measurement establishes its before value.
- **Action:** fix after merge, apply C, because PR #225 deferred the cache work outside its pass scheduler. Start with current repeat counts, then apply the shared fix in this one branch.

The original document record used A for no change, B for document-only coalescing, and C for the shared helper. It first recommended B. The stylesheet record used A for measurement, B for stylesheet-only coalescing, and C for the shared helper. It first recommended A. Its B is D above. The former measurement prerequisite came from that recommendation, not a user decision or a protocol requirement.

Historical source 1: [record at its source commit](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L100).

Historical source 2: [record at its source commit](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L98).
