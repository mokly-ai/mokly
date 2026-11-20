# The start retry keeps a second focus path

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from branch `calummoore/preview-cannot-be-loaded-v2-oe8e`, review finding 14.
- **Location:** `packages/viewer/src/shell/component_controls.tsx` (`restart`), `packages/viewer/src/shell/focus_after.ts` (the fallback when a focused named element leaves), `packages/viewer/src/shell/retry_focus.ts` (`useNamedRetryContent`).
- **Reason:** The review that found it ran after the two fix rounds of the branch, so the fix rule gives it a follow-up item.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **FocusAfter:** the helper in `packages/viewer/src/shell/focus_after.ts` that focuses a named element after a recovery action of the component controls, such as Reset.
  - **RetryFocus:** the helper in `packages/viewer/src/shell/retry_focus.ts` that applies the recovery focus rule of `docs/protocol/mokly-viewer.md`: the status after Try again, then the content.
  - **Start retry:** the Try again of the component controls when live editing could not start ("Editing could not start.").
- **Background:**
  - The start retry asks FocusAfter for the "Preparing to edit props…" notice. When the focused notice leaves, the FocusAfter fallback focuses the panel heading. That is the status-then-content rule.
  - Every other Try again of the shell uses RetryFocus. The Props tab's RetryFocus already offers the panel heading as content through `useNamedRetryContent`.
  - The user's choice of 2026-11-20 said to apply the rule through one shared viewer helper.
- **Problem:** Two mechanisms apply one rule, so a change to the rule must be made twice.
- **Impact if no action:** The start retry can drift from the rule.
- **Root question:** How does every Try again of the shell reach the recovery focus rule through one helper?
- **Options:**
  - **A.** Keep both, and say in `packages/viewer/src/shell/README.md` that FocusAfter applies the rule for the start retry. Effort: Small.
  - **B.** Wrap `start.retry` with the Props tab's `RetryFocus.retry`, and map the "notice" ref to its `status`. The panel heading is already on the page when the notice leaves, so `RetryFocus` must then focus content that was attached before the status left. Delete the FocusAfter fallback only if no other named element needs it: check Reset and Switch to Current first. Effort: Small.
  - **C.** Merge FocusAfter and RetryFocus into one helper for every recovery action of the shell, also Reset, Update preview, and Switch to Current. Effort: Medium.
- **Left out:** None.
- **Wider fix:** C.
- **Previous examples:** `f08d02dfb` "refactor(viewer): remove the viewer's leftover layers (#281)".
- **Recommendation:** B.
- **Action:** fix after merge.
