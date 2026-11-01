# Comparison errors ignore the reason that Serve sends

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch `calummoore/mokly-viewer-responsibilities`: the viewer investigation and the options check of its plan.
- **Location:** `packages/viewer/src/shell/comparison_request.ts:168-182` and `packages/viewer/src/shell/use_comparison.ts:200-207`.
- **Reason:** Each fix that shows a reason changes text that the reader sees, and no protocol doc states that text.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Serve:** the `mokly serve` development server. It prepares a
    comparison on request, through `/mokly-viewer/diffs/selection`.
- **Background:**
  - When Serve cannot prepare a comparison, it answers with a JSON body
    `{ code, message }`, in `crates/mokly-server/src/response.rs:52-55`. For
    example, `comparison-unavailable` comes with "The comparison is
    unavailable. Try again.", in `crates/mokly-server/src/comparison_routes.rs:65-71`.
    A missing file comes with "The requested file was not found.", in
    `crates/mokly-server/src/response.rs:57-63`.
  - No protocol doc states this body or its text.
  - The standalone shell shows the error message in the comparison failure,
    through `packages/viewer/src/shell/use_comparison.ts:200-207`. With an
    embedded host's error reporter, it always shows "Comparison unavailable".
- **Problem:** `failureDetails` reads a `details` field, which Serve never
  sends. So the shell always shows its fallback "Comparison unavailable". The
  unit test sends `{ details }`, in
  `packages/viewer/tests/comparison_request.test.ts:129-131`, so it does not
  find the mismatch. The viewer also uses a second sentence for the same
  failure, "The comparison is unavailable.", in
  `packages/viewer/src/shell/comparison_documents.ts:11`.
- **Impact if no action:** The reader sees a short generic text, and the
  code keeps a read that never matches.
- **Root question:** What should the shell tell the reader when Serve cannot
  prepare a comparison?
- **Options:**
  - **A.** Read `message`, and give the unit test the body that Serve sends.
    The reader then sees server text, also "The requested file was not
    found.". Effort: Small.
  - **B.** A, with the error body type moved into the Rust model crate and
    generated for the viewer. Effort: Small.
  - **C.** Keep today's text, and delete the read of `details`. No visible
    change. Effort: Small.
  - **D.** Map Serve's `code` to one sentence that the viewer owns, also for
    the second sentence of the same failure. The protocol page of the
    comparison routes then lists the codes. Effort: Small.
- **Left out:** None.
- **Wider fix:** D, because the viewer then owns all failure text and reads
  only a stable code.
- **Previous examples:** None found.
- **Related:** None.
- **Recommendation:** D. One sentence that the viewer owns fits each code and
  removes the second text for the same failure.
- **Action:** ask the user, because each option except C changes text that
  the reader sees, and no protocol doc states that text.
