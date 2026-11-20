# Check that each shipped state has a mockup

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from branch `calummoore/preview-cannot-be-loaded-fov6`, the blocked wider fix of review finding 2.
- **Location:** `packages/ui/src/preview-state/preview-state.tsx`, `examples/basic/specs/design`, and `tests/design_catalogue.test.ts`.
- **Reason:** The fix is a test for a class of defect, and such a test needs the user's approval.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Stage failure:** the shipped state "This screen could not be shown", drawn by `StageFailure` in `packages/ui/src/preview-state/preview-state.tsx` when an entry's details fail to load.
  - **Design catalogue:** the mockups of Mokly's own screens under `examples/basic/specs/design`.
- **Background:**
  - The design catalogue shows each shipped screen state. `design/browse/appearance/status/error` is the only screen that shows the stage failure.
  - A branch replaced that screen with another failure state by mistake. The review found it, and the branch restored the screen.
- **Problem:** No check notices when a change removes the only mockup of a shipped state.
- **Impact if no action:** A later change can delete the depiction of a shipped state, and only a review can catch it.
- **Root question:** How does the repository notice that a shipped state lost its only mockup?
- **Options:**
  - **A.** Change nothing. Rely on review. Effort: Small.
  - **B.** Add a check that each state component of `@mokly/ui`, such as `StageFailure`, has at least one design screen that renders it. Effort: Medium.
  - **C.** Build each design screen of a shipped state from the shipped component, not from copied text, so that a removal shows in the component's consumers. Effort: Medium.
- **Left out:** None.
- **Wider fix:** B. It detects the class; no structural fix stops a deletion.
- **Previous examples:** None found.
- **Recommendation:** C. It also stops copy drift, and it needs no new gate.
- **Action:** ask the user, because B adds a new gate and C changes how every state mockup is built.
