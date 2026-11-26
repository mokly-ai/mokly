# The app's content list choice has no caller

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from branch calummoore/click-on-row-ux-0nhj, review round 2.
- **Location:** `packages/app/src/components/controls.tsx:173-181`.
- **Reason:** No app caller used the choice before the branch that found it, and its future depends on the open Share choice decision.
- **Category:** Dead code.

- **Terms:**
  - **Content list:** `ContentList` in `controls.tsx`, the app's shared record rows, such as the settings index and the Access pane.
  - **Choice:** a row whose only action is a quiet button, given by `onChoose` and `action`.
- **Background:** `ContentList` draws a quiet Action at a row's end when the row has `onChoose`. No caller in `packages/app/src` passes `onChoose` to `ContentList`. The only choice rows in the app are Share's, and they use `PanelList`. The drawings' content list has a Choice variant in `docs/mockups/src/components/content-list.tsx`.
- **Problem:** The app keeps a choice form in `ContentList` that the product never draws.
- **Impact if no action:** The component carries a form that no screen tests, beside the open question of how a choice row looks.
- **Root question:** Does the app's content list keep a choice form that no screen uses?
- **Options:**
  - **A.** Remove the choice branch from `ContentList` and the choice case from its row type, after `plans/follow-ups/share-choice-rows-break-row-rule.md` is answered. Effort: Small.
  - **B.** Keep it, and give it the form that the Share decision chooses. Effort: Small.
- **Left out:** Remove it now. The Share decision can give the content list a choice form, so the removal can be undone the same week.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/share-choice-rows-break-row-rule.md`, work that waits for its answer.
- **Recommendation:** A, unless the Share decision gives record lists a choice.
- **Action:** fix after merge, apply A, because the choice's form waits for the Share decision.
