# Move focus after a removed preview's Retry

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from branch `calummoore/preview-cannot-be-loaded-v2-oe8e`, the wider fix of the frame retry focus decision.
- **Location:** `packages/viewer/src/shell/canvas_removed.tsx` (`CanvasRemovedStage`), `packages/viewer/src/shell/preview_unavailable.tsx`, `packages/ui/src/empty-state/empty-state.tsx` (`EmptyState`).
- **Reason:** The recovery focus decision of 2026-11-20 named each Try again of the shell, and this recovery has the label Retry, so the branch left it out to keep the scope of that decision.

- **Source:** Design.
- **Category:** Product bug.
- **Terms:**
  - **Removed preview:** the stage of an entry that the branch removed. It loads the previous version of the entry from the comparison snapshots.
  - **Recovery focus rule:** the rule in the "Package And Props" section of `docs/protocol/mokly-viewer.md`. After Try again, focus moves to the status that replaces the button, and then to the content that replaces the status. It does not move when the reader moved focus in the meantime.
  - **RetryFocus:** the helper in `packages/viewer/src/shell/retry_focus.ts` that applies the rule. `retry` wraps the action, `status` is the ref of the status, and `content` is the ref of the content.
- **Background:**
  - When the previous version of a removed entry cannot load, the stage shows "Previous version unavailable" with a Retry button (`PREVIEW_UNAVAILABLE` in `packages/viewer/src/previews/copy.ts`).
  - Retry calls `preview.retry` of `useRemovedPreview`. The canvas then shows a busy `EmptyState`, "Loading previous version…" with `role="status"`, and then the section with the previous version's frames.
  - On 2026-11-20 the user chose one recovery focus rule for each Try again of the shell. The catalogue, the routed stage, the comparison, Props, Usage, and each preview frame follow it.
- **Problem:** After a keyboard user presses Retry, the button leaves the page, so focus falls back to the page body.
- **Impact if no action:** Keyboard and screen-reader users lose their place when they recover a removed entry's previous version.
- **Root question:** None. The recovery focus rule already gives the targets.
- **Options:**
  - **A.** In `CanvasRemovedStage`, use `useRetryFocus`. Wrap `preview.retry` with `retry`, give the busy `EmptyState` a `focusRef` for `status`, and give the first frame of the section the `content` ref. Add the row to the table of the rule. Effort: Small.
  - **B.** Leave the Retry out of the rule, and say so in `docs/protocol/mokly-viewer.md`. Effort: Small.
- **Left out:** Changing the label to Try again. The label is not the problem, and its copy has its own contract in `packages/viewer/src/previews/copy.ts`.
- **Wider fix:** A.
- **Previous examples:** The routed stage's Try again in `packages/viewer/src/shell/stage_delivery.tsx` and `packages/viewer/src/shell/stages.tsx`.
- **Recommendation:** A. It gives the last recovery of the stage the same focus as the others.
- **Action:** fix after merge.
