# Count kept head views in the comparison trace

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from the head validation cut (B2) of branch
  `calummoore/mokly-edit-background-render-olos`.
- **Location:** `crates/mokly-compare/src/comparison_reuse.rs:120` (the fields
  of the `review.compare-views` span), `crates/mokly-compare/src/comparison_reuse.rs:41`
  (`validation_documents` in the collection work), and
  `crates/mokly-cli/src/serve_trace_fields.rs:116` (the mapping of the span
  fields to camel-case timing record fields).
- **Reason:** A design call of 2026-11-22 on that branch kept the existing
  `validationDocuments` count for its pull request, because an existing test
  requires it, and left a separate counter for later.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Kept head view:** a view whose head validation Serve builds from kept
    outputs without a document fetch, after its proof passes.
  - **`review.compare-views`:** the timing span of the view comparisons of one
    Changes classification. Its end record carries the reuse counts.
- **Background:**
  - The `review.compare-views` end record counts `validationDocuments`,
    `validationReused`, and `validationWalks`. Since the head validation cut of
    2026-11-22, a kept head view counts once in `validationDocuments` and once
    in `validationReused`, like a view that was fetched and whose closure facts
    were reused.
  - An existing test,
    `unchanged_head_reuses_closures_and_checks_each_document_only_once`,
    requires `validation_documents == 4`, so the count did not change.
  - So the timing records cannot tell a kept view from a fetched view. Only the
    span durations show the effect of the cut.
- **Problem:** No timing record counts the views that skipped their document
  fetch.
- **Impact if no action:** Measurements of Serve edits cannot confirm from the
  records how many views took the kept path, so a lost proof is visible only
  as a slower span.
- **Root question:** How can a timing record show how many head views took the
  kept path?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Add a `validationKept` count to the collection work and to the
    `review.compare-views` fields, and map it in
    `crates/mokly-cli/src/serve_trace_fields.rs`. A test of the trace mapping
    checks the new field. Effort: Small.
  - **C.** Replace `validationDocuments` with separate fetched and kept counts.
    This changes the existing test and the meaning of a field that
    measurements read. Effort: Small.
- **Left out:** None.
- **Wider fix:** None. This is one count.
- **Previous examples:** PR #466 added the `validation*` counts.
- **Recommendation:** B. It adds the missing count and keeps the existing
  fields and their meaning.
- **Action:** fix after merge, apply B, because it changes only diagnostics,
  and the first pull request keeps its scope.
