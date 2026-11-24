# A large variant set can miss its compare deadline

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Low. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-23, from the branch
  `calummoore/canvas-redesign-m12-right-panel-and-fo8u` (Milestone 12 of the
  Canvas redesign), the variant rows lifecycle.
- **Location:** `packages/viewer/src/shell/use_comparison.ts`,
  `packages/viewer/src/shell/comparison_row_lifecycle.ts`,
  `docs/protocol/mokly-selected-comparisons.md`
- **Reason:** Nobody has measured a large set yet, and the fix depends on the
  measurement.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Variant set:** a component on the canvas: one row for its own example
    and one row for each saved variant. Each row is its own catalogue entry.
  - **Selection:** Serve's on-demand comparison,
    `/mokly-viewer/diffs/selection?path={entry path}`. It captures the
    documents of one entry into one generation.
- **Background:** In Serve, each compared row of a variant set that the canvas
  shows requests its own selection, as `mokly-selected-comparisons.md` says.
  Serve captures different selections one at a time, with at most 32 pending
  requests and a 10-second deadline from admission to completion. A row whose
  request fails shows its own failure, with Try again, while the other rows
  still compare.
- **Problem:** A set with many changed rows queues one capture for each row.
  The last rows can wait past the 10-second deadline and fail, although
  nothing is wrong with them. A set with more than 32 compared rows also
  passes the pending-request limit.
- **Impact if no action:** A reader who compares a large changed variant set
  may see Try again on its last rows, and must press it to load them.
- **Root question:** How does every compared row of a large variant set load
  within the deadline?
- **Options:**
  - **A.** Measure a set of about 20 changed rows in Serve first, and change
    nothing if every row loads within the deadline. Effort: Small.
  - **B.** Request the rows in a bounded order, the shown rows nearest the
    stage first, and start each request only after the previous one ends, so
    no request waits in Serve's queue. Effort: Medium.
  - **C.** Let a component parent's selection capture its saved variants
    too, in one generation, which changes the Serve capture in Rust. Effort:
    Large.
- **Left out:** A longer deadline, because it hides a slow capture from every
  other request too.
- **Wider fix:** C, because one capture then serves the whole set.
- **Previous examples:** None found.
- **Recommendation:** A, then B or C only when the measurement shows failures.
  Someone must measure a set of about 20 rows before a fix is chosen.
- **Action:** ask the user, because no option is clearly best until a
  measurement shows whether the rows fail.
