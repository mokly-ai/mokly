# Gestures spec comment says the viewport stays

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the review of branch
  `calummoore/flaky-app-settings-escape-before-dialog-8plh`, which does not
  change this spec.
- **Location:** `packages/app/src/_tests_/settings/gestures.spec.ts:183` to
  line 185.
- **Reason:** The review found it outside the diff, and the review rules
  fix such a problem in its own branch.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **`openDialogInApp`:** the browser-spec helper in
    `packages/app/src/_tests_/settings/in-app.ts`. It opens the settings
    dialog by a step inside the app: it narrows the window to 390 px, opens
    the settings index, chooses a pane, and widens the window to 1440 px.
- **Background:** In `gestures.spec.ts`, the spec
  `a second draft after an exit is defended like the first` opens the
  dialog twice with `openDialogInApp`. Before the second open, a comment says "The same
  surface again, without touching the viewport".
- **Problem:** `openDialogInApp` always narrows and widens the window, so
  the second open does touch the viewport. The comment says the opposite
  of what the step does.
- **Impact if no action:** A reader of the spec can think that it proves
  the guard without a viewport change, and can rely on that in a later
  change.
- **Root question:** What does the spec's comment say about the second
  open?
- **Options:**
  - **A.** Reword the comment: the second open takes the same way into the
    dialog as the first. Effort: Small.
  - **B.** Make the second open keep the viewport, for example through a
    rail click or the settings index at the wide width, and keep the
    comment. It changes what the spec checks. Effort: Small.
- **Left out:** Deleting the comment, because the spec then does not say
  why it opens the dialog a second time. A is better on every point.
- **Wider fix:** None. It is one comment.
- **Previous examples:** None found.
- **Recommendation:** A. It makes the comment true and keeps the spec's
  checks.
- **Action:** fix after merge, apply A, because the review rules fix a
  problem outside the diff in its own branch.
