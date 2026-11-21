# Warm restarts miss the render store for some large React documents

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the measurements of step 4 of the performance orchestrator, which merged as PR #408 (`cb233fb50`).
- **Location:** the render store in `crates/mokly-compare/src/render_store.rs`, `crates/mokly-compare/src/render_store_read.rs`, and `crates/mokly-compare/src/render_pending.rs`, its Serve runtime in `crates/mokly-cli/src/render_store_runtime.rs`, the store key in `crates/mokly-graph/src/document_store.rs`, and `docs/protocol/mokly-render-store.md`.
- **Reason:** The performance orchestrator found the misses in its step 4 data. It owns this work after its steps 1 and 4.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Render store:** the disk cache of rendered documents. `mokly serve` fills it after the first Changes and reads it on the next start. `docs/protocol/mokly-render-store.md` defines it.
  - **Warm restart:** a Serve start with a render store that an earlier Serve run filled, with no source change in between.
  - **Large React fixture:** the generated test catalogue under `tests/fixtures/large`, rendered with React.
- **Background:**
  - Since PR #394, Serve saves rendered documents in the render store, with a bound of 128 MiB. On the next start, it reuses each saved document whose key still matches.
  - On the large React fixture, a warm restart serves only about 83% of the documents from the render store, also on `main`. The other documents render again.
  - The saved inventory holds 6,006 keys in 41.4 MB, so it fits the bound. So the misses are not evictions for capacity.
  - Nobody has traced which documents miss, or why.
- **Problem:** About 17% of the documents of the large React fixture miss the render store on a warm restart, although the store has room for them.
- **Impact if no action:** A large catalogue renders about one sixth of its documents again on each restart, so the first Changes after a restart comes later than the render store allows.
- **Root question:** Why does a warm restart of the large React fixture not reuse about 17% of its saved documents?
- **Options:**
  - **A.** Change nothing, and accept the hit rate. Effort: Small.
  - **B.** Trace the misses first. For each missed document, record whether the earlier run saved its key, and compare the saved key with the restart key part by part. Then fix the named cause with a regression test, and measure the hit rate again. Effort: Medium.
- **Left out:** A larger bound: the inventory already fits, so it changes nothing. Fewer than three approaches exist, because the fix depends on the cause that the trace names.
- **Wider fix:** None yet, because the cause is unknown.
- **Previous examples:** None found.
- **Recommendation:** B. The trace names the cause, and the fix can then keep every reuse check.
- **Action:** fix after merge, apply B, because the performance orchestrator owns this work after its steps 1 and 4, and the trace changes no behaviour.
